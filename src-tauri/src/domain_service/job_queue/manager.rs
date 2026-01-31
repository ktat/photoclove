use super::executor::process_specific_jobs_immediately;
use super::submission::{submit_create_db_job, submit_google_photos_upload_jobs, submit_import_jobs};
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

/// Job queue manager - coordinates job submission and processing
pub struct JobQueueManager {
    db: Arc<SQLite>,
    is_running: Arc<Mutex<bool>>,
    max_concurrent_jobs: usize,
}

impl JobQueueManager {
    /// Create a new JobQueueManager
    pub fn new(db: SQLite, max_concurrent_jobs: usize) -> Self {
        JobQueueManager {
            db: Arc::new(db),
            is_running: Arc::new(Mutex::new(false)),
            max_concurrent_jobs,
        }
    }

    /// Start background processing - resets interrupted jobs and notifies about pending jobs
    pub fn start_background_processing(&self, app_handle: tauri::AppHandle) {
        let is_running = Arc::clone(&self.is_running);

        {
            let mut running = is_running.lock().unwrap();
            if *running {
                return; // Already running
            }
            *running = true;
        }

        log::info!(target: "job_queue", "startup; status=starting");

        // 1. At startup: Reset any running jobs to pending (they were interrupted)
        log::info!(target: "job_queue", "startup; status=resetting_interrupted_jobs");
        if let Err(e) = self.reset_running_jobs_to_pending() {
            log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
        }

        // 2. At startup: Check for pending jobs and notify user (don't process - let user decide)
        log::info!(target: "job_queue", "startup; status=checking_pending_jobs");
        match self.db.get_pending_jobs() {
            Ok(pending_jobs) => {
                if !pending_jobs.is_empty() {
                    log::info!(target: "job_queue", "startup; pending_jobs_found; count={}", pending_jobs.len());

                    // Emit notification event for frontend
                    if let Err(e) = app_handle.emit("pending_jobs_found", pending_jobs.len()) {
                        log::error!(target: "job_queue", "startup; event_emit_error; error={}", e);
                    }
                } else {
                    log::info!(target: "job_queue", "startup; pending_jobs=none");
                }
            }
            Err(e) => {
                log::error!(target: "job_queue", "startup; get_pending_jobs_error; error={}", e);
            }
        }

        log::info!(target: "job_queue", "startup; status=complete");
        log::info!(target: "job_queue", "startup; status=ready_for_jobs");
    }

    /// Stop background processing
    #[allow(dead_code)]
    pub fn stop_background_processing(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
    }

    /// Reset any jobs that were "running" to "pending" (they were interrupted by app shutdown)
    fn reset_running_jobs_to_pending(&self) -> Result<(), String> {
        log::info!(target: "job_queue", "reset_jobs; status=checking");
        match self.db.reset_running_jobs_to_pending() {
            Ok(count) => {
                if count > 0 {
                    log::info!(target: "job_queue", "reset_jobs; status=reset; count={}", count);
                } else {
                    log::info!(target: "job_queue", "reset_jobs; status=none_found");
                }
                Ok(())
            }
            Err(e) => {
                log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
                Err(e)
            }
        }
    }

    /// Submit Google Photos upload jobs in batches
    pub fn submit_google_photos_upload_jobs(
        &self,
        photos: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        submit_google_photos_upload_jobs(
            Arc::clone(&self.db),
            self.max_concurrent_jobs,
            photos,
            app_handle,
        )
    }

    /// Submit import jobs - creates job unit and starts processing
    pub fn submit_import_jobs(
        &self,
        files: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        submit_import_jobs(
            Arc::clone(&self.db),
            self.max_concurrent_jobs,
            files,
            app_handle,
        )
    }

    /// Submit create database job for all photos
    pub fn submit_create_db_job(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        submit_create_db_job(
            Arc::clone(&self.db),
            app_handle,
        )
    }

    /// Get progress for a specific job unit
    pub fn get_job_progress(&self, job_unit_id: &str) -> Result<job_queue::JobProgress, String> {
        self.db.get_job_unit_progress(job_unit_id)
    }

    /// Get all job units
    pub fn get_all_job_units(&self) -> Result<Vec<job_queue::JobUnit>, String> {
        // This method would need to be implemented in the database layer
        // For now, return a placeholder
        Ok(vec![])
    }

    /// Get all jobs
    pub fn get_all_jobs(&self) -> Result<Vec<job_queue::QueuedJob>, String> {
        match self.db.get_all_jobs() {
            Ok(jobs) => Ok(jobs),
            Err(e) => Err(format!("Failed to get jobs: {}", e)),
        }
    }

    /// Retry a failed job
    pub fn retry_job(&self, job_id: i64, app_handle: tauri::AppHandle) -> Result<bool, String> {
        log::info!(target: "job_retry", "manual_retry; status=starting");
        log::info!(target: "job_retry", "manual_retry; job_id={}", job_id);

        // Reset job status to pending so it can be retried
        match self
            .db
            .update_job_status(job_id, &job_queue::JobStatus::Pending, None)
        {
            Ok(()) => {
                log::info!(target: "job_retry", "status_reset; job_id={}; status=pending", job_id);

                // Immediately process the retried job
                log::info!(target: "job_retry", "retry_processing; job_id={}; status=starting", job_id);
                process_specific_jobs_immediately(self.db.clone(), vec![job_id], app_handle);

                Ok(true)
            }
            Err(e) => Err(format!("Failed to retry job: {}", e)),
        }
    }

    /// Delete a specific job
    pub fn delete_job(&self, job_id: i64) -> Result<bool, String> {
        match self.db.delete_job(job_id) {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to delete job: {}", e)),
        }
    }

    /// Delete a job unit and all its jobs
    pub fn delete_job_unit(&self, job_unit_id: String) -> Result<bool, String> {
        match self.db.delete_job_unit(&job_unit_id) {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to delete job unit: {}", e)),
        }
    }

    /// Cleanup completed jobs
    pub fn cleanup_completed_jobs(&self) -> Result<bool, String> {
        match self.db.cleanup_completed_jobs() {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to cleanup completed jobs: {}", e)),
        }
    }

    /// Resume a job from where it stopped (uses checker to skip processed items)
    pub fn resume_job(&self, job_id: i64, app_handle: tauri::AppHandle) -> Result<bool, String> {
        log::info!(target: "job_queue", "resume_job; job_id={}; status=starting", job_id);

        // Get the job to check its current state
        let job = self.db.get_job_by_id(job_id)?
            .ok_or_else(|| format!("Job {} not found", job_id))?;

        // Only allow resume for pending or failed jobs
        match job.status {
            job_queue::JobStatus::Pending | job_queue::JobStatus::Failed => {}
            _ => return Err(format!("Cannot resume job with status: {:?}", job.status)),
        }

        // Reset job status to pending (keep last_processed_id for resume)
        self.db.update_job_status(job_id, &job_queue::JobStatus::Pending, None)?;

        log::info!(target: "job_queue", "resume_job; job_id={}; last_processed_id={:?}; status=processing",
            job_id, job.last_processed_id);

        // Process the job (handlers will use last_processed_id to skip processed items)
        process_specific_jobs_immediately(self.db.clone(), vec![job_id], app_handle);

        Ok(true)
    }

    /// Restart a job from the beginning (clears progress)
    pub fn restart_job(&self, job_id: i64, app_handle: tauri::AppHandle) -> Result<bool, String> {
        log::info!(target: "job_queue", "restart_job; job_id={}; status=starting", job_id);

        // Get the job to check its current state
        let job = self.db.get_job_by_id(job_id)?
            .ok_or_else(|| format!("Job {} not found", job_id))?;

        // Only allow restart for pending or failed jobs
        match job.status {
            job_queue::JobStatus::Pending | job_queue::JobStatus::Failed => {}
            _ => return Err(format!("Cannot restart job with status: {:?}", job.status)),
        }

        // Reset job status to pending AND clear progress
        self.db.update_job_status(job_id, &job_queue::JobStatus::Pending, None)?;
        // Reset processed_count and last_processed_id to start from beginning
        self.db.update_job_progress_with_last_id(job_id, 0, 0)?;

        log::info!(target: "job_queue", "restart_job; job_id={}; status=processing_from_start", job_id);

        // Process the job from the beginning
        process_specific_jobs_immediately(self.db.clone(), vec![job_id], app_handle);

        Ok(true)
    }

    /// Get job type configuration for a job
    pub fn get_job_config(&self, job_id: i64) -> Result<crate::entity::job_type_config::JobTypeConfig, String> {
        let job = self.db.get_job_by_id(job_id)?
            .ok_or_else(|| format!("Job {} not found", job_id))?;

        Ok(crate::entity::job_type_config::get_job_type_config(&job.job.job_type))
    }
}
