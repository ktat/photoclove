use super::handlers;
use super::utils::events::emit_import_completion_events;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use std::thread;
use tauri::Emitter;

/// Process pending jobs at startup
pub(crate) fn process_startup_jobs(
    db: Arc<SQLite>,
    max_concurrent: usize,
    app_handle: tauri::AppHandle,
) {
    log::info!(target: "job_queue", "startup_jobs; status=checking");
    match db.get_pending_jobs() {
        Ok(pending_jobs) => {
            if pending_jobs.is_empty() {
                log::info!(target: "job_queue", "startup_jobs; status=none_found");
                return;
            }

            log::info!(target: "job_queue", "startup_jobs; status=found; count={}", pending_jobs.len());
            for (idx, job) in pending_jobs.iter().enumerate() {
                log::info!(target: "job_queue", "startup_job_info; index={}; job_id={:?}; job_type={:?}; unit_id={}; files={}",
                    idx + 1, job.id, job.job.job_type, job.job_unit_id, job.job.target.len());
            }

            // Process jobs in batches up to max_concurrent
            let batch_size = std::cmp::min(pending_jobs.len(), max_concurrent);
            let mut handles = Vec::new();

            for job in pending_jobs.into_iter().take(batch_size) {
                let db_clone = Arc::clone(&db);
                let app_handle_clone = app_handle.clone();

                let handle = thread::spawn(move || process_job(db_clone, job, app_handle_clone));
                handles.push(handle);
            }

            // Wait for all startup jobs to complete
            for handle in handles {
                if let Err(e) = handle.join() {
                    log::error!(target: "job_queue", "startup_job_error; error={:?}", e);
                }
            }

            log::info!(target: "job_queue", "startup_jobs; status=complete");
        }
        Err(e) => {
            log::error!(target: "job_queue", "startup_jobs_error; error={}", e);
        }
    }

    // Cleanup completed jobs after startup processing
    if let Err(e) = db.cleanup_completed_jobs() {
        log::error!(target: "job_queue", "cleanup_error; error={}", e);
    }
}

/// Process new jobs when they are submitted
pub fn process_new_jobs(db: Arc<SQLite>, max_concurrent: usize, app_handle: tauri::AppHandle) {
    thread::spawn(move || {
        log::info!(target: "job_queue", "new_jobs; status=processing");
        match db.get_pending_jobs() {
            Ok(pending_jobs) => {
                if pending_jobs.is_empty() {
                    log::info!(target: "job_queue", "new_jobs; status=none_found");
                    return;
                }

                log::info!(target: "job_queue", "new_jobs; status=found; count={}", pending_jobs.len());

                // Separate Google Photos jobs from other jobs
                let (google_photos_jobs, other_jobs): (Vec<_>, Vec<_>) = pending_jobs
                    .into_iter()
                    .partition(|job| job.job.job_type == job_queue::JobType::GooglePhotosUpload);

                // Process Google Photos jobs sequentially first
                if !google_photos_jobs.is_empty() {
                    log::info!(target: "job_queue", "google_photos_jobs; status=processing_sequential; count={}", google_photos_jobs.len());
                    for job in google_photos_jobs {
                        let db_clone = Arc::clone(&db);
                        let app_handle_clone = app_handle.clone();
                        process_job(db_clone, job, app_handle_clone);
                    }
                }

                // Process other jobs in batches up to max_concurrent
                if !other_jobs.is_empty() {
                    let batch_size = std::cmp::min(other_jobs.len(), max_concurrent);
                    let mut handles = Vec::new();

                    for job in other_jobs.into_iter().take(batch_size) {
                        let db_clone = Arc::clone(&db);
                        let app_handle_clone = app_handle.clone();

                        let handle =
                            thread::spawn(move || process_job(db_clone, job, app_handle_clone));
                        handles.push(handle);
                    }

                    // Wait for all jobs in this batch to complete
                    for handle in handles {
                        if let Err(e) = handle.join() {
                            log::error!(target: "job_queue", "job_thread_error; error={:?}", e);
                        }
                    }
                }

                // Cleanup completed jobs after processing
                if let Err(e) = db.cleanup_completed_jobs() {
                    log::error!(target: "job_queue", "cleanup_error; error={}", e);
                }

                log::info!(target: "job_queue", "new_jobs; status=complete");
            }
            Err(e) => {
                log::error!(target: "job_queue", "new_jobs_error; error={}", e);
            }
        }
    });
}

/// Immediately process specific jobs (used for dependent jobs)
pub(crate) fn process_specific_jobs_immediately(
    db: Arc<SQLite>,
    job_ids: Vec<i64>,
    app_handle: tauri::AppHandle,
) {
    thread::spawn(move || {
        log::info!(target: "job_queue", "specific_jobs; status=processing; job_ids={:?}", job_ids);

        // Get all pending jobs and filter for the specific job IDs
        match db.get_pending_jobs() {
            Ok(pending_jobs) => {
                // Filter and sort jobs by the specified job_ids to maintain order
                let mut jobs_to_process = Vec::new();
                for job_id in &job_ids {
                    if let Some(job) = pending_jobs.iter().find(|j| j.id == Some(*job_id)) {
                        jobs_to_process.push(job.clone());
                    }
                }

                if jobs_to_process.is_empty() {
                    log::info!(target: "job_queue", "specific_jobs; status=none_found");
                    return;
                }

                log::info!(target: "job_queue", "specific_jobs; status=found; count={}", jobs_to_process.len());

                // Process each dependent job sequentially to maintain order
                for job in jobs_to_process {
                    log::info!(target: "job_queue", "dependent_job; job_id={:?}; job_type={:?}", job.id, job.job.job_type);
                    let db_clone = Arc::clone(&db);
                    let app_handle_clone = app_handle.clone();

                    // Process job in the same thread to maintain order (thumbnail before create_db)
                    process_job(db_clone, job, app_handle_clone);
                }

                // Cleanup completed jobs after processing
                if let Err(e) = db.cleanup_completed_jobs() {
                    log::error!(target: "job_queue", "dependent_jobs_cleanup_error; error={}", e);
                }

                log::info!(target: "job_queue", "dependent_jobs; status=complete");
            }
            Err(e) => {
                log::error!(target: "job_queue", "dependent_jobs_error; error={}", e);
            }
        }
    });
}

/// Create dependent jobs (thumbnail and create_db) after import completes
fn create_dependent_jobs(
    db: &Arc<SQLite>,
    job_unit_id: &str,
    imported_files: Vec<String>,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    log::info!(target: "job_queue", "dependent_jobs; status=creating; job_unit_id={}", job_unit_id);
    log::info!(target: "job_queue", "dependent_jobs; imported_files={}", imported_files.len());

    if imported_files.is_empty() {
        log::info!(target: "job_queue", "dependent_jobs; status=skipped; reason=no_imported_files");
        return Ok(());
    }

    // Create thumbnail job with destination file paths
    let thumbnail_job = job_queue::Job::new(
        job_unit_id.to_string(),
        job_queue::JobType::Thumbnail,
        imported_files.clone(),
    );

    // Create create_db job with destination file paths
    let create_db_job = job_queue::Job::new(
        job_unit_id.to_string(),
        job_queue::JobType::CreateDb,
        imported_files,
    );

    // Queue the dependent jobs
    let thumbnail_queued = job_queue::QueuedJob::new(job_unit_id.to_string(), thumbnail_job);
    let create_db_queued = job_queue::QueuedJob::new(job_unit_id.to_string(), create_db_job);

    let thumbnail_id = db.create_job(&thumbnail_queued)?;
    let create_db_id = db.create_job(&create_db_queued)?;

    log::info!(target: "job_queue", "dependent_jobs; status=created; thumbnail_id={}; create_db_id={}", thumbnail_id, create_db_id);

    // Immediately process the newly created dependent jobs in order
    log::info!(target: "job_queue", "dependent_jobs; status=starting_processing");
    let job_ids = vec![thumbnail_id, create_db_id]; // Process thumbnail first, then create_db
    process_specific_jobs_immediately(db.clone(), job_ids, app_handle.clone());

    Ok(())
}

/// Process a single job - dispatches to appropriate handler based on job type
fn process_job(db: Arc<SQLite>, job: job_queue::QueuedJob, app_handle: tauri::AppHandle) {
    let job_id = job.id.unwrap();
    log::info!(target: "job_queue", "job_processing; status=starting; job_id={}", job_id);
    log::info!(target: "job_queue", "job_info; job_id={}", job_id);
    log::info!(target: "job_queue", "job_info; job_type={:?}", job.job.job_type);
    log::info!(target: "job_queue", "job_info; job_unit_id={}", job.job_unit_id);
    log::info!(target: "job_queue", "job_info; target_files={}", job.job.target.len());
    for (i, target) in job.job.target.iter().enumerate() {
        log::debug!(target: "job_queue", "job_target; index={}; file={}", i + 1, target);
    }
    log::info!(target: "job_queue", "job_info; status=complete");

    // Mark job as running
    log::info!(target: "job_queue", "job_status_update; job_id={}; status=running", job_id);
    if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Running, None) {
        log::error!(target: "job_queue", "job_status_error; job_id={}; error={}", job_id, e);
        return;
    }
    log::info!(target: "job_queue", "job_status_update; job_id={}; status=running; result=success", job_id);

    // Process the job based on type
    log::info!(target: "job_queue", "job_execution; job_id={}; job_type={:?}; status=starting", job_id, job.job.job_type);
    let result = match job.job.job_type {
        job_queue::JobType::Import => {
            log::info!(target: "job_queue", "import_job; job_id={}; status=calling_process", job_id);
            match handlers::process_import_job(&job, &app_handle) {
                Ok(imported_files) => {
                    // Create dependent jobs when import completes successfully
                    if let Err(e) =
                        create_dependent_jobs(&db, &job.job_unit_id, imported_files, &app_handle)
                    {
                        log::error!(target: "job_queue", "dependent_jobs_error; job_id={}; error={}", job_id, e);
                    }
                    Ok(())
                }
                Err(e) => Err(e),
            }
        }
        job_queue::JobType::Thumbnail => {
            log::info!(target: "job_queue", "thumbnail_job; job_id={}; status=calling_process", job_id);
            handlers::process_thumbnail_job(&job, &app_handle).map(|_| ())
        }
        job_queue::JobType::CreateDb => {
            log::info!(target: "job_queue", "create_db_job; job_id={}; status=calling_process", job_id);
            handlers::process_create_db_job(&job, &app_handle).map(|_| ())
        }
        job_queue::JobType::GooglePhotosUpload => {
            log::info!(target: "job_queue", "google_photos_job; job_id={}; status=calling_process", job_id);
            // Use a blocking runtime for async Google Photos handler
            tokio::runtime::Runtime::new().unwrap().block_on(
                handlers::process_google_photos_upload_job(&job, &app_handle, &db),
            )
        }
    };

    log::info!(target: "job_queue", "job_execution; job_id={}; status=completed; success={}", job_id, result.is_ok());

    // Update job status based on result
    match result {
        Ok(_) => {
            if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Completed, None) {
                log::error!(target: "job_queue", "job_status_error; job_id={}; target_status=completed; error={}", job_id, e);
            }
            log::info!(target: "job_queue", "job_completed; job_id={}", job_id);

            // Check if all jobs in the job unit are completed and update job unit status
            if let Err(e) = db.update_job_unit_status_if_complete(&job.job_unit_id) {
                log::error!(target: "job_queue", "job_unit_status_error; job_id={}; error={}", job_id, e);
            }

            // Check if the entire job unit is now complete
            match db.get_job_unit_progress(&job.job_unit_id) {
                Ok(progress) => {
                    log::info!(target: "job_queue", "job_unit_progress; job_unit_id={}; completed={}; total={}", job.job_unit_id, progress.completed_jobs, progress.total_jobs);

                    // Emit individual job completion event
                    if let Err(e) = app_handle.emit("job_completed", &job.job_unit_id) {
                        log::error!(target: "job_queue", "event_emit_error; event=job_completed; error={}", e);
                    }

                    // If all jobs are complete, emit legacy import completion events
                    if progress.completed_jobs >= progress.total_jobs {
                        log::info!(target: "job_queue", "all_jobs_complete; job_unit_id={}; status=emitting_events", job.job_unit_id);
                        emit_import_completion_events(&app_handle, &job.job_unit_id, &db);
                    }
                }
                Err(e) => {
                    log::error!(target: "job_queue", "job_unit_progress_error; job_unit_id={}; error={}", job.job_unit_id, e);
                    // Still emit job completed event
                    if let Err(e) = app_handle.emit("job_completed", &job.job_unit_id) {
                        log::error!(target: "job_queue", "event_emit_error; event=job_completed; error={}", e);
                    }
                }
            }
        }
        Err(error_msg) => {
            if let Err(e) = db.update_job_status(
                job_id,
                &job_queue::JobStatus::Failed,
                Some(error_msg.clone()),
            ) {
                log::error!(target: "job_queue", "job_status_error; job_id={}; target_status=failed; error={}", job_id, e);
            }
            log::error!(target: "job_queue", "job_failed; job_id={}; error={}", job_id, error_msg);

            // Emit error event
            if let Err(e) = app_handle.emit("job_failed", (&job.job_unit_id, &error_msg)) {
                log::error!(target: "job_queue", "event_emit_error; event=job_failed; error={}", e);
            }
        }
    }
}
