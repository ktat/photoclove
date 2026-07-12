//! Photo-related Tauri commands.
//!
//! This module contains commands for retrieving photo information,
//! navigating between photos, and managing photo metadata (stars, comments).
//!
//! The actual search logic has been extracted to the `photo_handlers` module
//! for better maintainability.

use crate::app_state::{AppState, PhotoRequest};
use crate::domain_service::{achievements, photo_service};
use crate::entity::photo;
use crate::entity::photo_meta;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::comment;
use crate::value::date;
use crate::value::exif;
use crate::value::file;
use crate::value::star;

// Import handlers module from parent
use super::photo_handlers;
use photo_handlers::{HandlerContext, SearchParams};

/// Response structure for get_photo_info command.
///
/// Contains the original path, current path (which may be in trash),
/// trash status, and metadata/EXIF information.
#[derive(serde::Serialize)]
pub struct PhotoInfoResponse {
    /// Original photo path from database
    pub original_path: String,

    /// Current physical path (may be in trash)
    pub current_path: String,

    /// Whether the photo is in trash
    pub is_trashed: bool,

    /// File size in bytes
    pub file_size: Option<u64>,

    /// Photo metadata from database
    pub meta: Option<serde_json::Value>,

    /// EXIF data from photo file
    pub exif: Option<serde_json::Value>,
}

/// Get list of available dates that have photos.
///
/// First attempts to retrieve dates from SQLite metadata database for performance.
/// Falls back to filesystem directory scanning if metadata is unavailable.
#[tauri::command]
pub fn get_dates(window: tauri::Window, state: tauri::State<AppState>) -> String {
    log::debug!(target: "photo", "get_dates; from={}", window.label());

    // First try to get dates from SQLite metadata database
    let sqlite_db = state.meta_db.clone();

    if sqlite_db.has_metadata() {
        log::debug!(target: "photo", "get_dates; using_sqlite=true");
        match sqlite_db.get_available_dates() {
            Ok(dates) => {
                let mut date_list = date::Dates::empty();
                date_list.dates = dates;
                return date_list.to_json();
            }
            Err(e) => {
                log::error!(target: "photo", "get_dates_error; error={}", e);
                // Fall through to filesystem scanning
            }
        }
    } else {
        log::debug!(target: "photo", "get_dates; using_filesystem=true");
    }

    // Fallback to filesystem directory scanning
    let db = &state.repo_db;
    let dates = db.get_dates();
    dates.to_json()
}

/// Get photo counts for specific dates.
#[tauri::command]
pub async fn get_dates_num(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    dates_str: &str,
) -> Result<String, ()> {
    log::debug!(target: "sqlite", "get_dates_num; input_dates_str={}", dates_str);
    let mut dates = date::Dates::empty();
    let splitted = dates_str.split(',');
    for date_tupple in splitted.enumerate() {
        let date_str = date_tupple.1;
        if !date_str.trim().is_empty() {
            dates
                .dates
                .push(date::Date::from_string(&date_str.to_string(), Some("-")));
        }
    }
    log::debug!(target: "sqlite", "get_dates_num; parsed_dates_count={}", dates.dates.len());

    let meta_db = &state.meta_db;
    let db = &state.repo_db;

    let meta_data = meta_db.get_photo_count_per_dates(dates.clone());

    // Check if we have all the data from the database
    let missing_dates: Vec<_> = dates
        .dates
        .iter()
        .filter(|date| !meta_data.contains_key(&date.to_string()))
        .collect();

    let dates_num = if missing_dates.is_empty() {
        log::info!(target: "sqlite", "get_dates_num; using_database_only=true");
        meta_data
    } else {
        log::info!(target: "sqlite", "get_dates_num; using_filesystem_fallback=true; missing_dates={}", missing_dates.len());
        db.get_photo_count_per_dates(dates, meta_data)
    };

    Ok(dates_num.to_json())
}

/// Unified endpoint for retrieving photos with various search and filter options.
///
/// This is the main command for fetching photos. It supports multiple search types:
/// - `recent`: Most recently taken photos
/// - `date`: Photos from a specific date
/// - `album_photos`: Photos in a specific album
/// - `tag`: Photos with specific tags
/// - `search`: Text/metadata search
/// - `trash`: Photos in trash
/// - `all_albums`: List of all albums
/// - `all_tags`: List of all tags
#[tauri::command]
pub async fn get_photos_unified(
    request: PhotoRequest,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    log::info!(target: "get_photos", "unified_request; type={:?}", request);

    let ctx = HandlerContext::from_state(&state);

    match request {
        PhotoRequest::Search {
            search_type,
            query,
            star,
            has_comment,
            extension,
            page,
            limit,
            offset,
            sort_value,
            params,
        } => {
            let search_params = SearchParams::new(
                query,
                star,
                has_comment,
                extension,
                page,
                limit,
                offset,
                sort_value,
                params,
            );

            log::info!(target: "get_photos", "search_request; search_type={}; query={:?}", search_type, search_params.query);

            // Check first_search achievement for actual search queries
            if (search_type == "search" || search_type == "all") && search_params.query.is_some() {
                let _ = achievements::check_and_emit_achievement(
                    &app_handle,
                    &state.meta_db,
                    "first_search",
                );
            }

            match search_type.as_str() {
                "recent" => photo_handlers::recent::handle(&ctx, &search_params).await,
                "date" => photo_handlers::date::handle(&ctx, &search_params).await,
                "album_photos" => photo_handlers::album::handle(&ctx, &search_params).await,
                "tag" => photo_handlers::tag::handle(&ctx, &search_params).await,
                "person" => photo_handlers::person::handle(&ctx, &search_params).await,
                "unknown_faces" => {
                    photo_handlers::unknown_faces::handle(&ctx, &search_params).await
                }
                "all" => photo_handlers::search::handle_all(&ctx, &search_params).await,
                "search" => photo_handlers::search::handle(&ctx, &search_params).await,
                "trash" => photo_handlers::trash::handle(&ctx).await,
                "all_albums" => photo_handlers::collections::handle_albums(&ctx).await,
                "all_tags" => photo_handlers::collections::handle_tags(&ctx).await,
                // Burst grouping handlers
                "burst_date" => {
                    photo_handlers::burst::handle_burst_date(&ctx, &search_params).await
                }
                "burst_album" => {
                    photo_handlers::burst::handle_burst_album(&ctx, &search_params).await
                }
                "burst_tag" => photo_handlers::burst::handle_burst_tag(&ctx, &search_params).await,
                "burst_group" => {
                    photo_handlers::burst::handle_burst_group(&ctx, &search_params).await
                }
                // Memories ("On This Day") handlers
                "memories" => photo_handlers::memories::handle(&ctx, &search_params).await,
                "memories_startup" => {
                    photo_handlers::memories::handle_startup(&ctx, &search_params).await
                }
                _ => {
                    log::error!(target: "get_photos", "unsupported_search_type; search_type={}", search_type);
                    Err(())
                }
            }
        }
    }
}

/// Get detailed information about a specific photo.
///
/// Retrieves both metadata from database and EXIF data from the photo file.
/// Handles photos in trash by checking trash path.
#[tauri::command]
pub async fn get_photo_info(
    path_str: String,
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    // File I/O + EXIF parse + DB sync: run off the main thread
    let meta_db = state.meta_db.clone();
    let trash_path = state.config.trash_path.clone();
    let import_to = state.config.import_to.clone();
    tauri::async_runtime::spawn_blocking(move || {
        photo_info_blocking(&path_str, &meta_db, &trash_path, &import_to)
    })
    .await
    .map_err(|e| {
        log::error!(target: "photo_info", "photo_info_task_failed; error={}", e);
    })
}

fn photo_info_blocking(
    path_str: &str,
    meta_db: &crate::repository::MetaDB,
    trash_path: &str,
    import_to: &str,
) -> String {
    log::debug!(target: "photo_info", "get_photo_info; path={}", path_str);

    // path_str is relative (e.g., "2024-01-15/uuid/photo.jpg")
    // Check if photo is in trash
    let trash_path_opt = meta_db.get_trash_path_for_photo(path_str, trash_path, import_to);
    let is_trashed = trash_path_opt.is_some();

    // Determine the actual file path to read (absolute)
    let actual_path = if let Some(ref trash_path) = trash_path_opt {
        trash_path.clone()
    } else {
        file::to_absolute_path(path_str, import_to)
    };

    log::debug!(target: "photo_info", "get_photo_info; is_trashed={}; actual_path={}", is_trashed, actual_path);

    // Try to read the file from the actual path
    match file::File::new_if_exists(actual_path.clone()) {
        Some(f) => {
            // File exists, read EXIF from file
            let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
            let exif_data = exif::ExifData::new(f);

            // Sync EXIF data to database if there are differences
            if let Err(e) = meta_db.update_exif_if_changed(path_str, &exif_data) {
                log::warn!(target: "photo_info", "exif_sync_failed; path={}; error={}", path_str, e);
            }

            let photo_meta = photo_meta::PhotoMeta::new_with_data(p, meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);

            // Serialize to get JSON values
            let full_json = serde_json::to_value(&photo_meta_with_exif).unwrap();
            let meta_value = full_json.get("meta").cloned();
            let exif_value = full_json.get("exif").cloned();

            let file_size = std::fs::metadata(&actual_path).ok().map(|m| m.len());

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size,
                meta: meta_value,
                exif: exif_value,
            };

            serde_json::to_string(&response).unwrap()
        }
        None => {
            // File doesn't exist, try to get metadata from database
            log::warn!(target: "photo_info", "get_photo_info; file_not_found={}; attempting_db_lookup", actual_path);

            let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
            let photo_meta = photo_meta::PhotoMeta::new_with_data(p, meta_db);
            let meta_json = serde_json::to_value(&photo_meta).ok();

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size: None,
                meta: meta_json,
                exif: None,
            };

            serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string())
        }
    }
}

/// Get the next photo in a date's photo list.
#[tauri::command]
pub async fn get_next_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    photo_handlers::navigation::handle_next(
        &state.repo_db,
        &state.meta_db,
        path,
        date_str,
        sort_value,
    )
    .await
}

/// Get the previous photo in a date's photo list.
#[tauri::command]
pub async fn get_prev_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    photo_handlers::navigation::handle_prev(
        &state.repo_db,
        &state.meta_db,
        path,
        date_str,
        sort_value,
    )
    .await
}

/// Save or update a photo's star rating.
#[tauri::command]
pub fn save_star(
    _window: tauri::Window,
    app_handle: tauri::AppHandle,
    state: tauri::State<AppState>,
    path_str: &str,
    star_num: i32,
) {
    let db = &state.meta_db;
    let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
    let s = star::Star::new(star_num);
    photo_service::save_photo_star(db, &p, s);

    // Check first_star achievement when user adds a star rating
    if star_num > 0 {
        let _ = achievements::check_and_emit_achievement(&app_handle, &state.meta_db, "first_star");
    }
}

/// Save or update a photo's comment.
#[tauri::command]
pub fn save_comment(
    _window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    comment_str: &str,
) {
    let db = &state.meta_db;
    let c = comment::Comment::new(comment_str);
    let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
    photo_service::save_photo_comment(db, &p, c);
}
