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

/// Runs AI tagging for all photos in the library
///
/// # Arguments
/// * `window` - Tauri window handle for emitting events
/// * `state` - Application state
///
/// # Returns
/// JSON string containing the job unit ID or an error message
#[tauri::command]
pub fn run_ai_tagging_for_all(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    use crate::domain_service::job_queue::executor::process_new_jobs;
    use crate::entity::config::Config;
    use crate::entity::job_queue::{Job, JobType, QueuedJob};
    use crate::repository::meta_db::sqlite::SQLite;
    use std::sync::Arc;

    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "ai_tagging",
        "all_photos_tagging_request; correlation_id={}",
        correlation_id
    );

    // Reload config to get latest settings
    let config = Config::new();

    // Check if AI tagging is enabled
    if !config.ai_tagging.enabled {
        return Err("AI tagging is disabled. Enable it in Preferences first.".to_string());
    }

    // Get all photos using meta_db
    let photos = state
        .meta_db
        .get_all_photos_for_grouping()
        .map_err(|e| format!("Failed to get photos: {}", e))?;

    if photos.is_empty() {
        log::info!(
            target: "ai_tagging",
            "all_photos_tagging_request; correlation_id={}; status=no_photos",
            correlation_id
        );
        return Ok(r#"{"result": "no_photos", "count": 0}"#.to_string());
    }

    // Filter to only include image files
    let image_paths: Vec<String> = photos
        .iter()
        .filter(|p| {
            let lower = p.file.path.to_lowercase();
            lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".png")
                || lower.ends_with(".webp")
                || lower.ends_with(".heic")
                || lower.ends_with(".heif")
        })
        .map(|p| p.file.path.clone())
        .collect();

    if image_paths.is_empty() {
        log::info!(
            target: "ai_tagging",
            "all_photos_tagging_request; correlation_id={}; status=no_images",
            correlation_id
        );
        return Ok(r#"{"result": "no_images", "count": 0}"#.to_string());
    }

    let photo_count = image_paths.len();

    // Create job unit first (required for foreign key constraint)
    use crate::entity::job_queue::JobUnit;
    let job_types = vec!["ai_tagging".to_string()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit first
    state
        .meta_db
        .create_job_unit(&job_unit)
        .map_err(|e| format!("Failed to create job unit: {}", e))?;

    // Create AI tagging job
    let job = Job::new(job_unit_id.clone(), JobType::AiTagging, image_paths);
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Add job to queue using meta_db
    let job_id = state
        .meta_db
        .create_job(&queued_job)
        .map_err(|e| format!("Failed to create job: {}", e))?;

    log::info!(
        target: "ai_tagging",
        "all_photos_tagging_job_created; correlation_id={}; job_id={}; job_unit_id={}; photos={}",
        correlation_id,
        job_id,
        job_unit_id,
        photo_count
    );

    // Trigger job processing with a new SQLite instance wrapped in Arc
    let db = Arc::new(SQLite::new(config.import_to.clone()));
    let app_handle = window.app_handle().clone();
    process_new_jobs(db, 1, app_handle); // Use 1 concurrent job for AI tagging

    Ok(format!(
        r#"{{"result": "started", "job_unit_id": "{}", "job_id": {}, "photo_count": {}}}"#,
        job_unit_id, job_id, photo_count
    ))
}

/// Runs AI tagging for photos on a specific date
///
/// # Arguments
/// * `date` - Date string in format "YYYY-MM-DD" or "YYYY/MM/DD"
/// * `window` - Tauri window handle for emitting events
/// * `state` - Application state
///
/// # Returns
/// JSON string containing the job unit ID or an error message
#[tauri::command]
pub fn run_ai_tagging_for_date(
    date: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    use crate::domain_service::job_queue::executor::process_new_jobs;
    use crate::entity::config::Config;
    use crate::entity::job_queue::{Job, JobType, QueuedJob};
    use crate::repository::meta_db::sqlite::SQLite;
    use std::sync::Arc;

    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "ai_tagging",
        "date_tagging_request; correlation_id={}; date={}",
        correlation_id,
        date
    );

    // Reload config to get latest settings
    let config = Config::new();

    // Check if AI tagging is enabled
    if !config.ai_tagging.enabled {
        return Err("AI tagging is disabled. Enable it in Preferences first.".to_string());
    }

    // Normalize date format (convert YYYY/MM/DD to YYYY-MM-DD if needed)
    let normalized_date = date.replace('/', "-");

    // Get photos for the specified date using meta_db
    let photos = state
        .meta_db
        .get_photos_for_grouping_in_date(&normalized_date)
        .map_err(|e| format!("Failed to get photos for date: {}", e))?;

    if photos.is_empty() {
        log::info!(
            target: "ai_tagging",
            "date_tagging_request; correlation_id={}; status=no_photos; date={}",
            correlation_id,
            normalized_date
        );
        return Ok(r#"{"result": "no_photos", "count": 0}"#.to_string());
    }

    // Filter to only include image files
    let image_paths: Vec<String> = photos
        .iter()
        .filter(|p| {
            let lower = p.file.path.to_lowercase();
            lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".png")
                || lower.ends_with(".webp")
                || lower.ends_with(".heic")
                || lower.ends_with(".heif")
        })
        .map(|p| p.file.path.clone())
        .collect();

    if image_paths.is_empty() {
        log::info!(
            target: "ai_tagging",
            "date_tagging_request; correlation_id={}; status=no_images; date={}",
            correlation_id,
            normalized_date
        );
        return Ok(r#"{"result": "no_images", "count": 0}"#.to_string());
    }

    let photo_count = image_paths.len();

    // Create job unit first (required for foreign key constraint)
    use crate::entity::job_queue::JobUnit;
    let job_types = vec!["ai_tagging".to_string()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit first
    state
        .meta_db
        .create_job_unit(&job_unit)
        .map_err(|e| format!("Failed to create job unit: {}", e))?;

    // Create AI tagging job
    let job = Job::new(job_unit_id.clone(), JobType::AiTagging, image_paths);
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Add job to queue using meta_db
    let job_id = state
        .meta_db
        .create_job(&queued_job)
        .map_err(|e| format!("Failed to create job: {}", e))?;

    log::info!(
        target: "ai_tagging",
        "date_tagging_job_created; correlation_id={}; job_id={}; job_unit_id={}; photos={}",
        correlation_id,
        job_id,
        job_unit_id,
        photo_count
    );

    // Trigger job processing with a new SQLite instance wrapped in Arc
    let db = Arc::new(SQLite::new(config.import_to.clone()));
    let app_handle = window.app_handle().clone();
    process_new_jobs(db, 1, app_handle); // Use 1 concurrent job for AI tagging

    Ok(format!(
        r#"{{"result": "started", "job_unit_id": "{}", "job_id": {}, "photo_count": {}}}"#,
        job_unit_id, job_id, photo_count
    ))
}
