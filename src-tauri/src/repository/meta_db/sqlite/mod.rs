use crate::entity::{config, photo, photo_meta};
use crate::repository::{meta_db, DatesNum, MetaInfoDB};
use crate::value::{comment, date, file, star};
use regex;
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use std::path;

mod utils;
mod date_summary;
mod tags;
mod albums;
mod collections;
mod job_queue;

#[derive(Clone)]
pub struct SQLite {
    db_path: String,
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
        if let Err(_) = date_summary::check_date_summary_currency(&sqlite) {
            log::info!(target: "date_summary", "startup_validation; status=failed; action=rebuilding");
            let _ = date_summary::rebuild_date_summary(&sqlite);
        }

        sqlite
    }

    pub fn init_db(&self) -> Result<()> {
        let conn = self.get_connection()?;
        super::migrations::run_migrations(&conn)?;

        // Populate date_summary if it's empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM date_summary", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 {
            log::info!(target: "date_summary", "initial_population; status=populating");
            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
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
                        Some(format!("Failed to create directory: {}", e)),
                    )
                })?;
            }
        }
        Connection::open(&self.db_path)
    }

    pub fn get_available_dates(&self) -> Result<Vec<date::Date>, String> {
        log::info!(target: "date_summary", "get_available_dates; start=optimized_extraction");

        let conn = self.get_connection().map_err(|e| {
            log::error!(target: "date_summary", "get_available_dates; connection_failed; error={}", e);
            format!("Failed to connect to database: {}", e)
        })?;

        log::debug!(target: "date_summary", "get_available_dates; connection=successful");

        // Try to get dates directly from date_summary table
        let mut stmt = match conn.prepare(
            "SELECT date, photo_count FROM date_summary WHERE date IS NOT NULL ORDER BY date desc",
        ) {
            Ok(stmt) => stmt,
            Err(_) => {
                // Table doesn't exist, fall back to GROUP BY
                log::debug!(target: "date_summary", "get_available_dates; table_missing; fallback=group_by");
                return self.fallback_get_available_dates(&conn);
            }
        };

        let rows = match stmt.query_map([], |row| {
            let date_str: String = row.get(0)?;
            Ok(date_str)
        }) {
            Ok(rows) => rows,
            Err(_) => {
                // Query failed, fall back to GROUP BY
                log::debug!(target: "date_summary", "get_available_dates; query_failed; fallback=group_by");
                return self.fallback_get_available_dates(&conn);
            }
        };

        // Check if we got any results
        let dates: Result<Vec<String>, _> = rows.collect();
        match dates {
            Ok(date_strings) if !date_strings.is_empty() => {
                log::info!(target: "date_summary", "get_available_dates; using_optimized_table=true; count={}", date_strings.len());
                // Convert strings back to MappedRows format for process_date_rows
                let simulated_rows = date_strings.into_iter().map(|s| Ok(s));
                return self.process_date_rows_from_iter(simulated_rows);
            }
            _ => {
                // No data or error, fall back to GROUP BY
                log::debug!(target: "date_summary", "get_available_dates; no_data; fallback=group_by");
                self.fallback_get_available_dates(&conn)
            }
        }
    }

    fn process_date_rows(
        &self,
        rows: rusqlite::MappedRows<impl FnMut(&rusqlite::Row) -> rusqlite::Result<String>>,
    ) -> Result<Vec<date::Date>, String> {
        println!("SQLite::process_date_rows() - Processing date rows");

        let mut dates = Vec::new();
        let mut row_count = 0;
        let mut parsed_count = 0;

        for row in rows {
            row_count += 1;
            let date_str = row.map_err(|e| {
                println!(
                    "SQLite::process_date_rows() - Failed to parse row {}: {}",
                    row_count, e
                );
                format!("Failed to parse row: {}", e)
            })?;

            if row_count <= 3 {
                println!(
                    "SQLite::process_date_rows() - Processing row {}: '{}'",
                    row_count, date_str
                );
            }

            // Parse date string in "yyyy-mm-dd" format
            if row_count <= 3 {
                println!(
                    "SQLite::process_date_rows() - Processing date string: '{}'",
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
                            "SQLite::process_date_rows() - Parsed components: {}-{}-{}",
                            year, month, day
                        );
                    }

                    if let Some(date) = date::Date::new(year, month, day) {
                        dates.push(date);
                        parsed_count += 1;

                        if row_count <= 3 {
                            println!(
                                "SQLite::process_date_rows() - Created date object: {}-{:02}-{:02}",
                                year, month, day
                            );
                        }
                    } else {
                        if row_count <= 3 {
                            println!("SQLite::process_date_rows() - Failed to create date object for: {}-{}-{}", year, month, day);
                        }
                    }
                } else {
                    if row_count <= 3 {
                        println!("SQLite::process_date_rows() - Failed to parse date components from: {:?}", parts);
                    }
                }
            } else {
                if row_count <= 3 {
                    println!(
                        "SQLite::process_date_rows() - Wrong number of date parts: {:?}",
                        parts
                    );
                }
            }
        }

        println!(
            "SQLite::process_date_rows() - Processed {} rows, parsed {} dates",
            row_count, parsed_count
        );

        // Remove duplicates (in case same date appears multiple times)
        // Note: SQL already returns sorted results, so we don't need to sort here
        let original_count = dates.len();
        dates.dedup_by(|a, b| a.year == b.year && a.month == b.month && a.day == b.day);

        println!(
            "SQLite::process_date_rows() - After deduplication: {} -> {} unique dates",
            original_count,
            dates.len()
        );

        for (i, date) in dates.iter().enumerate() {
            println!(
                "SQLite::process_date_rows() - Final date {}: {}-{:02}-{:02}",
                i + 1,
                date.year,
                date.month,
                date.day
            );
        }

        println!(
            "SQLite::process_date_rows() - Returning {} dates",
            dates.len()
        );
        Ok(dates)
    }

    fn fallback_get_available_dates(
        &self,
        conn: &rusqlite::Connection,
    ) -> Result<Vec<date::Date>, String> {
        log::info!(target: "date_summary", "fallback_get_available_dates; using_group_by=true");

        let mut stmt = conn
            .prepare("SELECT DISTINCT date(photo_date) FROM photo_metadata WHERE (delete_flg = 0 OR delete_flg IS NULL) ORDER BY photo_date DESC")
            .map_err(|e| {
                log::error!(target: "date_summary", "fallback_get_available_dates; prepare_failed; error={}", e);
                format!("Failed to prepare fallback statement: {}", e)
            })?;

        let rows = stmt
            .query_map([], |row| {
                let date_str: String = row.get(0)?;
                Ok(date_str)
            })
            .map_err(|e| {
                log::error!(target: "date_summary", "fallback_get_available_dates; execute_failed; error={}", e);
                format!("Failed to execute fallback query: {}", e)
            })?;

        self.process_date_rows(rows)
    }

    fn process_date_rows_from_iter<I>(&self, rows: I) -> Result<Vec<date::Date>, String>
    where
        I: Iterator<Item = Result<String, rusqlite::Error>>,
    {
        log::debug!(target: "date_summary", "process_date_rows_from_iter; start=true");

        let mut dates = Vec::new();
        let mut row_count = 0;
        let mut parsed_count = 0;

        for row in rows {
            row_count += 1;
            let date_str = row.map_err(|e| {
                log::error!(target: "date_summary", "process_date_rows_from_iter; parse_failed; row={}; error={}", row_count, e);
                format!("Failed to parse row: {}", e)
            })?;

            // Parse date string in "yyyy-mm-dd" format
            let parts: Vec<&str> = date_str.split('-').collect();
            if parts.len() == 3 {
                if let (Ok(year), Ok(month), Ok(day)) = (
                    parts[0].parse::<i32>(),
                    parts[1].parse::<u32>(),
                    parts[2].parse::<u32>(),
                ) {
                    if let Some(date) = date::Date::new(year, month, day) {
                        dates.push(date);
                        parsed_count += 1;
                    }
                }
            }
        }

        log::info!(target: "date_summary", "process_date_rows_from_iter; processed={}; parsed={}", row_count, parsed_count);

        // Remove duplicates
        // Note: SQL already returns sorted results, so we don't need to sort here
        dates.dedup_by(|a, b| a.year == b.year && a.month == b.month && a.day == b.day);

        log::info!(target: "date_summary", "process_date_rows_from_iter; final_count={}", dates.len());
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

    fn add_advanced_filters(
        &self,
        sql_query: &mut String,
        params: &mut Vec<Box<dyn rusqlite::ToSql>>,
        filter_params: &serde_json::Value,
    ) -> Result<(), String> {
        // Date range filter - check exif_date_time_original, exif_date_time, and photo_date
        if let Some(start_date) = filter_params.get("start_date").and_then(|v| v.as_str()) {
            if !start_date.is_empty() {
                sql_query.push_str(
                    " AND (exif_date_time_original >= ? OR exif_date_time >= ? OR photo_date >= ?)",
                );
                params.push(Box::new(start_date.to_string()));
                params.push(Box::new(start_date.to_string()));
                params.push(Box::new(start_date.to_string()));
            }
        }

        if let Some(end_date) = filter_params.get("end_date").and_then(|v| v.as_str()) {
            if !end_date.is_empty() {
                sql_query.push_str(
                    " AND (exif_date_time_original <= ? OR exif_date_time <= ? OR photo_date <= ?)",
                );
                params.push(Box::new(end_date.to_string()));
                params.push(Box::new(end_date.to_string()));
                params.push(Box::new(end_date.to_string()));
            }
        }

        // Star rating filter
        if let Some(min_rating) = filter_params.get("min_rating").and_then(|v| v.as_i64()) {
            sql_query.push_str(" AND star >= ?");
            params.push(Box::new(min_rating));
        }

        // Camera filter - match the same ID format used in options generation
        if let Some(camera) = filter_params.get("camera").and_then(|v| v.as_str()) {
            if !camera.is_empty() && camera != "all" {
                if camera == "unknown" {
                    // Filter for photos with unknown camera info
                    sql_query.push_str(" AND (exif_make IS NULL OR exif_model IS NULL OR exif_make = '' OR exif_model = '')");
                } else {
                    sql_query.push_str(" AND LOWER(REPLACE(exif_make, ' ', '_') || '_' || REPLACE(exif_model, ' ', '_')) = ?");
                    params.push(Box::new(camera.to_string()));
                }
            }
        }

        // Lens filter - match the same ID format used in options generation
        if let Some(lens) = filter_params.get("lens").and_then(|v| v.as_str()) {
            if !lens.is_empty() && lens != "all" {
                sql_query.push_str(" AND LOWER(REPLACE(exif_lens_model, ' ', '_')) = ?");
                params.push(Box::new(lens.to_string()));
            }
        }

        // ISO range filter
        if let Some(iso_min) = filter_params.get("iso_min").and_then(|v| v.as_i64()) {
            sql_query.push_str(" AND CAST(exif_iso AS INTEGER) >= ?");
            params.push(Box::new(iso_min));
        }

        if let Some(iso_max) = filter_params.get("iso_max").and_then(|v| v.as_i64()) {
            sql_query.push_str(" AND CAST(exif_iso AS INTEGER) <= ?");
            params.push(Box::new(iso_max));
        }

        // Aperture range filter
        if let Some(aperture_min) = filter_params.get("aperture_min").and_then(|v| v.as_f64()) {
            sql_query.push_str(" AND CAST(exif_fnumber AS REAL) >= ?");
            params.push(Box::new(aperture_min));
        }

        if let Some(aperture_max) = filter_params.get("aperture_max").and_then(|v| v.as_f64()) {
            sql_query.push_str(" AND CAST(exif_fnumber AS REAL) <= ?");
            params.push(Box::new(aperture_max));
        }

        // Focal length range filter
        if let Some(focal_min) = filter_params
            .get("focal_length_min")
            .and_then(|v| v.as_f64())
        {
            sql_query.push_str(" AND CAST(exif_focal_length AS REAL) >= ?");
            params.push(Box::new(focal_min));
        }

        if let Some(focal_max) = filter_params
            .get("focal_length_max")
            .and_then(|v| v.as_f64())
        {
            sql_query.push_str(" AND CAST(exif_focal_length AS REAL) <= ?");
            params.push(Box::new(focal_max));
        }

        // Shutter speed range filter
        if let Some(shutter_min) = filter_params
            .get("shutter_speed_min")
            .and_then(|v| v.as_str())
        {
            if !shutter_min.is_empty() {
                sql_query.push_str(" AND exif_shutter_speed_value >= ?");
                params.push(Box::new(shutter_min.to_string()));
            }
        }

        if let Some(shutter_max) = filter_params
            .get("shutter_speed_max")
            .and_then(|v| v.as_str())
        {
            if !shutter_max.is_empty() {
                sql_query.push_str(" AND exif_shutter_speed_value <= ?");
                params.push(Box::new(shutter_max.to_string()));
            }
        }

        // File extension filter
        if let Some(extension) = filter_params.get("extension").and_then(|v| v.as_str()) {
            if !extension.is_empty() && extension != "all" {
                sql_query.push_str(" AND path LIKE ?");
                params.push(Box::new(format!("%.{}", extension)));
            }
        }

        // Has comments filter
        if let Some(has_comments) = filter_params.get("has_comments").and_then(|v| v.as_bool()) {
            if has_comments {
                sql_query.push_str(" AND comment IS NOT NULL AND comment != ''");
            }
        }

        // Tag filter - only include photos that have ALL selected tags
        if let Some(tag_ids) = filter_params.get("tag_ids").and_then(|v| v.as_array()) {
            if !tag_ids.is_empty() {
                let tag_id_values: Vec<i64> = tag_ids.iter().filter_map(|v| v.as_i64()).collect();

                if !tag_id_values.is_empty() {
                    // Use subquery to find photos that have ALL the specified tags
                    let placeholders: Vec<String> =
                        tag_id_values.iter().map(|_| "?".to_string()).collect();
                    let placeholders_str = placeholders.join(",");

                    sql_query.push_str(&format!(
                        " AND path IN (SELECT photo_path FROM photo_collection_items pci
                          JOIN photo_collections pc ON pc.id = pci.collection_id and pc.type = 'tag'
                          WHERE pci.collection_id IN ({})
                          GROUP BY pci.photo_path HAVING COUNT(DISTINCT pci.collection_id) = ?)",
                        placeholders_str
                    ));

                    // Add the tag IDs as parameters
                    for tag_id in &tag_id_values {
                        params.push(Box::new(*tag_id));
                    }
                    // Add the count of tags for the HAVING clause
                    params.push(Box::new(tag_id_values.len() as i64));
                }
            }
        }

        Ok(())
    }

    pub fn get_camera_options(&self) -> Result<String, String> {
        let conn = self.get_connection().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "
            SELECT
                exif_make,
                exif_model,
                COUNT(*) as count
            FROM photo_metadata
            WHERE exif_make IS NOT NULL AND exif_model IS NOT NULL
            GROUP BY exif_make, exif_model
            ORDER BY count DESC
        ",
            )
            .map_err(|e| e.to_string())?;

        let camera_iter = stmt
            .query_map([], |row| {
                let make: String = row.get("exif_make")?;
                let model: String = row.get("exif_model")?;
                let count: i64 = row.get("count")?;

                let id = format!(
                    "{}_{}",
                    make.replace(" ", "_").to_lowercase(),
                    model.replace(" ", "_").to_lowercase()
                );

                // Debug: Log each camera option generation
                log::debug!(
                    target: "database",
                    "camera_option_created; make={}; model={}; id={}; count={}",
                    make, model, id, count
                );

                Ok(serde_json::json!({
                    "id": id,
                    "make": make,
                    "model": model,
                    "count": count
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut cameras: Vec<serde_json::Value> = Vec::new();
        for camera in camera_iter {
            cameras.push(camera.map_err(|e| e.to_string())?);
        }

        // Count photos with unknown camera info (NULL or empty make/model)
        let unknown_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM photo_metadata
                 WHERE exif_make IS NULL OR exif_model IS NULL
                    OR exif_make = '' OR exif_model = ''",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Add "Unknown" option if there are photos with unknown camera
        if unknown_count > 0 {
            cameras.push(serde_json::json!({
                "id": "unknown",
                "make": "Unknown",
                "model": "Camera",
                "count": unknown_count
            }));
        }

        // Debug: Log camera options for troubleshooting
        log::debug!(
            target: "database",
            "camera_options_generated; camera_count={}; unknown_count={}; sample_cameras=[{}]",
            cameras.len(),
            unknown_count,
            cameras.iter().take(3).map(|c| format!("{:?}", c)).collect::<Vec<_>>().join(", ")
        );

        serde_json::to_string(&cameras).map_err(|e| e.to_string())
    }

    pub fn get_lens_options(&self) -> Result<String, String> {
        let conn = self.get_connection().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "
            SELECT 
                exif_lens_model, 
                COUNT(*) as count 
            FROM photo_metadata 
            WHERE exif_lens_model IS NOT NULL AND exif_lens_model != '' 
            GROUP BY exif_lens_model 
            ORDER BY count DESC
        ",
            )
            .map_err(|e| e.to_string())?;

        let lens_iter = stmt
            .query_map([], |row| {
                let model: String = row.get("exif_lens_model")?;
                let count: i64 = row.get("count")?;

                Ok(serde_json::json!({
                    "id": model.replace(" ", "_").to_lowercase(),
                    "model": model,
                    "count": count
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut lenses: Vec<serde_json::Value> = Vec::new();
        for lens in lens_iter {
            lenses.push(lens.map_err(|e| e.to_string())?);
        }

        serde_json::to_string(&lenses).map_err(|e| e.to_string())
    }

    pub fn get_extension_options(&self) -> Result<String, String> {
        let conn = self.get_connection().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "
            SELECT 
                LOWER(SUBSTR(path, INSTR(path, '.') + 1)) as extension, 
                COUNT(*) as count 
            FROM photo_metadata 
            WHERE INSTR(path, '.') > 0 
            GROUP BY extension 
            ORDER BY count DESC
        ",
            )
            .map_err(|e| e.to_string())?;

        let extension_iter = stmt
            .query_map([], |row| {
                let extension: String = row.get("extension")?;
                let count: i64 = row.get("count")?;

                Ok(serde_json::json!({
                    "extension": extension,
                    "count": count
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut extensions: Vec<serde_json::Value> = Vec::new();
        for extension in extension_iter {
            extensions.push(extension.map_err(|e| e.to_string())?);
        }

        serde_json::to_string(&extensions).map_err(|e| e.to_string())
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
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
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
                        date_str // Already has time component
                    } else {
                        format!("{} 00:00:00", date_str) // Add default time
                    }
                }
                None => {
                    log::warn!(target: "sqlite", "photo_skip; reason=missing_date; file={}; dir={}", photo.file.path, photo.dir.path);
                    continue;
                }
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
                log::error!(target: "sqlite", "db_statement_error; file={}; error={}", photo.file.path, e);
                "Failed to execute statement"
            })?;

            log::debug!(target: "sqlite", "photo_metadata_insert; file={}; date={}", photo.file.path, date);
        }

        // Update date_summary for newly inserted photos
        log::info!(target: "date_summary", "batch_insert_completed; rebuilding_summary=true");
        let _ = date_summary::rebuild_date_summary(self);

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

            // Get existing photo paths from database by directory path (not photo_date)
            // This is important for orphan detection when files are moved
            let existing_photos = match self.get_photo_paths_in_directory(&date_dir.path) {
                Ok(paths) => paths,
                Err(_) => Vec::new(),
            };

            // Create a set of current file paths from filesystem
            let current_paths: std::collections::HashSet<String> =
                photos.photos.iter().map(|p| p.file.path.clone()).collect();

            // Delete photos from database that are no longer in filesystem
            for path in existing_photos.iter() {
                if !current_paths.contains(path) {
                    log::info!(target: "sqlite", "orphaned_photo_delete; path={}", path);
                    self.delete_photo_by_path(path);
                }
            }

            let result = self.record_photos_meta_data(photos.photos);
            if result.is_err() {
                log::error!(target: "sqlite", "photo_recording_error; date={}; error={:?}", date.to_string(), result.err()
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
        // Use range query instead of date() function to utilize index
        // photo_date format: "YYYY-MM-DD HH:MM:SS"
        // Range: "YYYY-MM-DD 00:00:00" <= photo_date < "YYYY-MM-DD+1 00:00:00"
        let date_str = date.to_string();
        let next_date = format!(
            "{} 00:00:00",
            chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .map(|d| d.succ_opt().unwrap_or(d))
                .unwrap_or_else(|_| chrono::NaiveDate::from_ymd_opt(2099, 12, 31).unwrap())
                .format("%Y-%m-%d")
        );

        let query_sql = "SELECT pm.path, COALESCE(pm.exif_date_time_original, pm.exif_date_time, pm.photo_date) as photo_time, pm.star, pm.comment, pm.css_style, pm.google_photos_url,
                            GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '')) as tags, pm.exif_orientation
                     FROM photo_metadata pm
                     LEFT JOIN photo_collection_items pt ON pm.path = pt.photo_path
                     LEFT JOIN photo_collections t ON pt.collection_id = t.id AND t.type = 'tag'
                     WHERE pm.photo_date >= ?1 AND pm.photo_date < ?2 AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
                     GROUP BY pm.path, photo_time, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_orientation";

        log::info!(target: "database", "get_photo_meta_data_in_date_query; query={}; date={}; next_date={}", query_sql, date_str, next_date);

        let mut stmt = conn
            .prepare(query_sql)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let date_start = format!("{} 00:00:00", date_str);
        let rows = stmt
            .query_map(params![date_start, next_date], |row| {
                Ok(utils::photo_info_from_row_with_tags(
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
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
            Err(e) => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        };

        let mut stmt = match conn
            .prepare("SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date) as photo_time, star, comment, css_style, google_photos_url, exif_orientation FROM photo_metadata WHERE path = ?1")
        {
            Ok(stmt) => stmt,
            Err(e) => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        };

        let result = stmt.query_row(params![photo.file.path], |row| {
            Ok(utils::photo_info_from_row(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
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
            Err(e) => photo_meta::PhotoMeta::new(photo.clone()),
        }
    }

    fn get_photo_meta_from_trash(
        &self,
        photo: photo::Photo,
        trash_path: String,
        library_path: String,
    ) -> photo_meta::PhotoMeta {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(e) => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        };

        let mut stmt = match conn
            .prepare("SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date) as photo_time, star, comment, css_style, google_photos_url, exif_orientation FROM photo_metadata WHERE path = ?1")
        {
            Ok(stmt) => stmt,
            Err(e) => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        };

        let result = stmt.query_row(params![photo.file.path], |row| {
            Ok(utils::photo_info_from_row(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        });

        match result {
            Ok(record) => {
                if let Some(photo_meta) = photo_meta::PhotoMeta::new_from_photo_info_from_trash(
                    &record,
                    &trash_path,
                    &library_path,
                ) {
                    photo_meta
                } else {
                    photo_meta::PhotoMeta::new(photo.clone())
                }
            }
            Err(e) => photo_meta::PhotoMeta::new(photo.clone()),
        }
    }

    fn save_star(&self, photo: &photo::Photo, star: star::Star) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        // Use UPDATE to preserve other columns (especially exif_orientation)
        let _ = conn.execute(
            "UPDATE photo_metadata SET star = ?1, updated_at = ?2 WHERE path = ?3",
            params![star.star(), now, photo.file.path],
        );
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        // Use UPDATE to preserve other columns (especially exif_orientation)
        let _ = conn.execute(
            "UPDATE photo_metadata SET comment = ?1, updated_at = ?2 WHERE path = ?3",
            params![comment.comment(), now, photo.file.path],
        );
    }

    fn delete_photo(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Get the photo date before deletion for date_summary update
        let existing_meta = self.get_photo_meta(photo.clone());
        let photo_date = existing_meta.photo_time();

        // Soft delete: set delete_flg = 1 instead of DELETE
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let _ = conn.execute(
            "UPDATE photo_metadata SET delete_flg = 1, updated_at = ? WHERE path = ?",
            params![now, photo.file.path],
        );

        // Update date_summary after deletion (photo is hidden from normal views)
        let _ = date_summary::update_date_summary_for_photo(self, &photo_date, -1);
    }

    fn delete_photo_permanently(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Get the photo date before deletion for date_summary update
        let existing_meta = self.get_photo_meta(photo.clone());
        let photo_date = existing_meta.photo_time();

        // Hard delete: completely remove from database
        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![photo.file.path],
        );

        // Update date_summary after permanent deletion
        let _ = date_summary::update_date_summary_for_photo(self, &photo_date, -1);
    }

    fn restore_photo_from_trash(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Get the photo date for date_summary update
        let existing_meta = self.get_photo_meta(photo.clone());
        let photo_date = existing_meta.photo_time();

        // Restore: set delete_flg = 0
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let _ = conn.execute(
            "UPDATE photo_metadata SET delete_flg = 0, updated_at = ? WHERE path = ?",
            params![now, photo.file.path],
        );

        // Update date_summary after restoration (photo is visible in normal views again)
        let _ = date_summary::update_date_summary_for_photo(self, &photo_date, 1);
    }

    fn update_photo_path(&self, old_path: &str, new_path: &str) -> Result<bool, &str> {
        let conn = self
            .get_connection()
            .map_err(|_| "Failed to connect to database")?;

        let rows_affected = conn
            .execute(
                "UPDATE photo_metadata SET path = ?1 WHERE path = ?2",
                params![new_path, old_path],
            )
            .map_err(|_| "Failed to update photo path")?;

        Ok(rows_affected > 0)
    }

    fn get_photo_count_per_dates(&self, dates: date::Dates) -> DatesNum {
        println!(
            "SQLite::get_photo_count_per_dates() - Getting optimized counts for {} dates",
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

        // Check if date_summary table exists and has data
        let table_exists = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='date_summary'")
            .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)))
            .unwrap_or(false);

        if table_exists {
            let summary_count = conn
                .query_row("SELECT COUNT(*) FROM date_summary", [], |row| {
                    row.get::<_, i32>(0)
                })
                .unwrap_or(0);

            if summary_count > 0 {
                log::debug!(target: "sqlite", "get_photo_count_per_dates; using_optimized_date_summary=true");

                // Use optimized single query from date_summary table
                let date_counts: HashMap<String, i32> = match conn
                    .prepare("SELECT date, photo_count FROM date_summary WHERE date IS NOT NULL")
                {
                    Ok(mut stmt) => {
                        match stmt.query_map([], |row| {
                            let date: String = row.get(0)?;
                            let count: i32 = row.get(1)?;
                            Ok((date, count))
                        }) {
                            Ok(mapped) => mapped.filter_map(Result::ok).collect(),
                            Err(e) => {
                                log::error!(target: "sqlite", "get_photo_count_per_dates; error={}; falling_back_to_empty", e);
                                HashMap::new()
                            }
                        }
                    }
                    Err(e) => {
                        log::error!(target: "sqlite", "get_photo_count_per_dates; prepare_error={}; falling_back_to_empty", e);
                        HashMap::new()
                    }
                };

                // Fill in the requested dates from the cached results
                for date in dates.dates {
                    let date_string = date.to_string();
                    let count = date_counts.get(&date_string).copied().unwrap_or(0);

                    log::debug!(
                        target: "sqlite",
                        "get_photo_count_per_dates; date={}; count={}",
                        date_string, count
                    );
                    dates_num.data.insert(date_string, count);
                }

                log::debug!(
                    target: "sqlite",
                    "get_photo_count_per_dates_complete; optimized_result={}",
                    dates_num.to_json()
                );
                return dates_num;
            }
        }

        // Fallback to original GROUP BY query
        println!("SQLite::get_photo_count_per_dates() - Using fallback GROUP BY query");

        // First, let's see what date formats we actually have in the database
        if let Ok(mut debug_stmt) =
            conn.prepare("SELECT DISTINCT photo_date FROM photo_metadata LIMIT 5")
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
        let mut stmt = match conn.prepare("SELECT date(photo_date) as date_only, COUNT(*) as count FROM photo_metadata WHERE (delete_flg = 0 OR delete_flg IS NULL) GROUP BY date(photo_date)") {
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

    fn get_recent_photos_metadata(&self, limit: u32) -> Result<photo_meta::PhotoMetas, String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        let query = "SELECT pm.*, GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '')) as tags
        FROM photo_metadata pm
        LEFT JOIN photo_collection_items pt ON pm.path = pt.photo_path
        LEFT JOIN photo_collections t ON pt.collection_id = t.id
        WHERE (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
        GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.created_at
        ORDER BY pm.created_at DESC LIMIT ?";

        let mut stmt = conn
            .prepare(query)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map([limit], |row| {
                let path: String = row.get("path")?;
                let photo_date: String = row.get("photo_date")?;
                let exif_date_time_original: Option<String> =
                    row.get("exif_date_time_original").ok();
                let exif_date_time: Option<String> = row.get("exif_date_time").ok();
                let exif_orientation: Option<String> = row.get("exif_orientation").ok();
                let star: i32 = row.get("star")?;
                let comment: String = row.get("comment")?;

                // Use EXIF datetime if available, otherwise use photo_date
                let photo_time = exif_date_time_original
                    .or(exif_date_time)
                    .unwrap_or(photo_date);

                // Create photo object with the date
                let mut photo = crate::entity::photo::Photo::new(
                    crate::value::file::File::new(path.clone()),
                    None,
                );
                photo.set_time(photo_time);
                // Set orientation from database
                if let Some(ref orientation) = exif_orientation {
                    photo.meta_data.orientation = orientation.clone();
                }

                // Create photo_meta object
                let mut photo_meta = photo_meta::PhotoMeta::new(photo);

                // Set metadata fields
                photo_meta.star = star::Star::new(star);
                photo_meta.comment = comment::Comment::new(&comment);

                Ok((path, photo_meta))
            })
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut photo_metas = photo_meta::PhotoMetas::new();
        for row in rows {
            match row {
                Ok((path, meta)) => {
                    photo_metas.insert(&path, meta);
                }
                Err(e) => {
                    log::warn!(target: "recent_photos", "row_processing_error; error={:?}", e);
                }
            }
        }

        Ok(photo_metas)
    }

    // Tag management trait implementations
    fn get_all_tags(&self) -> Result<Vec<(i32, String, Option<String>)>, String> {
        SQLite::get_all_tags(self)
    }

    fn get_all_tags_with_photo_count(
        &self,
    ) -> Result<Vec<(i32, String, Option<String>, i32)>, String> {
        SQLite::get_all_tags_with_photo_count(self)
    }

    fn create_tag(&self, name: &str, color: Option<&str>) -> Result<i32, String> {
        SQLite::create_tag(self, name, color)
    }

    fn delete_tag(&self, tag_id: i32) -> Result<bool, String> {
        SQLite::delete_tag(self, tag_id)
    }

    fn add_tag_to_photo(&self, photo_path: &str, tag_id: i32) -> Result<(), String> {
        SQLite::add_tag_to_photo(self, photo_path, tag_id)
    }

    fn remove_tag_from_photo(&self, photo_path: &str, tag_id: i32) -> Result<bool, String> {
        SQLite::remove_tag_from_photo(self, photo_path, tag_id)
    }

    fn remove_all_tags_from_photo(&self, photo_path: &str) -> Result<i32, String> {
        SQLite::remove_all_tags_from_photo(self, photo_path)
    }

    fn get_tags_for_photo(
        &self,
        photo_path: &str,
    ) -> Result<Vec<(i32, String, Option<String>)>, String> {
        SQLite::get_tags_for_photo(self, photo_path)
    }

    fn get_photos_with_tags(&self, tag_ids: &[i32]) -> Result<Vec<String>, String> {
        SQLite::get_photos_with_tags(self, tag_ids)
    }

    // Album management trait implementations
    fn get_all_albums(&self) -> Result<Vec<(i32, String, String, Option<String>, i32)>, String> {
        SQLite::get_all_albums(self)
    }

    fn create_album(&self, name: &str, description: &str) -> Result<i32, String> {
        SQLite::create_album(self, name, description)
    }

    fn update_album(
        &self,
        id: i32,
        name: &str,
        description: &str,
        cover_photo_path: Option<&str>,
    ) -> Result<bool, String> {
        SQLite::update_album(self, id, name, description, cover_photo_path)
    }

    fn delete_album(&self, id: i32) -> Result<bool, String> {
        SQLite::delete_album(self, id)
    }

    fn add_photo_to_album(&self, album_id: i32, photo_path: &str) -> Result<(), String> {
        SQLite::add_photo_to_album(self, album_id, photo_path)
    }

    fn remove_photo_from_album(&self, album_id: i32, photo_path: &str) -> Result<bool, String> {
        SQLite::remove_photo_from_album(self, album_id, photo_path)
    }

    fn get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String> {
        SQLite::get_album_photos(self, album_id)
    }

    fn get_album_photos_with_metadata(
        &self,
        album_id: i32,
        config: config::Config,
    ) -> Result<Vec<photo::Photo>, String> {
        SQLite::get_album_photos_with_metadata(self, album_id, config)
    }

    fn reorder_album_photos(&self, album_id: i32, photo_order: Vec<String>) -> Result<(), String> {
        SQLite::reorder_album_photos(self, album_id, photo_order)
    }

    // Unified PhotoCollection trait implementations
    fn create_collection(
        &self,
        collection_type: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
    ) -> Result<i32, String> {
        SQLite::create_collection(self, collection_type, name, description, color)
    }

    fn get_all_collections(
        &self,
        collection_type: Option<&str>,
        config: config::Config,
    ) -> Result<Vec<serde_json::Value>, String> {
        SQLite::get_all_collections(self, collection_type, config)
    }

    fn update_collection(
        &self,
        id: i32,
        name: Option<&str>,
        description: Option<&str>,
        color: Option<&str>,
        cover_photo_path: Option<&str>,
    ) -> Result<(), String> {
        SQLite::update_collection(self, id, name, description, color, cover_photo_path)
    }

    fn delete_collection(&self, id: i32) -> Result<bool, String> {
        SQLite::delete_collection(self, id)
    }

    fn add_photo_to_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> {
        SQLite::add_photo_to_collection(self, collection_id, photo_path)
    }

    fn remove_photo_from_collection(
        &self,
        collection_id: i32,
        photo_path: &str,
    ) -> Result<(), String> {
        SQLite::remove_photo_from_collection(self, collection_id, photo_path)
    }

    fn get_collection_photos(
        &self,
        collection_id: i32,
        ordered: bool,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        SQLite::get_collection_photos(self, collection_id, ordered, config)
    }
}

impl SQLite {
    /// Delete photo permanently without updating date_summary (for batch operations)
    /// Note: Permanent delete doesn't decrement date_summary because the photo was already
    /// counted as deleted when it was moved to trash (delete_flg was set to 1)
    pub fn delete_photo_permanently_no_summary(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Hard delete: completely remove from database
        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![photo.file.path],
        );
    }

    /// Get all photo paths in a directory from database (by path pattern, not photo_date)
    pub fn get_photo_paths_in_directory(&self, dir_path: &str) -> Result<Vec<String>, String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        // Query by path pattern: dir_path/% (files directly in directory)
        // Also handle UUID subdirectories: dir_path/%/%
        let pattern = format!("{}/%", dir_path);
        let pattern_uuid = format!("{}/%/%", dir_path);

        let mut stmt = conn
            .prepare("SELECT path FROM photo_metadata WHERE (path LIKE ?1 OR path LIKE ?2) AND (delete_flg = 0 OR delete_flg IS NULL)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![pattern, pattern_uuid], |row| row.get(0))
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut paths = Vec::new();
        for row in rows {
            if let Ok(path) = row {
                paths.push(path);
            }
        }

        log::debug!(target: "sqlite", "get_photo_paths_in_directory; dir={}; count={}", dir_path, paths.len());
        Ok(paths)
    }

    /// Delete photo record by path (for orphan cleanup after file move)
    pub fn delete_photo_by_path(&self, path: &str) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Get photo_date before deletion for date_summary update
        let photo_date: Option<String> = conn
            .query_row(
                "SELECT COALESCE(exif_date_time_original, exif_date_time, photo_date) FROM photo_metadata WHERE path = ?1",
                params![path],
                |row| row.get(0),
            )
            .ok();

        // Hard delete since the file has been moved
        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![path],
        );

        // Update date_summary
        if let Some(date_str) = photo_date {
            let _ = date_summary::update_date_summary_for_photo(self, &date_str, -1);
        }

        log::info!(target: "sqlite", "photo_deleted_by_path; path={}", path);
    }

    /// Restore photo from trash without updating date_summary (for batch operations)
    pub fn restore_photo_from_trash_no_summary(&self, photo: &photo::Photo) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        // Restore: set delete_flg = 0
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let _ = conn.execute(
            "UPDATE photo_metadata SET delete_flg = 0, updated_at = ? WHERE path = ?",
            params![now, photo.file.path],
        );
    }

    /// Check if a photo is in trash (delete_flg = 1)
    /// Returns the trash path if photo is trashed, None otherwise
    pub fn get_trash_path_for_photo(
        &self,
        original_path: &str,
        trash_base_path: &str,
    ) -> Option<String> {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return None,
        };

        // Check if photo is marked as deleted
        let is_trashed = conn
            .query_row(
                "SELECT delete_flg FROM photo_metadata WHERE path = ?1",
                params![original_path],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0);

        if is_trashed == 1 {
            // Calculate trash path: trash_base_path + original_path (without leading /)
            let path_without_slash = original_path.strip_prefix('/').unwrap_or(original_path);
            let trash_path = format!(
                "{}/{}",
                trash_base_path.trim_end_matches('/'),
                path_without_slash
            );
            log::debug!(target: "sqlite", "get_trash_path_for_photo; original_path={}; trash_path={}", original_path, trash_path);
            Some(trash_path)
        } else {
            None
        }
    }

    // Job Queue Methods
    pub fn create_job_unit(
        &self,
        job_unit: &crate::entity::job_queue::JobUnit,
    ) -> Result<(), String> {
        job_queue::create_job_unit(self, job_unit)
    }

    pub fn create_job(
        &self,
        queued_job: &crate::entity::job_queue::QueuedJob,
    ) -> Result<i64, String> {
        job_queue::create_job(self, queued_job)
    }

    pub fn get_pending_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_pending_jobs(self)
    }

    pub fn update_job_status(
        &self,
        job_id: i64,
        status: &crate::entity::job_queue::JobStatus,
        error_message: Option<String>,
    ) -> Result<(), String> {
        job_queue::update_job_status(self, job_id, status, error_message)
    }

    pub fn get_job_unit_progress(
        &self,
        job_unit_id: &str,
    ) -> Result<crate::entity::job_queue::JobProgress, String> {
        job_queue::get_job_unit_progress(self, job_unit_id)
    }

    pub fn update_job_unit_status_if_complete(&self, job_unit_id: &str) -> Result<(), String> {
        job_queue::update_job_unit_status_if_complete(self, job_unit_id)
    }

    pub fn cleanup_completed_jobs(&self) -> Result<(), String> {
        job_queue::cleanup_completed_jobs(self)
    }

    pub fn get_jobs_for_unit(
        &self,
        job_unit_id: &str,
    ) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_jobs_for_unit(self, job_unit_id)
    }

    pub fn reset_running_jobs_to_pending(&self) -> Result<usize, String> {
        job_queue::reset_running_jobs_to_pending(self)
    }

    pub fn get_all_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_all_jobs(self)
    }

    pub fn delete_job(&self, job_id: i64) -> Result<(), String> {
        job_queue::delete_job(self, job_id)
    }

    pub fn delete_job_unit(&self, job_unit_id: &str) -> Result<(), String> {
        job_queue::delete_job_unit(self, job_unit_id)
    }

    pub fn get_photo_created_at(&self, photo: &photo::Photo) -> String {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return "1970-01-01 00:00:00".to_string(),
        };

        let mut stmt = match conn.prepare("SELECT created_at FROM photo_metadata WHERE path = ?1") {
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

    pub fn save_google_photos_url(
        &self,
        photo_path: &str,
        google_photos_url: &str,
    ) -> Result<(), String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected_rows = conn
            .execute(
                "UPDATE photo_metadata SET google_photos_url = ?1, updated_at = ?2 WHERE path = ?3",
                params![google_photos_url, now, photo_path],
            )
            .map_err(|e| format!("Failed to update Google Photos URL: {}", e))?;

        if affected_rows == 0 {
            return Err("Photo not found in database".to_string());
        }

        Ok(())
    }

    pub fn save_css_style(&self, photo_path: &str, css_style: &str) -> Result<(), String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected_rows = conn
            .execute(
                "UPDATE photo_metadata SET css_style = ?1, updated_at = ?2 WHERE path = ?3",
                params![css_style, now, photo_path],
            )
            .map_err(|e| format!("Failed to update CSS style: {}", e))?;

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

    pub fn search_photos(
        &self,
        query: &str,
        search_type: &str,
        filters: &str,
        sort_field: &str,
        sort_order: &str,
        max_photos_per_fetch: u32,
    ) -> Result<String, String> {
        use crate::entity::photo::Photo;
        use crate::entity::photo::Photos;
        use crate::value::exif::ExifData;
        use crate::value::file::File;
        let start_time = std::time::Instant::now();

        log::debug!(
            target: "database",
            "search_photos_start; query={}; search_type={}; filters={}; sort_field={}; sort_order={}",
            query, search_type, filters, sort_field, sort_order
        );

        let conn = self.get_connection().map_err(|e| e.to_string())?;

        // Parse filters JSON
        let filter_params: serde_json::Value =
            serde_json::from_str(filters).unwrap_or(serde_json::json!({}));

        log::debug!(
            target: "database",
            "filters_parsed; filter_count={}",
            filter_params.as_object().map_or(0, |obj| obj.len())
        );

        // Build search query based on search_type with tags
        let mut sql_query = String::from("
        SELECT pm.*, GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags -- 2
        FROM photo_metadata pm
        LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path 
        LEFT JOIN photo_collections pc ON pc.id = pci.collection_id AND pc.type = 'tag'
        WHERE (pm.delete_flg = 0 OR pm.delete_flg IS NULL)");

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // Add search condition based on search_type (only if query is not empty)
        if !query.is_empty() {
            match search_type {
                "filename" => {
                    sql_query.push_str(" AND path LIKE ?");
                    params.push(Box::new(format!("%{}%", query)));
                }
                "comment" => {
                    sql_query.push_str(" AND comment LIKE ?");
                    params.push(Box::new(format!("%{}%", query)));
                }
                "camera" => {
                    sql_query.push_str(" AND (exif_make LIKE ? OR exif_model LIKE ?)");
                    params.push(Box::new(format!("%{}%", query)));
                    params.push(Box::new(format!("%{}%", query)));
                }
                "settings" => {
                    sql_query.push_str(" AND (exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ? OR exif_shutter_speed_value LIKE ?)");
                    let query_pattern = format!("%{}%", query);
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern));
                }
                "date" => {
                    sql_query.push_str(" AND (exif_date_time_original LIKE ? OR exif_date_time LIKE ? OR photo_date LIKE ?)");
                    let query_pattern = format!("%{}%", query);
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern));
                }
                "exif" => {
                    sql_query.push_str(" AND (exif_make LIKE ? OR exif_model LIKE ? OR exif_lens_model LIKE ? OR exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ? OR exif_shutter_speed_value LIKE ?)");
                    let query_pattern = format!("%{}%", query);
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern));
                }
                "all" => {
                    sql_query.push_str(" AND (path LIKE ? OR comment LIKE ? OR exif_make LIKE ? OR exif_model LIKE ? OR exif_lens_model LIKE ? OR exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ?)");
                    let query_pattern = format!("%{}%", query);
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern.clone()));
                    params.push(Box::new(query_pattern));
                }
                _ => {
                    sql_query.push_str(" AND path LIKE ?");
                    params.push(Box::new(format!("%{}%", query)));
                }
            }
        }

        // Add advanced filters
        self.add_advanced_filters(&mut sql_query, &mut params, &filter_params)?;

        // Debug: Log the final SQL query with parameter information
        let param_strings: Vec<String> = params
            .iter()
            .enumerate()
            .map(|(i, param)| match param.to_sql() {
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Text(text))) => {
                    format!("${}: '{}'", i + 1, text)
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Integer(int))) => {
                    format!("${}: {}", i + 1, int)
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Real(real))) => {
                    format!("${}: {}", i + 1, real)
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Null)) => {
                    format!("${}: NULL", i + 1)
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Text(
                    text,
                ))) => {
                    format!("${}: '{}'", i + 1, String::from_utf8_lossy(text))
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Integer(
                    int,
                ))) => {
                    format!("${}: {}", i + 1, int)
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Real(
                    real,
                ))) => {
                    format!("${}: {}", i + 1, real)
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Null)) => {
                    format!("${}: NULL", i + 1)
                }
                Ok(_) => format!("${}: <unknown>", i + 1),
                Err(_) => format!("${}: <error>", i + 1),
            })
            .collect();

        // Create SQL with embedded parameters for better readability
        let mut embedded_sql = sql_query.clone();
        for (i, param) in params.iter().enumerate() {
            let placeholder = "?";
            let replacement = match param.to_sql() {
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Text(ref text))) => {
                    format!("'{}'", text.replace("'", "''")) // Escape single quotes
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Integer(int))) => {
                    int.to_string()
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Real(real))) => {
                    real.to_string()
                }
                Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Null)) => {
                    "NULL".to_string()
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Text(
                    text,
                ))) => {
                    format!("'{}'", String::from_utf8_lossy(text).replace("'", "''"))
                }
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Integer(
                    int,
                ))) => int.to_string(),
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Real(
                    real,
                ))) => real.to_string(),
                Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Null)) => {
                    "NULL".to_string()
                }
                _ => "?".to_string(),
            };
            // Replace the first occurrence of ? with the parameter value
            if let Some(pos) = embedded_sql.find(placeholder) {
                embedded_sql.replace_range(pos..pos + 1, &replacement);
            }
        }

        log::debug!(
            target: "database",
            "sql_with_params; query={}; params=[{}]",
            sql_query,
            param_strings.join(", ")
        );

        log::debug!(
            target: "database",
            "sql_embedded; query={}",
            embedded_sql
        );

        // Debug: Sample database date ranges to help troubleshooting
        if filter_params.get("start_date").is_some() || filter_params.get("end_date").is_some() {
            if let Ok(mut sample_stmt) = conn.prepare("SELECT MIN(exif_date_time_original) as min_date, MAX(exif_date_time_original) as max_date, COUNT(*) as total_photos FROM photo_metadata WHERE exif_date_time_original IS NOT NULL AND exif_date_time_original != ''") {
                if let Ok(sample_row) = sample_stmt.query_row([], |row| {
                    Ok((
                        row.get::<_, Option<String>>("min_date").unwrap_or_default(),
                        row.get::<_, Option<String>>("max_date").unwrap_or_default(),
                        row.get::<_, i64>("total_photos").unwrap_or(0)
                    ))
                }) {
                    log::debug!(
                        target: "database",
                        "database_date_range; min_date={}; max_date={}; total_photos_with_dates={}",
                        sample_row.0.unwrap_or_else(|| "None".to_string()),
                        sample_row.1.unwrap_or_else(|| "None".to_string()),
                        sample_row.2
                    );
                }
            }
        }

        // Add GROUP BY clause for tag aggregation
        sql_query.push_str(" GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_date_time_original, pm.exif_make, pm.exif_model, pm.exif_lens_model");

        // Add ORDER BY clause with primary and secondary sort fields
        let order_direction = if sort_order.to_lowercase() == "asc" {
            "ASC"
        } else {
            "DESC"
        };
        let secondary_direction = "DESC"; // Default secondary sort direction

        match sort_field {
            "exif_date_time_original" => {
                sql_query.push_str(&format!(
                    " ORDER BY pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}",
                    order_direction, secondary_direction, secondary_direction
                ));
            }
            "photo_date" => {
                sql_query.push_str(&format!(
                    " ORDER BY pm.photo_date {}, pm.exif_date_time_original {}, pm.path {}",
                    order_direction, secondary_direction, secondary_direction
                ));
            }
            "path" => {
                sql_query.push_str(&format!(
                    " ORDER BY pm.path {}, pm.exif_date_time_original {}, pm.photo_date {}",
                    order_direction, secondary_direction, secondary_direction
                ));
            }
            "star" => {
                // For star rating, we need to handle NULLs - put them at the end for DESC, beginning for ASC
                let null_handling = if sort_order.to_lowercase() == "desc" {
                    "NULLS LAST"
                } else {
                    "NULLS FIRST"
                };
                sql_query.push_str(&format!(" ORDER BY pm.star {} {}, pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}", 
                    order_direction, null_handling, secondary_direction, secondary_direction, secondary_direction));
            }
            _ => {
                // Default fallback to exif_date_time_original with secondary sorts
                sql_query.push_str(&format!(
                    " ORDER BY pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}",
                    order_direction, secondary_direction, secondary_direction
                ));
            }
        }

        // Add LIMIT clause
        sql_query.push_str(&format!(" LIMIT {}", max_photos_per_fetch));

        // Log the complete SQL with ORDER BY and LIMIT
        log::debug!(
            target: "database",
            "sql_with_params_complete; query={}; params=[{}]",
            sql_query,
            param_strings.join(", ")
        );

        // Execute query
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        log::info!(target: "database", "search_photos_final_query; query={}; param_count={}", sql_query, param_refs.len());

        let mut stmt = conn.prepare(&sql_query).map_err(|e| e.to_string())?;
        let photo_iter = stmt.query_map(&param_refs[..], |row| {
            let photo_path = row.get::<_, String>("path").unwrap_or_default();
            
            // Create Photo entity from file path
            let file_result = File::new_if_exists(photo_path.clone());
            if file_result.is_none() {
                return Err(rusqlite::Error::InvalidPath(photo_path.into()));
            }
            let file = file_result.unwrap();
            
            // Get config for thumbnail checking
            let config = crate::entity::config::Config::new();
            let mut photo = Photo::new(file, Some(config));
            
            // Set thumbnail status
            photo.set_has_thumbnail();
            
            // Set metadata from database
            let star = row.get::<_, i32>("star").unwrap_or(0);
            photo.set_star(star);
            
            let comment = row.get::<_, Option<String>>("comment").unwrap_or_default().unwrap_or_default();
            photo.set_comment(comment);
            
            // Set EXIF data
            let mut exif_data = ExifData::empty();
            if let Some(date_time) = row.get::<_, Option<String>>("exif_date_time_original").unwrap_or_default() {
                exif_data.date_time = date_time;
            }
            if let Some(orientation) = row.get::<_, Option<String>>("exif_orientation").unwrap_or_default() {
                exif_data.orientation = orientation;
            }
            photo.embed_exif(exif_data);
            
            // Process tags from concatenated string: "id:name:color,id:name:color"
            let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
            
            log::info!(target: "database", "search_photos_row_tags; path={}; raw_tags={:?}", photo_path, tags_string);
            
            photo.set_tags_from_string(tags_string);
            
            Ok(photo)
        }).map_err(|e| e.to_string())?;

        let mut photos = Photos::new();
        for photo_result in photo_iter {
            match photo_result {
                Ok(photo) => {
                    log::info!(target: "database", "search_photos_photo_added; path={}; has_tags={}", 
                        photo.file.path, photo.tags.is_some());
                    photos.photos.push(photo);
                }
                Err(e) => {
                    log::error!(target: "database", "search_photos_photo_error; error={}", e);
                    // TODO: continue processing but remove problematic photo from results
                }
            }
        }

        // Results are already limited by SQL LIMIT clause
        let final_count = photos.photos.len();
        let duration = start_time.elapsed();

        let json_response = photos.to_json();

        log::info!(
            target: "database",
            "search_photos_complete; result_count={}; limit={}; duration_ms={}",
            final_count,
            max_photos_per_fetch,
            duration.as_millis()
        );

        // Log first photo with tags for debugging
        if let Some(first_photo) = photos.photos.first() {
            if let Some(tags) = &first_photo.tags {
                log::info!(target: "database", "search_photos_response_sample; first_photo_tags={:?}; path={:?}", 
                    tags, first_photo.file.path);
            }
        }

        Ok(json_response)
    }

    // Date summary public methods
    pub fn update_date_summary_for_date(&self, date: &str, delta: i32) -> Result<(), String> {
        date_summary::update_date_summary_for_date(self, date, delta)
    }

    // Tag operations - delegating to tags module
    pub fn remove_all_tags_from_photo(&self, photo_path: &str) -> Result<i32, String> {
        tags::remove_all_tags_from_photo(self, photo_path)
    }

    pub fn get_tags_for_photo(
        &self,
        photo_path: &str,
    ) -> Result<Vec<(i32, String, Option<String>)>, String> {
        tags::get_tags_for_photo(self, photo_path)
    }

    pub fn get_photos_with_tags(&self, tag_ids: &[i32]) -> Result<Vec<String>, String> {
        tags::get_photos_with_tags(self, tag_ids)
    }

    // Album operations - delegating to albums module
    pub fn get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String> {
        albums::get_album_photos(self, album_id)
    }

    pub fn get_album_photos_with_metadata(
        &self,
        album_id: i32,
        config: config::Config,
    ) -> Result<Vec<photo::Photo>, String> {
        albums::get_album_photos_with_metadata(self, album_id, config)
    }

    pub fn reorder_album_photos(
        &self,
        album_id: i32,
        photo_order: Vec<String>,
    ) -> Result<(), String> {
        albums::reorder_album_photos(self, album_id, photo_order)
    }

    // Unified PhotoCollection Methods

    pub fn create_collection(
        &self,
        collection_type: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
    ) -> Result<i32, String> {
        collections::create_collection(self, collection_type, name, description, color)
    }

    pub fn get_all_collections(
        &self,
        collection_type: Option<&str>,
        config: config::Config,
    ) -> Result<Vec<serde_json::Value>, String> {
        collections::get_all_collections(self, collection_type, config)
    }

    pub fn update_collection(
        &self,
        id: i32,
        name: Option<&str>,
        description: Option<&str>,
        color: Option<&str>,
        cover_photo_path: Option<&str>,
    ) -> Result<(), String> {
        collections::update_collection(self, id, name, description, color, cover_photo_path)
    }

    pub fn delete_collection(&self, id: i32) -> Result<bool, String> {
        collections::delete_collection(self, id)
    }

    pub fn add_photo_to_collection(
        &self,
        collection_id: i32,
        photo_path: &str,
    ) -> Result<(), String> {
        collections::add_photo_to_collection(self, collection_id, photo_path)
    }

    pub fn remove_photo_from_collection(
        &self,
        collection_id: i32,
        photo_path: &str,
    ) -> Result<(), String> {
        collections::remove_photo_from_collection(self, collection_id, photo_path)
    }

    pub fn get_collection_photos(
        &self,
        collection_id: i32,
        ordered: bool,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        collections::get_collection_photos(self, collection_id, ordered, config)
    }

    /// Update EXIF data for a photo if values differ from database
    /// Returns true if any updates were made
    pub fn update_exif_if_changed(
        &self,
        path: &str,
        exif: &crate::value::exif::ExifData,
    ) -> Result<bool, String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        // Get current EXIF values from database
        let mut stmt = conn
            .prepare(
                "SELECT exif_iso, exif_fnumber, exif_date_time, exif_date_time_original,
                        exif_lens_model, exif_make, exif_lens_make, exif_model,
                        exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright,
                        exif_exposure_time, exif_shutter_speed_value, exif_focal_length,
                        exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode,
                        exif_white_balance_mode, exif_orientation
                 FROM photo_metadata WHERE path = ?1",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let db_exif: Option<(
            Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>, Option<String>,
            Option<String>, Option<String>, Option<String>, Option<String>,
        )> = stmt
            .query_row(rusqlite::params![path], |row| {
                Ok((
                    row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                    row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?,
                    row.get(8)?, row.get(9)?, row.get(10)?, row.get(11)?,
                    row.get(12)?, row.get(13)?, row.get(14)?, row.get(15)?,
                    row.get(16)?, row.get(17)?, row.get(18)?, row.get(19)?,
                ))
            })
            .ok();

        if db_exif.is_none() {
            return Ok(false); // Photo not in database
        }

        let db = db_exif.unwrap();

        // Helper to check if update needed (file value is not empty and differs from DB)
        let needs_update = |file_val: &str, db_val: &Option<String>| -> bool {
            if file_val.is_empty() {
                return false;
            }
            match db_val {
                None => true,
                Some(db_str) => db_str.is_empty() || db_str != file_val,
            }
        };

        // Helper for datetime fields - use DateTime value object for comparison
        // This handles different date formats (2025:11:23 vs 2025/11/23) correctly
        let needs_update_datetime = |file_val: &str, db_val: &Option<String>| -> bool {
            if file_val.is_empty() {
                return false;
            }
            match db_val {
                None => true,
                Some(db_str) => {
                    if db_str.is_empty() {
                        return true;
                    }
                    // Use DateTime value object to compare dates regardless of format
                    !crate::value::date::DateTime::are_equal(file_val, db_str)
                }
            }
        };

        // Check each field for differences
        let mut updates: Vec<(&str, &str)> = Vec::new();

        if needs_update(&exif.iso, &db.0) { updates.push(("exif_iso", &exif.iso)); }
        if needs_update(&exif.fnumber, &db.1) { updates.push(("exif_fnumber", &exif.fnumber)); }
        // Use DateTime-aware comparison for date fields to handle format differences
        if needs_update_datetime(&exif.date_time, &db.2) { updates.push(("exif_date_time", &exif.date_time)); }
        if needs_update_datetime(&exif.date_time_original, &db.3) { updates.push(("exif_date_time_original", &exif.date_time_original)); }
        if needs_update(&exif.lens_model, &db.4) { updates.push(("exif_lens_model", &exif.lens_model)); }
        if needs_update(&exif.make, &db.5) { updates.push(("exif_make", &exif.make)); }
        if needs_update(&exif.lens_make, &db.6) { updates.push(("exif_lens_make", &exif.lens_make)); }
        if needs_update(&exif.model, &db.7) { updates.push(("exif_model", &exif.model)); }
        if needs_update(&exif.xresolution, &db.8) { updates.push(("exif_xresolution", &exif.xresolution)); }
        if needs_update(&exif.yresolution, &db.9) { updates.push(("exif_yresolution", &exif.yresolution)); }
        if needs_update(&exif.resolution_unit, &db.10) { updates.push(("exif_resolution_unit", &exif.resolution_unit)); }
        if needs_update(&exif.copyright, &db.11) { updates.push(("exif_copyright", &exif.copyright)); }
        if needs_update(&exif.exposure_time, &db.12) { updates.push(("exif_exposure_time", &exif.exposure_time)); }
        if needs_update(&exif.shutter_speed_value, &db.13) { updates.push(("exif_shutter_speed_value", &exif.shutter_speed_value)); }
        if needs_update(&exif.focal_length, &db.14) { updates.push(("exif_focal_length", &exif.focal_length)); }
        if needs_update(&exif.focal_length_in35mm_film, &db.15) { updates.push(("exif_focal_length_in35mm_film", &exif.focal_length_in35mm_film)); }
        if needs_update(&exif.digital_zoom_ratio, &db.16) { updates.push(("exif_digital_zoom_ratio", &exif.digital_zoom_ratio)); }
        if needs_update(&exif.exposure_mode, &db.17) { updates.push(("exif_exposure_mode", &exif.exposure_mode)); }
        if needs_update(&exif.white_balance_mode, &db.18) { updates.push(("exif_white_balance_mode", &exif.white_balance_mode)); }
        if needs_update(&exif.orientation, &db.19) { updates.push(("exif_orientation", &exif.orientation)); }

        if updates.is_empty() {
            return Ok(false);
        }

        // Build and execute UPDATE statement
        let set_clauses: Vec<String> = updates
            .iter()
            .enumerate()
            .map(|(i, (col, _))| format!("{} = ?{}", col, i + 1))
            .collect();

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let sql = format!(
            "UPDATE photo_metadata SET {}, updated_at = ?{} WHERE path = ?{}",
            set_clauses.join(", "),
            updates.len() + 1,
            updates.len() + 2
        );

        log::info!(
            target: "sqlite",
            "exif_sync_update; path={}; fields_updated={}",
            path,
            updates.iter().map(|(col, _)| *col).collect::<Vec<_>>().join(",")
        );

        // Execute with dynamic params
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = updates
            .iter()
            .map(|(_, val)| Box::new(val.to_string()) as Box<dyn rusqlite::ToSql>)
            .collect();
        params.push(Box::new(now));
        params.push(Box::new(path.to_string()));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("Failed to update EXIF: {}", e))?;

        Ok(true)
    }
}
