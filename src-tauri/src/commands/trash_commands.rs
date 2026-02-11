//! Trash management commands for PhotoClove.
//!
//! This module provides batch operations for managing photos in the trash:
//! - Moving multiple photos to trash
//! - Restoring multiple photos from trash
//! - Permanently deleting photos from trash
//! - Emptying the entire trash
//!
//! All batch operations track success/failure counts and update date summaries efficiently.

use crate::app_state::{AppState, BatchOperationResult};
use crate::domain_service::{achievements, file_service, thumbnail_service};
use crate::entity::{photo, trash};
use crate::repository::MetaInfoDB;
use crate::value::file;

/// Moves multiple photos to trash in a batch operation.
///
/// This command:
/// 1. Moves each file to the trash directory
/// 2. Marks photos as deleted in the database (delete_flg = 1)
/// 3. Updates date_summary counts efficiently by batching date changes
///
/// Returns a JSON-serialized `BatchOperationResult` with success/failure counts
/// and date changes for UI updates.
///
/// # Arguments
/// * `paths` - Vector of photo file paths to move to trash
/// * `app_handle` - Tauri app handle for emitting events
/// * `state` - Application state containing database and configuration
#[tauri::command]
pub async fn move_to_trash_batch(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "move_to_trash_batch; count={}", paths.len());

    let meta_db = &state.meta_db;
    let trash = trash::Trash::new(state.config.trash_path.to_string());

    // Group photos by date for efficient date_summary update
    let mut date_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut succeeded = 0;
    let mut failed = 0;
    let mut failed_paths = Vec::new();

    for path_str in paths {
        // path_str is relative (e.g., "2024-01-15/uuid/photo.jpg")
        let photo = photo::Photo::new(
            file::File::from_relative(path_str.clone()),
            Option::Some(state.config.clone()),
        );
        // Resolve to absolute path for file system operation
        let abs_path = file::to_absolute_path(&path_str, &state.config.import_to);
        let abs_file = file::File::new(abs_path);

        // Move file to trash (use relative DB path for simple trash directory structure)
        match file_service::move_to_trash(abs_file, trash.clone(), &path_str) {
            Ok(_) => {
                // Mark as deleted in DB (set delete_flg = 1)
                meta_db.delete_photo(&photo);
                // Parse date using helper function
                // Get photo date before moving to trash
                let photo_meta = meta_db.get_photo_meta(photo.clone());
                let date_key = photo_meta.date_key();
                *date_counts.entry(date_key).or_insert(0) -= 1;
                succeeded += 1;
                log::debug!(target: "trash", "move_to_trash_batch; moved={}", path_str);
            }
            Err(e) => {
                failed += 1;
                failed_paths.push(path_str.clone());
                log::error!(target: "trash", "move_to_trash_batch; failed={}; error={}", path_str, e);
            }
        }
    }

    // Batch update date_summary
    for (date, count) in &date_counts {
        match meta_db.update_date_summary_for_date(date, *count) {
            Ok(_) => {
                log::info!(target: "trash", "move_to_trash_batch; date={}; count_delta={}; status=success", date, count);
            }
            Err(e) => {
                log::error!(target: "trash", "move_to_trash_batch; date={}; count_delta={}; error={}; status=failed", date, count, e);
            }
        }
    }

    log::info!(target: "trash", "move_to_trash_batch; succeeded={}; failed={}", succeeded, failed);

    // Check first_delete achievement if any photos were deleted
    if succeeded > 0 {
        let _ = achievements::check_and_emit_achievement(
            &app_handle,
            &state.config.import_to,
            "first_delete",
        );
    }

    let result = BatchOperationResult {
        succeeded,
        failed,
        failed_paths,
        date_changes: date_counts,
        message: format!("Moved {} photos to trash, {} failed", succeeded, failed),
    };

    Ok(serde_json::to_string(&result).map_err(|e| format!("Failed to serialize result: {}", e))?)
}

/// Restores multiple photos from trash in a batch operation.
///
/// This command:
/// 1. Moves each file from trash back to the library directory
/// 2. Marks photos as restored in the database (delete_flg = 0)
/// 3. Updates date_summary counts efficiently by batching date changes
///
/// Returns a JSON-serialized `BatchOperationResult` with success/failure counts
/// and date changes for UI updates.
///
/// # Arguments
/// * `paths` - Vector of photo file paths to restore from trash
/// * `state` - Application state containing database and configuration
#[tauri::command]
pub async fn restore_from_trash_batch(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "restore_from_trash_batch; count={}", paths.len());

    let meta_db = &state.meta_db;
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let library_path = state.config.import_to.clone();
    let trash_path = state.config.trash_path.clone();

    // Group photos by date for efficient date_summary update
    let mut date_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut succeeded = 0;
    let mut failed = 0;
    let mut failed_paths = Vec::new();

    for path_str in paths {
        // path_str is relative (e.g., "2024-01-15/uuid/photo.jpg")
        let photo = photo::Photo::new(
            file::File::from_relative(path_str.clone()),
            Option::Some(state.config.clone()),
        );
        // Resolve to absolute path for file system operation
        let abs_path = file::to_absolute_path(&path_str, &library_path);
        let abs_file = file::File::new(abs_path);

        // Restore file from trash to library (pass relative path for trash lookup)
        match file_service::restore_from_trash(abs_file, trash.clone(), library_path.clone(), &path_str) {
            Ok(_) => {
                // Update database (set delete_flg = 0) without updating date_summary yet
                meta_db.restore_photo_from_trash_no_summary(&photo);
                let photo_meta = meta_db.get_photo_meta_from_trash(
                    photo.clone(),
                    trash_path.clone(),
                    library_path.clone(),
                );
                let date_key = photo_meta.date_key();
                *date_counts.entry(date_key).or_insert(0) += 1;
                succeeded += 1;
                log::debug!(target: "trash", "restore_from_trash_batch; restored={}", path_str);
            }
            Err(e) => {
                failed += 1;
                failed_paths.push(path_str.clone());
                log::error!(target: "trash", "restore_from_trash_batch; failed={}; error={}", path_str, e);
            }
        }
    }

    // Batch update date_summary
    for (date, count) in &date_counts {
        match meta_db.update_date_summary_for_date(date, *count) {
            Ok(_) => {
                log::info!(target: "trash", "restore_from_trash_batch; date={}; count_delta={}; status=success", date, count);
            }
            Err(e) => {
                log::error!(target: "trash", "restore_from_trash_batch; date={}; count_delta={}; error={}; status=failed", date, count, e);
            }
        }
    }

    log::info!(target: "trash", "restore_from_trash_batch; succeeded={}; failed={}", succeeded, failed);

    let result = BatchOperationResult {
        succeeded,
        failed,
        failed_paths,
        date_changes: date_counts,
        message: format!(
            "Restored {} photos successfully, {} failed",
            succeeded, failed
        ),
    };

    Ok(serde_json::to_string(&result).map_err(|e| format!("Failed to serialize result: {}", e))?)
}

/// Permanently deletes multiple photos from trash in a batch operation.
///
/// This command:
/// 1. Removes each file from the trash directory permanently
/// 2. Deletes associated thumbnail files
/// 3. Removes photo records from the database
///
/// Note: This does NOT update date_summary counts since photos were already
/// marked as deleted when moved to trash (date_summary was decremented then).
///
/// Returns a JSON-serialized `BatchOperationResult` with success/failure counts.
///
/// # Arguments
/// * `paths` - Vector of photo file paths to delete permanently
/// * `state` - Application state containing database and configuration
#[tauri::command]
pub async fn delete_permanently_batch(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "delete_permanently_batch; count={}", paths.len());

    let meta_db = &state.meta_db;
    let trash = trash::Trash::new(state.config.trash_path.to_string());

    // Note: Permanent delete doesn't affect date_summary since photos are already marked as deleted
    // date_summary was already decremented when photos were moved to trash
    let mut succeeded = 0;
    let mut failed = 0;
    let mut failed_paths = Vec::new();

    for path_str in paths {
        // path_str is relative (e.g., "2024-01-15/uuid/photo.jpg")
        let photo = photo::Photo::new(file::File::from_relative(path_str.clone()), Option::Some(state.config.clone()));
        // Resolve to absolute path (for old structure fallback in file_service)
        let abs_import_path = file::to_absolute_path(&path_str, &state.config.import_to);
        let abs_file = file::File::new(abs_import_path);

        // Remove file from trash permanently (pass relative path for trash lookup)
        match file_service::remove_from_trash_permanently(abs_file, trash.clone(), &path_str) {
            Ok(_) => {
                // Delete thumbnail if it exists
                let _ = thumbnail_service::delete_thumbnail(&photo, &state.config);

                // Permanently delete from database (no date_summary update needed)
                meta_db.delete_photo_permanently_no_summary(&photo);
                succeeded += 1;
                log::debug!(target: "trash", "delete_permanently_batch; deleted={}", path_str);
            }
            Err(e) => {
                failed += 1;
                failed_paths.push(path_str.clone());
                log::error!(target: "trash", "delete_permanently_batch; failed={}; error={}", path_str, e);
            }
        }
    }

    log::info!(target: "trash", "delete_permanently_batch; succeeded={}; failed={}", succeeded, failed);

    let result = BatchOperationResult {
        succeeded,
        failed,
        failed_paths,
        date_changes: std::collections::HashMap::new(), // No date changes for permanent delete
        message: format!(
            "Deleted {} photos permanently, {} failed",
            succeeded, failed
        ),
    };

    Ok(serde_json::to_string(&result).map_err(|e| format!("Failed to serialize result: {}", e))?)
}

/// Empties the entire trash by permanently deleting all photos in it.
///
/// This command:
/// 1. Queries the database for all photos marked as deleted (delete_flg = 1)
/// 2. Removes each file from the trash directory permanently
/// 3. Removes all photo records from the database
///
/// Returns a count of successfully deleted photos.
///
/// # Arguments
/// * `state` - Application state containing database and configuration
#[tauri::command]
pub async fn empty_trash(state: tauri::State<'_, AppState>) -> Result<String, String> {
    log::info!(target: "trash", "empty_trash; starting_bulk_delete");

    let meta_db = &state.meta_db;
    let conn = meta_db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Get all photos in trash
    let mut stmt = conn
        .prepare("SELECT path FROM photo_metadata WHERE delete_flg = 1")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let path: String = row.get(0)?;
            Ok(path)
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut deleted_count = 0;

    for row in rows {
        if let Ok(path) = row {
            // path is relative from DB (e.g., "2024-01-15/uuid/photo.jpg")
            let photo = photo::Photo::new(file::File::from_relative(path.clone()), Option::Some(state.config.clone()));
            // Resolve to absolute path (for old structure fallback in file_service)
            let abs_import_path = file::to_absolute_path(&path, &state.config.import_to);
            let abs_file = file::File::new(abs_import_path);
            let trash = trash::Trash::new(state.config.trash_path.to_string());

            // Remove file from trash permanently (pass relative path for trash lookup)
            if file_service::remove_from_trash_permanently(abs_file, trash, &path).is_ok() {
                // Permanently delete from database
                meta_db.delete_photo_permanently(&photo);
                deleted_count += 1;
            }
        }
    }

    log::info!(target: "trash", "empty_trash; completed; deleted_count={}", deleted_count);
    Ok(format!(
        "Permanently deleted {} photos from trash",
        deleted_count
    ))
}
