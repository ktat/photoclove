//! Photo metadata recording and retrieval operations for SQLite repository

use super::{date_summary, utils, SQLite};
use crate::entity::{photo, photo_meta};
use crate::value::{comment, date, file, star};
use rusqlite::params;
use std::collections::HashMap;

/// Record photo metadata from PhotoMetas collection
#[allow(dead_code)]
pub fn record_photo_metas(
    sqlite: &SQLite,
    _info_path: std::path::PathBuf,
    photo_metas: photo_meta::PhotoMetas,
) -> Result<bool, &'static str> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database")?;
    let mut stmt = conn
        .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                 exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                 exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                 exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)")
        .map_err(|_| "Failed to prepare statement")?;

    let now = date::DateTime::now().to_db_string();
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

/// Record photo metadata from Photos collection (with EXIF data)
pub fn record_photos_meta_data(sqlite: &SQLite, photos: Vec<photo::Photo>) -> Result<bool, &'static str> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database")?;
    let mut stmt = conn
        .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                 exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                 exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                 exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)")
        .map_err(|_| "Failed to prepare statement")?;

    let now = date::DateTime::now().to_db_string();
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
        let existing_meta = get_photo_meta(sqlite, photo.clone());

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
    let _ = date_summary::rebuild_date_summary(sqlite);

    Ok(true)
}

/// Record all photo metadata for given dates
pub fn record_photos_all_meta_data(
    sqlite: &SQLite,
    dates: date::Dates,
) -> Result<HashMap<String, usize>, &'static str> {
    let mut date_num: HashMap<String, usize> = HashMap::new();
    let db_path = sqlite.db_path();

    for date in dates.dates {
        let date_dir = file::Dir::new(format!(
            "{}/{}",
            db_path.replace("/photoclove.db", ""),
            date.to_string()
        ));
        let files = crate::domain_service::dir_service::find_files(&date_dir);
        let photos = crate::domain_service::photo_service::photos_from_dir(files);

        date_num.insert(date.to_string(), photos.photos.len());

        // Get existing photo paths from database by directory path (not photo_date)
        // This is important for orphan detection when files are moved
        let existing_photos = match sqlite.get_photo_paths_in_directory(&date_dir.path) {
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
                sqlite.delete_photo_by_path(path);
            }
        }

        let result = record_photos_meta_data(sqlite, photos.photos);
        if result.is_err() {
            log::error!(target: "sqlite", "photo_recording_error; date={}; error={:?}", date.to_string(), result.err()
            );
        }
    }

    Ok(date_num)
}

/// Get photo metadata for a specific date
pub fn get_photo_meta_data_in_date(
    sqlite: &SQLite,
    date: date::Date,
) -> Result<photo_meta::PhotoMetas, String> {
    let conn = sqlite
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

const PHOTO_META_QUERY: &str =
    "SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date) as photo_time, star, comment, css_style, google_photos_url, exif_orientation FROM photo_metadata WHERE path = ?1";

/// Internal helper to fetch photo info from database
fn fetch_photo_info(
    sqlite: &SQLite,
    photo_path: &str,
) -> Option<crate::repository::meta_db::PhotoInfo> {
    let conn = sqlite.get_connection().ok()?;
    let mut stmt = conn.prepare(PHOTO_META_QUERY).ok()?;

    stmt.query_row(params![photo_path], |row| {
        Ok(utils::photo_info_from_row(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
        ))
    })
    .ok()
}

/// Get photo metadata for a specific photo
pub fn get_photo_meta(sqlite: &SQLite, photo: photo::Photo) -> photo_meta::PhotoMeta {
    match fetch_photo_info(sqlite, &photo.file.path) {
        Some(record) => photo_meta::PhotoMeta::new_from_photo_info(&record)
            .unwrap_or_else(|| photo_meta::PhotoMeta::new(photo.clone())),
        None => photo_meta::PhotoMeta::new(photo.clone()),
    }
}

/// Get photo metadata from trash
pub fn get_photo_meta_from_trash(
    sqlite: &SQLite,
    photo: photo::Photo,
    trash_path: String,
    library_path: String,
) -> photo_meta::PhotoMeta {
    match fetch_photo_info(sqlite, &photo.file.path) {
        Some(record) => {
            photo_meta::PhotoMeta::new_from_photo_info_from_trash(&record, &trash_path, &library_path)
                .unwrap_or_else(|| photo_meta::PhotoMeta::new(photo.clone()))
        }
        None => photo_meta::PhotoMeta::new(photo.clone()),
    }
}

/// Get recent photos metadata
pub fn get_recent_photos_metadata(
    sqlite: &SQLite,
    limit: u32,
) -> Result<photo_meta::PhotoMetas, String> {
    let conn = sqlite
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
            let star_val: i32 = row.get("star")?;
            let comment_val: String = row.get("comment")?;

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
            photo_meta.star = star::Star::new(star_val);
            photo_meta.comment = comment::Comment::new(&comment_val);

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
