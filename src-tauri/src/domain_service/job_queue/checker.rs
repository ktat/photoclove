//! Processed Item Checker
//!
//! Provides strategies for checking if items have been processed,
//! enabling job resume functionality.

use crate::entity::job_queue::QueuedJob;
use crate::entity::job_type_config::ProcessedCheckStrategy;
use crate::repository::meta_db::sqlite::SQLite;
use std::path::Path;
use std::time::SystemTime;

/// Check if an item is processed based on strategy
pub fn is_item_processed(
    strategy: &ProcessedCheckStrategy,
    item: &str,
    job: &QueuedJob,
    db: &SQLite,
    output_path_fn: Option<&dyn Fn(&str) -> String>,
) -> bool {
    match strategy {
        ProcessedCheckStrategy::LastProcessedId => {
            // This strategy is handled at the batch level, not per-item
            // See filter_unprocessed_by_last_id
            false
        }
        ProcessedCheckStrategy::FileCreationTime => {
            if let Some(get_path) = output_path_fn {
                let output_path = get_path(item);
                is_processed_by_file_time(&output_path, job.started_at.as_deref())
            } else {
                false
            }
        }
        ProcessedCheckStrategy::Custom => {
            // Custom strategies are implemented in job-specific checkers
            false
        }
    }
}

/// Generic check: File mtime > job.started_at
/// For parallel processing jobs (Thumbnail)
pub fn is_processed_by_file_time(output_path: &str, job_started_at: Option<&str>) -> bool {
    let path = Path::new(output_path);
    if !path.exists() {
        return false;
    }

    let job_start = match job_started_at {
        Some(started_at) => match parse_datetime(started_at) {
            Some(dt) => dt,
            None => return false,
        },
        None => return false,
    };

    let file_mtime = match path.metadata().and_then(|m| m.modified()) {
        Ok(mtime) => mtime,
        Err(_) => return false,
    };

    file_mtime > job_start
}

/// Parse datetime string to SystemTime
fn parse_datetime(datetime_str: &str) -> Option<SystemTime> {
    // Expected format: "2024-01-15 10:30:45" or similar
    use chrono::{NaiveDateTime, TimeZone, Utc};

    // Try parsing common formats
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S%.f",
    ];

    for format in formats {
        if let Ok(naive) = NaiveDateTime::parse_from_str(datetime_str, format) {
            let datetime = Utc.from_utc_datetime(&naive);
            return Some(SystemTime::from(datetime));
        }
    }

    None
}

/// Filter items by last_processed_id for sequential processing
/// Returns items with id > last_processed_id
pub fn filter_unprocessed_by_last_id<T>(
    items: &[(i64, T)], // (id, item) pairs, must be sorted by id
    last_processed_id: Option<i64>,
) -> Vec<&(i64, T)> {
    match last_processed_id {
        Some(last_id) => items.iter().filter(|(id, _)| *id > last_id).collect(),
        None => items.iter().collect(),
    }
}

// ==================== Custom Checkers ====================

/// Import checker: destination file exists
pub fn is_import_processed(source_path: &str, import_to: &str) -> bool {
    let dest_path = compute_import_destination(source_path, import_to);
    Path::new(&dest_path).exists()
}

/// Compute destination path for import
fn compute_import_destination(source_path: &str, import_to: &str) -> String {
    // Extract filename from source path
    let filename = Path::new(source_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    // Extract date from source path (assuming YYYY/MM/DD structure)
    let parts: Vec<&str> = source_path.split('/').collect();
    let date_parts: Vec<&str> = parts
        .iter()
        .rev()
        .skip(1)
        .take(3)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();

    if date_parts.len() == 3 {
        format!("{}/{}/{}/{}/{}", import_to, date_parts[0], date_parts[1], date_parts[2], filename)
    } else {
        format!("{}/{}", import_to, filename)
    }
}

/// GooglePhotosUpload checker: has google_photos_url in DB
pub fn is_google_photos_uploaded(db: &SQLite, photo_path: &str) -> bool {
    db.get_connection()
        .ok()
        .and_then(|conn| {
            conn.query_row(
                "SELECT google_photos_url FROM photo_metadata WHERE path = ?1",
                [photo_path],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
        })
        .flatten()
        .map(|url| !url.is_empty())
        .unwrap_or(false)
}

/// S3Sync checker: has storage_sync record in DB
pub fn is_s3_synced(db: &SQLite, photo_path: &str) -> bool {
    db.get_connection()
        .ok()
        .and_then(|conn| {
            conn.query_row(
                "SELECT storage_sync FROM photo_metadata WHERE path = ?1",
                [photo_path],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
        })
        .flatten()
        .map(|sync| !sync.is_empty() && sync != "{}")
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_unprocessed_by_last_id_none() {
        let items = vec![(1, "a"), (2, "b"), (3, "c")];
        let result = filter_unprocessed_by_last_id(&items, None);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_filter_unprocessed_by_last_id_some() {
        let items = vec![(1, "a"), (2, "b"), (3, "c"), (4, "d")];
        let result = filter_unprocessed_by_last_id(&items, Some(2));
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].0, 3);
        assert_eq!(result[1].0, 4);
    }

    #[test]
    fn test_filter_unprocessed_by_last_id_all_processed() {
        let items = vec![(1, "a"), (2, "b"), (3, "c")];
        let result = filter_unprocessed_by_last_id(&items, Some(10));
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_parse_datetime() {
        let dt = parse_datetime("2024-01-15 10:30:45");
        assert!(dt.is_some());
    }

    #[test]
    fn test_parse_datetime_with_fraction() {
        let dt = parse_datetime("2024-01-15 10:30:45.123");
        assert!(dt.is_some());
    }
}
