use crate::entity::{photo, photo_meta};
use crate::repository::{meta_db, DatesNum, MetaInfoDB};
use crate::value::{comment, date, file, star};
use csv::ReaderBuilder;
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use std::fs;
use std::path;

pub struct SQLite {
    db_path: String,
}

impl SQLite {
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
                    "CREATE TABLE IF NOT EXISTS photo_metadata (
                        path TEXT PRIMARY KEY,
                        photo_date TEXT NOT NULL,
                        star INTEGER NOT NULL DEFAULT 0,
                        comment TEXT NOT NULL DEFAULT ''
                    )",
                    [],
                );
            }
        }
        sqlite
    }

    fn init_db(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        
        // Check if table exists and what columns it has
        let table_info = conn.prepare("PRAGMA table_info(photo_metadata)");
        let table_exists = table_info.is_ok();
        
        if table_exists {
            // Check if old 'date' column exists
            let mut has_old_date_column = false;
            let mut has_new_photo_date_column = false;
            
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
                        }
                    }
                }
            }
            
            // Migrate old table structure to new one
            if has_old_date_column && !has_new_photo_date_column {
                println!("Migrating database schema from 'date' to 'photo_date' column");
                
                // Create new table with correct schema
                conn.execute(
                    "CREATE TABLE photo_metadata_new (
                        path TEXT PRIMARY KEY,
                        photo_date TEXT NOT NULL,
                        star INTEGER NOT NULL DEFAULT 0,
                        comment TEXT NOT NULL DEFAULT ''
                    )",
                    [],
                )?;
                
                // Copy data from old table to new table, converting date format
                conn.execute(
                    "INSERT INTO photo_metadata_new (path, photo_date, star, comment)
                     SELECT path, REPLACE(date, '/', '-'), star, comment FROM photo_metadata",
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
                
                println!("Database schema migration completed");
            }
        } else {
            // Create new table with correct schema
            conn.execute(
                "CREATE TABLE IF NOT EXISTS photo_metadata (
                    path TEXT PRIMARY KEY,
                    photo_date TEXT NOT NULL,
                    star INTEGER NOT NULL DEFAULT 0,
                    comment TEXT NOT NULL DEFAULT ''
                )",
                [],
            )?;
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date)",
                [],
            )?;
        }
        
        Ok(())
    }

    fn get_connection(&self) -> Result<Connection> {
        Connection::open(&self.db_path)
    }

    fn photo_info_from_row(
        path: String,
        date: String,
        star: i32,
        comment: String,
    ) -> meta_db::PhotoInfo {
        meta_db::PhotoInfo {
            path,
            date,
            star,
            comment,
        }
    }

    pub fn migrate_from_tsv_files(&self, root_path: &str) -> Result<usize, String> {
        let conn = self
            .get_connection()
            .map_err(|e| format!("Failed to connect to database: {}", e))?;
        let mut total_migrated = 0;

        // Find all .photoclove-dir-info.tsv files
        let tsv_files = self.find_tsv_files(root_path)?;

        for tsv_file in tsv_files {
            match self.migrate_single_tsv_file(&conn, &tsv_file) {
                Ok(count) => {
                    total_migrated += count;
                    println!("Migrated {} records from {}", count, tsv_file.display());
                }
                Err(e) => {
                    eprintln!("Error migrating {}: {}", tsv_file.display(), e);
                }
            }
        }

        Ok(total_migrated)
    }

    fn find_tsv_files(&self, root_path: &str) -> Result<Vec<path::PathBuf>, String> {
        let mut tsv_files = Vec::new();

        fn visit_dir(dir: &path::Path, tsv_files: &mut Vec<path::PathBuf>) -> Result<(), String> {
            if !dir.is_dir() {
                return Ok(());
            }

            let entries = fs::read_dir(dir)
                .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

            for entry in entries {
                let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
                let path = entry.path();

                if path.is_dir() {
                    visit_dir(&path, tsv_files)?;
                } else if path.file_name().and_then(|n| n.to_str())
                    == Some(".photoclove-dir-info.tsv")
                {
                    tsv_files.push(path);
                }
            }
            Ok(())
        }

        visit_dir(path::Path::new(root_path), &mut tsv_files)?;
        Ok(tsv_files)
    }

    fn migrate_single_tsv_file(
        &self,
        conn: &Connection,
        tsv_file: &path::Path,
    ) -> Result<usize, String> {
        let file = fs::File::open(tsv_file)
            .map_err(|e| format!("Failed to open {}: {}", tsv_file.display(), e))?;

        let mut rdr = ReaderBuilder::new()
            .delimiter(b'\t')
            .flexible(true)
            .from_reader(file);

        let mut stmt = conn
            .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let mut count = 0;
        for result in rdr.deserialize() {
            match result {
                Ok(record) => {
                    let photo_info: meta_db::PhotoInfo = record;
                    // Convert date format from "yyyy/mm/dd hh:mm:ss" to "yyyy-mm-dd hh:mm:ss"
                    let converted_date = photo_info.date.replace("/", "-");
                    println!("Migration: Converting date '{}' to '{}'", photo_info.date, converted_date);
                    stmt.execute(params![
                        photo_info.path,
                        converted_date,
                        photo_info.star,
                        photo_info.comment
                    ])
                    .map_err(|e| format!("Failed to insert record: {}", e))?;
                    count += 1;
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to parse row in {}: {}",
                        tsv_file.display(),
                        e
                    );
                }
            }
        }

        Ok(count)
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
            .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|_| "Failed to prepare statement")?;

        for (path, meta) in photo_metas.iter() {
            stmt.execute(params![
                path,
                meta.photo_time(),
                meta.star.star(),
                meta.comment.comment()
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
            .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|_| "Failed to prepare statement")?;

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
                None => continue,
            };

            // Check if photo already exists
            let existing_meta = self.get_photo_meta(photo.clone());

            stmt.execute(params![
                photo.file.path,
                date,
                existing_meta.star.star(),
                existing_meta.comment.comment()
            ])
            .map_err(|_| "Failed to execute statement")?;
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
            .prepare("SELECT path, photo_date, star, comment FROM photo_metadata WHERE date(photo_date) = ?1")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![date.to_string()], |row| {
                Ok(Self::photo_info_from_row(
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
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
            .prepare("SELECT path, photo_date, star, comment FROM photo_metadata WHERE path = ?1")
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

        let _ = conn.execute(
            "INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment) VALUES (?1, ?2, ?3, ?4)",
            params![
                photo.file.path,
                existing_meta.photo_time(),
                star.star(),
                existing_meta.comment.comment()
            ],
        );
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        let conn = match self.get_connection() {
            Ok(conn) => conn,
            Err(_) => return,
        };

        let existing_meta = self.get_photo_meta(photo.clone());

        let _ = conn.execute(
            "INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment) VALUES (?1, ?2, ?3, ?4)",
            params![
                photo.file.path,
                existing_meta.photo_time(),
                existing_meta.star.star(),
                comment.comment()
            ],
        );
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
