//! SQL query implementations for photography statistics.

use super::stats_types::*;
use crate::entity::config::Config;
use crate::repository::meta_db::sqlite::SQLite;
use chrono::NaiveDate;
use rusqlite::Connection;
use std::fs;
use std::path::Path;

/// Get shooting time statistics (hour of day, day of week)
pub fn get_shooting_time_stats(
    sqlite: &SQLite,
    period: &TimePeriod,
) -> Result<ShootingTimeStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // Hour distribution from exif_date_time_original
    let hour_query = format!(
        "SELECT
            CAST(SUBSTR(COALESCE(exif_date_time_original, photo_date), 12, 2) AS INTEGER) as hour,
            COUNT(*) as count
         FROM photo_metadata
         WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
           AND (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY hour
         ORDER BY hour",
        date_filter
    );

    let mut hour_stmt = conn
        .prepare(&hour_query)
        .map_err(|e| format!("Failed to prepare hour query: {}", e))?;

    let by_hour: Vec<HourCount> = hour_stmt
        .query_map([], |row| {
            Ok(HourCount {
                hour: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query hours: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Day of week distribution
    let day_query = format!(
        "SELECT
            CAST(strftime('%w', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) as day,
            COUNT(*) as count
         FROM photo_metadata
         WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
           AND (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY day
         ORDER BY day",
        date_filter
    );

    let mut day_stmt = conn
        .prepare(&day_query)
        .map_err(|e| format!("Failed to prepare day query: {}", e))?;

    let day_names = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    let by_day_of_week: Vec<DayOfWeekCount> = day_stmt
        .query_map([], |row| {
            let day: u32 = row.get(0)?;
            Ok(DayOfWeekCount {
                day,
                day_name: day_names
                    .get(day as usize)
                    .unwrap_or(&"Unknown")
                    .to_string(),
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query days: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ShootingTimeStats {
        by_hour,
        by_day_of_week,
    })
}

/// Get camera settings distribution
pub fn get_camera_settings_stats(
    sqlite: &SQLite,
    period: &TimePeriod,
) -> Result<CameraSettingsStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // ISO distribution
    let iso = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_iso, COUNT(*) FROM photo_metadata
             WHERE exif_iso IS NOT NULL AND exif_iso != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_iso ORDER BY CAST(exif_iso AS INTEGER) LIMIT 20",
            date_filter
        ),
        |value| format!("ISO {}", value),
    )?;

    // Aperture distribution
    let aperture = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_fnumber, COUNT(*) FROM photo_metadata
             WHERE exif_fnumber IS NOT NULL AND exif_fnumber != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_fnumber ORDER BY CAST(exif_fnumber AS REAL) LIMIT 20",
            date_filter
        ),
        |value| format!("f/{}", value),
    )?;

    // Shutter speed distribution
    let shutter_speed = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_exposure_time, COUNT(*) as count FROM photo_metadata
             WHERE exif_exposure_time IS NOT NULL AND exif_exposure_time != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_exposure_time ORDER BY count DESC LIMIT 20",
            date_filter
        ),
        format_shutter_speed,
    )?;

    // Focal length distribution
    let focal_length = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_focal_length, COUNT(*) FROM photo_metadata
             WHERE exif_focal_length IS NOT NULL AND exif_focal_length != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_focal_length ORDER BY CAST(exif_focal_length AS REAL) LIMIT 20",
            date_filter
        ),
        |value| format!("{}mm", value),
    )?;

    Ok(CameraSettingsStats {
        iso,
        aperture,
        shutter_speed,
        focal_length,
    })
}

/// Get equipment usage statistics
pub fn get_equipment_stats(sqlite: &SQLite, period: &TimePeriod) -> Result<EquipmentStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // Camera usage
    let camera_query = format!(
        "SELECT 
            COALESCE(exif_model, 'Unknown') as camera,
            COUNT(*) as count
         FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY camera
         ORDER BY count DESC
         LIMIT 10",
        date_filter
    );

    let cameras = query_equipment_distribution(&conn, &camera_query)?;

    // Lens usage
    let lens_query = format!(
        "SELECT
            CASE
                WHEN exif_lens_model IS NOT NULL AND exif_lens_model != '' THEN exif_lens_model
                ELSE 'Unknown'
            END as lens,
            COUNT(*) as count
         FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY lens
         ORDER BY count DESC
         LIMIT 10",
        date_filter
    );

    let lenses = query_equipment_distribution(&conn, &lens_query)?;

    Ok(EquipmentStats { cameras, lenses })
}

/// Get organization metrics
pub fn get_organization_stats(
    sqlite: &SQLite,
    period: &TimePeriod,
) -> Result<OrganizationStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // Total photos count
    let total_photos: u32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM photo_metadata 
                 WHERE (delete_flg = 0 OR delete_flg IS NULL){}",
                date_filter
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Photos with EXIF data
    let total_photos_with_exif: u32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM photo_metadata 
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                   AND exif_date_time_original IS NOT NULL{}",
                date_filter
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Total tags and albums
    let total_tags: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_collections WHERE type = 'tag'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_albums: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_collections WHERE type = 'album'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Photos with tags
    let photos_with_tags: u32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(DISTINCT pci.photo_path) 
                 FROM photo_collection_items pci
                 JOIN photo_collections pc ON pci.collection_id = pc.id
                 JOIN photo_metadata pm ON pci.photo_path = pm.path
                 WHERE pc.type = 'tag' 
                   AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL){}",
                date_filter
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Photos in albums
    let photos_in_albums: u32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(DISTINCT pci.photo_path)
                 FROM photo_collection_items pci
                 JOIN photo_collections pc ON pci.collection_id = pc.id
                 JOIN photo_metadata pm ON pci.photo_path = pm.path
                 WHERE pc.type = 'album'
                   AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL){}",
                date_filter
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(OrganizationStats {
        total_photos,
        total_photos_with_exif,
        total_tags,
        total_albums,
        photos_with_tags,
        photos_in_albums,
    })
}

/// Get storage usage statistics
pub fn get_storage_stats(config: &Config) -> Result<StorageStats, String> {
    // Calculate storage from the import_to directory (photo library)
    let photo_path = Path::new(&config.import_to);
    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;
    let mut largest_size: u64 = 0;

    if photo_path.exists() {
        calculate_directory_stats(
            photo_path,
            &mut total_size,
            &mut file_count,
            &mut largest_size,
        )?;
    }

    // Calculate thumbnail cache size
    let thumbnail_path = Path::new(&config.thumbnail_store);
    let mut thumbnail_size: u64 = 0;
    let mut thumb_count: u64 = 0;
    let mut thumb_largest: u64 = 0;

    if thumbnail_path.exists() {
        calculate_directory_stats(
            thumbnail_path,
            &mut thumbnail_size,
            &mut thumb_count,
            &mut thumb_largest,
        )?;
    }

    // Calculate face thumbnail size (in thumbnail_store/faces/)
    let face_path = thumbnail_path.join("faces");
    let mut face_size: u64 = 0;
    let mut face_count: u64 = 0;
    let mut face_largest: u64 = 0;

    if face_path.exists() {
        calculate_directory_stats(
            &face_path,
            &mut face_size,
            &mut face_count,
            &mut face_largest,
        )?;
    }

    // Subtract face size from thumbnail size (since faces are inside thumbnail_store)
    let thumbnail_only_size = thumbnail_size.saturating_sub(face_size);

    Ok(StorageStats {
        total_size_bytes: total_size,
        thumbnail_size_bytes: thumbnail_only_size,
        face_thumbnail_size_bytes: face_size,
    })
}

// Helper functions

fn query_setting_distribution<F>(
    conn: &Connection,
    query: &str,
    format_fn: F,
) -> Result<Vec<SettingCount>, String>
where
    F: Fn(&str) -> String,
{
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare setting query: {}", e))?;

    let results = stmt
        .query_map([], |row| {
            let value: String = row.get(0)?;
            let count: u32 = row.get(1)?;
            Ok(SettingCount {
                display: format_fn(&value),
                value,
                count,
            })
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

fn format_shutter_speed(value: &str) -> String {
    if value.starts_with("1/") {
        value.to_string()
    } else {
        match value.parse::<f64>() {
            Ok(seconds) if seconds >= 1.0 => format!("{}s", seconds),
            Ok(seconds) => format!("1/{}", (1.0 / seconds).round()),
            Err(_) => value.to_string(),
        }
    }
}

fn query_equipment_distribution(
    conn: &Connection,
    query: &str,
) -> Result<Vec<EquipmentCount>, String> {
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare equipment query: {}", e))?;

    let equipment: Vec<(String, u32)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query equipment: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let total: u32 = equipment.iter().map(|(_, count)| count).sum();

    let equipment_counts = equipment
        .iter()
        .map(|(name, count)| EquipmentCount {
            name: name.clone(),
            count: *count,
            percentage: if total > 0 {
                (*count as f32 / total as f32) * 100.0
            } else {
                0.0
            },
        })
        .collect();

    Ok(equipment_counts)
}

fn calculate_directory_stats(
    path: &Path,
    total_size: &mut u64,
    file_count: &mut u64,
    largest_size: &mut u64,
) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len();
                    *total_size += size;
                    *file_count += 1;
                    if size > *largest_size {
                        *largest_size = size;
                    }
                }
            } else if path.is_dir() {
                calculate_directory_stats(&path, total_size, file_count, largest_size)?;
            }
        }
    }
    Ok(())
}

/// Get available time periods in the photo library
pub fn get_available_periods(sqlite: &SQLite) -> Result<AvailablePeriods, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // Get available years
    let mut year_stmt = conn
        .prepare(
            "SELECT DISTINCT CAST(strftime('%Y', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) as year
             FROM photo_metadata
             WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
               AND (delete_flg = 0 OR delete_flg IS NULL)
             ORDER BY year DESC"
        )
        .map_err(|e| format!("Failed to prepare year query: {}", e))?;

    let years: Vec<i32> = year_stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query years: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Get available months
    let mut month_stmt = conn
        .prepare(
            "SELECT DISTINCT 
                CAST(strftime('%Y', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) as year,
                CAST(strftime('%m', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) as month
             FROM photo_metadata
             WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
               AND (delete_flg = 0 OR delete_flg IS NULL)
             ORDER BY year DESC, month DESC"
        )
        .map_err(|e| format!("Failed to prepare month query: {}", e))?;

    let months: Vec<(i32, u32)> = month_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query months: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Get available weeks (weeks that actually have photos)
    let mut week_stmt = conn
        .prepare(
            "SELECT DISTINCT date(COALESCE(exif_date_time_original, photo_date), 'weekday 0', '-6 days') as week_start
             FROM photo_metadata
             WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
               AND (delete_flg = 0 OR delete_flg IS NULL)
             ORDER BY week_start DESC"
        )
        .map_err(|e| format!("Failed to prepare week query: {}", e))?;

    let weeks: Vec<NaiveDate> = week_stmt
        .query_map([], |row| {
            let date_str: String = row.get(0)?;
            Ok(NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").ok())
        })
        .map_err(|e| format!("Failed to query weeks: {}", e))?
        .filter_map(|r| r.ok().flatten())
        .collect();

    Ok(AvailablePeriods {
        years,
        months,
        weeks,
    })
}
