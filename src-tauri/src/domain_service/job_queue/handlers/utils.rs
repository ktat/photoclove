//! Common utilities for job handlers.

use crate::entity::job_queue::QueuedJob;
use std::path::PathBuf;

/// Get the start index for resume functionality.
/// Returns the index to start processing from based on last_processed_id.
/// If last_processed_id is None, returns 0 (start from beginning).
/// If last_processed_id is Some(n), returns n+1 (skip already processed items).
pub fn get_resume_start_index(job: &QueuedJob) -> usize {
    job.last_processed_id.map(|id| (id + 1) as usize).unwrap_or(0)
}

/// Log resume information if resuming from a previous position.
pub fn log_resume_info(target: &str, start_index: usize, total: usize) {
    if start_index > 0 {
        log::info!(
            target: target,
            "resuming; start_index={}; total={}",
            start_index,
            total
        );
    }
}

// ==================== Job Stop (Kill File) ====================

/// Get the directory for kill files.
fn get_kill_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("photoclove")
        .join("job_kill")
}

/// Get the kill file path for a specific job.
fn get_kill_file_path(job_id: i64) -> PathBuf {
    get_kill_dir().join(format!("{}", job_id))
}

/// Check if the job should stop (kill file exists).
pub fn should_stop_job(job_id: i64) -> bool {
    get_kill_file_path(job_id).exists()
}

/// Create a kill file to signal job stop.
pub fn create_kill_file(job_id: i64) -> Result<(), String> {
    let kill_dir = get_kill_dir();
    std::fs::create_dir_all(&kill_dir)
        .map_err(|e| format!("Failed to create kill directory: {}", e))?;

    let kill_file = get_kill_file_path(job_id);
    std::fs::write(&kill_file, "")
        .map_err(|e| format!("Failed to create kill file: {}", e))?;

    log::info!(target: "job_queue", "kill_file_created; job_id={}", job_id);
    Ok(())
}

/// Remove the kill file for a job (cleanup after job ends).
pub fn cleanup_kill_file(job_id: i64) {
    let kill_file = get_kill_file_path(job_id);
    if kill_file.exists() {
        if let Err(e) = std::fs::remove_file(&kill_file) {
            log::warn!(target: "job_queue", "kill_file_cleanup_failed; job_id={}; error={}", job_id, e);
        }
    }
}

/// Cleanup all kill files (called on app startup).
pub fn cleanup_all_kill_files() {
    let kill_dir = get_kill_dir();
    if kill_dir.exists() {
        match std::fs::read_dir(&kill_dir) {
            Ok(entries) => {
                let mut count = 0;
                for entry in entries.flatten() {
                    if let Err(e) = std::fs::remove_file(entry.path()) {
                        log::warn!(target: "job_queue", "kill_file_cleanup_failed; path={:?}; error={}", entry.path(), e);
                    } else {
                        count += 1;
                    }
                }
                if count > 0 {
                    log::info!(target: "job_queue", "startup_kill_files_cleaned; count={}", count);
                }
            }
            Err(e) => {
                log::warn!(target: "job_queue", "kill_dir_read_failed; error={}", e);
            }
        }
    }
}
