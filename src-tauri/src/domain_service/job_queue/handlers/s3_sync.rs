//! S3 Sync job handler
//!
//! Handles uploading photos to S3 or S3-compatible storage.

use super::utils::{cleanup_kill_file, get_resume_start_index, log_resume_info, should_stop_job};
use crate::domain_service::s3_service::S3Service;
use crate::entity::job_queue;
use crate::entity::recovery_queue::OperationType;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process S3 sync job - uploads photos to S3 storage
pub(crate) async fn process_s3_sync_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(target: "s3_sync", "sync_job; status=starting; job_unit_id={}", job.job_unit_id);

    // Get app state for S3 config
    let state = app_handle.state::<crate::AppState>();
    let s3_config = state.config.s3.clone()
        .ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        return Err("S3 backup is not enabled".to_string());
    }

    let provider = match s3_config.storage_type {
        crate::entity::config::S3StorageType::AwsS3 => "aws_s3",
        crate::entity::config::S3StorageType::Wasabi => "wasabi",
        crate::entity::config::S3StorageType::MinIO => "minio",
        crate::entity::config::S3StorageType::CloudflareR2 => "cloudflare_r2",
        crate::entity::config::S3StorageType::DigitalOcean => "digitalocean",
        crate::entity::config::S3StorageType::IDriveE2 => "idrive_e2",
        crate::entity::config::S3StorageType::Custom => "custom",
    };

    let import_to = state.config.import_to.clone();

    // Initialize S3 service
    let mut s3_service = S3Service::new(s3_config.clone());
    s3_service.init().await?;

    // Get photo paths from job target
    let photo_paths = &job.job.target;
    let total = photo_paths.len();

    log::info!(target: "s3_sync", "sync_job; photos_to_sync={}; provider={}", total, provider);

    let mut success_count = 0;
    let mut fail_count = 0;
    let job_id = job.id.unwrap_or(0);

    // Calculate start index for resume functionality
    let start_index = get_resume_start_index(job);
    log_resume_info("s3_sync", start_index, total);

    // Process each photo
    for (idx, photo_path) in photo_paths.iter().enumerate().skip(start_index) {
        // Check for stop signal
        if should_stop_job(job_id) {
            log::info!(target: "s3_sync", "stopped; job_id={}; index={}", job_id, idx);
            cleanup_kill_file(job_id);
            return Err("Job stopped by user".to_string());
        }

        log::debug!(target: "s3_sync", "uploading; index={}/{}; path={}", idx + 1, total, photo_path);

        // Update progress in database and emit event (with last_processed_id for resume)
        let processed = (idx + 1) as i64;
        let _ = db.update_job_progress_with_last_id(job_id, processed, idx as i64);

        let progress = ((idx as f32 / total as f32) * 100.0) as u32;
        if let Err(e) = app_handle.emit(
            "s3_sync_progress",
            (&job.job_unit_id, format!("Uploading {}/{}", idx + 1, total), progress),
        ) {
            log::error!(target: "s3_sync", "emit_error; error={}", e);
        }

        // Upload file
        match s3_service.upload_file(photo_path, &import_to).await {
            Ok(s3_url) => {
                // Update storage_sync in database
                if let Err(e) = update_storage_sync(db, photo_path, provider, &s3_url) {
                    log::error!(target: "s3_sync", "update_sync_error; path={}; error={}", photo_path, e);
                    // Continue with other files even if DB update fails
                }
                success_count += 1;
                log::info!(target: "s3_sync", "upload_success; path={}; s3_url={}", photo_path, s3_url);
            }
            Err(e) => {
                log::error!(target: "s3_sync", "upload_failed; path={}; error={}", photo_path, e);
                fail_count += 1;

                // Add to recovery queue for retry
                let error_reason = format!("provider={};error={}", provider, e);
                if let Err(re) = db.add_to_recovery_queue(
                    OperationType::S3Sync,
                    photo_path,
                    &error_reason,
                ) {
                    log::error!(target: "s3_sync", "recovery_queue_error; path={}; error={}", photo_path, re);
                }
            }
        }
    }

    // Emit completion event
    if let Err(e) = app_handle.emit(
        "s3_sync_progress",
        (&job.job_unit_id, format!("Completed: {} success, {} failed", success_count, fail_count), 100),
    ) {
        log::error!(target: "s3_sync", "emit_error; error={}", e);
    }

    // Backup database if enabled and all uploads succeeded
    if s3_config.backup_db && fail_count == 0 {
        log::info!(target: "s3_sync", "backing_up_database");
        let db_path = format!("{}/photoclove.db", import_to);
        match s3_service.backup_database(&db_path).await {
            Ok(url) => {
                log::info!(target: "s3_sync", "db_backup_success; s3_url={}", url);
            }
            Err(e) => {
                log::error!(target: "s3_sync", "db_backup_failed; error={}", e);
                // Don't fail the whole job for DB backup failure
            }
        }
    }

    log::info!(target: "s3_sync", "sync_job; status=complete; success={}; failed={}",
        success_count, fail_count);

    // Return error if any uploads failed
    if fail_count > 0 {
        Err(format!("{} of {} uploads failed", fail_count, total))
    } else {
        Ok(())
    }
}

/// Update storage_sync column in photo_metadata
fn update_storage_sync(
    db: &Arc<SQLite>,
    photo_path: &str,
    provider: &str,
    s3_url: &str,
) -> Result<(), String> {
    let conn = db.get_connection()
        .map_err(|e| format!("Failed to get database connection: {}", e))?;

    // Get existing storage_sync value
    let existing_sync: Option<String> = conn
        .query_row(
            "SELECT storage_sync FROM photo_metadata WHERE path = ?1",
            [photo_path],
            |row| row.get(0),
        )
        .ok();

    // Parse existing JSON or create new
    let mut sync_data: serde_json::Value = existing_sync
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    // Add/update provider entry
    let now = chrono::Utc::now().to_rfc3339();
    sync_data[provider] = serde_json::json!({
        "url": s3_url,
        "synced_at": now
    });

    // Update database
    let sync_json = serde_json::to_string(&sync_data)
        .map_err(|e| format!("Failed to serialize storage_sync: {}", e))?;

    conn.execute(
        "UPDATE photo_metadata SET storage_sync = ?1 WHERE path = ?2",
        rusqlite::params![sync_json, photo_path],
    ).map_err(|e| format!("Failed to update storage_sync: {}", e))?;

    Ok(())
}
