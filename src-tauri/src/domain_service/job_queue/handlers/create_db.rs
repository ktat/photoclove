use super::super::utils::date_extractor::extract_dates_from_paths;
use crate::entity::job_queue;
use crate::repository::{MetaInfoDB, RepositoryDB};
use tauri::{Emitter, Manager};

/// Process create database job - creates database entries for imported photos
pub(crate) fn process_create_db_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    log::info!(target: "create_db_job", "execution; status=processing; files={}", job.job.target.len());

    // Get app state to access configuration and database
    let state = app_handle.state::<crate::AppState>();
    let meta_db = &state.meta_db;
    let repo_db = &state.repo_db;

    // Emit progress event
    if let Err(e) = app_handle.emit(
        "create_db_progress",
        (&job.job_unit_id, "Creating database entries", 0),
    ) {
        log::error!(target: "create_db_job", "progress_event_error; error={}", e);
    }

    // If target is empty, process all photos from repo_db
    let dates_obj = if job.job.target.is_empty() {
        log::info!(target: "create_db_job", "target_empty; fetching_all_dates_from_repo");
        // Get all dates from repo_db
        repo_db.get_dates()
    } else {
        // Extract unique dates from the imported file paths using utility function
        let dates_set = extract_dates_from_paths(&job.job.target);

        if dates_set.is_empty() {
            log::warn!(target: "create_db_job", "date_extraction; status=no_valid_dates");
            return Ok(());
        }

        // Convert to date objects
        let mut dates = Vec::new();
        for date_str in dates_set {
            log::debug!(target: "create_db_job", "date_processing; date={}", date_str);
            // Skip empty date strings
            if !date_str.trim().is_empty() {
                let date = crate::value::date::Date::from_string(&date_str, Some("-"));
                dates.push(date);
            }
        }

        crate::value::date::Dates::new(&dates)
    };

    log::info!(target: "create_db_job", "database_creation; dates={}", dates_obj.dates.len());

    // Create database entries for the imported photos using existing functionality
    match meta_db.record_photos_all_meta_data(dates_obj) {
        Ok(result) => {
            log::info!(target: "create_db_job", "database_creation; status=success");
            log::debug!(target: "create_db_job", "database_result; result={:?}", result);

            // Update progress to completion
            let job_id = job.id.unwrap_or(0);
            let total = job.job.target.len() as i64;
            let _ = meta_db.update_job_progress(job_id, total);

            // Emit final progress
            if let Err(e) = app_handle.emit(
                "create_db_progress",
                (&job.job_unit_id, "Database entries completed", 100.0),
            ) {
                log::error!(target: "create_db_job", "progress_event_error; error={}", e);
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to create database entries: {:?}", e);
            log::error!(target: "create_db_job", "database_creation_error; error={}", error_msg);
            Err(error_msg)
        }
    }
}
