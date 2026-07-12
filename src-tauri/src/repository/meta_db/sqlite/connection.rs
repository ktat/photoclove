//! SQLite struct definition, initialization and per-operation connection
//! opening.

use super::date_summary;
use crate::repository::meta_db::migrations;
use crate::value::date;
use rusqlite::{params, Connection, Result};

#[derive(Clone)]
pub struct SQLite {
    pub(super) db_path: String,
}

impl SQLite {
    pub fn new(path: String) -> SQLite {
        let sqlite = SQLite {
            db_path: path + "/photoclove.db",
        };

        if let Err(e) = sqlite.init_db() {
            log::error!(target: "sqlite", "db_init_error; error={}", e);
        }

        // Validate date_summary currency on startup
        if date_summary::check_date_summary_currency(&sqlite).is_err() {
            log::info!(target: "date_summary", "startup_validation; status=failed; action=rebuilding");
            let _ = date_summary::rebuild_date_summary(&sqlite);
        }

        sqlite
    }

    pub fn init_db(&self) -> Result<()> {
        let conn = self.get_connection()?;
        migrations::run_migrations(&conn)?;

        // Populate date_summary if it's empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM date_summary", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 {
            log::info!(target: "date_summary", "initial_population; status=populating");
            let now = date::DateTime::now().to_db_string();
            conn.execute(
                "INSERT INTO date_summary (date, photo_count, created_at, updated_at)
                 SELECT date(photo_date) as date_only, COUNT(*) as count, ? as created_at, ? as updated_at
                 FROM photo_metadata
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                 GROUP BY date(photo_date)",
                params![now, now],
            )?;
            log::info!(target: "date_summary", "initial_population; status=completed");
        }

        Ok(())
    }

    pub fn get_connection(&self) -> Result<Connection> {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&self.db_path).parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                        Some(format!(
                            "Failed to create directory '{}': {}",
                            parent.display(),
                            e
                        )),
                    )
                })?;
            }
        }
        let conn = Connection::open(&self.db_path)?;
        // WAL lets background jobs (import, face detection, thumbnails) write
        // while UI commands read on their own connections; busy_timeout makes
        // concurrent writers wait instead of failing with SQLITE_BUSY.
        // NORMAL sync is durable enough under WAL and avoids per-commit fsync.
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        Ok(conn)
    }

    /// Get the database path
    pub fn db_path(&self) -> &str {
        &self.db_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_connection_sets_wal_and_busy_timeout() {
        let dir = std::env::temp_dir().join("photoclove_sqlite_pragma_test");
        std::fs::create_dir_all(&dir).unwrap();
        let sqlite = SQLite::new(dir.to_str().unwrap().to_string());

        let conn = sqlite.get_connection().unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            journal_mode.to_lowercase(),
            "wal",
            "background jobs must be able to write while the UI reads"
        );

        let busy_timeout: i64 = conn
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .unwrap();
        assert!(
            busy_timeout >= 5000,
            "concurrent writers should wait instead of failing with SQLITE_BUSY (got {})",
            busy_timeout
        );
    }
}
