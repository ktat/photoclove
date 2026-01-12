//! Photo-related Tauri commands.
//!
//! This module contains commands for retrieving photo information,
//! navigating between photos, and managing photo metadata (stars, comments).

use crate::app_state::{AppState, PhotoRequest};
use crate::domain_service::photo_service;
use crate::entity::photo;
use crate::entity::photo_meta;
use crate::repository;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::comment;
use crate::value::date;
use crate::value::exif;
use crate::value::file;
use crate::value::star;
use rusqlite::params;

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

    /// Photo metadata from database
    pub meta: Option<serde_json::Value>,

    /// EXIF data from photo file
    pub exif: Option<serde_json::Value>,
}

/// Get list of available dates that have photos.
///
/// First attempts to retrieve dates from SQLite metadata database for performance.
/// Falls back to filesystem directory scanning if metadata is unavailable.
///
/// # Arguments
/// * `window` - Tauri window instance
/// * `state` - Application state containing repository and configuration
///
/// # Returns
/// JSON string containing array of dates with photo counts
#[tauri::command]
pub fn get_dates(window: tauri::Window, state: tauri::State<AppState>) -> String {
    println!("get_dates is called from {}", window.label());

    // First try to get dates from SQLite metadata database
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    if sqlite_db.has_metadata() {
        println!("Using SQLite database for dates");
        match sqlite_db.get_available_dates() {
            Ok(dates) => {
                // println!("get_dates() - SQLite returned {} dates", dates.len());
                let mut date_list = date::Dates::empty();
                date_list.dates = dates;
                let json_result = date_list.to_json();
                // println!("get_dates() - JSON result: {}", json_result);
                // println!("get_dates() - FINAL JSON SENT TO REACT: {}", json_result);
                return json_result;
            }
            Err(e) => {
                log::error!(target: "photo", "get_dates_error; error={}", e);
                // Fall through to filesystem scanning
            }
        }
    } else {
        println!("SQLite database has no metadata, falling back to filesystem scanning");
    }

    // Fallback to filesystem directory scanning
    println!("Using filesystem directory scanning for dates");
    let db = &state.repo_db;
    let dates = db.get_dates();
    let filesystem_json = dates.to_json();
    // println!(
    //     "get_dates() - FINAL JSON SENT TO REACT: {}",
    //     filesystem_json
    // );
    filesystem_json
}

/// Get photo counts for specific dates.
///
/// Takes a comma-separated list of date strings and returns the count
/// of photos for each date. Uses metadata database when available,
/// falls back to filesystem scanning for missing dates.
///
/// # Arguments
/// * `_window` - Tauri window instance (unused)
/// * `state` - Application state
/// * `dates_str` - Comma-separated date strings (e.g., "2025-01-15,2025-01-16")
///
/// # Returns
/// `Result<String, ()>` - JSON string mapping dates to photo counts, or error
#[tauri::command]
pub async fn get_dates_num(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    dates_str: &str,
) -> Result<String, ()> {
    log::debug!(target: "sqlite", "get_dates_num; input_dates_str={}", dates_str);
    let mut dates = date::Dates::empty();
    let splitted = dates_str.split(",");
    for date_tupple in splitted.enumerate() {
        let date_str = date_tupple.1;
        // Skip empty date strings
        if !date_str.trim().is_empty() {
            dates.dates.push(date::Date::from_string(
                &date_str.to_string(),
                Option::Some("-"),
            ));
        }
    }
    log::debug!(target: "sqlite", "get_dates_num; parsed_dates_count={}", dates.dates.len());

    let meta_db = &state.meta_db;
    let db = &state.repo_db;

    log::debug!(target: "sqlite", "get_dates_num; fetching_from_database; dates_count={}", dates.dates.len());
    let meta_data = meta_db.get_photo_count_per_dates(dates.clone());
    log::debug!(target: "sqlite", "get_dates_num; database_result_count={}", meta_data.len());

    // Check if we have all the data from the database
    let missing_dates: Vec<_> = dates
        .dates
        .iter()
        .filter(|date| !meta_data.contains_key(&date.to_string()))
        .collect();

    let dates_num = if missing_dates.is_empty() {
        // All data is available from the database, no need for filesystem fallback
        log::info!(target: "sqlite", "get_dates_num; using_database_only=true; optimized=true");
        meta_data
    } else {
        // Some dates are missing from database, use filesystem fallback for those
        log::info!(target: "sqlite", "get_dates_num; using_filesystem_fallback=true; missing_dates={}", missing_dates.len());
        db.get_photo_count_per_dates(dates, meta_data)
    };

    let final_json = dates_num.to_json();
    log::debug!(target: "sqlite", "get_dates_num; completed; result_entries={}", dates_num.len());

    Ok(final_json)
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
///
/// # Arguments
/// * `request` - PhotoRequest enum containing search type and parameters
/// * `state` - Application state
///
/// # Returns
/// `Result<String, ()>` - JSON string containing photos array, or error
#[tauri::command]
pub async fn get_photos_unified(
    request: PhotoRequest,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    log::info!(target: "get_photos", "unified_request; type={:?}", request);

    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;

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
            // デフォルト値を設定
            let star = star.unwrap_or(-1);
            let has_comment = has_comment.unwrap_or(false);
            let extension = extension.as_deref().unwrap_or("all");
            let page = page.unwrap_or(1);
            let sort_value = sort_value.unwrap_or(0);

            log::info!(target: "get_photos", "search_request; search_type={}; query={:?}", search_type, query);

            match search_type.as_str() {
                "recent" => {
                    let limit = limit.unwrap_or(60);

                    // Get recent photos metadata directly from database using SQL
                    let meta_data = match meta_db.get_recent_photos_metadata(limit) {
                        Ok(data) => data,
                        Err(e) => {
                            log::error!(target: "get_photos", "recent_metadata_error; error={}", e);
                            return Err(());
                        }
                    };

                    let photos = repo_db
                        .get_recent_photos(
                            &meta_data,
                            page,
                            repository::sort_from_int(sort_value),
                            limit,
                            offset.unwrap_or(0) as usize,
                            star,
                            has_comment,
                            extension,
                            Option::Some(state.config.clone()),
                        )
                        .await;

                    let json_result = photos.to_json();
                    Ok(json_result)
                }
                "date" => {
                    let date_str = query.ok_or_else(|| {
                        log::error!(target: "get_photos", "missing_date_query");
                    })?;

                    let limit = limit.unwrap_or(1000);
                    let offset = offset.unwrap_or(0);

                    // Convert date string to Date object - detect delimiter
                    let delimiter = if date_str.contains("/") {
                        Some("/")
                    } else {
                        Some("-")
                    };
                    let date = match crate::value::date::Date::try_from_string(
                        &date_str.to_string(),
                        delimiter,
                    ) {
                        Ok(d) => d,
                        Err(e) => {
                            log::error!(target: "get_photos", "date_parse_error; date_str={}; error={}", date_str, e);
                            return Err(());
                        }
                    };

                    // Get metadata first
                    let metadata = match meta_db.get_photo_meta_data_in_date(date) {
                        Ok(data) => data,
                        Err(_e) => photo_meta::PhotoMetas::new(),
                    };

                    let photos = repo_db
                        .get_photos_in_date(
                            &metadata,
                            date,
                            repository::sort_from_int(sort_value),
                            limit,
                            page,
                            offset as usize,
                            star,
                            has_comment,
                            extension,
                            Option::Some(state.config.clone()),
                        )
                        .await;

                    Ok(photos.to_json())
                }
                "album_photos" => {
                    let album_id = if let Some(params) = params {
                        params
                            .get("album_id")
                            .and_then(|v| v.as_i64())
                            .map(|v| v as i32)
                            .ok_or_else(|| {
                                log::error!(target: "get_photos", "missing_album_id_in_params");
                            })?
                    } else {
                        log::error!(target: "get_photos", "missing_params_for_album_photos");
                        return Err(());
                    };

                    log::info!(target: "get_photos", "album_photos_request_using_unified_collections; album_id={}", album_id);

                    // Use get_collection_photos which includes tag information and config
                    let mut photos = meta_db.get_collection_photos(album_id, true, Some(state.config.clone())).map_err(|e| {
                        log::error!(target: "get_photos", "album_photos_failed; error={}", e);
                    })?;

                    // Set has_thumbnail flag for each photo
                    for photo in photos.iter_mut() {
                        photo.set_has_thumbnail();
                        // Debug: log photos with tags
                        if photo.tags.is_some() {
                            log::debug!(target: "get_photos", "album_photo_with_tags; path={}; tags={:?}", photo.file.path, photo.tags);
                        }
                    }

                    // Convert to Photos format to match other responses
                    let photos_response = photo::Photos {
                        photos,
                        has_next: false,
                        has_prev: false,
                    };

                    log::info!(target: "get_photos", "album_photos_success; album_id={}; count={}", album_id, photos_response.photos.len());
                    Ok(photos_response.to_json())
                }
                "tag" => {
                    // Parse tag IDs from query parameter (comma-separated)
                    let tag_ids_str = query.ok_or_else(|| {
                        log::error!(target: "get_photos", "missing_tag_ids_query");
                    })?;

                    let tag_ids: Result<Vec<i32>, _> = tag_ids_str
                        .split(',')
                        .filter(|s| !s.trim().is_empty())
                        .map(|s| s.trim().parse::<i32>())
                        .collect();

                    let tag_ids = tag_ids.map_err(|e| {
                        log::error!(target: "get_photos", "invalid_tag_ids; error={}", e);
                    })?;

                    if tag_ids.is_empty() {
                        log::warn!(target: "get_photos", "empty_tag_ids");
                        return Ok(crate::entity::photo::Photos::new().to_json());
                    }

                    log::info!(target: "get_photos", "tag_request; tag_ids={:?}", tag_ids);

                    // Get photos with tags from database with Photo entities
                    let conn = meta_db.get_connection().map_err(|e| {
                        log::error!(target: "get_photos", "tag_db_connection_failed; error={}", e);
                    })?;

                    // Build dynamic query for unified collections (tags)
                    log::info!(target: "get_photos", "tag_request_using_unified_collections; tag_ids={:?}", tag_ids);
                    let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    let query_sql = format!(
                        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_orientation,
                                GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags
                         FROM photo_metadata pm
                         LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
                         LEFT JOIN photo_collections pc ON pci.collection_id = pc.id AND pc.type = 'tag'
                         WHERE pm.path IN (
                             SELECT DISTINCT pci2.photo_path FROM photo_collection_items pci2
                             INNER JOIN photo_collections pc2 ON pci2.collection_id = pc2.id
                             WHERE pc2.id IN ({}) AND pc2.type = 'tag'
                             GROUP BY pci2.photo_path
                             HAVING COUNT(DISTINCT pci2.collection_id) = ?
                         ) AND pm.delete_flg = 0
                         GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_orientation
                         ORDER BY pm.photo_date DESC",
                        placeholders
                    );

                    let mut stmt = conn.prepare(&query_sql).map_err(|e| {
                        log::error!(target: "get_photos", "tag_prepare_failed; error={}", e);
                    })?;

                    let mut params: Vec<&dyn rusqlite::ToSql> = tag_ids
                        .iter()
                        .map(|id| id as &dyn rusqlite::ToSql)
                        .collect();
                    let tag_count = tag_ids.len() as i32;
                    params.push(&tag_count);

                    let photo_iter = stmt
                        .query_map(params.as_slice(), |row| {
                            let photo_path = row.get::<_, String>("path").unwrap_or_default();

                            // Create Photo entity from file path
                            let file_result =
                                crate::value::file::File::new_if_exists(photo_path.clone());
                            if file_result.is_none() {
                                return Err(rusqlite::Error::InvalidPath(photo_path.into()));
                            }
                            let file = file_result.unwrap();

                            // Get config for thumbnail checking
                            let config = state.config.clone();
                            let mut photo = crate::entity::photo::Photo::new(file, Some(config));

                            // Set thumbnail status
                            photo.set_has_thumbnail();

                            // Set metadata from database
                            let star = row.get::<_, i32>("star").unwrap_or(0);
                            photo.set_star(star);

                            let comment = row
                                .get::<_, Option<String>>("comment")
                                .unwrap_or_default()
                                .unwrap_or_default();
                            photo.set_comment(comment);

                            // Set CSS style
                            if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
                                photo.set_css_style(css_style);
                            }

                            // Set orientation from database
                            if let Ok(Some(orientation)) = row.get::<_, Option<String>>("exif_orientation") {
                                if !orientation.is_empty() {
                                    photo.meta_data.orientation = orientation;
                                }
                            }

                            // Process tags from concatenated string
                            let tags_string =
                                row.get::<_, Option<String>>("tags").unwrap_or_default();
                            photo.set_tags_from_string(tags_string);

                            Ok(photo)
                        })
                        .map_err(|e| {
                            log::error!(target: "get_photos", "tag_query_failed; error={}", e);
                        })?;

                    let mut photos = crate::entity::photo::Photos::new();
                    for photo_result in photo_iter {
                        match photo_result {
                            Ok(photo) => photos.photos.push(photo),
                            Err(e) => {
                                log::error!(target: "get_photos", "tag_photo_error; error={}", e);
                            }
                        }
                    }

                    log::info!(target: "get_photos", "tag_complete; count={}", photos.photos.len());
                    Ok(photos.to_json())
                }
                "all" => {
                    // General search across all fields
                    let search_query = query.unwrap_or_default();

                    // Get filters and sort parameters from params
                    let (filters_str, sort_field, sort_order) = if let Some(ref params) = params {
                        let filters_str = params
                            .get("filters")
                            .and_then(|v| v.as_str())
                            .unwrap_or("{}")
                            .to_string();
                        let sort_field = params
                            .get("sort_field")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let sort_order = params
                            .get("sort_order")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        (filters_str, sort_field, sort_order)
                    } else {
                        // Fallback to sort_value if no params
                        let sort_config = repository::sort_from_int(sort_value);
                        let (field, order) = match sort_config {
                            repository::Sort::PhotoTimeDesc => ("photo_date", "DESC"),
                            repository::Sort::PhotoTimeAsc => ("photo_date", "ASC"),
                            repository::Sort::AddedTimeDesc => ("created_at", "DESC"),
                            repository::Sort::AddedTimeAsc => ("created_at", "ASC"),
                            repository::Sort::StarDesc => ("star", "DESC"),
                            repository::Sort::StarAsc => ("star", "ASC"),
                            repository::Sort::NameDesc => ("path", "DESC"),
                            repository::Sort::NameAsc => ("path", "ASC"),
                            repository::Sort::PhotoTime => ("photo_date", "DESC"),
                            repository::Sort::Time => ("created_at", "DESC"),
                            repository::Sort::Name => ("path", "ASC"),
                        };
                        ("{}".to_string(), Some(field.to_string()), Some(order.to_string()))
                    };

                    // Use existing search_photos implementation
                    let max_photos_per_fetch = limit.unwrap_or(9999);
                    match meta_db.search_photos(
                        &search_query,
                        "all",
                        &filters_str,
                        &sort_field.unwrap_or("photo_date".to_string()),
                        &sort_order.unwrap_or("DESC".to_string()),
                        max_photos_per_fetch,
                    ) {
                        Ok(result) => Ok(result),
                        Err(e) => {
                            log::error!(target: "get_photos", "all_search_failed; error={}", e);
                            Err(())
                        }
                    }
                }
                "search" => {
                    let search_query = query.unwrap_or_default();

                    // Get search parameters from params or use defaults
                    let (search_type_param, filters_str, sort_field, sort_order) =
                        if let Some(ref params) = params {
                            let search_type_param = params
                                .get("search_type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("text")
                                .to_string();
                            let filters_str = params
                                .get("filters")
                                .and_then(|v| v.as_str())
                                .unwrap_or("{}")
                                .to_string();
                            let sort_field = params
                                .get("sort_field")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            let sort_order = params
                                .get("sort_order")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            (search_type_param, filters_str, sort_field, sort_order)
                        } else {
                            ("text".to_string(), "{}".to_string(), None, None)
                        };

                    log::info!(target: "get_photos", "search_request; query={}; search_type={}", search_query, search_type_param);

                    // Use existing search_photos implementation
                    let max_photos_per_fetch = limit.unwrap_or(1000);
                    match meta_db.search_photos(
                        &search_query,
                        &search_type_param,
                        &filters_str,
                        &sort_field.unwrap_or("photo_date".to_string()),
                        &sort_order.unwrap_or("DESC".to_string()),
                        max_photos_per_fetch,
                    ) {
                        Ok(result) => {
                            log::info!(target: "get_photos", "search_complete; result_length={}", result.len());
                            Ok(result)
                        }
                        Err(e) => {
                            log::error!(target: "get_photos", "search_failed; error={}", e);
                            Err(())
                        }
                    }
                }
                "trash" => {
                    let config = state.config.clone();
                    log::info!(target: "get_photos", "trash_request; config_trash_path={}", config.trash_path);

                    // Get trash photos from database
                    let conn = meta_db.get_connection().map_err(|e| {
                        log::error!(target: "get_photos", "trash_db_connection_failed; error={}", e);
                    })?;

                    let mut stmt = conn.prepare("SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url,
                                GROUP_CONCAT(c.id || ':' || c.name || ':' || COALESCE(c.color, '')) as tags
                         FROM photo_metadata pm
                         LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
                         LEFT JOIN photo_collections c ON pci.collection_id = c.id AND c.type = 'tag'
                         WHERE pm.delete_flg = 1
                         GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url
                         ORDER BY pm.updated_at DESC").map_err(|e| {
                        log::error!(target: "get_photos", "trash_prepare_failed; error={}", e);
                    })?;

                    log::debug!(target: "get_photos", "trash_query_prepared; executing_query");

                    let photo_iter = stmt
                        .query_map([], |row| {
                            let photo_path = row.get::<_, String>("path").unwrap_or_default();

                            // For trash photos, check if file exists in trash path
                            let trash_file_path = if !config.trash_path.is_empty() {
                                // Construct trash path: trash_path + original_path
                                let trash_path = config.trash_path.trim_end_matches('/');
                                format!("{}{}", trash_path, photo_path)
                            } else {
                                photo_path.clone()
                            };

                            // Check if file exists in trash
                            let trash_file_result =
                                crate::value::file::File::new_if_exists(trash_file_path.clone());
                            if trash_file_result.is_none() {
                                return Err(rusqlite::Error::InvalidPath(trash_file_path.into()));
                            }

                            // Create Photo entity from original path (DB path), not trash path
                            let mut photo = if let Some(file) =
                                crate::value::file::File::new_if_exists(photo_path.clone())
                            {
                                // Original file exists, use it
                                crate::entity::photo::Photo::new(file, Some(config.clone()))
                            } else {
                                // Original file doesn't exist, create File object manually with original path
                                let file = crate::value::file::File::new(photo_path.clone());
                                crate::entity::photo::Photo::new(file, Some(config.clone()))
                            };

                            // Set thumbnail status
                            photo.set_has_thumbnail();

                            // Set metadata from database
                            let star = row.get::<_, i32>("star").unwrap_or(0);
                            photo.set_star(star);

                            let comment = row
                                .get::<_, Option<String>>("comment")
                                .unwrap_or_default()
                                .unwrap_or_default();
                            photo.set_comment(comment);

                            // Set CSS style
                            if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
                                photo.set_css_style(css_style);
                            }

                            // Process tags from concatenated string
                            let tags_string =
                                row.get::<_, Option<String>>("tags").unwrap_or_default();
                            photo.set_tags_from_string(tags_string);

                            Ok(photo)
                        })
                        .map_err(|e| {
                            log::error!(target: "get_photos", "trash_query_failed; error={}", e);
                        })?;

                    let mut photos = crate::entity::photo::Photos::new();
                    for photo_result in photo_iter {
                        match photo_result {
                            Ok(photo) => photos.photos.push(photo),
                            Err(e) => {
                                log::error!(target: "get_photos", "trash_photo_error; error={}", e);
                            }
                        }
                    }

                    log::info!(target: "get_photos", "trash_complete; count={}; first_photo_debug={:?}",
                               photos.photos.len(),
                               photos.photos.get(0).map(|p| format!("path={}, has_thumbnail={}", p.file.path, p.has_thumbnail)));
                    let json_result = photos.to_json();
                    log::debug!(target: "get_photos", "trash_json_response; response_length={}", json_result.len());
                    Ok(json_result)
                }
                "all_albums" => {
                    log::info!(target: "get_photos", "all_albums_request; using_unified_collections=true");
                    match meta_db.get_all_collections(Some("album"), state.config.clone()) {
                        Ok(albums) => {
                            Ok(serde_json::to_string(&albums).unwrap_or_else(|_| "[]".to_string()))
                        }
                        Err(e) => {
                            log::error!(target: "get_photos", "all_albums_error; error={}", e);
                            Err(())
                        }
                    }
                }
                "all_tags" => {
                    log::info!(target: "get_photos", "all_tags_request; using_unified_collections=true");
                    match meta_db.get_all_collections(Some("tag"), state.config.clone()) {
                        Ok(tags) => {
                            Ok(serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string()))
                        }
                        Err(e) => {
                            log::error!(target: "get_photos", "all_tags_error; error={}", e);
                            Err(())
                        }
                    }
                }
                "all_tags_with_count" => {
                    log::info!(target: "get_photos", "all_tags_with_count_request; using_unified_collections=true");
                    match meta_db.get_all_collections(Some("tag"), state.config.clone()) {
                        Ok(tags) => {
                            Ok(serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string()))
                        }
                        Err(e) => {
                            log::error!(target: "get_photos", "all_tags_with_count_error; error={}", e);
                            Err(())
                        }
                    }
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
///
/// # Arguments
/// * `path_str` - Photo file path
/// * `window` - Tauri window instance
/// * `state` - Application state
///
/// # Returns
/// JSON string containing PhotoInfoResponse with metadata and EXIF data
#[tauri::command]
pub fn get_photo_info(
    path_str: &str,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    log::debug!(target: "photo_info", "get_photo_info; path={}", path_str);

    // Check if photo is in trash
    let trash_path_opt = state
        .meta_db
        .get_trash_path_for_photo(path_str, &state.config.trash_path);
    let is_trashed = trash_path_opt.is_some();

    // Determine the actual file path to read
    let actual_path = if let Some(ref trash_path) = trash_path_opt {
        trash_path.clone()
    } else {
        path_str.to_string()
    };

    log::debug!(target: "photo_info", "get_photo_info; is_trashed={}; actual_path={}", is_trashed, actual_path);

    // Try to read the file from the actual path
    match file::File::new_if_exists(actual_path.clone()) {
        Some(f) => {
            // File exists, read EXIF from file
            let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
            let exif_data = exif::ExifData::new(f);

            // Sync EXIF data to database if there are differences
            // This ensures DB stays in sync with actual file metadata
            if let Err(e) = state.meta_db.update_exif_if_changed(path_str, &exif_data) {
                log::warn!(target: "photo_info", "exif_sync_failed; path={}; error={}", path_str, e);
            }

            let photo_meta = photo_meta::PhotoMeta::new_with_data(photo, &state.meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);

            // Serialize to get JSON values
            let full_json = serde_json::to_value(&photo_meta_with_exif).unwrap();
            let meta_value = full_json.get("meta").cloned();
            let exif_value = full_json.get("exif").cloned();

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                meta: meta_value,
                exif: exif_value,
            };

            serde_json::to_string(&response).unwrap()
        }
        None => {
            // File doesn't exist, try to get metadata from database (for trashed photos with missing files)
            log::warn!(target: "photo_info", "get_photo_info; file_not_found={}; attempting_db_lookup", actual_path);

            let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
            let photo_meta = photo_meta::PhotoMeta::new_with_data(photo, &state.meta_db);

            // Serialize photo_meta to get the meta JSON
            let meta_json = serde_json::to_value(&photo_meta).ok();

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                meta: meta_json,
                exif: None, // No EXIF if file doesn't exist
            };

            serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string())
        }
    }
}

/// Get the next photo in a date's photo list.
///
/// Returns the path of the next photo after the given path within the same date,
/// respecting the specified sort order.
///
/// # Arguments
/// * `path` - Current photo path
/// * `date_str` - Date string to search within
/// * `sort_value` - Sort order (0=name, 1=date, etc.)
/// * `window` - Tauri window instance
/// * `state` - Application state
///
/// # Returns
/// `Result<String, ()>` - Next photo path, empty string if none, or error
#[tauri::command]
pub async fn get_next_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    // Check if date_str is empty
    if date_str.trim().is_empty() {
        return Err(());
    }
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_next_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
            Option::None,
        )
        .await;
    if photo.is_some() {
        return Ok(photo.unwrap().file.path);
    } else {
        return Ok("".to_string());
    }
}

/// Get the previous photo in a date's photo list.
///
/// Returns the path of the previous photo before the given path within the same date,
/// respecting the specified sort order.
///
/// # Arguments
/// * `path` - Current photo path
/// * `date_str` - Date string to search within
/// * `sort_value` - Sort order (0=name, 1=date, etc.)
/// * `window` - Tauri window instance
/// * `state` - Application state
///
/// # Returns
/// `Result<String, ()>` - Previous photo path, empty string if none, or error
#[tauri::command]
pub async fn get_prev_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    // Check if date_str is empty
    if date_str.trim().is_empty() {
        return Err(());
    }
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_prev_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
            Option::None,
        )
        .await;
    if photo.is_some() {
        let f = photo.unwrap().file.path;
        // println!("path: {}", f);
        return Ok(f);
    } else {
        return Ok("".to_string());
    }
}

/// Save or update a photo's star rating.
///
/// Persists the star rating (0-5) to the metadata database.
///
/// # Arguments
/// * `window` - Tauri window instance
/// * `state` - Application state
/// * `path_str` - Photo file path
/// * `star_num` - Star rating (0-5)
#[tauri::command]
pub fn save_star(
    window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    star_num: i32,
) {
    let db = &state.meta_db;
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let star = star::Star::new(star_num);
    photo_service::save_photo_star(db, &photo, star);
}

/// Save or update a photo's comment.
///
/// Persists the comment text to the metadata database.
///
/// # Arguments
/// * `_window` - Tauri window instance (unused)
/// * `state` - Application state
/// * `path_str` - Photo file path
/// * `comment_str` - Comment text
#[tauri::command]
pub fn save_comment(
    _window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    comment_str: &str,
) {
    let db = &state.meta_db;
    let comment = comment::Comment::new(comment_str);
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    photo_service::save_photo_comment(db, &photo, comment);
}
