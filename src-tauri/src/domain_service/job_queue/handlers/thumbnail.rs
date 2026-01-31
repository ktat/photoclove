use super::super::utils::date_extractor::extract_dates_from_paths;
use crate::entity::job_queue;
use tauri::{Emitter, Manager};

/// Process thumbnail creation job - creates thumbnails for imported photos
pub(crate) fn process_thumbnail_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    log::info!(target: "thumbnail_job", "execution; status=processing; files={}", job.job.target.len());

    // Get app state to access configuration
    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Emit progress event
    if let Err(e) = app_handle.emit(
        "thumbnail_progress",
        (&job.job_unit_id, "Processing thumbnails", 0),
    ) {
        log::error!(target: "thumbnail_job", "progress_event_error; error={}", e);
    }

    // Extract unique dates from the imported file paths using utility function
    let dates_set = extract_dates_from_paths(&job.job.target);

    if dates_set.is_empty() {
        log::warn!(target: "thumbnail_job", "date_extraction; status=no_valid_dates");
        return Ok(());
    }

    // Convert to date objects
    let mut dates = Vec::new();
    for date_str in dates_set {
        log::debug!(target: "thumbnail_job", "date_processing; date={}", date_str);
        // Skip empty date strings
        if !date_str.trim().is_empty() {
            let date = crate::value::date::Date::from_string(&date_str, Some("-"));
            dates.push(date);
        }
    }

    let dates_obj = crate::value::date::Dates::new(&dates);

    // Create thumbnails using the existing photo service
    let origin = std::path::PathBuf::from(&config.import_to);
    let dest = std::path::PathBuf::from(&config.thumbnail_store);

    log::info!(target: "thumbnail_job", "thumbnail_creation; dates={}", dates.len());
    log::debug!(target: "thumbnail_job", "thumbnail_paths; origin={}", origin.display());
    log::debug!(target: "thumbnail_job", "thumbnail_paths; destination={}", dest.display());

    // Use futures blocking approach for thumbnail creation
    let thumbnail_result = futures::executor::block_on(async {
        crate::domain_service::photo_service::create_thumbnails(
            dates_obj,
            &origin,
            &dest,
            config.thumbnail_parallel as u32,
            config.thumbnail_compression_quality,
            config.thumbnail_ratio,
            config.thumbnail_ignore_file_size,
        )
        .await
    });

    match thumbnail_result {
        Ok(_) => {
            log::info!(target: "thumbnail_job", "thumbnail_creation; status=success; dates={}", dates.len());

            // Update progress to completion
            let job_id = job.id.unwrap_or(0);
            let total = job.job.target.len() as i64;
            let _ = state.meta_db.update_job_progress(job_id, total);

            // Emit final progress
            if let Err(e) = app_handle.emit(
                "thumbnail_progress",
                (&job.job_unit_id, "Thumbnails completed", 100.0),
            ) {
                log::error!(target: "thumbnail_job", "progress_event_error; error={}", e);
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to create thumbnails: {}", e);
            log::error!(target: "thumbnail_job", "thumbnail_creation_error; error={}", error_msg);
            Err(error_msg)
        }
    }
}
