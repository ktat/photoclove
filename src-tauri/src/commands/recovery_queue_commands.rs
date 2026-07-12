//! Recovery Queue Commands
//!
//! Tauri commands for managing the recovery queue (failed operations that can be retried).

use crate::entity::recovery_queue::{OperationType, RecoveryStatus};
use crate::AppState;
use serde_json::json;

/// Get count of pending recovery items
#[tauri::command]
pub async fn get_recovery_pending_count(state: tauri::State<'_, AppState>) -> Result<i32, String> {
    // Polled every 30s by the footer; keep the NFS DB query off the main thread
    let meta_db = state.meta_db.clone();
    tauri::async_runtime::spawn_blocking(move || meta_db.get_recovery_pending_count())
        .await
        .map_err(|e| format!("Recovery count task failed: {}", e))?
}

/// Get all pending recovery items
#[tauri::command]
pub fn get_recovery_pending_items(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let items = meta_db.get_recovery_pending_items()?;

    serde_json::to_string(&items).map_err(|e| format!("Failed to serialize recovery items: {}", e))
}

/// Get all recovery items (including resolved and discarded)
#[tauri::command]
pub fn get_recovery_all_items(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let items = meta_db.get_recovery_all_items()?;

    serde_json::to_string(&items).map_err(|e| format!("Failed to serialize recovery items: {}", e))
}

/// Discard a recovery item (mark as discarded)
#[tauri::command]
pub fn discard_recovery_item(id: i64, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let meta_db = &state.meta_db;

    log::info!(target: "recovery_queue", "discard_item; id={}", id);

    meta_db.update_recovery_status(id, RecoveryStatus::Discarded)
}

/// Delete a recovery item completely
#[tauri::command]
pub fn delete_recovery_item(id: i64, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let meta_db = &state.meta_db;

    log::info!(target: "recovery_queue", "delete_item; id={}", id);

    meta_db.delete_recovery_item(id)
}

/// Retry a single recovery item
#[tauri::command]
pub fn retry_recovery_item(id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let config = &state.config;

    log::info!(target: "recovery_queue", "retry_item; id={}", id);

    // Get the recovery item
    let item = meta_db
        .get_recovery_item(id)?
        .ok_or_else(|| format!("Recovery item not found: {}", id))?;

    // Increment retry count
    meta_db.increment_recovery_retry(id)?;

    // Execute the operation based on type
    let result = match item.operation_type {
        OperationType::MoveToTrash => retry_move_to_trash(&item.target_path, config),
        OperationType::Restore => retry_restore(&item.target_path, config),
        OperationType::Import => {
            // Import retry would need the original import parameters
            // For now, we just indicate it needs manual intervention
            Err("Import operations need to be re-initiated manually".to_string())
        }
        OperationType::PermanentlyDelete => retry_permanently_delete(&item.target_path, config),
        OperationType::S3Sync => {
            // S3 sync retry would need the S3 service to be initialized
            // For now, we indicate it needs manual intervention via Preferences
            Err(
                "S3 sync operations need to be re-initiated via Preferences > S3 Backup"
                    .to_string(),
            )
        }
    };

    match result {
        Ok(_) => {
            // Mark as resolved
            meta_db.update_recovery_status(id, RecoveryStatus::Resolved)?;
            log::info!(target: "recovery_queue", "retry_success; id={}", id);
            Ok(json!({"success": true}).to_string())
        }
        Err(e) => {
            // Check if error is unrecoverable (file not found, etc.)
            let is_unrecoverable = e.to_lowercase().contains("not found")
                || e.to_lowercase().contains("no such file")
                || e.to_lowercase().contains("does not exist");

            if is_unrecoverable {
                let _ = meta_db.update_recovery_status(id, RecoveryStatus::Unrecoverable);
                log::warn!(target: "recovery_queue", "retry_unrecoverable; id={}; error={}", id, e);
            } else {
                log::warn!(target: "recovery_queue", "retry_failed; id={}; error={}", id, e);
            }
            Err(e)
        }
    }
}

/// Retry all pending recovery items
#[tauri::command]
pub fn retry_all_recovery_items(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let config = &state.config;

    log::info!(target: "recovery_queue", "retry_all; status=starting");

    let items = meta_db.get_recovery_pending_items()?;
    let total = items.len();
    let mut succeeded = 0;
    let mut failed = 0;

    for item in items {
        // Skip unrecoverable items
        if item.status == RecoveryStatus::Unrecoverable {
            continue;
        }

        // Increment retry count
        let _ = meta_db.increment_recovery_retry(item.id);

        let result = match item.operation_type {
            OperationType::MoveToTrash => retry_move_to_trash(&item.target_path, config),
            OperationType::Restore => retry_restore(&item.target_path, config),
            OperationType::Import => {
                Err("Import operations need to be re-initiated manually".to_string())
            }
            OperationType::PermanentlyDelete => retry_permanently_delete(&item.target_path, config),
            OperationType::S3Sync => Err(
                "S3 sync operations need to be re-initiated via Preferences > S3 Backup"
                    .to_string(),
            ),
        };

        match result {
            Ok(_) => {
                let _ = meta_db.update_recovery_status(item.id, RecoveryStatus::Resolved);
                succeeded += 1;
            }
            Err(e) => {
                // Check if error is unrecoverable
                let is_unrecoverable = e.to_lowercase().contains("not found")
                    || e.to_lowercase().contains("no such file")
                    || e.to_lowercase().contains("does not exist");

                if is_unrecoverable {
                    let _ = meta_db.update_recovery_status(item.id, RecoveryStatus::Unrecoverable);
                }
                failed += 1;
            }
        }
    }

    log::info!(
        target: "recovery_queue",
        "retry_all; status=completed; total={}; succeeded={}; failed={}",
        total, succeeded, failed
    );

    Ok(json!({
        "total": total,
        "succeeded": succeeded,
        "failed": failed
    })
    .to_string())
}

/// Cleanup old resolved/discarded items
#[tauri::command]
pub fn cleanup_recovery_items(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let meta_db = &state.meta_db;
    meta_db.cleanup_old_recovery_items()
}

// Helper functions for retry operations

fn retry_move_to_trash(
    target_path: &str,
    config: &crate::entity::config::Config,
) -> Result<(), String> {
    use crate::domain_service::file_service;
    use crate::entity::trash::Trash;
    use crate::value::file::File;

    let file = File::new(target_path.to_string());
    let trash = Trash::new(config.trash_path.clone());

    // Compute relative path by stripping import_to prefix
    let import_to = config.import_to.trim_end_matches('/');
    let relative_path = if let Some(stripped) = target_path.strip_prefix(import_to) {
        stripped.trim_start_matches('/').to_string()
    } else {
        target_path.trim_start_matches('/').to_string()
    };

    file_service::move_to_trash(file, trash, &relative_path)
        .map_err(|e| format!("Failed to move to trash: {}", e))
}

fn retry_restore(target_path: &str, config: &crate::entity::config::Config) -> Result<(), String> {
    use crate::domain_service::file_service;
    use crate::entity::trash::Trash;
    use crate::value::file::File;

    // target_path is the path in trash
    // We need to find the file - try recorded path first, then current trash path
    let recorded_path = std::path::Path::new(target_path);

    let actual_path = if recorded_path.exists() {
        target_path.to_string()
    } else {
        // Try to find in current trash path
        let filename = recorded_path
            .file_name()
            .ok_or_else(|| "Cannot get filename from path".to_string())?;
        let current_path = std::path::Path::new(&config.trash_path).join(filename);
        if current_path.exists() {
            current_path.display().to_string()
        } else {
            return Err(format!("File not found: {}", target_path));
        }
    };

    let file = File::new(actual_path.clone());
    let trash = Trash::new(config.trash_path.clone());
    let library_path = config.repository.store.clone();

    // Compute relative path by stripping import_to prefix
    let import_to = config.import_to.trim_end_matches('/');
    let relative_path = if let Some(stripped) = actual_path.strip_prefix(import_to) {
        stripped.trim_start_matches('/').to_string()
    } else {
        actual_path.trim_start_matches('/').to_string()
    };

    file_service::restore_from_trash(file, trash, library_path, &relative_path)
        .map_err(|e| format!("Failed to restore from trash: {}", e))
}

fn retry_permanently_delete(
    target_path: &str,
    config: &crate::entity::config::Config,
) -> Result<(), String> {
    use crate::domain_service::file_service;
    use crate::entity::trash::Trash;
    use crate::value::file::File;

    // Similar fallback logic as restore
    let recorded_path = std::path::Path::new(target_path);

    let actual_path = if recorded_path.exists() {
        target_path.to_string()
    } else {
        let filename = recorded_path
            .file_name()
            .ok_or_else(|| "Cannot get filename from path".to_string())?;
        let current_path = std::path::Path::new(&config.trash_path).join(filename);
        if current_path.exists() {
            current_path.display().to_string()
        } else {
            return Err(format!("File not found: {}", target_path));
        }
    };

    let file = File::new(actual_path.clone());
    let trash = Trash::new(config.trash_path.clone());

    // Compute relative path by stripping import_to prefix
    let import_to = config.import_to.trim_end_matches('/');
    let relative_path = if let Some(stripped) = actual_path.strip_prefix(import_to) {
        stripped.trim_start_matches('/').to_string()
    } else {
        actual_path.trim_start_matches('/').to_string()
    };

    file_service::remove_from_trash_permanently(file, trash, &relative_path)
        .map_err(|e| format!("Failed to permanently delete: {}", e))
}
