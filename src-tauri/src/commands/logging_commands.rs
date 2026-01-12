use crate::entity::config::Config;
use crate::AppState;

/// Retrieves logs from the logging service
///
/// # Arguments
/// * `log_type` - Type of logs to retrieve ("backend" or "frontend")
/// * `lines` - Optional number of lines to retrieve
/// * `since` - Optional timestamp to retrieve logs since
/// * `state` - Application state containing the logging service
#[tauri::command]
pub async fn get_logs(
    log_type: String,
    lines: Option<usize>,
    since: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    logging_service.get_logs(&log_type, lines, since.as_deref())
}

/// Submits frontend logs to the logging service
///
/// # Arguments
/// * `logs` - JSON string containing frontend logs
/// * `state` - Application state containing the logging service
#[tauri::command]
pub async fn submit_frontend_logs(
    logs: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.submit_frontend_logs(&logs)
}

/// Enables or disables logging in the application
///
/// # Arguments
/// * `enabled` - Boolean flag to enable or disable logging
/// * `state` - Application state containing the config
#[tauri::command]
pub async fn set_logging_enabled(
    enabled: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.clone();
    config.logging_enabled = enabled;

    if config.save() {
        log::info!(target: "config", "logging_enabled updated; enabled={}", enabled);
        Ok(())
    } else {
        log::error!(target: "config", "failed to save logging_enabled config; enabled={}", enabled);
        Err("Failed to save logging configuration".to_string())
    }
}

/// Retrieves the current logging status
///
/// # Arguments
/// * `state` - Application state containing the config
///
/// # Returns
/// JSON object containing logging enabled status and level
#[tauri::command]
pub async fn get_logging_status(
    _state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    // Always read the current saved configuration to get the latest state
    let config = Config::new();
    Ok(serde_json::json!({
        "enabled": config.logging_enabled,
        "level": config.logging_level
    }))
}

/// Clears all backend logs
///
/// # Arguments
/// * `state` - Application state containing the logging service
#[tauri::command]
pub async fn clear_backend_logs(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.clear_backend_logs()
}

/// Clears all frontend logs
///
/// # Arguments
/// * `state` - Application state containing the logging service
#[tauri::command]
pub async fn clear_frontend_logs(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.clear_frontend_logs()
}

/// Exports logs to the download directory
///
/// # Arguments
/// * `log_type` - Type of logs to export ("backend" or "frontend")
/// * `filtered_logs` - Optional pre-filtered logs to export
/// * `state` - Application state containing the logging service and config
///
/// # Returns
/// Path to the exported log file
#[tauri::command]
pub async fn export_logs_to_download_dir(
    log_type: String,
    filtered_logs: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    let download_dir = &state.config.download_dir;

    // Ensure download directory exists
    std::fs::create_dir_all(download_dir)
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    logging_service.export_logs_to_file(download_dir, &log_type, filtered_logs)
}
