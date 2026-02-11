#![allow(clippy::type_complexity)]

use crate::repository::MetaInfoDB;
use crate::AppState;

/// Creates a new tag in the metadata database
///
/// # Arguments
/// * `name` - Name of the tag
/// * `color` - Optional color for the tag (hex format)
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// The ID of the newly created tag
#[tauri::command]
pub async fn create_tag(
    name: String,
    color: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "create_tag_request; correlation_id={}; name={}; using_unified_collections=true", correlation_id, name);

    match meta_db.create_collection("tag", &name, None, color.as_deref()) {
        Ok(collection_id) => {
            log::info!(target: "tags", "create_tag_success; correlation_id={}; collection_id={}", correlation_id, collection_id);
            Ok(collection_id)
        }
        Err(e) => {
            log::error!(target: "tags", "create_tag_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Deletes a tag from the metadata database
///
/// # Arguments
/// * `tag_id` - ID of the tag to delete
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// True if the tag was successfully deleted, false otherwise
#[tauri::command]
pub async fn delete_tag(tag_id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "delete_tag_request; correlation_id={}; tag_id={}; using_unified_collections=true", correlation_id, tag_id);

    match meta_db.delete_collection(tag_id) {
        Ok(deleted) => {
            log::info!(target: "tags", "delete_tag_success; correlation_id={}; deleted={}", correlation_id, deleted);
            Ok(deleted)
        }
        Err(e) => {
            log::error!(target: "tags", "delete_tag_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Adds a tag to a photo
///
/// # Arguments
/// * `photo_path` - Path to the photo
/// * `tag_id` - ID of the tag to add
/// * `state` - Application state containing the metadata database
#[tauri::command]
pub async fn add_tag_to_photo(
    photo_path: String,
    tag_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "add_tag_to_photo_request; correlation_id={}; photo_path={}; tag_id={}; using_unified_collections=true", correlation_id, photo_path, tag_id);

    match meta_db.add_photo_to_collection(tag_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "tags", "add_tag_to_photo_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "tags", "add_tag_to_photo_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Removes a tag from a photo
///
/// # Arguments
/// * `photo_path` - Path to the photo
/// * `tag_id` - ID of the tag to remove
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// True if the tag was successfully removed, false otherwise
#[tauri::command]
pub async fn remove_tag_from_photo(
    photo_path: String,
    tag_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "remove_tag_from_photo_request; correlation_id={}; photo_path={}; tag_id={}; using_unified_collections=true", correlation_id, photo_path, tag_id);

    match meta_db.remove_photo_from_collection(tag_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "tags", "remove_tag_from_photo_success; correlation_id={}; removed=true", correlation_id);
            Ok(true) // Assume success if no error
        }
        Err(e) => {
            log::error!(target: "tags", "remove_tag_from_photo_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Removes all tags from a photo
///
/// # Arguments
/// * `photo_path` - Path to the photo
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// Number of tags removed from the photo
#[tauri::command]
pub async fn remove_all_tags_from_photo(
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "remove_all_tags_from_photo_request; correlation_id={}; photo_path={}", correlation_id, photo_path);

    match meta_db.remove_all_collections_from_photo(&photo_path, Some("tag")) {
        Ok(removed_count) => {
            log::info!(target: "tags", "remove_all_tags_from_photo_success; correlation_id={}; removed_count={}", correlation_id, removed_count);
            Ok(removed_count)
        }
        Err(e) => {
            log::error!(target: "tags", "remove_all_tags_from_photo_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Retrieves all tags associated with a photo
///
/// # Arguments
/// * `photo_path` - Path to the photo
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// Vector of tuples containing (tag_id, tag_name, tag_color)
#[tauri::command]
pub async fn get_tags_for_photo(
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(i32, String, Option<String>)>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "get_tags_for_photo_request; correlation_id={}; photo_path={}", correlation_id, photo_path);

    match meta_db.get_collections_for_photo(&photo_path, Some("tag")) {
        Ok(tags) => {
            log::info!(target: "tags", "get_tags_for_photo_success; correlation_id={}; count={}", correlation_id, tags.len());
            Ok(tags)
        }
        Err(e) => {
            log::error!(target: "tags", "get_tags_for_photo_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Retrieves all tags associated with a photo, including metadata (for AI tags with confidence)
///
/// # Arguments
/// * `photo_path` - Path to the photo
/// * `state` - Application state containing the metadata database
///
/// # Returns
/// Vector of tuples containing (tag_id, tag_name, tag_color, metadata_json)
#[allow(clippy::type_complexity)]
#[tauri::command]
pub async fn get_tags_for_photo_with_metadata(
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(i32, String, Option<String>, Option<String>)>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "get_tags_for_photo_with_metadata_request; correlation_id={}; photo_path={}", correlation_id, photo_path);

    match meta_db.get_tags_for_photo_with_metadata(&photo_path) {
        Ok(tags) => {
            log::info!(target: "tags", "get_tags_for_photo_with_metadata_success; correlation_id={}; count={}", correlation_id, tags.len());
            Ok(tags)
        }
        Err(e) => {
            log::error!(target: "tags", "get_tags_for_photo_with_metadata_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}
