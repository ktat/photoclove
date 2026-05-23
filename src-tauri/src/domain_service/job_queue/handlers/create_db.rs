use crate::entity::{config, job_queue, photo};
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::file;
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

    // Incremental path: when the job carries specific imported file paths,
    // record metadata only for those paths instead of rescanning the entire
    // date directory (which could be thousands of files for a few imports).
    let outcome: Result<(), String> = if job.job.target.is_empty() {
        log::info!(target: "create_db_job", "target_empty; mode=full_rebuild; fetching_all_dates_from_repo");
        let dates_obj = repo_db.get_dates();
        log::info!(target: "create_db_job", "database_creation; dates={}", dates_obj.dates.len());
        meta_db
            .record_photos_all_meta_data(dates_obj)
            .map(|_| ())
            .map_err(|e| e.to_string())
    } else {
        let import_to = config::Config::new().import_to;
        let mut photos = Vec::with_capacity(job.job.target.len());
        for abs_path in &job.job.target {
            let relative_path = file::to_relative_path(abs_path, &import_to);
            photos.push(photo::Photo::new(file::File::from_relative(relative_path), None));
        }
        log::info!(target: "create_db_job", "database_creation; targets={}; mode=incremental", photos.len());
        meta_db
            .record_photos_meta_data(photos)
            .map(|_| ())
            .map_err(|e| e.to_string())
    };

    match outcome {
        Ok(()) => {
            log::info!(target: "create_db_job", "database_creation; status=success");

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
            let error_msg = format!("Failed to create database entries: {}", e);
            log::error!(target: "create_db_job", "database_creation_error; error={}", error_msg);
            Err(error_msg)
        }
    }
}
