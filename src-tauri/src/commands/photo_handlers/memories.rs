//! "On This Day" memories handler.
//!
//! Retrieves photos taken on the same month-day in previous years.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;
use crate::repository;
use crate::value::file;
use rusqlite::params;

/// Handle memories request - get photos from same day in previous years
pub async fn handle(ctx: &HandlerContext<'_>, _params: &SearchParams) -> Result<String, ()> {
    let now = chrono::Local::now();
    let month = now.format("%m").to_string().parse::<u32>().unwrap_or(1);
    let day = now.format("%d").to_string().parse::<u32>().unwrap_or(1);

    log::info!(target: "memories", "handle_memories; month={}; day={}", month, day);

    let sqlite = repository::meta_db::sqlite::SQLite::new(ctx.config.import_to.clone());

    match get_memories_photos_grouped(&sqlite, month, day) {
        Ok(groups) => {
            let response = MemoriesResponse { groups };
            Ok(serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(e) => {
            log::error!(target: "memories", "get_memories_error; error={}", e);
            Ok("{}".to_string())
        }
    }
}

/// Handle memories request for startup image - get random photo from past
pub async fn handle_startup(ctx: &HandlerContext<'_>, _params: &SearchParams) -> Result<String, ()> {
    let now = chrono::Local::now();
    let month = now.format("%m").to_string().parse::<u32>().unwrap_or(1);
    let day = now.format("%d").to_string().parse::<u32>().unwrap_or(1);

    log::info!(target: "memories", "handle_startup_memories; month={}; day={}", month, day);

    let sqlite = repository::meta_db::sqlite::SQLite::new(ctx.config.import_to.clone());

    match get_memories_photos(&sqlite, month, day, 100) {
        Ok(photos) => {
            if photos.is_empty() {
                return Ok("{}".to_string());
            }
            // Return pseudo-random photo for startup image using current time
            let now = chrono::Local::now();
            let seed = (now.timestamp_millis() as usize) % photos.len();
            let photo = &photos[seed];
            // Return absolute path for frontend convertFileSrc
            let abs_path = crate::value::file::to_absolute_path(&photo.file.path, &ctx.config.import_to);
            let response = StartupMemoryResponse {
                path: abs_path,
                has_memories: true,
            };
            Ok(serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(e) => {
            log::error!(target: "memories", "get_startup_memories_error; error={}", e);
            Ok("{}".to_string())
        }
    }
}

/// Get photos from the same month-day in previous years
fn get_memories_photos(
    sqlite: &repository::meta_db::sqlite::SQLite,
    month: u32,
    day: u32,
    limit: u32,
) -> Result<Vec<photo::Photo>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Use LIKE pattern for matching month-day
    // photo_date format: "YYYY-MM-DD HH:MM:SS"
    let month_day_pattern = format!("%-{:02}-{:02} %", month, day);
    let current_year_pattern = format!("{}-%", chrono::Local::now().format("%Y"));

    log::info!(target: "memories", "get_memories_photos; month_day_pattern={}; current_year_pattern={}; limit={}", month_day_pattern, current_year_pattern, limit);

    let query = "SELECT pm.path, COALESCE(pm.exif_date_time_original, pm.exif_date_time, pm.photo_date) as photo_time,
                        pm.exif_orientation
                 FROM photo_metadata pm
                 WHERE pm.photo_date LIKE ?1
                   AND pm.photo_date NOT LIKE ?2
                   AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
                 ORDER BY pm.photo_date DESC
                 LIMIT ?3";

    log::debug!(target: "memories", "get_memories_photos; query={}", query);

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![month_day_pattern, current_year_pattern, limit], |row| {
            let path: String = row.get(0)?;
            let photo_time: String = row.get(1)?;
            let exif_orientation: Option<String> = row.get(2)?;

            // path is relative from DB
            let mut photo = photo::Photo::new(file::File::from_relative(path), None);
            photo.set_time(photo_time);
            if let Some(ref orientation) = exif_orientation {
                photo.meta_data.orientation = orientation.clone();
            }

            Ok(photo)
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut photos = Vec::new();
    for photo in rows.flatten() {
        photos.push(photo);
    }

    Ok(photos)
}

/// Get memories photos grouped by year
fn get_memories_photos_grouped(
    sqlite: &repository::meta_db::sqlite::SQLite,
    month: u32,
    day: u32,
) -> Result<Vec<MemoriesGroup>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Use LIKE pattern for matching month-day
    let month_day_pattern = format!("%-{:02}-{:02} %", month, day);
    let current_year: i32 = chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2024);
    let current_year_pattern = format!("{}-%", current_year);

    log::info!(target: "memories", "get_memories_photos_grouped; month_day_pattern={}; current_year_pattern={}", month_day_pattern, current_year_pattern);

    let query = "SELECT pm.path, COALESCE(pm.exif_date_time_original, pm.exif_date_time, pm.photo_date) as photo_time,
                        pm.exif_orientation, substr(pm.photo_date, 1, 4) as photo_year
                 FROM photo_metadata pm
                 WHERE pm.photo_date LIKE ?1
                   AND pm.photo_date NOT LIKE ?2
                   AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
                 ORDER BY pm.photo_date DESC";

    log::debug!(target: "memories", "get_memories_photos_grouped; query={}", query);

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![month_day_pattern, current_year_pattern], |row| {
            let path: String = row.get(0)?;
            let photo_time: String = row.get(1)?;
            let exif_orientation: Option<String> = row.get(2)?;
            let photo_year: String = row.get(3)?;

            // path is relative from DB
            let mut photo = photo::Photo::new(file::File::from_relative(path), None);
            photo.set_time(photo_time);
            if let Some(ref orientation) = exif_orientation {
                photo.meta_data.orientation = orientation.clone();
            }

            Ok((photo_year, photo))
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    // Group by year
    let mut grouped: std::collections::HashMap<String, Vec<photo::Photo>> = std::collections::HashMap::new();
    for (year, photo) in rows.flatten() {
        grouped.entry(year).or_default().push(photo);
    }

    // Convert to sorted vector with years_ago calculation
    let mut result: Vec<MemoriesGroup> = grouped
        .into_iter()
        .map(|(year, photos)| {
            let year_int: i32 = year.parse().unwrap_or(current_year);
            let years_ago = current_year - year_int;
            MemoriesGroup {
                year,
                years_ago,
                photos,
            }
        })
        .collect();
    result.sort_by(|a, b| a.years_ago.cmp(&b.years_ago));

    log::info!(target: "memories", "get_memories_grouped; years_count={}", result.len());
    Ok(result)
}

#[derive(Debug, serde::Serialize)]
pub struct MemoriesGroup {
    pub year: String,
    pub years_ago: i32,
    pub photos: Vec<photo::Photo>,
}

#[derive(Debug, serde::Serialize)]
pub struct MemoriesResponse {
    pub groups: Vec<MemoriesGroup>,
}

#[derive(Debug, serde::Serialize)]
pub struct StartupMemoryResponse {
    pub path: String,
    pub has_memories: bool,
}
