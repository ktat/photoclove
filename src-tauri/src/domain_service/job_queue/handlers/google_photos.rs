use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process Google Photos upload job - uploads photos to Google Photos in batches
pub(crate) async fn process_google_photos_upload_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(target: "google_photos", "upload_job; status=starting");
    log::info!(target: "job_queue", "job_info; job_unit_id={}", job.job_unit_id);

    // Deserialize job data from target field
    let job_data_json = job
        .job
        .target
        .first()
        .ok_or_else(|| "No job data found in target field".to_string())?;

    let job_data: job_queue::GooglePhotosUploadJob = serde_json::from_str(job_data_json)
        .map_err(|e| format!("Failed to deserialize job data: {}", e))?;

    log::info!(
        target: "google_photos",
        "upload_job_start; job_unit_id={}; batch={}/{}; photos={}",
        job.job_unit_id,
        job_data.chunk_index + 1,
        job_data.total_chunks,
        job_data.photo_paths.len()
    );

    // Get app state for database path
    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Get fresh access token (will auto-refresh if needed)
    let access_token =
        crate::domain_service::token_storage_service::TokenStorageService::get_valid_access_token()
            .await
            .map_err(|e| format!("Authentication failed: {}", e))?;

    // Get refresh token for GooglePhotos instance (though it won't be used directly anymore)
    let refresh_token =
        crate::domain_service::token_storage_service::TokenStorageService::get_refresh_token()
            .map_err(|e| format!("Failed to get refresh token: {}", e))?;

    // Create GooglePhotos instance
    let google_photos = crate::entity::google_photos::GooglePhotos::new(
        access_token,
        refresh_token,
        config.import_to.clone(), // db_path
    );

    // Emit progress event
    if let Err(e) = app_handle.emit(
        "upload_progress",
        (
            &job.job_unit_id,
            format!(
                "Starting batch {} of {}",
                job_data.chunk_index + 1,
                job_data.total_chunks
            ),
            0,
        ),
    ) {
        log::error!(target: "google_photos", "Failed to emit progress event: {}", e);
    }

    // Upload photos in this batch
    let photo_refs: Vec<&str> = job_data.photo_paths.iter().map(|s| s.as_str()).collect();

    log::info!(
        target: "google_photos",
        "starting_upload; job_unit_id={}; files={:?}",
        job.job_unit_id,
        photo_refs
    );

    // Use the existing upload_photo method which handles the batching internally
    // This now returns Result<(), String> so we can properly handle errors
    match google_photos.upload_photo(photo_refs).await {
        Ok(()) => {
            // Update progress to completion
            let job_id = job.id.unwrap_or(0);
            let total = job_data.photo_paths.len() as i64;
            let _ = db.update_job_progress(job_id, total);

            // Emit completion event
            if let Err(e) = app_handle.emit(
                "upload_progress",
                (
                    &job.job_unit_id,
                    format!(
                        "Completed batch {} of {}",
                        job_data.chunk_index + 1,
                        job_data.total_chunks
                    ),
                    100,
                ),
            ) {
                log::error!(target: "google_photos", "Failed to emit completion event: {}", e);
            }

            log::info!(
                target: "google_photos",
                "upload_job_complete; job_unit_id={}; batch={}/{}",
                job.job_unit_id,
                job_data.chunk_index + 1,
                job_data.total_chunks
            );

            log::info!(target: "google_photos", "upload_job; status=complete");
            Ok(())
        }
        Err(error_msg) => {
            log::error!(
                target: "google_photos",
                "upload_job_failed; job_unit_id={}; batch={}/{}; error={}",
                job.job_unit_id,
                job_data.chunk_index + 1,
                job_data.total_chunks,
                error_msg
            );

            // Emit error event
            if let Err(e) = app_handle.emit(
                "upload_error",
                (
                    &job.job_unit_id,
                    format!(
                        "Batch {} of {} failed: {}",
                        job_data.chunk_index + 1,
                        job_data.total_chunks,
                        error_msg
                    ),
                ),
            ) {
                log::error!(target: "google_photos", "Failed to emit error event: {}", e);
            }

            log::error!(target: "google_photos", "upload_job; status=failed; error={}", error_msg);
            Err(error_msg)
        }
    }
}
