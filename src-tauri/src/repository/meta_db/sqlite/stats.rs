//! Photography insights statistics module.
//!
//! Provides aggregated statistics about the photo library including:
//! - Shooting time patterns (hour of day, day of week)
//! - Camera settings distribution (ISO, aperture, shutter speed, focal length)
//! - Equipment usage (cameras, lenses)
//! - Organization metrics (total photos, tags, albums)
//! - Storage usage
//!
//! Supports time period filtering: all, weekly, monthly, yearly.

use crate::entity::config::Config;
use crate::repository::meta_db::sqlite::SQLite;
use chrono::{Datelike, Duration, NaiveDate};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Time period for filtering statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TimePeriod {
    /// All time (no filtering)
    All,
    /// Specific year (e.g., 2023)
    Yearly { year: i32 },
    /// Specific month (e.g., 2023-04)
    Monthly { year: i32, month: u32 },
    /// Specific week starting from a date (7 days from start_date)
    Weekly { start_date: NaiveDate },
}

impl Default for TimePeriod {
    fn default() -> Self {
        TimePeriod::All
    }
}

impl TimePeriod {
    /// Get SQL date condition for this period
    pub fn date_condition(&self) -> String {
        match self {
            TimePeriod::All => String::new(),
            TimePeriod::Yearly { year } => format!(
                " AND strftime('%Y', date(COALESCE(exif_date_time_original, photo_date))) = '{}'",
                year
            ),
            TimePeriod::Monthly { year, month } => format!(
                " AND strftime('%Y-%m', date(COALESCE(exif_date_time_original, photo_date))) = '{}-{:02}'",
                year, month
            ),
            TimePeriod::Weekly { start_date } => {
                let end_date = *start_date + Duration::days(7);
                format!(
                    " AND date(COALESCE(exif_date_time_original, photo_date)) >= '{}' AND date(COALESCE(exif_date_time_original, photo_date)) < '{}'",
                    start_date.format("%Y-%m-%d"),
                    end_date.format("%Y-%m-%d")
                )
            }
        }
    }

    /// Parse from string format:
    /// - "all" -> All
    /// - "yearly:2023" -> Yearly { year: 2023 }
    /// - "monthly:2023-04" -> Monthly { year: 2023, month: 4 }
    /// - "weekly:2023-04-10" -> Weekly { start_date: 2023-04-10 }
    pub fn from_str(s: &str) -> Self {
        let s = s.to_lowercase();
        if s == "all" {
            return TimePeriod::All;
        }

        let parts: Vec<&str> = s.splitn(2, ':').collect();
        if parts.len() != 2 {
            return TimePeriod::All;
        }

        let (period_type, value) = (parts[0], parts[1]);

        match period_type {
            "yearly" => {
                if let Ok(year) = value.parse::<i32>() {
                    TimePeriod::Yearly { year }
                } else {
                    TimePeriod::All
                }
            }
            "monthly" => {
                let date_parts: Vec<&str> = value.split('-').collect();
                if date_parts.len() >= 2 {
                    if let (Ok(year), Ok(month)) = (
                        date_parts[0].parse::<i32>(),
                        date_parts[1].parse::<u32>(),
                    ) {
                        if month >= 1 && month <= 12 {
                            return TimePeriod::Monthly { year, month };
                        }
                    }
                }
                TimePeriod::All
            }
            "weekly" => {
                if let Ok(start_date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
                    TimePeriod::Weekly { start_date }
                } else {
                    TimePeriod::All
                }
            }
            _ => TimePeriod::All,
        }
    }

    /// Convert to string format
    pub fn as_str(&self) -> String {
        match self {
            TimePeriod::All => "all".to_string(),
            TimePeriod::Yearly { year } => format!("yearly:{}", year),
            TimePeriod::Monthly { year, month } => format!("monthly:{}-{:02}", year, month),
            TimePeriod::Weekly { start_date } => {
                format!("weekly:{}", start_date.format("%Y-%m-%d"))
            }
        }
    }

    /// Get the period type as a simple string (for UI display)
    pub fn period_type(&self) -> &'static str {
        match self {
            TimePeriod::All => "all",
            TimePeriod::Yearly { .. } => "yearly",
            TimePeriod::Monthly { .. } => "monthly",
            TimePeriod::Weekly { .. } => "weekly",
        }
    }

    /// Get display label for this period
    pub fn display_label(&self) -> String {
        match self {
            TimePeriod::All => "All Time".to_string(),
            TimePeriod::Yearly { year } => format!("{}", year),
            TimePeriod::Monthly { year, month } => format!("{}-{:02}", year, month),
            TimePeriod::Weekly { start_date } => {
                let end_date = *start_date + Duration::days(6);
                format!(
                    "{} - {}",
                    start_date.format("%Y-%m-%d"),
                    end_date.format("%Y-%m-%d")
                )
            }
        }
    }
}

/// Complete photography insights data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotographyInsights {
    /// Time period for this statistics
    pub period: TimePeriod,
    pub shooting_time: ShootingTimeStats,
    pub camera_settings: CameraSettingsStats,
    pub equipment: EquipmentStats,
    pub organization: OrganizationStats,
    pub storage: StorageStats,
}

/// Shooting time statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShootingTimeStats {
    pub hour_distribution: Vec<HourCount>,
    pub day_of_week: Vec<DayOfWeekCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourCount {
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayOfWeekCount {
    pub day: i32,
    pub day_name: String,
    pub count: i64,
}

/// Camera settings distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSettingsStats {
    pub iso_distribution: Vec<SettingCount>,
    pub aperture_distribution: Vec<SettingCount>,
    pub shutter_speed_distribution: Vec<SettingCount>,
    pub focal_length_distribution: Vec<SettingCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingCount {
    pub value: String,
    pub count: i64,
}

/// Equipment statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquipmentStats {
    pub cameras: Vec<EquipmentCount>,
    pub lenses: Vec<EquipmentCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquipmentCount {
    pub make: Option<String>,
    pub model: String,
    pub count: i64,
}

/// Organization metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationStats {
    pub total_photos: i64,
    pub starred_photos: i64,
    pub total_tags: i64,
    pub total_albums: i64,
    pub photos_with_tags: i64,
    pub photos_in_albums: i64,
}

/// Storage usage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_size_bytes: u64,
    pub thumbnail_size_bytes: u64,
    pub face_thumbnail_size_bytes: u64,
}

/// Get all photography insights for a specific time period
pub fn get_all_insights(
    sqlite: &SQLite,
    config: &Config,
    period: &TimePeriod,
) -> Result<PhotographyInsights, String> {
    log::info!(target: "stats", "get_all_insights; status=starting; period={}", period.as_str());

    let shooting_time = get_shooting_time_stats(sqlite, period)?;
    let camera_settings = get_camera_settings_stats(sqlite, period)?;
    let equipment = get_equipment_stats(sqlite, period)?;
    let organization = get_organization_stats(sqlite, period)?;
    // Storage stats are not affected by time period (always shows current usage)
    let storage = get_storage_stats(config)?;

    log::info!(target: "stats", "get_all_insights; status=complete; period={}", period.as_str());

    Ok(PhotographyInsights {
        period: period.clone(),
        shooting_time,
        camera_settings,
        equipment,
        organization,
        storage,
    })
}

/// Get shooting time statistics (hour of day, day of week)
fn get_shooting_time_stats(sqlite: &SQLite, period: &TimePeriod) -> Result<ShootingTimeStats, String> {
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

    let hour_distribution: Vec<HourCount> = hour_stmt
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

    let day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    let day_of_week: Vec<DayOfWeekCount> = day_stmt
        .query_map([], |row| {
            let day: i32 = row.get(0)?;
            Ok(DayOfWeekCount {
                day,
                day_name: day_names.get(day as usize).unwrap_or(&"Unknown").to_string(),
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query days: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ShootingTimeStats {
        hour_distribution,
        day_of_week,
    })
}

/// Get camera settings distribution
fn get_camera_settings_stats(sqlite: &SQLite, period: &TimePeriod) -> Result<CameraSettingsStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // ISO distribution
    let iso_distribution = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_iso, COUNT(*) FROM photo_metadata
             WHERE exif_iso IS NOT NULL AND exif_iso != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_iso ORDER BY CAST(exif_iso AS INTEGER) LIMIT 20",
            date_filter
        ),
    )?;

    // Aperture distribution
    let aperture_distribution = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_fnumber, COUNT(*) FROM photo_metadata
             WHERE exif_fnumber IS NOT NULL AND exif_fnumber != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_fnumber ORDER BY CAST(exif_fnumber AS REAL) LIMIT 20",
            date_filter
        ),
    )?;

    // Shutter speed distribution
    let shutter_speed_distribution = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_exposure_time, COUNT(*) as count FROM photo_metadata
             WHERE exif_exposure_time IS NOT NULL AND exif_exposure_time != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_exposure_time ORDER BY count DESC LIMIT 20",
            date_filter
        ),
    )?;

    // Focal length distribution
    let focal_length_distribution = query_setting_distribution(
        &conn,
        &format!(
            "SELECT exif_focal_length, COUNT(*) FROM photo_metadata
             WHERE exif_focal_length IS NOT NULL AND exif_focal_length != ''
               AND (delete_flg = 0 OR delete_flg IS NULL){}
             GROUP BY exif_focal_length ORDER BY CAST(exif_focal_length AS REAL) LIMIT 20",
            date_filter
        ),
    )?;

    Ok(CameraSettingsStats {
        iso_distribution,
        aperture_distribution,
        shutter_speed_distribution,
        focal_length_distribution,
    })
}

/// Helper to query setting distribution
fn query_setting_distribution(
    conn: &rusqlite::Connection,
    query: &str,
) -> Result<Vec<SettingCount>, String> {
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let results: Vec<SettingCount> = stmt
        .query_map([], |row| {
            Ok(SettingCount {
                value: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Get equipment statistics (cameras, lenses)
fn get_equipment_stats(sqlite: &SQLite, period: &TimePeriod) -> Result<EquipmentStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    // Camera ranking
    let camera_query = format!(
        "SELECT exif_make, exif_model, COUNT(*) as count
         FROM photo_metadata
         WHERE exif_model IS NOT NULL AND exif_model != ''
           AND (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY exif_make, exif_model
         ORDER BY count DESC
         LIMIT 10",
        date_filter
    );

    let mut camera_stmt = conn
        .prepare(&camera_query)
        .map_err(|e| format!("Failed to prepare camera query: {}", e))?;

    let cameras: Vec<EquipmentCount> = camera_stmt
        .query_map([], |row| {
            Ok(EquipmentCount {
                make: row.get(0).ok(),
                model: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query cameras: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Lens ranking
    let lens_query = format!(
        "SELECT exif_lens_make, exif_lens_model, COUNT(*) as count
         FROM photo_metadata
         WHERE exif_lens_model IS NOT NULL AND exif_lens_model != ''
           AND (delete_flg = 0 OR delete_flg IS NULL){}
         GROUP BY exif_lens_make, exif_lens_model
         ORDER BY count DESC
         LIMIT 10",
        date_filter
    );

    let mut lens_stmt = conn
        .prepare(&lens_query)
        .map_err(|e| format!("Failed to prepare lens query: {}", e))?;

    let lenses: Vec<EquipmentCount> = lens_stmt
        .query_map([], |row| {
            Ok(EquipmentCount {
                make: row.get(0).ok(),
                model: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query lenses: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(EquipmentStats { cameras, lenses })
}

/// Get organization metrics
fn get_organization_stats(sqlite: &SQLite, period: &TimePeriod) -> Result<OrganizationStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let date_filter = period.date_condition();

    let total_photos_query = format!(
        "SELECT COUNT(*) FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL){}",
        date_filter
    );

    let total_photos: i64 = conn
        .query_row(&total_photos_query, [], |row| row.get(0))
        .unwrap_or(0);

    let starred_photos_query = format!(
        "SELECT COUNT(*) FROM photo_metadata
         WHERE star > 0 AND (delete_flg = 0 OR delete_flg IS NULL){}",
        date_filter
    );

    let starred_photos: i64 = conn
        .query_row(&starred_photos_query, [], |row| row.get(0))
        .unwrap_or(0);

    // Tags and albums count are not filtered by date (they are collections, not photos)
    let total_tags: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_collections WHERE type = 'tag'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_albums: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_collections WHERE type = 'album'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Photos with tags/albums are filtered by the photo's date
    let photos_with_tags_query = format!(
        "SELECT COUNT(DISTINCT pci.photo_path)
         FROM photo_collection_items pci
         JOIN photo_collections pc ON pc.id = pci.collection_id
         JOIN photo_metadata pm ON pm.absolute_path = pci.photo_path
         WHERE pc.type = 'tag'
           AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL){}",
        date_filter.replace(
            "COALESCE(exif_date_time_original, photo_date)",
            "COALESCE(pm.exif_date_time_original, pm.photo_date)"
        )
    );

    let photos_with_tags: i64 = conn
        .query_row(&photos_with_tags_query, [], |row| row.get(0))
        .unwrap_or(0);

    let photos_in_albums_query = format!(
        "SELECT COUNT(DISTINCT pci.photo_path)
         FROM photo_collection_items pci
         JOIN photo_collections pc ON pc.id = pci.collection_id
         JOIN photo_metadata pm ON pm.absolute_path = pci.photo_path
         WHERE pc.type = 'album'
           AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL){}",
        date_filter.replace(
            "COALESCE(exif_date_time_original, photo_date)",
            "COALESCE(pm.exif_date_time_original, pm.photo_date)"
        )
    );

    let photos_in_albums: i64 = conn
        .query_row(&photos_in_albums_query, [], |row| row.get(0))
        .unwrap_or(0);

    Ok(OrganizationStats {
        total_photos,
        starred_photos,
        total_tags,
        total_albums,
        photos_with_tags,
        photos_in_albums,
    })
}

/// Get storage usage statistics
fn get_storage_stats(config: &Config) -> Result<StorageStats, String> {
    log::info!(target: "stats", "get_storage_stats; status=starting");

    // Calculate thumbnail sizes (relatively small directories)
    let thumbnail_size_bytes = calculate_directory_size(&config.thumbnail_store);

    // Face thumbnails are stored in a subdirectory of thumbnail_store
    let face_thumbnail_path = Path::new(&config.thumbnail_store).join("faces");
    let face_thumbnail_size_bytes = if face_thumbnail_path.exists() {
        calculate_directory_size(face_thumbnail_path.to_str().unwrap_or(""))
    } else {
        0
    };

    // For photo library size, calculate from filesystem
    // This can be slow for very large libraries (100k+ photos)
    let total_size_bytes = calculate_directory_size(&config.import_to);

    log::info!(target: "stats", "get_storage_stats; status=complete; total_size={}; thumbnail_size={}; face_size={}",
        total_size_bytes, thumbnail_size_bytes, face_thumbnail_size_bytes);

    Ok(StorageStats {
        total_size_bytes,
        thumbnail_size_bytes,
        face_thumbnail_size_bytes,
    })
}

/// Calculate total size of a directory recursively
fn calculate_directory_size(path: &str) -> u64 {
    let path = Path::new(path);
    if !path.exists() {
        return 0;
    }

    calculate_dir_size_recursive(path)
}

/// Recursively calculate directory size using std::fs
fn calculate_dir_size_recursive(path: &Path) -> u64 {
    let mut total_size = 0u64;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                }
            } else if entry_path.is_dir() {
                total_size += calculate_dir_size_recursive(&entry_path);
            }
        }
    }

    total_size
}

/// Available periods for filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailablePeriods {
    /// Available years (e.g., [2023, 2024])
    pub years: Vec<i32>,
    /// Available months as "YYYY-MM" strings (e.g., ["2023-04", "2023-12"])
    pub months: Vec<String>,
    /// Available weeks grouped by year. Key: year, Value: list of Monday dates
    pub weeks_by_year: std::collections::HashMap<i32, Vec<String>>,
    /// Earliest photo date
    pub min_date: Option<String>,
    /// Latest photo date
    pub max_date: Option<String>,
}

/// Get available periods based on photo dates in the database
pub fn get_available_periods(sqlite: &SQLite) -> Result<AvailablePeriods, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // Get min and max dates
    let date_range_query = "
        SELECT
            MIN(date(COALESCE(exif_date_time_original, photo_date))) as min_date,
            MAX(date(COALESCE(exif_date_time_original, photo_date))) as max_date
        FROM photo_metadata
        WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
          AND (delete_flg = 0 OR delete_flg IS NULL)
    ";

    let (min_date_str, max_date_str): (Option<String>, Option<String>) = conn
        .query_row(date_range_query, [], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query date range: {}", e))?;

    if min_date_str.is_none() || max_date_str.is_none() {
        return Ok(AvailablePeriods {
            years: vec![],
            months: vec![],
            weeks_by_year: std::collections::HashMap::new(),
            min_date: None,
            max_date: None,
        });
    }

    // Get distinct years
    let years_query = "
        SELECT DISTINCT CAST(strftime('%Y', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) as year
        FROM photo_metadata
        WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
          AND (delete_flg = 0 OR delete_flg IS NULL)
        ORDER BY year DESC
    ";

    let mut years_stmt = conn
        .prepare(years_query)
        .map_err(|e| format!("Failed to prepare years query: {}", e))?;

    let years: Vec<i32> = years_stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query years: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Get distinct months
    let months_query = "
        SELECT DISTINCT strftime('%Y-%m', date(COALESCE(exif_date_time_original, photo_date))) as month
        FROM photo_metadata
        WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
          AND (delete_flg = 0 OR delete_flg IS NULL)
        ORDER BY month DESC
    ";

    let mut months_stmt = conn
        .prepare(months_query)
        .map_err(|e| format!("Failed to prepare months query: {}", e))?;

    let months: Vec<String> = months_stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query months: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Get weeks with photos (Monday start dates), grouped by year
    // Calculate week start (Monday) for each photo date using SQLite
    // strftime('%w') returns 0=Sunday, 1=Monday, ..., 6=Saturday
    // To get Monday: subtract (weekday + 6) % 7 days
    let weeks_query = "
        SELECT DISTINCT
            date(
                COALESCE(exif_date_time_original, photo_date),
                '-' || ((CAST(strftime('%w', date(COALESCE(exif_date_time_original, photo_date))) AS INTEGER) + 6) % 7) || ' days'
            ) as week_start
        FROM photo_metadata
        WHERE (exif_date_time_original IS NOT NULL OR photo_date IS NOT NULL)
          AND (delete_flg = 0 OR delete_flg IS NULL)
        ORDER BY week_start DESC
    ";

    let mut weeks_stmt = conn
        .prepare(weeks_query)
        .map_err(|e| format!("Failed to prepare weeks query: {}", e))?;

    let weeks: Vec<String> = weeks_stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query weeks: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Group weeks by year
    let mut weeks_by_year: std::collections::HashMap<i32, Vec<String>> = std::collections::HashMap::new();
    for week in weeks {
        if let Ok(date) = NaiveDate::parse_from_str(&week, "%Y-%m-%d") {
            let year = date.year();
            weeks_by_year.entry(year).or_insert_with(Vec::new).push(week);
        }
    }

    Ok(AvailablePeriods {
        years,
        months,
        weeks_by_year,
        min_date: min_date_str,
        max_date: max_date_str,
    })
}
