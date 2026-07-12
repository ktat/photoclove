//! AI Model Management Commands
//!
//! Commands for managing AI models used in photo tagging.

use crate::domain_service::ai_tagging::backend::{ModelInfo, ModelManager, ModelStatus};
use crate::domain_service::ai_tagging::categories::AutoTagCategory;
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

    Ok(format!(
        r#"{{"result": "success", "model_id": "{}"}}"#,
        model_id
    ))
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

    Ok(format!(
        r#"{{"result": "success", "model_id": "{}"}}"#,
        model_id
    ))
}

/// Get the models directory path
#[tauri::command]
pub fn get_ai_models_dir() -> Result<String, String> {
    let dir = ModelManager::default_models_dir();
    Ok(dir.to_string_lossy().to_string())
}

/// Get installation status of the ONNX Runtime dynamic library.
#[tauri::command]
pub fn get_onnx_runtime_status() -> Result<String, String> {
    use crate::domain_service::ai_tagging::runtime_installer;

    let installed = runtime_installer::is_installed();
    let supported = runtime_installer::download_url().is_some();
    let path = runtime_installer::lib_path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(serde_json::json!({
        "installed": installed,
        "auto_install_supported": supported,
        "path": path,
        "version": runtime_installer::ONNX_VERSION,
    })
    .to_string())
}

/// Download and install the ONNX Runtime dynamic library.
#[tauri::command]
pub fn download_onnx_runtime() -> Result<String, String> {
    use crate::domain_service::ai_tagging::runtime_installer;

    log::info!(target: "ai_tagging", "onnx_runtime_install_request");
    runtime_installer::install()?;

    Ok(serde_json::json!({
        "result": "success",
        "version": runtime_installer::ONNX_VERSION,
    })
    .to_string())
}

/// Get default CLIP labels for OpenCLIP/SigLIP
#[tauri::command]
pub fn get_default_clip_labels() -> Result<String, String> {
    use crate::domain_service::ai_tagging::backend::clip_common::DEFAULT_CLIP_LABELS;

    let labels: Vec<&str> = DEFAULT_CLIP_LABELS.to_vec();
    serde_json::to_string(&labels).map_err(|e| format!("Serialization error: {}", e))
}

/// Run AI tagging for a single photo
#[tauri::command]
pub fn run_ai_tagging_for_photo(
    photo_path: String,
    use_full_image: Option<bool>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    let use_full = use_full_image.unwrap_or(false);
    use crate::domain_service::ai_tagging::service::{get_service, AITaggingConfig};
    use crate::value::file;
    use std::path::Path;

    log::info!(
        target: "ai_tagging",
        "single_photo_tagging_request; photo_path={}; use_full_image={}",
        photo_path,
        use_full
    );

    let config = &state.config;

    // Resolve relative path to absolute for file I/O
    let abs_path = if photo_path.starts_with('/') {
        photo_path.clone()
    } else {
        file::to_absolute_path(&photo_path, &config.import_to)
    };

    // Check if AI tagging is enabled
    if !config.ai_tagging.enabled {
        return Err("AI tagging is disabled. Enable it in Preferences first.".to_string());
    }

    // Convert config categories
    let enabled_categories = if config.ai_tagging.enabled_categories.is_empty() {
        None
    } else {
        Some(
            config
                .ai_tagging
                .enabled_categories
                .iter()
                .filter_map(|s| s.parse::<AutoTagCategory>().ok())
                .collect(),
        )
    };

    // Initialize the AI service with configuration
    // When use_full_image is true, disable EXIF thumbnail completely
    let (use_exif_thumbnail, min_thumbnail_size) = if use_full {
        (false, 0)
    } else {
        (
            config.ai_tagging.use_exif_thumbnail,
            config.ai_tagging.min_thumbnail_size,
        )
    };

    let service_config = AITaggingConfig {
        enabled: config.ai_tagging.enabled,
        auto_tag_on_import: config.ai_tagging.auto_tag_on_import,
        confidence_threshold: config.ai_tagging.confidence_threshold,
        max_tags_per_image: config.ai_tagging.max_tags_per_image as usize,
        enabled_categories,
        model_type: config.ai_tagging.model_type.clone(),
        custom_labels: config.ai_tagging.custom_labels.clone(),
        use_exif_thumbnail,
        min_thumbnail_size,
    };

    let service = get_service();
    {
        let mut svc = service.lock().unwrap_or_else(|poisoned| {
            log::warn!(
                target: "ai_tagging",
                "recovering_poisoned_lock; status=recovered"
            );
            poisoned.into_inner()
        });

        svc.set_config(service_config);

        if !svc.is_ready() {
            log::info!(
                target: "ai_tagging",
                "service_init; status=initializing"
            );
            svc.initialize()?;
        }
    }

    // Tag the photo
    let result = {
        let svc = service.lock().unwrap_or_else(|poisoned| {
            log::warn!(
                target: "ai_tagging",
                "recovering_poisoned_lock_in_tag; status=recovered"
            );
            poisoned.into_inner()
        });
        svc.tag_photo(Path::new(&abs_path))
    };

    if result.success {
        // Store tags in database
        for tag in &result.tags {
            // Get or create the collection for this AI tag
            let collection_id = match state.meta_db.get_or_create_collection(&tag.tag_name, "tag") {
                Ok(id) => id,
                Err(e) => {
                    log::error!(
                        target: "ai_tagging",
                        "collection_error; tag={}; error={}",
                        tag.tag_name,
                        e
                    );
                    continue;
                }
            };

            // Add photo to collection with confidence metadata
            let metadata = serde_json::json!({
                "confidence": tag.confidence,
                "model": tag.model,
                "auto_generated": true
            });

            if let Err(e) = state.meta_db.add_photo_to_collection_with_metadata(
                collection_id,
                &photo_path,
                Some(metadata.to_string()),
            ) {
                log::error!(
                    target: "ai_tagging",
                    "add_photo_error; photo={}; collection={}; error={}",
                    photo_path,
                    tag.tag_name,
                    e
                );
            }
        }

        log::info!(
            target: "ai_tagging",
            "single_photo_tagged; path={}; tags={}",
            photo_path,
            result.tags.len()
        );

        // Return the tags
        let response_tags: Vec<serde_json::Value> = result
            .tags
            .iter()
            .map(|t| {
                serde_json::json!({
                    "tag_name": t.tag_name,
                    "confidence": t.confidence,
                    "model": t.model
                })
            })
            .collect();

        Ok(serde_json::json!({
            "success": true,
            "tags": response_tags,
            "count": result.tags.len()
        })
        .to_string())
    } else {
        let error = result.error.unwrap_or_else(|| "Unknown error".to_string());
        log::warn!(
            target: "ai_tagging",
            "single_photo_tagging_failed; path={}; error={}",
            photo_path,
            error
        );
        Err(error)
    }
}
