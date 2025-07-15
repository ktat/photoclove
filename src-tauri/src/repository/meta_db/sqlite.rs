use crate::entity::{photo, photo_meta};
use crate::repository::{meta_db, DatesNum, MetaInfoDB};
use crate::value::{comment, date, file, star};
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use std::path;

pub struct SQLite {
    db_path: String,
}

impl SQLite {
    fn get_full_schema() -> &'static str {
        "CREATE TABLE photo_metadata (
            path TEXT PRIMARY KEY,
            photo_date TEXT NOT NULL,
            star INTEGER NOT NULL DEFAULT 0,
            comment TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
            updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
            google_photos_url TEXT,
            exif_iso TEXT,
            exif_fnumber TEXT,
            exif_date_time TEXT,
            exif_date_time_original TEXT,
            exif_lens_model TEXT,
            exif_make TEXT,
            exif_lens_make TEXT,
            exif_model TEXT,
            exif_xresolution TEXT,
            exif_yresolution TEXT,
            exif_resolution_unit TEXT,
            exif_copyright TEXT,
            exif_exposure_time TEXT,
            exif_shutter_speed_value TEXT,
            exif_focal_length TEXT,
            exif_focal_length_in35mm_film TEXT,
            exif_digital_zoom_ratio TEXT,
            exif_exposure_mode TEXT,
            exif_white_balance_mode TEXT,
            exif_orientation TEXT,
            css_style TEXT
        )"
    }

    pub fn new(path: String) -> SQLite {
        let sqlite = SQLite {
            db_path: path + "/photoclove.db",
        };
        if let Err(e) = sqlite.init_db() {
            eprintln!("Failed to initialize SQLite database: {}", e);
            eprintln!("Falling back to basic table creation");
            // Try basic table creation as fallback
            if let Ok(conn) = sqlite.get_connection() {
                let _ = conn.execute(
                    &format!("CREATE TABLE IF NOT EXISTS {}", SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "photo_metadata")),
                    [],
                );
                // Also create the index
                let _ = conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                );
            }
        }
        sqlite
    }

    pub fn init_db(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        
        // Check if table exists by trying to query it
        let table_exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photo_metadata'")
            .and_then(|mut stmt| {
                stmt.query_row([], |row| {
                    let _name: String = row.get(0)?;
                    Ok(true)
                })
            })
            .unwrap_or(false);
        
        if table_exists {
            // Check if old 'date' column exists and if new columns exist
            let mut has_old_date_column = false;
            let mut has_new_photo_date_column = false;
            let mut has_created_at_column = false;
            let mut has_updated_at_column = false;
            let mut has_google_photos_url_column = false;
            
            // EXIF fields
            let mut has_exif_iso = false;
            let mut has_exif_fnumber = false;
            let mut has_exif_date_time = false;
            let mut has_exif_date_time_original = false;
            let mut has_exif_lens_model = false;
            let mut has_exif_make = false;
            let mut has_exif_lens_make = false;
            let mut has_exif_model = false;
            let mut has_exif_xresolution = false;
            let mut has_exif_yresolution = false;
            let mut has_exif_resolution_unit = false;
            let mut has_exif_copyright = false;
            let mut has_exif_exposure_time = false;
            let mut has_exif_shutter_speed_value = false;
            let mut has_exif_focal_length = false;
            let mut has_exif_focal_length_in35mm_film = false;
            let mut has_exif_digital_zoom_ratio = false;
            let mut has_exif_exposure_mode = false;
            let mut has_exif_white_balance_mode = false;
            let mut has_exif_orientation = false;
            
            // CSS style field
            let mut has_css_style = false;
            
            if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(photo_metadata)") {
                if let Ok(rows) = stmt.query_map([], |row| {
                    let column_name: String = row.get(1)?;
                    Ok(column_name)
                }) {
                    for row in rows {
                        if let Ok(column_name) = row {
                            if column_name == "date" {
                                has_old_date_column = true;
                            }
                            if column_name == "photo_date" {
                                has_new_photo_date_column = true;
                            }
                            if column_name == "created_at" {
                                has_created_at_column = true;
                            }
                            if column_name == "updated_at" {
                                has_updated_at_column = true;
                            }
                            if column_name == "google_photos_url" {
                                has_google_photos_url_column = true;
                            }
                            // Check for EXIF fields
                            if column_name == "exif_iso" {
                                has_exif_iso = true;
                            }
                            if column_name == "exif_fnumber" {
                                has_exif_fnumber = true;
                            }
                            if column_name == "exif_date_time" {
                                has_exif_date_time = true;
                            }
                            if column_name == "exif_date_time_original" {
                                has_exif_date_time_original = true;
                            }
                            if column_name == "exif_lens_model" {
                                has_exif_lens_model = true;
                            }
                            if column_name == "exif_make" {
                                has_exif_make = true;
                            }
                            if column_name == "exif_lens_make" {
                                has_exif_lens_make = true;
                            }
                            if column_name == "exif_model" {
                                has_exif_model = true;
                            }
                            if column_name == "exif_xresolution" {
                                has_exif_xresolution = true;
                            }
                            if column_name == "exif_yresolution" {
                                has_exif_yresolution = true;
                            }
                            if column_name == "exif_resolution_unit" {
                                has_exif_resolution_unit = true;
                            }
                            if column_name == "exif_copyright" {
                                has_exif_copyright = true;
                            }
                            if column_name == "exif_exposure_time" {
                                has_exif_exposure_time = true;
                            }
                            if column_name == "exif_shutter_speed_value" {
                                has_exif_shutter_speed_value = true;
                            }
                            if column_name == "exif_focal_length" {
                                has_exif_focal_length = true;
                            }
                            if column_name == "exif_focal_length_in35mm_film" {
                                has_exif_focal_length_in35mm_film = true;
                            }
                            if column_name == "exif_digital_zoom_ratio" {
                                has_exif_digital_zoom_ratio = true;
                            }
                            if column_name == "exif_exposure_mode" {
                                has_exif_exposure_mode = true;
                            }
                            if column_name == "exif_white_balance_mode" {
                                has_exif_white_balance_mode = true;
                            }
                            if column_name == "exif_orientation" {
                                has_exif_orientation = true;
                            }
                            if column_name == "css_style" {
                                has_css_style = true;
                            }
                        }
                    }
                }
            }
            
            // Migrate old table structure to new one
            if has_old_date_column && !has_new_photo_date_column {
                println!("Migrating database schema from 'date' to 'photo_date' column");
                
                // Create new table with full schema including EXIF columns
                conn.execute(
                    &SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "CREATE TABLE photo_metadata_new"),
                    [],
                )?;
                
                // Copy data from old table to new table, converting date format and adding all new columns
                let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, REPLACE(date, '/', '-'), star, comment, ?1, ?2, NULL,
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL 
                     FROM photo_metadata",
                    params![now, now],
                )?;
                
                // Drop old table and rename new one
                conn.execute("DROP TABLE photo_metadata", [])?;
                conn.execute("ALTER TABLE photo_metadata_new RENAME TO photo_metadata", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("Database schema migration completed");
            } else if has_new_photo_date_column && !has_created_at_column {
                println!("Adding created_at, updated_at, and google_photos_url columns to existing photo_metadata table");
                
                // Create new table with full schema including EXIF columns
                conn.execute(
                    &SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "CREATE TABLE photo_metadata_new"),
                    [],
                )?;
                
                // Copy data from old table to new table, adding all new columns
                let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, photo_date, star, comment, ?1, ?2, NULL,
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL 
                     FROM photo_metadata",
                    params![now, now],
                )?;
                
                // Drop old table and rename new one
                conn.execute("DROP TABLE photo_metadata", [])?;
                conn.execute("ALTER TABLE photo_metadata_new RENAME TO photo_metadata", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("Created_at, updated_at, and google_photos_url columns migration completed");
            } else if has_new_photo_date_column && has_created_at_column && !has_updated_at_column {
                println!("Adding updated_at and google_photos_url columns to existing photo_metadata table");
                
                // Create new table with full schema including EXIF columns
                conn.execute(
                    &SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "CREATE TABLE photo_metadata_new"),
                    [],
                )?;
                
                // Copy data from old table to new table, adding all new columns (keep existing created_at)
                let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, photo_date, star, comment, created_at, ?1, NULL,
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL 
                     FROM photo_metadata",
                    params![now],
                )?;
                
                // Drop old table and rename new one
                conn.execute("DROP TABLE photo_metadata", [])?;
                conn.execute("ALTER TABLE photo_metadata_new RENAME TO photo_metadata", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("Updated_at and google_photos_url columns migration completed");
            } else if has_new_photo_date_column && has_created_at_column && has_updated_at_column && !has_google_photos_url_column {
                println!("Adding google_photos_url column to existing photo_metadata table");
                
                // Create new table with full schema including EXIF columns
                conn.execute(
                    &SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "CREATE TABLE photo_metadata_new"),
                    [],
                )?;
                
                // Copy data from old table to new table, adding all new columns
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, photo_date, star, comment, created_at, updated_at, NULL,
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL 
                     FROM photo_metadata",
                    [],
                )?;
                
                // Drop old table and rename new one
                conn.execute("DROP TABLE photo_metadata", [])?;
                conn.execute("ALTER TABLE photo_metadata_new RENAME TO photo_metadata", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("Google_photos_url column migration completed");
            } else if has_new_photo_date_column && has_created_at_column && has_updated_at_column && has_google_photos_url_column && !has_exif_iso {
                println!("Adding EXIF columns to existing photo_metadata table");
                
                // Create new table with EXIF columns
                conn.execute(
                    &SQLite::get_full_schema(),
                    [],
                )?;
                
                // Move current table to temporary name
                conn.execute("ALTER TABLE photo_metadata RENAME TO photo_metadata_old", [])?;
                
                // Create new table with full schema
                conn.execute(
                    &SQLite::get_full_schema(),
                    [],
                )?;
                
                // Copy data from old table to new table, adding EXIF columns as NULL
                conn.execute(
                    "INSERT INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL 
                     FROM photo_metadata_old",
                    [],
                )?;
                
                // Drop old table
                conn.execute("DROP TABLE photo_metadata_old", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("EXIF columns migration completed");
            } else if has_new_photo_date_column && has_created_at_column && has_updated_at_column && has_google_photos_url_column && has_exif_iso && !has_css_style {
                println!("Adding CSS style column to existing photo_metadata table");
                
                // Create new table with CSS style column
                conn.execute(
                    &SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "CREATE TABLE photo_metadata_new"),
                    [],
                )?;
                
                // Copy data from old table to new table, adding CSS style column as NULL
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     SELECT path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, NULL 
                     FROM photo_metadata",
                    [],
                )?;
                
                // Drop old table and rename new one
                conn.execute("DROP TABLE photo_metadata", [])?;
                conn.execute("ALTER TABLE photo_metadata_new RENAME TO photo_metadata", [])?;
                
                // Create index
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                    [],
                )?;
                
                println!("CSS style column migration completed");
            }
        } else {
            // Create new table with full schema including EXIF columns
            conn.execute(
                &format!("CREATE TABLE IF NOT EXISTS {}", SQLite::get_full_schema().replace("CREATE TABLE photo_metadata", "photo_metadata")),
                [],
            )?;
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                [],
            )?;
        }
        
        // Create job queue tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS job_unit (
                id TEXT PRIMARY KEY,
                jobs TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
            )",
            [],
        )?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS job_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_unit_id TEXT NOT NULL,
                job TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                error_message TEXT,
                FOREIGN KEY(job_unit_id) REFERENCES job_unit(id)
            )",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_queue_unit_id ON job_queue(job_unit_id)",
            [],
        )?;
        
        Ok(())
    }

    fn get_connection(&self) -> Result<Connection> {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&self.db_path).parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                        Some(format!("Failed to create directory: {}", e))
                    )
                })?;
            }
        }
        Connection::open(&self.db_path)
    }

    fn photo_info_from_row(
        path: String,
        date: String,
        star: i32,
        comment: String,
        css_style: Option<String>,
    ) -> meta_db::PhotoInfo {
        meta_db::PhotoInfo {
            path,
            date,
            star,
            comment,
            css_style,
        }
    }


    pub fn clear_all_metadata(&self) -> Result<(), String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
        conn.execute("DELETE FROM photo_metadata", [])
            .map_err(|e| format!("Failed to clear metadata: {}", e))?;
        Ok(())
    }

    pub fn get_available_dates(&self) -> Result<Vec<date::Date>, String> {
        println!("SQLite::get_available_dates() - Starting date extraction");

        let conn = self.get_connection().map_err(|e| {
            println!("SQLite::get_available_dates() - Failed to connect: {}", e);
            format!("Failed to connect to database: {}", e)
        })?;

        println!("SQLite::get_available_dates() - Database connection successful");

        // First check how many records we have
        let count_result = conn.query_row("SELECT COUNT(*) FROM photo_metadata", [], |row| {
            let count: i64 = row.get(0)?;
            Ok(count)
        });

        match count_result {
            Ok(count) => println!(
                "SQLite::get_available_dates() - Found {} total records",
                count
            ),
            Err(e) => println!(
                "SQLite::get_available_dates() - Error counting records: {}",
                e
            ),
        }

        let mut stmt = conn
            .prepare("SELECT DISTINCT date(photo_date) FROM photo_metadata ORDER BY photo_date")
            .map_err(|e| {
                println!(
                    "SQLite::get_available_dates() - Failed to prepare statement: {}",
                    e
                );
                format!("Failed to prepare statement: {}", e)
            })?;

        println!("SQLite::get_available_dates() - Query prepared successfully");

        let rows = stmt
            .query_map([], |row| {
                let date_str: String = row.get(0)?;
                Ok(date_str)
            })
            .map_err(|e| {
                println!(
                    "SQLite::get_available_dates() - Failed to execute query: {}",
                    e
                );
                format!("Failed to execute query: {}", e)
            })?;

        println!("SQLite::get_available_dates() - Query executed successfully");

        let mut dates = Vec::new();
        let mut row_count = 0;
        let mut parsed_count = 0;

        for row in rows {
            row_count += 1;
            let date_str = row.map_err(|e| {
                println!(
                    "SQLite::get_available_dates() - Failed to parse row {}: {}",
                    row_count, e
                );
                format!("Failed to parse row: {}", e)
            })?;

            if row_count <= 3 {
                println!(
                    "SQLite::get_available_dates() - Processing row {}: '{}'",
                    row_count, date_str
                );
            }

            // Parse date string in "yyyy-mm-dd" format (from date() function)
            if row_count <= 3 {
                println!(
                    "SQLite::get_available_dates() - Processing date string: '{}'",
                    date_str
                );
            }

            // Convert format from "2023-01-15" to components
            let parts: Vec<&str> = date_str.split('-').collect();
            if parts.len() == 3 {
                if let (Ok(year), Ok(month), Ok(day)) = (
                    parts[0].parse::<i32>(),
                    parts[1].parse::<u32>(),
                    parts[2].parse::<u32>(),
                ) {
                    if row_count <= 3 {
                        println!(
                            "SQLite::get_available_dates() - Parsed components: {}-{}-{}",
                            year, month, day
                        );
                    }

                    if let Some(date) = date::Date::new(year, month, day) {
                        dates.push(date);
                        parsed_count += 1;

                        if row_count <= 3 {
                            println!("SQLite::get_available_dates() - Created date object: {}-{:02}-{:02}", year, month, day);
                        }
                    } else {
                        if row_count <= 3 {
                            println!("SQLite::get_available_dates() - Failed to create date object for: {}-{}-{}", year, month, day);
                        }
                    }
                } else {
                    if row_count <= 3 {
                        println!("SQLite::get_available_dates() - Failed to parse date components from: {:?}", parts);
                    }
                }
            } else {
                if row_count <= 3 {
                    println!(
                        "SQLite::get_available_dates() - Wrong number of date parts: {:?}",
                        parts
                    );
                }
            }
        }

        println!(
            "SQLite::get_available_dates() - Processed {} rows, parsed {} dates",
            row_count, parsed_count
        );

        // Remove duplicates (in case same date appears multiple times)
        let original_count = dates.len();
        dates.sort_by(|a, b| {
            a.year
                .cmp(&b.year)
                .then(a.month.cmp(&b.month))
                .then(a.day.cmp(&b.day))
        });
        dates.dedup_by(|a, b| a.year == b.year && a.month == b.month && a.day == b.day);

        println!(
            "SQLite::get_available_dates() - After deduplication: {} -> {} unique dates",
            original_count,
            dates.len()
        );

        for (i, date) in dates.iter().enumerate() {
            println!(
                "SQLite::get_available_dates() - Final date {}: {}-{:02}-{:02}",
                i + 1,
                date.year,
                date.month,
                date.day
            );
        }

        println!(
            "SQLite::get_available_dates() - Returning {} dates",
            dates.len()
        );
        Ok(dates)
    }

    pub fn has_metadata(&self) -> bool {
        println!("SQLite::has_metadata() - Checking if database contains metadata");

        if let Ok(conn) = self.get_connection() {
            println!("SQLite::has_metadata() - Database connection successful");

            if let Ok(mut stmt) = conn.prepare("SELECT COUNT(*) FROM photo_metadata") {
                println!("SQLite::has_metadata() - Query prepared successfully");

                if let Ok(count) = stmt.query_row([], |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count)
                }) {
                    println!("SQLite::has_metadata() - Found {} records", count);
                    return count > 0;
                } else {
                    println!("SQLite::has_metadata() - Failed to execute count query");
                }
            } else {
                println!("SQLite::has_metadata() - Failed to prepare count query");
            }
        } else {
            println!("SQLite::has_metadata() - Failed to connect to database");
        }

        println!("SQLite::has_metadata() - Returning false (no metadata)");
        false
    }
}

impl MetaInfoDB for SQLite {
    fn connect(&self, _path: String) {
        // Connection is managed per operation
    }

    fn new_connect(&self) -> SQLite {
        SQLite::new(self.db_path.replace("/photoclove.db", ""))
    }

    fn record_photo_metas(
        &self,
        _info_path: path::PathBuf,
        photo_metas: photo_meta::PhotoMetas,
    ) -> Result<bool, &str> {
        let conn = self
            .get_connection()
            .map_err(|_| "Failed to connect to database")?;
        let mut stmt = conn
            .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)")
            .map_err(|_| "Failed to prepare statement")?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        for (path, meta) in photo_metas.iter() {
            stmt.execute(params![
                path,
                meta.photo_time(),
                meta.star.star(),
                meta.comment.comment(),
                now,
                now,
                None::<String>,
                // EXIF fields as NULL for now since PhotoMeta doesn't have them
                None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>,
                None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>, None::<String>,
                None::<String>, None::<String>, None::<String>, None::<String>,
                // CSS style field
                None::<String>
            ])
            .map_err(|_| "Failed to execute statement")?;
        }

        Ok(true)
    }

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        let conn = self
            .get_connection()
            .map_err(|_| "Failed to connect to database")?;
        let mut stmt = conn
            .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                     exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                     exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                     exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)")
            .map_err(|_| "Failed to prepare statement")?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        for mut photo in photos {
            photo.load_exif();
            let date = match photo.dir.to_date() {
                Some(d) => {
                    // Convert from "2022-12-03" to "2022-12-03 00:00:00" format
                    let date_str = d.to_string();
                    if date_str.contains(" ") {
                        date_str  // Already has time component
                    } else {
                        format!("{} 00:00:00", date_str)  // Add default time
                    }
                },
                None => {
                    eprintln!("WARNING: Skipping photo due to missing date: {} (dir: {})", photo.file.path, photo.dir.path);
                    continue;
                },
            };

            // Check if photo already exists
            let existing_meta = self.get_photo_meta(photo.clone());

            // Get EXIF data from the photo
            let exif = &photo.meta_data;
            
            stmt.execute(params![
                photo.file.path,
                date,
                existing_meta.star.star(),
                existing_meta.comment.comment(),
                now,
                now,
                None::<String>,
                // EXIF fields
                if exif.iso.is_empty() { None } else { Some(exif.iso.clone()) },
                if exif.fnumber.is_empty() { None } else { Some(exif.fnumber.clone()) },
                if exif.date_time.is_empty() { None } else { Some(exif.date_time.clone()) },
                if exif.date_time_original.is_empty() { None } else { Some(exif.date_time_original.clone()) },
                if exif.lens_model.is_empty() { None } else { Some(exif.lens_model.clone()) },
                if exif.make.is_empty() { None } else { Some(exif.make.clone()) },
                if exif.lens_make.is_empty() { None } else { Some(exif.lens_make.clone()) },
                if exif.model.is_empty() { None } else { Some(exif.model.clone()) },
                if exif.xresolution.is_empty() { None } else { Some(exif.xresolution.clone()) },
                if exif.yresolution.is_empty() { None } else { Some(exif.yresolution.clone()) },
                if exif.resolution_unit.is_empty() { None } else { Some(exif.resolution_unit.clone()) },
                if exif.copyright.is_empty() { None } else { Some(exif.copyright.clone()) },
                if exif.exposure_time.is_empty() { None } else { Some(exif.exposure_time.clone()) },
                if exif.shutter_speed_value.is_empty() { None } else { Some(exif.shutter_speed_value.clone()) },
                if exif.focal_length.is_empty() { None } else { Some(exif.focal_length.clone()) },
                if exif.focal_length_in35mm_film.is_empty() { None } else { Some(exif.focal_length_in35mm_film.clone()) },
                if exif.digital_zoom_ratio.is_empty() { None } else { Some(exif.digital_zoom_ratio.clone()) },
                if exif.exposure_mode.is_empty() { None } else { Some(exif.exposure_mode.clone()) },
                if exif.white_balance_mode.is_empty() { None } else { Some(exif.white_balance_mode.clone()) },
                if exif.orientation.is_empty() { None } else { Some(exif.orientation.clone()) },
                // CSS style field - default to None for now
                None::<String>
            ])
            .map_err(|e| {
                eprintln!("Failed to execute database statement for {}: {}", photo.file.path, e);
                "Failed to execute statement"
            })?;
            
            eprintln!("Successfully inserted metadata for: {} (date: {})", photo.file.path, date);
        }

        Ok(true)
    }

    fn record_photos_all_meta_data(
        &self,
        dates: date::Dates,
    ) -> Result<HashMap<String, usize>, &str> {
        let mut date_num: HashMap<String, usize> = HashMap::new();

        for date in dates.dates {
            let date_dir = file::Dir::new(format!(
                "{}/{}",
                self.db_path.replace("/photoclove.db", ""),
                date.to_string()
            ));
            let files = crate::domain_service::dir_service::find_files(&date_dir);
            let photos = crate::domain_service::photo_service::photos_from_dir(files);

            date_num.insert(date.to_string(), photos.photos.len());

            // Get existing photo paths from database for this date
            let existing_photos = match self.get_photo_meta_data_in_date(date.clone()) {
                Ok(photo_metas) => photo_metas,
                Err(_) => photo_meta::PhotoMetas::new(),
            };

            // Create a set of current file paths from filesystem
            let current_paths: std::collections::HashSet<String> = photos.photos
                .iter()
                .map(|p| p.file.path.clone())
                .collect();

            // Delete photos from database that are no longer in filesystem
            for (path, existing_photo) in existing_photos.iter() {
                if !current_paths.contains(path) {
                    eprintln!("Deleting orphaned photo from DB: {}", path);
                    self.delete_photo(existing_photo.photo());
                }
            }

            let result = self.record_photos_meta_data(photos.photos);
            if result.is_err() {
                eprintln!(
                    "Error recording photos for date {}: {:?}",
                    date.to_string(),
                    result.err()
                );
            }
        }

        Ok(date_num)
    }

    fn get_photo_meta_data_in_date(
        &self,
        date: date::Date,
    ) -> Result<photo_meta::PhotoMetas, String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT path, photo_date, star, comment, css_style FROM photo_metadata WHERE date(photo_date) = ?1")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![date.to_string()], |row| {
                Ok(Self::photo_info_from_row(
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut photo_metas = photo_meta::PhotoMetas::new();
        for row in rows {
            let record = row.map_err(|e| format!("Failed to parse row: {}", e))?;
            if let Some(photo_meta) = photo_meta::PhotoMeta::new_from_photo_info(&record) {
                photo_metas.insert(&record.path.clone(), photo_meta);
            }
        }

        Ok(photo_metas)
    }


    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return photo_meta::PhotoMeta::new(photo.clone()),
        };

        let mut stmt = match conn
            .prepare("SELECT path, photo_date, star, comment, css_style FROM photo_metadata WHERE path = ?1")
        {
            Ok(stmt) => stmt,
            Err(_) => return photo_meta::PhotoMeta::new(photo.clone()),
        };

        let result = stmt.query_row(params![photo.file.path], |row| {
            Ok(Self::photo_info_from_row(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        });

        match result {
            Ok(record) => {
                if let Some(photo_meta) = photo_meta::PhotoMeta::new_from_photo_info(&record) {
                    photo_meta
                } else {
                    photo_meta::PhotoMeta::new(photo.clone())
                }
            }
            Err(_) => photo_meta::PhotoMeta::new(photo.clone()),
        }
    }

    fn save_star(&self, photo: &photo::Photo, star: star::Star) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let existing_meta = self.get_photo_meta(photo.clone());
        let created_at = self.get_photo_created_at(photo);

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                photo.file.path,
                existing_meta.photo_time(),
                star.star(),
                existing_meta.comment.comment(),
                created_at,
                now,
                None::<String>
            ],
        );
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let existing_meta = self.get_photo_meta(photo.clone());
        let created_at = self.get_photo_created_at(photo);

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                photo.file.path,
                existing_meta.photo_time(),
                existing_meta.star.star(),
                comment.comment(),
                created_at,
                now,
                None::<String>
            ],
        );
    }

    fn delete_photo(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![photo.file.path],
        );
    }

    fn update_photo_path(&self, old_path: &str, new_path: &str) -> Result<bool, &str> {
        let conn = self.get_connection()
            .map_err(|_| "Failed to connect to database")?;
        
        let rows_affected = conn.execute(
            "UPDATE photo_metadata SET path = ?1 WHERE path = ?2",
            params![new_path, old_path],
        ).map_err(|_| "Failed to update photo path")?;
        
        Ok(rows_affected > 0)
    }

    fn get_photo_count_per_dates(&self, dates: date::Dates) -> DatesNum {
        println!(
            "SQLite::get_photo_count_per_dates() - Getting counts for {} dates",
            dates.dates.len()
        );
        let mut dates_num = DatesNum {
            data: HashMap::new(),
        };

        let conn = match self.get_connection() {
            Ok(conn) => {
                println!("SQLite::get_photo_count_per_dates() - Database connection successful");
                conn
            }
            Err(e) => {
                println!(
                    "SQLite::get_photo_count_per_dates() - Database connection failed: {:?}",
                    e
                );
                return dates_num;
            }
        };

        // First, let's see what date formats we actually have in the database
        if let Ok(mut debug_stmt) = conn.prepare("SELECT DISTINCT photo_date FROM photo_metadata LIMIT 5")
        {
            println!("SQLite::get_photo_count_per_dates() - Sample dates in database:");
            if let Ok(rows) = debug_stmt.query_map([], |row| {
                let date_str: String = row.get(0)?;
                Ok(date_str)
            }) {
                for (i, row) in rows.enumerate() {
                    if let Ok(date_str) = row {
                        println!(
                            "SQLite::get_photo_count_per_dates() - DB date {}: '{}'",
                            i + 1,
                            date_str
                        );
                    }
                }
            }
        }

        // Use GROUP BY to get all counts in a single query
        let mut stmt = match conn.prepare("SELECT date(photo_date) as date_only, COUNT(*) as count FROM photo_metadata GROUP BY date(photo_date)") {
            Ok(stmt) => {
                println!("SQLite::get_photo_count_per_dates() - GROUP BY query prepared successfully");
                stmt
            }
            Err(e) => {
                println!(
                    "SQLite::get_photo_count_per_dates() - Query prepare failed: {:?}",
                    e
                );
                return dates_num;
            }
        };

        // Execute the query once to get all date counts
        let db_counts = match stmt.query_map([], |row| {
            let date_str: String = row.get(0)?;
            let count: i32 = row.get(1)?;
            Ok((date_str, count))
        }) {
            Ok(rows) => {
                let mut counts = std::collections::HashMap::new();
                for row in rows {
                    if let Ok((date_str, count)) = row {
                        println!(
                            "SQLite::get_photo_count_per_dates() - DB has {} photos for date '{}'",
                            count, date_str
                        );
                        counts.insert(date_str, count);
                    }
                }
                counts
            }
            Err(e) => {
                println!(
                    "SQLite::get_photo_count_per_dates() - Query execution failed: {:?}",
                    e
                );
                return dates_num;
            }
        };

        // Now match the requested dates with the database results
        for date in dates.dates {
            let date_string = date.to_string();
            let count = db_counts.get(&date_string).unwrap_or(&0);
            println!(
                "SQLite::get_photo_count_per_dates() - Requested date '{}' has {} photos",
                date_string, count
            );
            dates_num.data.insert(date_string, *count);
        }

        println!(
            "SQLite::get_photo_count_per_dates() - Final result: {}",
            dates_num.to_json()
        );
        dates_num
    }
    
}

impl SQLite {
    // Job Queue Methods
    pub fn create_job_unit(&self, job_unit: &crate::entity::job_queue::JobUnit) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let jobs_json = serde_json::to_string(&job_unit.jobs)
            .map_err(|e| format!("Failed to serialize jobs: {}", e))?;
            
        conn.execute(
            "INSERT INTO job_unit (id, jobs, created_at, status) VALUES (?1, ?2, ?3, ?4)",
            params![job_unit.id, jobs_json, job_unit.created_at, job_unit.status.to_string()],
        ).map_err(|e| format!("Failed to insert job unit: {}", e))?;
        
        Ok(())
    }
    
    pub fn create_job(&self, queued_job: &crate::entity::job_queue::QueuedJob) -> Result<i64, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let job_json = serde_json::to_string(&queued_job.job)
            .map_err(|e| format!("Failed to serialize job: {}", e))?;
            
        conn.execute(
            "INSERT INTO job_queue (job_unit_id, job, status, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![queued_job.job_unit_id, job_json, queued_job.status.to_string(), queued_job.created_at],
        ).map_err(|e| format!("Failed to insert job: {}", e))?;
        
        Ok(conn.last_insert_rowid())
    }
    
    pub fn get_pending_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        // Always create a fresh connection for thread safety
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let mut stmt = conn.prepare(
            "SELECT id, job_unit_id, job, status, created_at, started_at, completed_at, error_message 
             FROM job_queue WHERE status = 'pending' ORDER BY created_at ASC"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let job_iter = stmt.query_map([], |row| {
            let job_json: String = row.get(2)?;
            let job: crate::entity::job_queue::Job = serde_json::from_str(&job_json)
                .map_err(|e| rusqlite::Error::InvalidColumnType(2, "job".to_string(), rusqlite::types::Type::Text))?;
                
            Ok(crate::entity::job_queue::QueuedJob {
                id: Some(row.get(0)?),
                job_unit_id: row.get(1)?,
                job,
                status: crate::entity::job_queue::JobStatus::from(row.get::<_, String>(3)?),
                created_at: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
                error_message: row.get(7)?,
            })
        }).map_err(|e| format!("Failed to query jobs: {}", e))?;
        
        let mut jobs = Vec::new();
        for job in job_iter {
            jobs.push(job.map_err(|e| format!("Failed to parse job: {}", e))?);
        }
        
        Ok(jobs)
    }
    
    pub fn update_job_status(&self, job_id: i64, status: &crate::entity::job_queue::JobStatus, error_message: Option<String>) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        match status {
            crate::entity::job_queue::JobStatus::Running => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, started_at = ?2 WHERE id = ?3",
                    params![status.to_string(), now, job_id],
                ).map_err(|e| format!("Failed to update job status: {}", e))?;
            },
            crate::entity::job_queue::JobStatus::Completed => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, completed_at = ?2 WHERE id = ?3",
                    params![status.to_string(), now, job_id],
                ).map_err(|e| format!("Failed to update job status: {}", e))?;
            },
            crate::entity::job_queue::JobStatus::Failed => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, completed_at = ?2, error_message = ?3 WHERE id = ?4",
                    params![status.to_string(), now, error_message, job_id],
                ).map_err(|e| format!("Failed to update job status: {}", e))?;
            },
            _ => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1 WHERE id = ?2",
                    params![status.to_string(), job_id],
                ).map_err(|e| format!("Failed to update job status: {}", e))?;
            }
        }
        
        Ok(())
    }
    
    pub fn get_job_unit_progress(&self, job_unit_id: &str) -> Result<crate::entity::job_queue::JobProgress, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let mut stmt = conn.prepare(
            "SELECT status, COUNT(*) FROM job_queue WHERE job_unit_id = ?1 GROUP BY status"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let mut total_jobs = 0;
        let mut completed_jobs = 0;
        
        let rows = stmt.query_map([job_unit_id], |row| {
            let status: String = row.get(0)?;
            let count: i32 = row.get(1)?;
            Ok((status, count))
        }).map_err(|e| format!("Failed to query job progress: {}", e))?;
        
        for row in rows {
            let (status, count) = row.map_err(|e| format!("Failed to parse job progress row: {}", e))?;
            total_jobs += count;
            if status == "completed" {
                completed_jobs += count;
            }
        }
        
        let mut progress = crate::entity::job_queue::JobProgress::new(job_unit_id.to_string(), total_jobs as usize);
        progress.update_progress(completed_jobs as usize, None);
        
        Ok(progress)
    }
    
    pub fn update_job_unit_status_if_complete(&self, job_unit_id: &str) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        // Check if all jobs for this job unit are completed
        let incomplete_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM job_queue WHERE job_unit_id = ?1 AND status != 'completed'",
            [job_unit_id],
            |row| row.get(0)
        ).map_err(|e| format!("Failed to query incomplete jobs: {}", e))?;
        
        // If no incomplete jobs, mark job unit as completed
        if incomplete_count == 0 {
            eprintln!("All jobs completed for job unit {}, updating status", job_unit_id);
            conn.execute(
                "UPDATE job_unit SET status = 'completed' WHERE id = ?1",
                [job_unit_id],
            ).map_err(|e| format!("Failed to update job unit status: {}", e))?;
        }
        
        Ok(())
    }
    
    pub fn cleanup_completed_jobs(&self) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        // First, delete all completed jobs (no time restriction for immediate cleanup)
        let deleted_jobs = conn.execute(
            "DELETE FROM job_queue WHERE status = 'completed'",
            [],
        ).map_err(|e| format!("Failed to cleanup completed jobs: {}", e))?;
        
        // Then delete completed job units that have no remaining jobs
        let deleted_units = conn.execute(
            "DELETE FROM job_unit WHERE status = 'completed' AND id NOT IN (SELECT DISTINCT job_unit_id FROM job_queue)",
            [],
        ).map_err(|e| format!("Failed to cleanup completed job units: {}", e))?;
        
        if deleted_jobs > 0 || deleted_units > 0 {
            eprintln!("Cleaned up {} completed jobs and {} completed job units", deleted_jobs, deleted_units);
        }
        
        Ok(())
    }

    pub fn get_jobs_for_unit(&self, job_unit_id: &str) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let mut stmt = conn.prepare(
            "SELECT id, job_unit_id, job_type, target, status, error_message, created_at 
             FROM job_queue WHERE job_unit_id = ?1"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let job_iter = stmt.query_map([job_unit_id], |row| {
            let job_id: i64 = row.get(0)?;
            let job_unit_id: String = row.get(1)?;
            let job_type_str: String = row.get(2)?;
            let target_json: String = row.get(3)?;
            let status_str: String = row.get(4)?;
            let error_message: Option<String> = row.get(5)?;
            let _created_at: String = row.get(6)?;
            
            // Parse job type
            let job_type = match job_type_str.as_str() {
                "import" => crate::entity::job_queue::JobType::Import,
                "thumbnail" => crate::entity::job_queue::JobType::Thumbnail,
                "create_db" => crate::entity::job_queue::JobType::CreateDb,
                _ => return Err(rusqlite::Error::InvalidColumnType(2, "job_type".to_string(), rusqlite::types::Type::Text)),
            };
            
            // Parse target files
            let target: Vec<String> = serde_json::from_str(&target_json)
                .map_err(|_| rusqlite::Error::InvalidColumnType(3, "target".to_string(), rusqlite::types::Type::Text))?;
            
            // Parse status
            let status = match status_str.as_str() {
                "pending" => crate::entity::job_queue::JobStatus::Pending,
                "running" => crate::entity::job_queue::JobStatus::Running,
                "completed" => crate::entity::job_queue::JobStatus::Completed,
                "failed" => crate::entity::job_queue::JobStatus::Failed,
                _ => return Err(rusqlite::Error::InvalidColumnType(4, "status".to_string(), rusqlite::types::Type::Text)),
            };
            
            // Create job
            let job = crate::entity::job_queue::Job::new(job_unit_id.clone(), job_type, target);
            let mut queued_job = crate::entity::job_queue::QueuedJob::new(job_unit_id, job);
            queued_job.id = Some(job_id);
            queued_job.status = status;
            queued_job.error_message = error_message;
            
            Ok(queued_job)
        }).map_err(|e| format!("Failed to query jobs: {}", e))?;
        
        let mut jobs = Vec::new();
        for job_result in job_iter {
            jobs.push(job_result.map_err(|e| format!("Failed to parse job: {}", e))?);
        }
        
        Ok(jobs)
    }

    pub fn reset_running_jobs_to_pending(&self) -> Result<usize, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let affected_rows = conn.execute(
            "UPDATE job_queue SET status = 'pending' WHERE status = 'running'",
            [],
        ).map_err(|e| format!("Failed to reset running jobs: {}", e))?;
        
        Ok(affected_rows)
    }

    pub fn get_all_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let mut stmt = conn.prepare(
            "SELECT id, job_unit_id, job, status, created_at, started_at, completed_at, error_message 
             FROM job_queue ORDER BY created_at DESC"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let job_iter = stmt.query_map([], |row| {
            let job_json: String = row.get(2)?;
            let job: crate::entity::job_queue::Job = serde_json::from_str(&job_json)
                .map_err(|e| rusqlite::Error::InvalidColumnType(2, "job".to_string(), rusqlite::types::Type::Text))?;
                
            Ok(crate::entity::job_queue::QueuedJob {
                id: Some(row.get(0)?),
                job_unit_id: row.get(1)?,
                job,
                status: crate::entity::job_queue::JobStatus::from(row.get::<_, String>(3)?),
                created_at: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
                error_message: row.get(7)?,
            })
        }).map_err(|e| format!("Failed to query jobs: {}", e))?;
        
        let mut jobs = Vec::new();
        for job in job_iter {
            jobs.push(job.map_err(|e| format!("Failed to parse job: {}", e))?);
        }
        
        Ok(jobs)
    }

    pub fn delete_job(&self, job_id: i64) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        let affected_rows = conn.execute(
            "DELETE FROM job_queue WHERE id = ?1 AND status IN ('pending', 'failed')",
            [job_id],
        ).map_err(|e| format!("Failed to delete job: {}", e))?;
        
        if affected_rows == 0 {
            return Err("Job not found or cannot be deleted (job may be running)".to_string());
        }
        
        Ok(())
    }

    pub fn delete_job_unit(&self, job_unit_id: &str) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
        // Delete all jobs for this unit (only if not running)
        let affected_jobs = conn.execute(
            "DELETE FROM job_queue WHERE job_unit_id = ?1 AND status IN ('pending', 'failed', 'completed')",
            [job_unit_id],
        ).map_err(|e| format!("Failed to delete jobs for unit: {}", e))?;
        
        // Delete the job unit itself
        let affected_units = conn.execute(
            "DELETE FROM job_unit WHERE id = ?1",
            [job_unit_id],
        ).map_err(|e| format!("Failed to delete job unit: {}", e))?;
        
        if affected_units == 0 {
            return Err("Job unit not found".to_string());
        }
        
        Ok(())
    }

    pub fn get_photo_created_at(&self, photo: &photo::Photo) -> String {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return "1970-01-01 00:00:00".to_string(),
        };

        let mut stmt = match conn
            .prepare("SELECT created_at FROM photo_metadata WHERE path = ?1")
        {
            Ok(stmt) => stmt,
            Err(_) => return "1970-01-01 00:00:00".to_string(),
        };

        let result = stmt.query_row(params![photo.file.path], |row| {
            let created_at: String = row.get(0)?;
            Ok(created_at)
        });

        match result {
            Ok(created_at) => created_at,
            Err(_) => "1970-01-01 00:00:00".to_string(),
        }
    }

    pub fn save_google_photos_url(&self, photo_path: &str, google_photos_url: &str) -> Result<(), String> {
        let conn = self.get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
        
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected_rows = conn.execute(
            "UPDATE photo_metadata SET google_photos_url = ?1, updated_at = ?2 WHERE path = ?3",
            params![google_photos_url, now, photo_path],
        ).map_err(|e| format!("Failed to update Google Photos URL: {}", e))?;
        
        if affected_rows == 0 {
            return Err("Photo not found in database".to_string());
        }
        
        Ok(())
    }

    pub fn save_css_style(&self, photo_path: &str, css_style: &str) -> Result<(), String> {
        let conn = self.get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
        
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected_rows = conn.execute(
            "UPDATE photo_metadata SET css_style = ?1, updated_at = ?2 WHERE path = ?3",
            params![css_style, now, photo_path],
        ).map_err(|e| format!("Failed to update CSS style: {}", e))?;
        
        if affected_rows == 0 {
            return Err("Photo not found in database".to_string());
        }
        
        Ok(())
    }

    pub fn get_css_style(&self, photo_path: &str) -> Option<String> {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return None,
        };

        let mut stmt = match conn.prepare("SELECT css_style FROM photo_metadata WHERE path = ?1") {
            Ok(stmt) => stmt,
            Err(_) => return None,
        };

        let result = stmt.query_row(params![photo_path], |row| {
            let css_style: Option<String> = row.get(0)?;
            Ok(css_style)
        });

        match result {
            Ok(css_style) => css_style,
            Err(_) => None,
        }
    }
}
