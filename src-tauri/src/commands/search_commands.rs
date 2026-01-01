//! Search and filter command implementations for PhotoClove
//!
//! This module contains Tauri commands related to photo filter option retrieval.

use crate::app_state::AppState;
use crate::repository;
use tauri::State;

/// Get available filter options for a specific filter type
///
/// This command retrieves the available values for dropdown filters in the UI,
/// such as camera models, lens models, and file extensions that exist in the
/// photo collection.
///
/// # Arguments
/// * `filter_type` - The type of filter options to retrieve:
///   - "cameras": Returns list of camera make/model combinations
///   - "lenses": Returns list of lens models
///   - "extensions": Returns list of file extensions
/// * `state` - Application state containing database access
///
/// # Returns
/// JSON string containing array of filter option objects with counts,
/// or empty array "[]" if filter_type is unknown
///
/// # Example Response
/// For "cameras": `[{"id": "Canon EOS 5D", "make": "Canon", "model": "EOS 5D", "count": 150}, ...]`
/// For "lenses": `[{"id": "Canon EF 24-70mm", "model": "Canon EF 24-70mm", "count": 200}, ...]`
/// For "extensions": `[{"extension": "jpg", "count": 500}, {"extension": "raw", "count": 100}, ...]`
#[tauri::command]
pub async fn get_filter_options(
    filter_type: &str,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    let options = match filter_type {
        "cameras" => sqlite_db
            .get_camera_options()
            .unwrap_or_else(|_| "[]".to_string()),
        "lenses" => sqlite_db
            .get_lens_options()
            .unwrap_or_else(|_| "[]".to_string()),
        "extensions" => sqlite_db
            .get_extension_options()
            .unwrap_or_else(|_| "[]".to_string()),
        _ => "[]".to_string(),
    };

    Ok(options)
}
