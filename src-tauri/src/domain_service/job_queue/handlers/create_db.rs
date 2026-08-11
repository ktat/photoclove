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
    // Outcome carries the number of rows actually inserted so job progress can
    // report a meaningful total even for the full-rebuild path (where
    // job.job.target is empty and its len() would always be 0).
    // Only the full rebuild is a user-initiated "recreate db". The incremental
    // path runs as a step of every import, which announces its own completion -
    // reporting this one too would pop a second dialog for the same action.
    let is_full_rebuild = job.job.target.is_empty();
    if is_full_rebuild {
        let _ = app_handle.emit("create_db", "start");
    }

    // (rows inserted, rows the database now holds for the processed scope)
    let outcome: Result<(usize, usize), String> = if is_full_rebuild {
        log::info!(target: "create_db_job", "target_empty; mode=full_rebuild; fetching_all_dates_from_repo");
        let dates_obj = repo_db.get_dates();
        log::info!(target: "create_db_job", "database_creation; dates={}", dates_obj.dates.len());
        meta_db
            .record_photos_all_meta_data(dates_obj)
            .map(|(per_date, inserted)| (inserted, per_date.values().sum()))
            .map_err(|e| e.to_string())
    } else {
        let import_to = config::Config::new().import_to;
        let mut photos = Vec::with_capacity(job.job.target.len());
        for abs_path in &job.job.target {
            let relative_path = file::to_relative_path(abs_path, &import_to);
            photos.push(photo::Photo::new(
                file::File::from_relative(relative_path),
                None,
            ));
        }
        log::info!(target: "create_db_job", "database_creation; targets={}; mode=incremental", photos.len());
        let target_count = photos.len();
        meta_db
            .record_photos_meta_data(photos)
            .map(|inserted| (inserted, target_count))
            .map_err(|e| e.to_string())
    };

    match outcome {
        Ok((inserted, total)) => {
            log::info!(target: "create_db_job", "database_creation; status=success; inserted={}; total={}", inserted, total);

            // Update progress to completion using the number of rows recorded.
            // Kept under its own name: shadowing `total` here would send the
            // insert count as the scope count in the finish event below, so a
            // rebuild that found existing rows would report the two as equal.
            let job_id = job.id.unwrap_or(0);
            let progress_total = inserted as i64;
            let _ = meta_db.update_job_progress(job_id, progress_total);

            // Emit final progress
            if let Err(e) = app_handle.emit(
                "create_db_progress",
                (&job.job_unit_id, "Database entries completed", 100.0),
            ) {
                log::error!(target: "create_db_job", "progress_event_error; error={}", e);
            }

            // The same shape `create_db_in_date` emits, so the frontend reports
            // a full rebuild exactly as it already reports a single date.
            // Without this the job finished with no footer, no notification and
            // no dialog - the user could not tell it had run at all.
            if is_full_rebuild {
                let _ = app_handle.emit(
                    "create_db",
                    serde_json::json!({
                        "status": "finish",
                        "inserted": inserted,
                        "total": total,
                    }),
                );
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to create database entries: {}", e);
            log::error!(target: "create_db_job", "database_creation_error; error={}", error_msg);
            if is_full_rebuild {
                let _ = app_handle.emit("create_db", serde_json::json!({ "status": "failed" }));
            }
            Err(error_msg)
        }
    }
}
