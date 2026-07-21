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
            if let Err(e) = date_summary::rebuild_date_summary(&sqlite) {
                log::error!(target: "date_summary", "rebuild_failed; error={}", e);
            }
        }

        sqlite
    }

    pub fn init_db(&self) -> Result<()> {
        let conn = self.get_connection()?;

        // Keep the DB in rollback-journal mode. The photo library (and this
        // DB with it) commonly lives on a NAS, and WAL over NFS is both
        // unsupported by SQLite and ~3x slower per connection open (WAL-index
        // locks become network round-trips). journal_mode is persistent, so
        // this also converts back any DB that a previous build switched to
        // WAL. Runs once at startup.
        conn.pragma_update(None, "journal_mode", "DELETE")?;

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
        // busy_timeout makes a connection that hits a concurrent writer wait
        // instead of failing immediately with SQLITE_BUSY (UI reads vs
        // background job writes). Deliberately NOT WAL: see init_db.
        conn.pragma_update(None, "busy_timeout", 5000)?;
        Ok(conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_connection_sets_busy_timeout_without_wal() {
        let dir = std::env::temp_dir().join("photoclove_sqlite_pragma_test");
        std::fs::create_dir_all(&dir).unwrap();
        let sqlite = SQLite::new(dir.to_str().unwrap().to_string());

        let conn = sqlite.get_connection().unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        // The library (and its DB) often lives on a NAS: WAL over NFS costs
        // ~90ms of lock round-trips per connection open and is unsupported
        // by SQLite on network filesystems, so the DB must stay in rollback
        // journal mode.
        assert_eq!(
            journal_mode.to_lowercase(),
            "delete",
            "WAL must not be used: the photo library DB may live on NFS"
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

    #[test]
    fn test_init_db_converts_wal_database_back_to_delete() {
        let dir = std::env::temp_dir().join("photoclove_sqlite_wal_revert_test");
        std::fs::create_dir_all(&dir).unwrap();
        let db_file = dir.join("photoclove.db");
        if db_file.exists() {
            std::fs::remove_file(&db_file).unwrap();
        }

        // Simulate a DB left in WAL mode by the earlier WAL experiment
        {
            let conn = Connection::open(&db_file).unwrap();
            conn.pragma_update(None, "journal_mode", "WAL").unwrap();
        }

        let sqlite = SQLite::new(dir.to_str().unwrap().to_string());
        let conn = sqlite.get_connection().unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal_mode.to_lowercase(), "delete");
    }
}
