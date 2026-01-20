//! AI Model Management Commands
//!
//! Commands for managing AI models used in photo tagging.

use crate::domain_service::ai_tagging::backend::{ModelInfo, ModelManager, ModelStatus};
use serde::Serialize;

/// Response containing information about all available models
#[derive(Serialize)]
struct ModelListResponse {
    models: Vec<ModelWithStatus>,
}

/// Model info with its current status
#[derive(Serialize)]
struct ModelWithStatus {
    #[serde(flatten)]
    info: ModelInfo,
    status: String,
    downloaded: bool,
}

/// Get list of all available AI models with their status
#[tauri::command]
pub fn get_ai_models() -> Result<String, String> {
    let manager = ModelManager::new();
    let statuses = manager.get_all_model_statuses();

    let models: Vec<ModelWithStatus> = statuses
        .into_iter()
        .map(|(info, status)| {
            let (status_str, downloaded) = match status {
                ModelStatus::Ready => ("ready".to_string(), true),
                ModelStatus::NotDownloaded => ("not_downloaded".to_string(), false),
                ModelStatus::Downloading { progress } => {
                    (format!("downloading:{}", progress), false)
                }
                ModelStatus::Failed { error } => (format!("failed:{}", error), false),
            };
            ModelWithStatus {
                info,
                status: status_str,
                downloaded,
            }
        })
        .collect();

    let response = ModelListResponse { models };
    serde_json::to_string(&response).map_err(|e| format!("Serialization error: {}", e))
}

/// Get info about a specific model
#[tauri::command]
pub fn get_ai_model_info(model_id: String) -> Result<String, String> {
    let manager = ModelManager::new();

    let info = ModelManager::get_model_info(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let status = manager.get_model_status(&model_id);
    let (status_str, downloaded) = match status {
        ModelStatus::Ready => ("ready".to_string(), true),
        ModelStatus::NotDownloaded => ("not_downloaded".to_string(), false),
        ModelStatus::Downloading { progress } => (format!("downloading:{}", progress), false),
        ModelStatus::Failed { error } => (format!("failed:{}", error), false),
    };

    let response = ModelWithStatus {
        info,
        status: status_str,
        downloaded,
    };

    serde_json::to_string(&response).map_err(|e| format!("Serialization error: {}", e))
}

/// Check if a specific model is downloaded
#[tauri::command]
pub fn is_ai_model_downloaded(model_id: String) -> Result<bool, String> {
    let manager = ModelManager::new();
    Ok(manager.is_model_downloaded(&model_id))
}

/// Download an AI model
/// Note: This is a synchronous operation that blocks until download completes
#[tauri::command]
pub fn download_ai_model(model_id: String) -> Result<String, String> {
    log::info!(
        target: "ai_tagging",
        "download_model_request; model_id={}",
        model_id
    );

    let manager = ModelManager::new();
    manager.download_model(&model_id)?;

    Ok(format!(r#"{{"result": "success", "model_id": "{}"}}"#, model_id))
}

/// Delete a downloaded AI model
#[tauri::command]
pub fn delete_ai_model(model_id: String) -> Result<String, String> {
    log::info!(
        target: "ai_tagging",
        "delete_model_request; model_id={}",
        model_id
    );

    let manager = ModelManager::new();
    manager.delete_model(&model_id)?;

    Ok(format!(r#"{{"result": "success", "model_id": "{}"}}"#, model_id))
}

/// Get the models directory path
#[tauri::command]
pub fn get_ai_models_dir() -> Result<String, String> {
    let dir = ModelManager::default_models_dir();
    Ok(dir.to_string_lossy().to_string())
}

/// Get default CLIP labels for OpenCLIP/SigLIP
#[tauri::command]
pub fn get_default_clip_labels() -> Result<String, String> {
    use crate::domain_service::ai_tagging::backend::clip_common::DEFAULT_CLIP_LABELS;

    let labels: Vec<&str> = DEFAULT_CLIP_LABELS.to_vec();
    serde_json::to_string(&labels).map_err(|e| format!("Serialization error: {}", e))
}
