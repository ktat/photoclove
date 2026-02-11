use crate::entity::photo;
use crate::entity::recovery_queue::{OperationType, RecoveryItem, RecoveryStatus};
use crate::repository::meta_db;
use crate::value::{exif, file};
use rusqlite::{Connection, Row};

use super::SQLite;

/// Execute a database operation with a connection.
/// Handles connection opening and error mapping.
pub(super) fn with_connection<F, T>(sqlite: &SQLite, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let conn = Connection::open(sqlite.db_path())
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    f(&conn)
}

/// Convert a database row to a RecoveryItem entity.
/// Row must have columns in order:
/// id, operation_type, target_path, error_reason, failed_at, retry_count, last_retry_at, status, created_at, updated_at
pub(super) fn row_to_recovery_item(row: &Row) -> rusqlite::Result<RecoveryItem> {
    Ok(RecoveryItem {
        id: row.get(0)?,
        operation_type: OperationType::from(row.get::<_, String>(1)?),
        target_path: row.get(2)?,
        error_reason: row.get(3)?,
        failed_at: row.get(4)?,
        retry_count: row.get(5)?,
        last_retry_at: row.get(6)?,
        status: RecoveryStatus::from(row.get::<_, String>(7)?),
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

use crate::entity::job_queue::{Job, JobStatus, QueuedJob};

/// Convert a database row to a QueuedJob entity.
/// Row must have columns in order:
/// id, job_unit_id, job (JSON), status, created_at, started_at, completed_at, error_message, processed_count, last_processed_id
pub(super) fn row_to_queued_job(row: &Row) -> rusqlite::Result<QueuedJob> {
    let job_json: String = row.get(2)?;
    let job: Job = serde_json::from_str(&job_json).map_err(|_e| {
        rusqlite::Error::InvalidColumnType(2, "job".to_string(), rusqlite::types::Type::Text)
    })?;

    Ok(QueuedJob {
        id: Some(row.get(0)?),
        job_unit_id: row.get(1)?,
        job,
        status: JobStatus::from(row.get::<_, String>(3)?),
        created_at: row.get(4)?,
        started_at: row.get(5)?,
        completed_at: row.get(6)?,
        error_message: row.get(7)?,
        processed_count: row.get(8)?,
        last_processed_id: row.get(9)?,
    })
}

/// Create PhotoInfo from database row data without tags
#[allow(clippy::too_many_arguments)]
pub(super) fn photo_info_from_row(
    path: String,
    date: String,
    star: i32,
    comment: String,
    css_style: Option<String>,
    google_photo_url: Option<String>,
    orientation: Option<String>,
    storage_sync: Option<String>,
) -> meta_db::PhotoInfo {
    meta_db::PhotoInfo {
        path,
        date,
        star,
        comment,
        css_style,
        google_photo_url,
        tags: None,
        orientation,
        storage_sync,
    }
}

/// Create PhotoInfo from database row data with tags
#[allow(clippy::too_many_arguments)]
pub(super) fn photo_info_from_row_with_tags(
    path: String,
    date: String,
    star: i32,
    comment: String,
    css_style: Option<String>,
    google_photo_url: Option<String>,
    tags_str: Option<String>,
    orientation: Option<String>,
    storage_sync: Option<String>,
) -> meta_db::PhotoInfo {
    let tags = if let Some(tags_str) = tags_str {
        if tags_str.is_empty() {
            None
        } else {
            // Parse the GROUP_CONCAT result: "id:name:color,id:name:color,..."
            let parsed_tags: Vec<photo::PhotoTag> = tags_str
                .split(',')
                .filter_map(|tag_str| {
                    let parts: Vec<&str> = tag_str.split(':').collect();
                    if parts.len() >= 3 {
                        if let Ok(id) = parts[0].parse::<i32>() {
                            let name = parts[1].to_string();
                            let color = if parts[2].is_empty() {
                                None
                            } else {
                                Some(parts[2].to_string())
                            };
                            Some(photo::PhotoTag::new(id, name, color))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();

            if parsed_tags.is_empty() {
                None
            } else {
                Some(parsed_tags)
            }
        }
    } else {
        None
    };

    

    meta_db::PhotoInfo {
        path: path.clone(),
        date,
        star,
        comment,
        css_style,
        google_photo_url,
        tags: tags.clone(),
        orientation,
        storage_sync,
    }
}

/// Convert a database row to a Photo entity for grouping operations.
/// Simplified version that only reads columns needed for burst grouping.
/// Row must have columns in order: path, exif_make, exif_model, exif_date_time_original, burst_group_id
pub(super) fn row_to_photo_for_grouping(row: &Row) -> photo::Photo {
    let path: String = row.get(0).unwrap_or_default();
    let exif_make: Option<String> = row.get(1).unwrap_or_default();
    let exif_model: Option<String> = row.get(2).unwrap_or_default();
    let exif_date_time_original: Option<String> = row.get(3).unwrap_or_default();
    let burst_group_id: Option<String> = row.get(4).unwrap_or_default();

    // Extract file name from path
    let file_name = path.split('/').next_back().unwrap_or(&path).to_string();

    let file_obj = file::File {
        name: file_name,
        path,
        dir: String::new(),
        created_at: String::new(),
        is_link: false,
    };

    // Create minimal ExifData with just the fields needed for grouping
    let exif_data = exif::ExifData {
        date_time: String::new(),
        date_time_original: exif_date_time_original.unwrap_or_default(),
        make: exif_make.unwrap_or_default(),
        model: exif_model.unwrap_or_default(),
        fnumber: String::new(),
        iso: String::new(),
        exposure_time: String::new(),
        focal_length: String::new(),
        lens_model: String::new(),
        lens_make: String::new(),
        xresolution: String::new(),
        yresolution: String::new(),
        resolution_unit: String::new(),
        copyright: String::new(),
        shutter_speed_value: String::new(),
        focal_length_in35mm_film: String::new(),
        digital_zoom_ratio: String::new(),
        exposure_mode: String::new(),
        white_balance_mode: String::new(),
        orientation: String::new(),
    };

    photo::Photo::from_db_row(
        file_obj,
        exif_data,
        None,
        None,
        burst_group_id,
    )
}
