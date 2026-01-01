use crate::AppState;
use tauri::Manager;

/// Retrieves all job units from the job queue manager
///
/// # Arguments
/// * `state` - Application state containing the job queue manager
///
/// # Returns
/// JSON string containing all job units or an error message
#[tauri::command]
pub fn get_all_job_units(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let job_units = {
        let manager = job_queue_manager.lock().unwrap();
        manager.get_all_job_units()
    };

    match serde_json::to_string(&job_units) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize job units: {}", e)),
    }
}

/// Retrieves all jobs from the job queue manager
///
/// # Arguments
/// * `state` - Application state containing the job queue manager
///
/// # Returns
/// JSON string containing all jobs or an error message
#[tauri::command]
pub fn get_all_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let jobs = {
        let manager = job_queue_manager.lock().unwrap();
        manager.get_all_jobs()
    };

    match serde_json::to_string(&jobs) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize jobs: {}", e)),
    }
}

/// Retries a failed job
///
/// # Arguments
/// * `job_id` - ID of the job to retry
/// * `window` - Tauri window handle for emitting events
/// * `state` - Application state containing the job queue manager and logging service
///
/// # Returns
/// JSON string containing the result of the retry operation or an error message
#[tauri::command]
pub fn retry_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "job_queue",
        "manual_retry_request; correlation_id={}; job_id={}",
        correlation_id,
        job_id
    );

    let job_queue_manager = state.job_queue_manager.clone();
    let app_handle = window.app_handle().clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.retry_job(job_id, app_handle)
    };

    match result {
        Ok(success) => {
            log::info!(
                target: "job_queue",
                "manual_retry_success; correlation_id={}; job_id={}; success={}",
                correlation_id,
                job_id,
                success
            );
            Ok(format!("{{\"result\": {}}}", success))
        }
        Err(e) => {
            log::error!(
                target: "job_queue",
                "manual_retry_error; correlation_id={}; job_id={}; error={}",
                correlation_id,
                job_id,
                e
            );
            Err(format!("Failed to retry job: {}", e))
        }
    }
}

/// Deletes a job from the job queue
///
/// # Arguments
/// * `job_id` - ID of the job to delete
/// * `state` - Application state containing the job queue manager
///
/// # Returns
/// JSON string containing the result of the delete operation or an error message
#[tauri::command]
pub fn delete_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.delete_job(job_id)
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to delete job: {}", e)),
    }
}

/// Deletes a job unit from the job queue
///
/// # Arguments
/// * `job_unit_id` - ID of the job unit to delete
/// * `state` - Application state containing the job queue manager
///
/// # Returns
/// JSON string containing the result of the delete operation or an error message
#[tauri::command]
pub fn delete_job_unit(
    job_unit_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.delete_job_unit(job_unit_id)
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to delete job unit: {}", e)),
    }
}

/// Cleans up all completed jobs from the job queue
///
/// # Arguments
/// * `state` - Application state containing the job queue manager
///
/// # Returns
/// JSON string containing the result of the cleanup operation or an error message
#[tauri::command]
pub fn cleanup_completed_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.cleanup_completed_jobs()
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to cleanup completed jobs: {}", e)),
    }
}
