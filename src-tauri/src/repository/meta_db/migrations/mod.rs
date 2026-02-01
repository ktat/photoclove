use crate::value::date;
use rusqlite::{params, Connection, Result};

/// Migration definition
struct Migration {
    version: i32,
    name: &'static str,
    sql: &'static str,
}

/// All migrations in order
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial_schema",
        sql: include_str!("001_initial_schema.sql"),
    },
    Migration {
        version: 2,
        name: "create_date_summary",
        sql: include_str!("002_create_date_summary.sql"),
    },
    Migration {
        version: 3,
        name: "create_collections",
        sql: include_str!("003_create_collections.sql"),
    },
    Migration {
        version: 4,
        name: "create_job_queue",
        sql: include_str!("004_create_job_queue.sql"),
    },
    Migration {
        version: 5,
        name: "create_recovery_queue",
        sql: include_str!("005_create_recovery_queue.sql"),
    },
    Migration {
        version: 6,
        name: "create_burst_groups",
        sql: include_str!("006_create_burst_groups.sql"),
    },
    Migration {
        version: 7,
        name: "add_storage_sync",
        sql: include_str!("007_add_storage_sync.sql"),
    },
    Migration {
        version: 8,
        name: "create_face_detection",
        sql: include_str!("008_create_face_detection.sql"),
    },
    Migration {
        version: 9,
        name: "fix_face_detection_fk",
        sql: include_str!("009_fix_face_detection_fk.sql"),
    },
    Migration {
        version: 10,
        name: "add_photo_id_and_face_mapping",
        sql: include_str!("010_add_photo_id_and_face_mapping.sql"),
    },
    Migration {
        version: 11,
        name: "add_job_processed_count",
        sql: include_str!("011_add_job_processed_count.sql"),
    },
    Migration {
        version: 12,
        name: "add_job_last_processed_id",
        sql: include_str!("012_add_job_last_processed_id.sql"),
    },
    Migration {
        version: 13,
        name: "create_achievements",
        sql: include_str!("013_create_achievements.sql"),
    },
    Migration {
        version: 14,
        name: "add_achievement_hash",
        sql: include_str!("014_add_achievement_hash.sql"),
    },
];

/// Initialize the migrations table
fn init_migrations_table(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

/// Check if a migration has been applied
fn is_migration_applied(conn: &Connection, version: i32) -> Result<bool> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM _migrations WHERE version = ?",
        params![version],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Mark a migration as applied
fn mark_migration_applied(conn: &Connection, version: i32, name: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO _migrations (version, name) VALUES (?, ?)",
        params![version, name],
    )?;
    Ok(())
}

/// Run all pending migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Initialize migrations table
    init_migrations_table(conn)?;

    // Check if we need to handle legacy database migration
    handle_legacy_migrations(conn)?;

    // Run migrations
    for migration in MIGRATIONS {
        if is_migration_applied(conn, migration.version)? {
            continue;
        }

        // Special handling for migrations that add columns which might already exist
        // (e.g., from migration 001 which now includes these columns for fresh DBs)
        match migration.version {
            7 => {
                // Migration 7 adds storage_sync column
                if has_column(conn, "storage_sync") {
                    log::info!(target: "migrations", "skipping_migration; version=7; reason=column_already_exists");
                    mark_migration_applied(conn, 7, "add_storage_sync (column exists)")?;
                    continue;
                }
            }
            10 => {
                // Migration 10 assumes burst_group_id and storage_sync exist
                // Ensure they exist before running this migration
                if table_exists(conn) {
                    if !has_column(conn, "burst_group_id") {
                        log::info!(target: "migrations", "adding_burst_group_id_before_migration_10");
                        conn.execute(
                            "ALTER TABLE photo_metadata ADD COLUMN burst_group_id TEXT",
                            [],
                        )?;
                    }
                    if !has_column(conn, "storage_sync") {
                        log::info!(target: "migrations", "adding_storage_sync_before_migration_10");
                        conn.execute(
                            "ALTER TABLE photo_metadata ADD COLUMN storage_sync TEXT DEFAULT NULL",
                            [],
                        )?;
                    }
                }
            }
            _ => {}
        }

        log::info!(target: "migrations", "applying_migration; version={}; name={}", migration.version, migration.name);

        // Split and execute SQL statements
        for statement in migration.sql.split(';') {
            let statement = statement.trim();
            if !statement.is_empty() {
                conn.execute(statement, [])?;
            }
        }

        mark_migration_applied(conn, migration.version, migration.name)?;
        log::info!(target: "migrations", "migration_applied; version={}; name={}", migration.version, migration.name);
    }

    // Ensure indexes exist (for any edge cases)
    ensure_column_indexes(conn)?;

    Ok(())
}

/// Ensure indexes exist for burst_group_id and storage_sync columns
fn ensure_column_indexes(conn: &Connection) -> Result<()> {
    if table_exists(conn) {
        if has_column(conn, "burst_group_id") {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_burst_group_id ON photo_metadata(burst_group_id)",
                [],
            )?;
        }
        if has_column(conn, "storage_sync") {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_storage_sync ON photo_metadata(storage_sync)",
                [],
            )?;
        }
    }
    Ok(())
}

/// Check if photo_metadata table exists
fn table_exists(conn: &Connection) -> bool {
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photo_metadata'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)))
        .unwrap_or(false)
}

/// Check if a column exists in photo_metadata table
fn has_column(conn: &Connection, column_name: &str) -> bool {
    conn.prepare("PRAGMA table_info(photo_metadata)")
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| {
                let name: String = row.get(1)?;
                Ok(name)
            })?;
            for row in rows {
                if let Ok(name) = row {
                    if name == column_name {
                        return Ok(true);
                    }
                }
            }
            Ok(false)
        })
        .unwrap_or(false)
}


/// Handle legacy database migrations (from old schema without migrations table)
fn handle_legacy_migrations(conn: &Connection) -> Result<()> {
    // Check if photo_metadata table exists with old schema
    let table_exists = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photo_metadata'")
        .and_then(|mut stmt| {
            stmt.query_row([], |row| {
                let _name: String = row.get(0)?;
                Ok(true)
            })
        })
        .unwrap_or(false);

    if !table_exists {
        // New database - nothing to migrate
        return Ok(());
    }

    // Check for old 'date' column (needs migration from very old schema)
    let mut has_old_date_column = false;
    let mut has_new_photo_date_column = false;
    let mut has_created_at = false;
    let mut has_exif_iso = false;
    let mut has_css_style = false;
    let mut has_delete_flg = false;

    if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(photo_metadata)") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let column_name: String = row.get(1)?;
            Ok(column_name)
        }) {
            for row in rows {
                if let Ok(column_name) = row {
                    match column_name.as_str() {
                        "date" => has_old_date_column = true,
                        "photo_date" => has_new_photo_date_column = true,
                        "created_at" => has_created_at = true,
                        "exif_iso" => has_exif_iso = true,
                        "css_style" => has_css_style = true,
                        "delete_flg" => has_delete_flg = true,
                        _ => {}
                    }
                }
            }
        }
    }

    // If we have old schema, migrate it
    if has_old_date_column
        || (!has_created_at && has_new_photo_date_column)
        || !has_exif_iso
        || !has_css_style
        || !has_delete_flg
    {
        log::info!(target: "migrations", "legacy_migration; status=migrating_old_schema");
        migrate_legacy_schema(
            conn,
            has_old_date_column,
            has_new_photo_date_column,
            has_created_at,
            has_exif_iso,
            has_css_style,
            has_delete_flg,
        )?;

        // Mark migration 1 as applied since we migrated the schema
        if !is_migration_applied(conn, 1)? {
            mark_migration_applied(conn, 1, "initial_schema (legacy migration)")?;
        }
    }

    Ok(())
}

/// Migrate from legacy schema to current schema
fn migrate_legacy_schema(
    conn: &Connection,
    has_old_date: bool,
    has_new_photo_date: bool,
    has_created_at: bool,
    has_exif_iso: bool,
    has_css_style: bool,
    has_delete_flg: bool,
) -> Result<()> {
    let now = date::DateTime::now().to_db_string();

    // Get full current schema
    let full_schema = include_str!("001_initial_schema.sql");
    let create_table_sql = full_schema
        .lines()
        .skip_while(|line| !line.contains("CREATE TABLE IF NOT EXISTS"))
        .take_while(|line| {
            !line.starts_with("--") || line.contains("CREATE TABLE") || line.contains(")")
        })
        .collect::<Vec<_>>()
        .join("\n");

    // Create new table with full schema
    let create_new_table = create_table_sql.replace("photo_metadata", "photo_metadata_new");
    conn.execute(&create_new_table, [])?;

    // Build SELECT columns based on what exists
    let mut select_cols = vec!["path"];

    if has_old_date {
        select_cols.push("REPLACE(date, '/', '-') as photo_date");
    } else if has_new_photo_date {
        select_cols.push("photo_date");
    }

    select_cols.push("star");
    select_cols.push("comment");

    let created_at_col;
    if has_created_at {
        select_cols.push("created_at");
    } else {
        created_at_col = format!("'{}' as created_at", now.clone());
        select_cols.push(&created_at_col);
    }

    let updated_at_col = format!("'{}' as updated_at", now.clone());
    select_cols.push(&updated_at_col);
    select_cols.push("google_photos_url");

    // EXIF columns
    if has_exif_iso {
        select_cols.extend_from_slice(&[
            "exif_iso",
            "exif_fnumber",
            "exif_date_time",
            "exif_date_time_original",
            "exif_lens_model",
            "exif_make",
            "exif_lens_make",
            "exif_model",
            "exif_xresolution",
            "exif_yresolution",
            "exif_resolution_unit",
            "exif_copyright",
            "exif_exposure_time",
            "exif_shutter_speed_value",
            "exif_focal_length",
            "exif_focal_length_in35mm_film",
            "exif_digital_zoom_ratio",
            "exif_exposure_mode",
            "exif_white_balance_mode",
            "exif_orientation",
        ]);
    } else {
        for _ in 0..21 {
            select_cols.push("NULL");
        }
    }

    if has_css_style {
        select_cols.push("css_style");
    } else {
        select_cols.push("NULL as css_style");
    }

    if has_delete_flg {
        select_cols.push("delete_flg");
    } else {
        select_cols.push("0 as delete_flg");
    }

    // Copy data
    let insert_sql = format!(
        "INSERT INTO photo_metadata_new SELECT {} FROM photo_metadata",
        select_cols.join(", ")
    );
    conn.execute(&insert_sql, [])?;

    // Drop old and rename new
    conn.execute("DROP TABLE photo_metadata", [])?;
    conn.execute(
        "ALTER TABLE photo_metadata_new RENAME TO photo_metadata",
        [],
    )?;

    // Create indexes
    let index_sqls = full_schema
        .lines()
        .filter(|line| line.starts_with("CREATE INDEX"))
        .collect::<Vec<_>>();

    for index_sql in index_sqls {
        conn.execute(index_sql, [])?;
    }

    log::info!(target: "migrations", "legacy_migration; status=completed");
    Ok(())
}
