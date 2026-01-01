//! Album management commands.
//!
//! This module contains Tauri commands for album operations including:
//! - Creating, updating, and deleting albums
//! - Adding and removing photos from albums
//! - Retrieving album photos with or without metadata
//! - Reordering photos within albums
//!
//! All album operations use the unified PhotoCollection system internally.

use crate::app_state::AppState;

/// Creates a new album
///
/// # Arguments
/// * `name` - The name of the album
/// * `description` - A description of the album
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(i32)` - The ID of the newly created album
/// * `Err(String)` - Error message if creation fails
#[tauri::command]
pub async fn create_album(
    name: String,
    description: String,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "create_album_request; correlation_id={}; name={}; using_unified_collections=true", correlation_id, name);

    match meta_db.create_collection("album", &name, Some(&description), None) {
        Ok(collection_id) => {
            log::info!(target: "albums", "create_album_success; correlation_id={}; collection_id={}", correlation_id, collection_id);
            Ok(collection_id)
        }
        Err(e) => {
            log::error!(target: "albums", "create_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Updates an existing album
///
/// # Arguments
/// * `id` - The ID of the album to update
/// * `name` - The new name for the album
/// * `description` - The new description for the album
/// * `cover_photo_path` - Optional path to the cover photo
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(bool)` - True if the update was successful
/// * `Err(String)` - Error message if update fails
#[tauri::command]
pub async fn update_album(
    id: i32,
    name: String,
    description: String,
    cover_photo_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "update_album_request; correlation_id={}; id={}; name={}; using_unified_collections=true", correlation_id, id, name);

    match meta_db.update_collection(
        id,
        Some(&name),
        Some(&description),
        None,
        cover_photo_path.as_deref(),
    ) {
        Ok(()) => {
            log::info!(target: "albums", "update_album_success; correlation_id={}; updated=true", correlation_id);
            Ok(true)
        }
        Err(e) => {
            log::error!(target: "albums", "update_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Deletes an album
///
/// # Arguments
/// * `id` - The ID of the album to delete
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(bool)` - True if the album was deleted
/// * `Err(String)` - Error message if deletion fails
#[tauri::command]
pub async fn delete_album(id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "delete_album_request; correlation_id={}; id={}; using_unified_collections=true", correlation_id, id);

    match meta_db.delete_collection(id) {
        Ok(deleted) => {
            log::info!(target: "albums", "delete_album_success; correlation_id={}; deleted={}", correlation_id, deleted);
            Ok(deleted)
        }
        Err(e) => {
            log::error!(target: "albums", "delete_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Adds a photo to an album
///
/// # Arguments
/// * `album_id` - The ID of the album
/// * `photo_path` - The path to the photo to add
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn add_photo_to_album(
    album_id: i32,
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "add_photo_to_album_request; correlation_id={}; album_id={}; photo_path={}; using_unified_collections=true", correlation_id, album_id, photo_path);

    match meta_db.add_photo_to_collection(album_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "albums", "add_photo_to_album_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "albums", "add_photo_to_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Removes a photo from an album
///
/// # Arguments
/// * `album_id` - The ID of the album
/// * `photo_path` - The path to the photo to remove
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(bool)` - True if the photo was removed
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn remove_photo_from_album(
    album_id: i32,
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "remove_photo_from_album_request; correlation_id={}; album_id={}; photo_path={}; using_unified_collections=true", correlation_id, album_id, photo_path);

    match meta_db.remove_photo_from_collection(album_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "albums", "remove_photo_from_album_success; correlation_id={}; removed=true", correlation_id);
            Ok(true)
        }
        Err(e) => {
            log::error!(target: "albums", "remove_photo_from_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Gets the list of photo paths in an album
///
/// # Arguments
/// * `album_id` - The ID of the album
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(Vec<String>)` - Vector of photo paths
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn get_album_photos(
    album_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "get_album_photos_request; correlation_id={}; album_id={}", correlation_id, album_id);

    match meta_db.get_album_photos(album_id) {
        Ok(photos) => {
            log::info!(target: "albums", "get_album_photos_success; correlation_id={}; count={}", correlation_id, photos.len());
            Ok(photos)
        }
        Err(e) => {
            log::error!(target: "albums", "get_album_photos_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Gets album photos with their full metadata
///
/// # Arguments
/// * `album_id` - The ID of the album
/// * `state` - Application state containing the database, config, and logging service
///
/// # Returns
/// * `Ok(String)` - JSON string containing photo metadata
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn get_album_photos_with_metadata(
    album_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let config = &state.config;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "get_album_photos_with_metadata_request; correlation_id={}; album_id={}", correlation_id, album_id);

    match meta_db.get_album_photos_with_metadata(album_id, config.clone()) {
        Ok(photos) => {
            log::info!(target: "albums", "get_album_photos_with_metadata_success; correlation_id={}; count={}", correlation_id, photos.len());
            let photos_json = serde_json::to_string(&photos).map_err(|e| e.to_string())?;
            Ok(photos_json)
        }
        Err(e) => {
            log::error!(target: "albums", "get_album_photos_with_metadata_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Reorders photos within an album
///
/// # Arguments
/// * `album_id` - The ID of the album
/// * `photo_order` - Vector of photo paths in the desired order
/// * `state` - Application state containing the database and logging service
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub async fn reorder_album_photos(
    album_id: i32,
    photo_order: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "reorder_album_photos_request; correlation_id={}; album_id={}; photo_count={}", correlation_id, album_id, photo_order.len());

    match meta_db.reorder_album_photos(album_id, photo_order) {
        Ok(()) => {
            log::info!(target: "albums", "reorder_album_photos_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "albums", "reorder_album_photos_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}
