//! Photo CRUD operations for SQLite repository

use super::{date_summary, photo_metadata, SQLite};
use crate::entity::photo;
use crate::value::{comment, date, star};
use rusqlite::params;

/// Save star rating for a photo
pub fn save_star(sqlite: &SQLite, photo: &photo::Photo, star: star::Star) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    let now = date::DateTime::now().to_db_string();
    // Use UPDATE to preserve other columns (especially exif_orientation)
    let _ = conn.execute(
        "UPDATE photo_metadata SET star = ?1, updated_at = ?2 WHERE path = ?3",
        params![star.star(), now, photo.file.path],
    );
}

/// Save comment for a photo
pub fn save_comment(sqlite: &SQLite, photo: &photo::Photo, comment: comment::Comment) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    let now = date::DateTime::now().to_db_string();
    // Use UPDATE to preserve other columns (especially exif_orientation)
    let _ = conn.execute(
        "UPDATE photo_metadata SET comment = ?1, updated_at = ?2 WHERE path = ?3",
        params![comment.comment(), now, photo.file.path],
    );
}

/// Soft delete a photo (set delete_flg = 1)
pub fn delete_photo(sqlite: &SQLite, photo: &photo::Photo) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Get the photo date before deletion for date_summary update
    let existing_meta = photo_metadata::get_photo_meta(sqlite, photo.clone());
    let photo_date = existing_meta.photo_time();

    // Soft delete: set delete_flg = 1 instead of DELETE
    let now = date::DateTime::now().to_db_string();
    let _ = conn.execute(
        "UPDATE photo_metadata SET delete_flg = 1, updated_at = ? WHERE path = ?",
        params![now, photo.file.path],
    );

    // Update date_summary after deletion (photo is hidden from normal views)
    let _ = date_summary::update_date_summary_for_photo(sqlite, &photo_date, -1);
}

/// Hard delete a photo (completely remove from database)
pub fn delete_photo_permanently(sqlite: &SQLite, photo: &photo::Photo) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Get the photo date before deletion for date_summary update
    let existing_meta = photo_metadata::get_photo_meta(sqlite, photo.clone());
    let photo_date = existing_meta.photo_time();

    // Hard delete: completely remove from database
    let _ = conn.execute(
        "DELETE FROM photo_metadata WHERE path = ?1",
        params![photo.file.path],
    );

    // Update date_summary after permanent deletion
    let _ = date_summary::update_date_summary_for_photo(sqlite, &photo_date, -1);
}

/// Delete photo permanently without updating date_summary (for batch operations)
/// Note: Permanent delete doesn't decrement date_summary because the photo was already
/// counted as deleted when it was moved to trash (delete_flg was set to 1)
pub fn delete_photo_permanently_no_summary(sqlite: &SQLite, photo: &photo::Photo) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Hard delete: completely remove from database
    let _ = conn.execute(
        "DELETE FROM photo_metadata WHERE path = ?1",
        params![photo.file.path],
    );
}

/// Restore photo from trash (set delete_flg = 0)
#[allow(dead_code)]
pub fn restore_photo_from_trash(sqlite: &SQLite, photo: &photo::Photo) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Get the photo date for date_summary update
    let existing_meta = photo_metadata::get_photo_meta(sqlite, photo.clone());
    let photo_date = existing_meta.photo_time();

    // Restore: set delete_flg = 0
    let now = date::DateTime::now().to_db_string();
    let _ = conn.execute(
        "UPDATE photo_metadata SET delete_flg = 0, updated_at = ? WHERE path = ?",
        params![now, photo.file.path],
    );

    // Update date_summary after restoration (photo is visible in normal views again)
    let _ = date_summary::update_date_summary_for_photo(sqlite, &photo_date, 1);
}

/// Restore photo from trash without updating date_summary (for batch operations)
pub fn restore_photo_from_trash_no_summary(sqlite: &SQLite, photo: &photo::Photo) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Restore: set delete_flg = 0
    let now = date::DateTime::now().to_db_string();
    let _ = conn.execute(
        "UPDATE photo_metadata SET delete_flg = 0, updated_at = ? WHERE path = ?",
        params![now, photo.file.path],
    );
}

/// Update photo path in database
#[allow(dead_code)]
pub fn update_photo_path(sqlite: &SQLite, old_path: &str, new_path: &str) -> Result<bool, &'static str> {
    let conn = sqlite
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

/// Get all photo paths in a directory from database (by path pattern, not photo_date)
pub fn get_photo_paths_in_directory(sqlite: &SQLite, dir_path: &str) -> Result<Vec<String>, String> {
    let conn = sqlite
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
/// Note: This checks if the file was moved to a new location first.
/// If found, it updates the path instead of deleting to preserve album/tag associations.
pub fn delete_photo_by_path(sqlite: &SQLite, path: &str) {
    let conn = match sqlite.get_connection() {
        Ok(conn) => conn,
        Err(_) => return,
    };

    // Extract filename from the old path
    let filename = std::path::Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if filename.is_empty() {
        log::warn!(target: "sqlite", "delete_photo_by_path_invalid_path; path={}", path);
        return;
    }

    // Check if a new record with the same filename exists (file was moved)
    let new_path: Option<String> = conn
        .query_row(
            "SELECT path FROM photo_metadata WHERE path LIKE ?1 AND path != ?2 ORDER BY created_at DESC LIMIT 1",
            params![format!("%/{}", filename), path],
            |row| row.get(0),
        )
        .ok();

    if let Some(ref new_path_str) = new_path {
        // File was moved - update path instead of deleting to preserve album/tag associations
        log::info!(target: "sqlite", "photo_path_update_for_move; old_path={}; new_path={}", path, new_path_str);

        // Update photo_collection_items to point to new path
        let _ = conn.execute(
            "UPDATE photo_collection_items SET photo_path = ?1 WHERE photo_path = ?2",
            params![new_path_str, path],
        );

        // Delete the old record (the new one was already created by record_photos_meta_data)
        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![path],
        );

        log::info!(target: "sqlite", "photo_moved_associations_preserved; old_path={}; new_path={}", path, new_path_str);
    } else {
        // File was truly deleted, not moved
        // Get photo_date before deletion for date_summary update
        let photo_date: Option<String> = conn
            .query_row(
                "SELECT COALESCE(exif_date_time_original, exif_date_time, photo_date) FROM photo_metadata WHERE path = ?1",
                params![path],
                |row| row.get(0),
            )
            .ok();

        // Hard delete
        let _ = conn.execute(
            "DELETE FROM photo_metadata WHERE path = ?1",
            params![path],
        );

        // Update date_summary
        if let Some(date_str) = photo_date {
            let _ = date_summary::update_date_summary_for_photo(sqlite, &date_str, -1);
        }

        log::info!(target: "sqlite", "photo_deleted_by_path; path={}", path);
    }
}

/// Check if a photo is in trash (delete_flg = 1)
/// Returns the trash path if photo is trashed, None otherwise
pub fn get_trash_path_for_photo(
    sqlite: &SQLite,
    original_path: &str,
    trash_base_path: &str,
    import_to: &str,
) -> Option<String> {
    let conn = match sqlite.get_connection() {
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
        // Try new structure first: trash_base_path/relative_path
        let trimmed_path = original_path.trim_start_matches('/');
        let new_trash_path = format!(
            "{}/{}",
            trash_base_path.trim_end_matches('/'),
            trimmed_path
        );

        // Check if file exists at new location
        if std::path::Path::new(&new_trash_path).exists() {
            log::debug!(target: "sqlite", "get_trash_path_for_photo; original_path={}; trash_path={}", original_path, new_trash_path);
            return Some(new_trash_path);
        }

        // Fallback to old structure: trash_base_path/abs_path_without_leading_slash
        let abs_import_path = crate::value::file::to_absolute_path(original_path, import_to);
        let old_trash_path = format!(
            "{}/{}",
            trash_base_path.trim_end_matches('/'),
            abs_import_path.trim_start_matches('/')
        );
        log::debug!(target: "sqlite", "get_trash_path_for_photo; original_path={}; trash_path={}; fallback=old_structure", original_path, old_trash_path);
        Some(old_trash_path)
    } else {
        None
    }
}

/// Save Google Photos URL for a photo
pub fn save_google_photos_url(
    sqlite: &SQLite,
    photo_path: &str,
    google_photos_url: &str,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let now = date::DateTime::now().to_db_string();
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

/// Save CSS style for a photo
pub fn save_css_style(sqlite: &SQLite, photo_path: &str, css_style: &str) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let now = date::DateTime::now().to_db_string();
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

/// Get CSS style for a photo
pub fn get_css_style(sqlite: &SQLite, photo_path: &str) -> Option<String> {
    let conn = match sqlite.get_connection() {
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

/// Get created_at timestamp for a photo
#[allow(dead_code)]
pub fn get_photo_created_at(sqlite: &SQLite, photo: &photo::Photo) -> String {
    let conn = match sqlite.get_connection() {
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
