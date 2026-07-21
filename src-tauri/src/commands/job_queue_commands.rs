use crate::commands::job_helpers::{
    create_and_start_job, filter_image_paths, normalize_date, NO_IMAGES_RESPONSE,
    NO_PHOTOS_RESPONSE,
};
use crate::commands::run_blocking;
use crate::entity::config::Config;
use crate::entity::job_queue::JobType;
use crate::AppState;
use tauri::Manager;

/// Retrieves all job units from the job queue manager
#[tauri::command]
pub async fn get_all_job_units(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let job_units = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.get_all_job_units()
        };

        serde_json::to_string(&job_units)
            .map_err(|e| format!("Failed to serialize job units: {}", e))
    })
    .await
}

/// Retrieves all jobs from the job queue manager
#[tauri::command]
pub async fn get_all_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let jobs = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.get_all_jobs()
        };

        serde_json::to_string(&jobs).map_err(|e| format!("Failed to serialize jobs: {}", e))
    })
    .await
}

/// Retries a failed job
#[tauri::command]
pub async fn retry_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let logging_service = state.logging_service.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "job_queue",
            "manual_retry_request; correlation_id={}; job_id={}",
            correlation_id,
            job_id
        );

        let app_handle = window.app_handle().clone();
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
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
    })
    .await
}

/// Deletes a job from the job queue
#[tauri::command]
pub async fn delete_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.delete_job(job_id)
        };

        match result {
            Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
            Err(e) => Err(format!("Failed to delete job: {}", e)),
        }
    })
    .await
}

/// Deletes a job unit from the job queue
#[tauri::command]
pub async fn delete_job_unit(
    job_unit_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.delete_job_unit(job_unit_id)
        };

        match result {
            Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
            Err(e) => Err(format!("Failed to delete job unit: {}", e)),
        }
    })
    .await
}

/// Cleans up all completed jobs from the job queue
#[tauri::command]
pub async fn cleanup_completed_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.cleanup_completed_jobs()
        };

        match result {
            Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
            Err(e) => Err(format!("Failed to cleanup completed jobs: {}", e)),
        }
    })
    .await
}

/// Stop a running job by creating a kill file
#[tauri::command]
pub async fn stop_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let logging_service = state.logging_service.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "job_queue",
            "stop_job_request; correlation_id={}; job_id={}",
            correlation_id,
            job_id
        );

        // Create kill file to signal the job to stop
        match crate::domain_service::job_queue::handlers::utils::create_kill_file(job_id) {
            Ok(()) => {
                log::info!(
                    target: "job_queue",
                    "stop_job_success; correlation_id={}; job_id={}",
                    correlation_id,
                    job_id
                );
                Ok(serde_json::json!({"Ok": true}).to_string())
            }
            Err(e) => {
                log::error!(
                    target: "job_queue",
                    "stop_job_error; correlation_id={}; job_id={}; error={}",
                    correlation_id,
                    job_id,
                    e
                );
                Ok(serde_json::json!({"Err": e}).to_string())
            }
        }
    })
    .await
}

/// Resume a job from where it stopped (skips already processed items)
#[tauri::command]
pub async fn resume_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let logging_service = state.logging_service.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "job_queue",
            "resume_job_request; correlation_id={}; job_id={}",
            correlation_id,
            job_id
        );

        let app_handle = window.app_handle().clone();
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.resume_job(job_id, app_handle)
        };

        match result {
            Ok(success) => {
                log::info!(
                    target: "job_queue",
                    "resume_job_success; correlation_id={}; job_id={}; success={}",
                    correlation_id,
                    job_id,
                    success
                );
                Ok(serde_json::json!({"Ok": success}).to_string())
            }
            Err(e) => {
                log::error!(
                    target: "job_queue",
                    "resume_job_error; correlation_id={}; job_id={}; error={}",
                    correlation_id,
                    job_id,
                    e
                );
                Ok(serde_json::json!({"Err": e}).to_string())
            }
        }
    })
    .await
}

/// Restart a job from the beginning (processes all items again)
#[tauri::command]
pub async fn restart_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let logging_service = state.logging_service.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "job_queue",
            "restart_job_request; correlation_id={}; job_id={}",
            correlation_id,
            job_id
        );

        let app_handle = window.app_handle().clone();
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.restart_job(job_id, app_handle)
        };

        match result {
            Ok(success) => {
                log::info!(
                    target: "job_queue",
                    "restart_job_success; correlation_id={}; job_id={}; success={}",
                    correlation_id,
                    job_id,
                    success
                );
                Ok(serde_json::json!({"Ok": success}).to_string())
            }
            Err(e) => {
                log::error!(
                    target: "job_queue",
                    "restart_job_error; correlation_id={}; job_id={}; error={}",
                    correlation_id,
                    job_id,
                    e
                );
                Ok(serde_json::json!({"Err": e}).to_string())
            }
        }
    })
    .await
}

/// Get job type configuration for UI display
#[tauri::command]
pub async fn get_job_config(
    job_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    run_blocking(move || {
        let result = {
            let manager = job_queue_manager
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            manager.get_job_config(job_id)
        };

        match result {
            Ok(config) => {
                let json = serde_json::json!({
                    "Ok": {
                        "resume_supported": config.resume_supported,
                        "restart_supported": config.restart_supported
                    }
                });
                Ok(json.to_string())
            }
            Err(e) => Ok(serde_json::json!({"Err": e}).to_string()),
        }
    })
    .await
}

/// Runs AI tagging for all photos in the library
#[tauri::command]
pub async fn run_ai_tagging_for_all(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = state.logging_service.clone();
    let meta_db = state.meta_db.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "ai_tagging",
            "all_photos_tagging_request; correlation_id={}",
            correlation_id
        );

        // Check if AI tagging is enabled
        let config = Config::new();
        if !config.ai_tagging.enabled {
            return Err("AI tagging is disabled. Enable it in Preferences first.".to_string());
        }

        // Get all photos
        let photos = meta_db
            .get_all_photos_for_grouping()
            .map_err(|e| format!("Failed to get photos: {}", e))?;

        if photos.is_empty() {
            log::info!(
                target: "ai_tagging",
                "all_photos_tagging_request; correlation_id={}; status=no_photos",
                correlation_id
            );
            return Ok(NO_PHOTOS_RESPONSE.to_string());
        }

        let image_paths = filter_image_paths(&photos);

        if image_paths.is_empty() {
            log::info!(
                target: "ai_tagging",
                "all_photos_tagging_request; correlation_id={}; status=no_images",
                correlation_id
            );
            return Ok(NO_IMAGES_RESPONSE.to_string());
        }

        let result = create_and_start_job(
            &meta_db,
            JobType::AiTagging,
            image_paths,
            window.app_handle().clone(),
            &correlation_id,
            "ai_tagging",
        )?;

        Ok(result.to_json())
    })
    .await
}

/// Runs AI tagging for photos on a specific date
#[tauri::command]
pub async fn run_ai_tagging_for_date(
    date: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = state.logging_service.clone();
    let meta_db = state.meta_db.clone();
    run_blocking(move || {
        let correlation_id = logging_service.generate_correlation_id();

        log::info!(
            target: "ai_tagging",
            "date_tagging_request; correlation_id={}; date={}",
            correlation_id,
            date
        );

        // Check if AI tagging is enabled
        let config = Config::new();
        if !config.ai_tagging.enabled {
            return Err("AI tagging is disabled. Enable it in Preferences first.".to_string());
        }

        let normalized_date = normalize_date(&date);

        let photos = meta_db
            .get_photos_for_grouping_in_date(&normalized_date)
            .map_err(|e| format!("Failed to get photos for date: {}", e))?;

        if photos.is_empty() {
            log::info!(
                target: "ai_tagging",
                "date_tagging_request; correlation_id={}; status=no_photos; date={}",
                correlation_id,
                normalized_date
            );
            return Ok(NO_PHOTOS_RESPONSE.to_string());
        }

        let image_paths = filter_image_paths(&photos);

        if image_paths.is_empty() {
            log::info!(
                target: "ai_tagging",
                "date_tagging_request; correlation_id={}; status=no_images; date={}",
                correlation_id,
                normalized_date
            );
            return Ok(NO_IMAGES_RESPONSE.to_string());
        }

        let result = create_and_start_job(
            &meta_db,
            JobType::AiTagging,
            image_paths,
            window.app_handle().clone(),
            &correlation_id,
            "ai_tagging",
        )?;

        Ok(result.to_json())
    })
    .await
}
