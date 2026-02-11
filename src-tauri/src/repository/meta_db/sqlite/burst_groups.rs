//! Burst group repository operations.
//!
//! Handles CRUD operations for burst groups and photo-group associations.

use crate::entity::burst_group::BurstGroup;
use crate::entity::photo;
use rusqlite::params;

use super::utils;
use super::SQLite;

/// Save a burst group to the database.
pub(super) fn save_burst_group(db: &SQLite, group: &BurstGroup) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO burst_groups (id, is_manual, created_at) VALUES (?1, ?2, ?3)",
        params![group.id, group.is_manual as i32, group.created_at],
    )
    .map_err(|e| format!("Failed to save burst group: {}", e))?;

    log::info!(target: "burst_groups", "save_burst_group; id={}", group.id);
    Ok(())
}

/// Update a photo's burst_group_id in photo_metadata.
pub(super) fn update_photo_burst_group(
    db: &SQLite,
    photo_path: &str,
    group_id: &str,
) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let rows_affected = conn
        .execute(
            "UPDATE photo_metadata SET burst_group_id = ?1 WHERE path = ?2",
            params![group_id, photo_path],
        )
        .map_err(|e| format!("Failed to update photo burst group: {}", e))?;

    log::debug!(target: "burst_groups", "update_photo_burst_group; photo_path={}; group_id={}; rows_affected={}",
        photo_path, group_id, rows_affected);
    Ok(())
}

/// Clear a photo's burst_group_id (set to NULL).
pub(super) fn clear_photo_burst_group(db: &SQLite, photo_path: &str) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let rows_affected = conn
        .execute(
            "UPDATE photo_metadata SET burst_group_id = NULL WHERE path = ?1",
            params![photo_path],
        )
        .map_err(|e| format!("Failed to clear photo burst group: {}", e))?;

    log::debug!(target: "burst_groups", "clear_photo_burst_group; photo_path={}; rows_affected={}",
        photo_path, rows_affected);
    Ok(())
}

/// Clear burst_group_id for all photos in a group.
pub(super) fn clear_burst_group_photos(db: &SQLite, group_id: &str) -> Result<usize, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let rows_affected = conn
        .execute(
            "UPDATE photo_metadata SET burst_group_id = NULL WHERE burst_group_id = ?1",
            params![group_id],
        )
        .map_err(|e| format!("Failed to clear burst group photos: {}", e))?;

    log::info!(target: "burst_groups", "clear_burst_group_photos; group_id={}; rows_affected={}",
        group_id, rows_affected);
    Ok(rows_affected)
}

/// Delete a burst group from the database.
pub(super) fn delete_burst_group(db: &SQLite, group_id: &str) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    conn.execute("DELETE FROM burst_groups WHERE id = ?1", params![group_id])
        .map_err(|e| format!("Failed to delete burst group: {}", e))?;

    log::info!(target: "burst_groups", "delete_burst_group; group_id={}", group_id);
    Ok(())
}

/// Count the number of photos in a burst group.
pub(super) fn count_photos_in_group(db: &SQLite, group_id: &str) -> Result<usize, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_metadata WHERE burst_group_id = ?1 AND (delete_flg = 0 OR delete_flg IS NULL)",
            params![group_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count photos in group: {}", e))?;

    Ok(count as usize)
}

/// Get the burst_group_id for a photo.
pub(super) fn get_photo_burst_group_id(
    db: &SQLite,
    photo_path: &str,
) -> Result<Option<String>, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let result: Result<Option<String>, _> = conn.query_row(
        "SELECT burst_group_id FROM photo_metadata WHERE path = ?1",
        params![photo_path],
        |row| row.get(0),
    );

    match result {
        Ok(group_id) => Ok(group_id),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get photo burst group id: {}", e)),
    }
}

/// Get all photo paths that belong to manual burst groups.
pub(super) fn get_manual_group_photo_paths(
    db: &SQLite,
) -> Result<std::collections::HashSet<String>, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT pm.path FROM photo_metadata pm
             INNER JOIN burst_groups bg ON pm.burst_group_id = bg.id
             WHERE bg.is_manual = 1 AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let paths = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query manual group photos: {}", e))?
        .collect::<Result<std::collections::HashSet<String>, _>>()
        .map_err(|e| format!("Failed to collect photo paths: {}", e))?;

    Ok(paths)
}

/// Clear all auto burst groups (is_manual = 0).
/// This removes auto groups from burst_groups table and clears burst_group_id for affected photos.
pub(super) fn clear_auto_burst_groups(db: &SQLite) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // First, clear burst_group_id for photos in auto groups
    conn.execute(
        "UPDATE photo_metadata SET burst_group_id = NULL
         WHERE burst_group_id IN (SELECT id FROM burst_groups WHERE is_manual = 0)",
        [],
    )
    .map_err(|e| format!("Failed to clear auto group photos: {}", e))?;

    // Then, delete auto groups
    let deleted = conn
        .execute("DELETE FROM burst_groups WHERE is_manual = 0", [])
        .map_err(|e| format!("Failed to delete auto burst groups: {}", e))?;

    log::info!(target: "burst_groups", "clear_auto_burst_groups; deleted_groups={}", deleted);
    Ok(())
}

/// Clear auto burst groups for photos in a specific date.
/// Only clears burst_group_id for photos in that date, and deletes orphaned auto groups.
pub(super) fn clear_auto_burst_groups_in_date(db: &SQLite, date_str: &str) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Get auto group IDs that have photos in this date
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT pm.burst_group_id FROM photo_metadata pm
             INNER JOIN burst_groups bg ON pm.burst_group_id = bg.id
             WHERE bg.is_manual = 0
               AND date(pm.photo_date) = ?1
               AND pm.burst_group_id IS NOT NULL",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let affected_group_ids: Vec<String> = stmt
        .query_map(params![date_str], |row| row.get(0))
        .map_err(|e| format!("Failed to query affected groups: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Clear burst_group_id for photos in this date that are in auto groups
    conn.execute(
        "UPDATE photo_metadata SET burst_group_id = NULL
         WHERE date(photo_date) = ?1
           AND burst_group_id IN (SELECT id FROM burst_groups WHERE is_manual = 0)",
        params![date_str],
    )
    .map_err(|e| format!("Failed to clear auto group photos in date: {}", e))?;

    // Check each affected group and delete if empty
    for group_id in &affected_group_ids {
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM photo_metadata WHERE burst_group_id = ?1",
                params![group_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if remaining == 0 {
            conn.execute("DELETE FROM burst_groups WHERE id = ?1", params![group_id])
                .map_err(|e| format!("Failed to delete empty burst group: {}", e))?;
        }
    }

    log::info!(target: "burst_groups", "clear_auto_burst_groups_in_date; date={}; affected_groups={}",
        date_str, affected_group_ids.len());
    Ok(())
}

/// Get photos for burst grouping with optional date filter
pub(super) fn get_photos_for_grouping_internal(
    db: &SQLite,
    date_filter: Option<&str>,
) -> Result<Vec<photo::Photo>, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match date_filter {
        Some(date_str) => (
            "SELECT path, exif_make, exif_model, exif_date_time_original, burst_group_id
             FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
               AND exif_date_time_original IS NOT NULL
               AND exif_date_time_original != ''
               AND date(photo_date) = ?1
             ORDER BY exif_date_time_original ASC"
                .to_string(),
            vec![Box::new(date_str.to_string())],
        ),
        None => (
            "SELECT path, exif_make, exif_model, exif_date_time_original, burst_group_id
             FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
               AND exif_date_time_original IS NOT NULL
               AND exif_date_time_original != ''
             ORDER BY exif_date_time_original ASC"
                .to_string(),
            vec![],
        ),
    };

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let photos = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(utils::row_to_photo_for_grouping(row))
        })
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    Ok(photos)
}

/// Get all photos for grouping (no date filter)
pub(super) fn get_all_photos_for_grouping(db: &SQLite) -> Result<Vec<photo::Photo>, String> {
    get_photos_for_grouping_internal(db, None)
}

/// Get photos for grouping in a specific date
pub(super) fn get_photos_for_grouping_in_date(
    db: &SQLite,
    date_str: &str,
) -> Result<Vec<photo::Photo>, String> {
    get_photos_for_grouping_internal(db, Some(date_str))
}

/// Get photo paths that belong to manual burst groups in a specific date
pub(super) fn get_manual_group_photo_paths_in_date(
    db: &SQLite,
    date_str: &str,
) -> Result<std::collections::HashSet<String>, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT pm.path FROM photo_metadata pm
             INNER JOIN burst_groups bg ON pm.burst_group_id = bg.id
             WHERE bg.is_manual = 1
               AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
               AND date(pm.photo_date) = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let paths = stmt
        .query_map(rusqlite::params![date_str], |row| row.get(0))
        .map_err(|e| format!("Failed to query manual group photos: {}", e))?
        .collect::<Result<std::collections::HashSet<String>, _>>()
        .map_err(|e| format!("Failed to collect photo paths: {}", e))?;

    Ok(paths)
}
