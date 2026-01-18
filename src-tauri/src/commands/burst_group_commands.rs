//! Burst group management commands.
//!
//! This module contains Tauri commands for manual burst group operations:
//! - Creating burst groups from selected photos
//! - Removing individual photos from burst groups
//! - Recalculating burst groups based on threshold settings

use crate::app_state::AppState;
use crate::domain_service::job_queue_service::submission::submit_recalculate_grouping_job;
use crate::entity::burst_group::BurstGroup;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use uuid::Uuid;

/// Creates a new manual burst group from selected photos.
///
/// # Arguments
/// * `photo_paths` - List of photo paths to include in the group (minimum 2)
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(String)` - The ID of the newly created burst group
/// * `Err(String)` - Error message if creation fails
#[tauri::command]
pub async fn create_burst_group(
    photo_paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "burst_groups", "create_burst_group_request; correlation_id={}; photo_count={}",
        correlation_id, photo_paths.len());

    // Validate minimum photo count
    if photo_paths.len() < 2 {
        log::warn!(target: "burst_groups", "create_burst_group_rejected; correlation_id={}; reason=insufficient_photos; count={}",
            correlation_id, photo_paths.len());
        return Err("At least 2 photos are required to create a burst group".to_string());
    }

    // Check if any photos are already in a group
    for path in &photo_paths {
        match meta_db.get_photo_burst_group_id(path) {
            Ok(Some(existing_group_id)) => {
                log::warn!(target: "burst_groups", "create_burst_group_rejected; correlation_id={}; reason=photo_already_grouped; path={}; existing_group={}",
                    correlation_id, path, existing_group_id);
                return Err(format!("Photo '{}' is already in a burst group. Remove it from the existing group first.",
                    path.split('/').last().unwrap_or(path)));
            }
            Ok(None) => {}
            Err(e) => {
                log::error!(target: "burst_groups", "create_burst_group_error; correlation_id={}; error=check_existing_group_failed; details={}",
                    correlation_id, e);
                return Err(format!("Failed to check existing groups: {}", e));
            }
        }
    }

    // Generate unique group ID
    let group_id = format!("manual_{}", Uuid::new_v4());
    let group = BurstGroup::new_manual(group_id.clone());

    // Save the group
    meta_db.save_burst_group(&group)?;

    // Associate all photos with the group
    for path in &photo_paths {
        meta_db.update_photo_burst_group(path, &group_id)?;
    }

    log::info!(target: "burst_groups", "create_burst_group_success; correlation_id={}; group_id={}; photo_count={}",
        correlation_id, group_id, photo_paths.len());

    Ok(group_id)
}

/// Removes specific photos from a burst group.
///
/// If the group has fewer than 2 photos remaining after removal,
/// the group is automatically dissolved.
///
/// # Arguments
/// * `photo_paths` - List of photo paths to remove from their burst groups
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn remove_from_burst_group(
    photo_paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "burst_groups", "remove_from_burst_group_request; correlation_id={}; photo_count={}",
        correlation_id, photo_paths.len());

    // Track groups that may need cleanup
    let mut affected_groups: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Remove each photo from its group
    for path in &photo_paths {
        // Get the photo's current group
        if let Ok(Some(group_id)) = meta_db.get_photo_burst_group_id(path) {
            affected_groups.insert(group_id);
            meta_db.clear_photo_burst_group(path)?;
        }
    }

    // Check each affected group and dissolve if less than 2 photos remain
    for group_id in affected_groups {
        let remaining_count = meta_db.count_photos_in_group(&group_id)?;
        log::debug!(target: "burst_groups", "remove_from_burst_group_check; correlation_id={}; group_id={}; remaining_count={}",
            correlation_id, group_id, remaining_count);

        if remaining_count < 2 {
            log::info!(target: "burst_groups", "remove_from_burst_group_auto_dissolve; correlation_id={}; group_id={}; reason=insufficient_remaining_photos",
                correlation_id, group_id);

            // Clear remaining photos and delete the group
            meta_db.clear_burst_group_photos(&group_id)?;
            meta_db.delete_burst_group(&group_id)?;
        }
    }

    log::info!(target: "burst_groups", "remove_from_burst_group_success; correlation_id={}; photos_removed={}",
        correlation_id, photo_paths.len());

    Ok(())
}

/// Recalculates auto burst groups based on new threshold settings.
/// Manual groups (is_manual=true) are preserved.
/// This operation runs asynchronously in the job queue.
///
/// # Arguments
/// * `threshold_seconds` - Time threshold in seconds for grouping consecutive shots
/// * `min_group_size` - Minimum number of photos required to form a group
/// * `app_handle` - Tauri app handle for job queue
/// * `state` - Application state
///
/// # Returns
/// * `Ok(String)` - Job unit ID for tracking progress
/// * `Err(String)` - Error message if job submission fails
#[tauri::command]
pub async fn recalculate_grouping(
    threshold_seconds: u32,
    min_group_size: u32,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    let config = &state.config;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(
        target: "burst_groups",
        "recalculate_grouping_submit; correlation_id={}; threshold_seconds={}; min_group_size={}",
        correlation_id,
        threshold_seconds,
        min_group_size
    );

    // Create database connection for job queue
    let db = Arc::new(SQLite::new(config.import_to.clone()));

    // Submit job to queue
    let job_unit_id = submit_recalculate_grouping_job(
        db,
        threshold_seconds,
        min_group_size,
        app_handle,
    )?;

    log::info!(
        target: "burst_groups",
        "recalculate_grouping_submitted; correlation_id={}; job_unit_id={}",
        correlation_id,
        job_unit_id
    );

    Ok(job_unit_id)
}
