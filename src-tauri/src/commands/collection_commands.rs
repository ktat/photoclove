use crate::app_state::AppState;
use crate::domain_service::achievements;
use crate::repository::MetaInfoDB;
use tauri::State;

// Unified PhotoCollection API endpoints

/// Create a new collection (album or photo collection)
#[tauri::command]
pub async fn create_collection(
    collection_type: String,
    name: String,
    description: Option<String>,
    color: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "create_collection_request; correlation_id={}; type={}; name={}", correlation_id, collection_type, name);

    match meta_db.create_collection(
        &collection_type,
        &name,
        description.as_deref(),
        color.as_deref(),
    ) {
        Ok(collection_id) => {
            log::info!(target: "photo_collections", "create_collection_success; correlation_id={}; collection_id={}", correlation_id, collection_id);

            // Check achievement based on collection type
            let achievement_id = if collection_type == "album" {
                "first_album"
            } else {
                "first_tag"
            };
            let _ = achievements::check_and_emit_achievement(
                &app_handle,
                &state.meta_db,
                achievement_id,
            );

            Ok(collection_id)
        }
        Err(e) => {
            log::error!(target: "photo_collections", "create_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Get all collections of a specific type (or all types if None)
#[tauri::command]
pub async fn get_all_collections(
    collection_type: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    let config = state.config.clone();

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "get_all_collections_request; correlation_id={}; type={:?}", correlation_id, collection_type);

    match meta_db.get_all_collections(collection_type.as_deref(), config) {
        Ok(collections) => {
            log::info!(target: "photo_collections", "get_all_collections_success; correlation_id={}; count={}", correlation_id, collections.len());

            // Debug: log first collection with cover photo
            if let Some(first_with_cover) = collections
                .iter()
                .find(|c| c.get("coverPhoto").and_then(|v| v.as_object()).is_some())
            {
                log::debug!(target: "photo_collections", "sample_collection_with_cover; id={}; has_cover_photo={}",
                    first_with_cover.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
                    first_with_cover.get("coverPhoto").is_some());
            }

            serde_json::to_string(&collections).map_err(|e| e.to_string())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "get_all_collections_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Update collection metadata
#[tauri::command]
pub async fn update_collection(
    id: i32,
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
    cover_photo_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "update_collection_request; correlation_id={}; id={}", correlation_id, id);

    match meta_db.update_collection(
        id,
        name.as_deref(),
        description.as_deref(),
        color.as_deref(),
        cover_photo_path.as_deref(),
    ) {
        Ok(()) => {
            log::info!(target: "photo_collections", "update_collection_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "update_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Delete a collection
#[tauri::command]
pub async fn delete_collection(id: i32, state: State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "delete_collection_request; correlation_id={}; id={}", correlation_id, id);

    match meta_db.delete_collection(id) {
        Ok(deleted) => {
            log::info!(target: "photo_collections", "delete_collection_success; correlation_id={}; deleted={}", correlation_id, deleted);
            Ok(deleted)
        }
        Err(e) => {
            log::error!(target: "photo_collections", "delete_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Add a photo to a collection
#[tauri::command]
pub async fn add_photo_to_collection(
    collection_id: i32,
    photo_path: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "add_photo_to_collection_request; correlation_id={}; collection_id={}; photo_path={}", correlation_id, collection_id, photo_path);

    match meta_db.add_photo_to_collection(collection_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "photo_collections", "add_photo_to_collection_success; correlation_id={}", correlation_id);

            // Check achievement based on collection type
            if let Ok(Some(collection_type)) = meta_db.get_collection_type(collection_id) {
                let achievement_id = if collection_type == "album" {
                    "first_album"
                } else {
                    "first_tag"
                };
                let _ = achievements::check_and_emit_achievement(
                    &app_handle,
                    &state.meta_db,
                    achievement_id,
                );
            }

            Ok(())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "add_photo_to_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Add multiple photos to a collection in bulk
///
/// This is more efficient than calling add_photo_to_collection multiple times.
/// It first filters out photos that are already in the collection, then bulk inserts
/// the remaining photos in batches (to respect SQLite variable limits).
/// Works for both albums and tags.
#[tauri::command]
pub async fn add_photos_to_collection_bulk(
    collection_id: i32,
    photo_paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "add_photos_to_collection_bulk_request; correlation_id={}; collection_id={}; photo_count={}",
        correlation_id, collection_id, photo_paths.len());

    match meta_db.add_photos_to_collection_bulk(collection_id, &photo_paths) {
        Ok(added_count) => {
            log::info!(target: "photo_collections", "add_photos_to_collection_bulk_success; correlation_id={}; added_count={}; requested_count={}",
                correlation_id, added_count, photo_paths.len());
            Ok(added_count)
        }
        Err(e) => {
            log::error!(target: "photo_collections", "add_photos_to_collection_bulk_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Remove a photo from a collection
#[tauri::command]
pub async fn remove_photo_from_collection(
    collection_id: i32,
    photo_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "remove_photo_from_collection_request; correlation_id={}; collection_id={}; photo_path={}", correlation_id, collection_id, photo_path);

    match meta_db.remove_photo_from_collection(collection_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "photo_collections", "remove_photo_from_collection_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "remove_photo_from_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Get all photos in a collection
#[tauri::command]
pub async fn get_collection_photos(
    collection_id: i32,
    ordered: Option<bool>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "get_collection_photos_request; correlation_id={}; collection_id={}; ordered={:?}", correlation_id, collection_id, ordered);

    match meta_db.get_collection_photos(
        collection_id,
        ordered.unwrap_or(false),
        Some(state.config.clone()),
    ) {
        Ok(mut photos) => {
            // Set has_thumbnail flag for each photo
            for photo in photos.iter_mut() {
                photo.set_has_thumbnail();
            }
            log::info!(target: "photo_collections", "get_collection_photos_success; correlation_id={}; count={}", correlation_id, photos.len());
            serde_json::to_string(&photos).map_err(|e| e.to_string())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "get_collection_photos_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}
