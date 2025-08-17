// TODO: This file is too large (2664 lines) and should be refactored into smaller modules:
// - commands/photo_commands.rs: Photo-related Tauri commands (get_photos_unified, get_next_photo, etc.)
// - commands/album_commands.rs: Album-related commands (get_albums, create_album, etc.)
// - commands/search_commands.rs: Search and filter commands (search_photos, get_filter_options, etc.)
// - commands/system_commands.rs: System operations (import_photos, create_db, etc.)
// - commands/google_commands.rs: Google Photos integration commands
// - app_state.rs: AppState struct and related initialization
// Keep only main app setup and command registration in lib.rs

use crate::domain_service::{
    file_service, job_queue_service, logging_service, photo_service, thumbnail_service,
};
use crate::entity::importer;
use crate::entity::*;
use crate::repository::RepositoryDB;
use crate::repository::*;
use crate::value::*;
use entity::config::Config;
use rusqlite::params;
use std::{
    fs, path,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    sync::{Arc, Mutex},
};
use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    Emitter, Manager,
};

#[cfg(unix)]
use std::os::unix::fs::symlink;

#[cfg(windows)]
use std::os::windows::fs::symlink_file;

mod domain_service;
mod entity;
mod error;
mod repository;
mod value;

static IN_LOCKING: AtomicBool = AtomicBool::new(false);

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

struct AppState {
    repo_db: repository::RepoDB,
    meta_db: repository::MetaDB,
    import_progress: Mutex<importer::ImportProgress>,
    job_queue_manager: Arc<Mutex<job_queue_service::JobQueueManager>>,
    logging_service: Arc<logging_service::LoggingService>,
    config: Config,
}

// Search related structures
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct SearchFilters {
    camera: Option<String>,
    lens: Option<String>,
    iso_range: Option<(u32, u32)>,
    aperture_range: Option<(f32, f32)>,
    focal_length_range: Option<(f32, f32)>,
    date_range: Option<(String, String)>,
    has_comment: bool,
    star_rating: i32,
    file_extension: Option<String>,
    tag_ids: Option<Vec<i32>>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct CameraInfo {
    id: String,
    make: String,
    model: String,
    count: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct LensInfo {
    id: String,
    model: String,
    count: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct ExtensionInfo {
    extension: String,
    count: u32,
}

// Search commands
#[tauri::command]
async fn search_photos(
    query: &str,
    search_type: &str,
    filters: &str,
    sort_field: Option<String>,
    sort_order: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let repo_db = &state.repo_db;
    let logging_service = &state.logging_service;

    // Generate correlation ID for this search request
    let correlation_id = logging_service.generate_correlation_id();
    let start_time = std::time::Instant::now();

    log::info!(
        target: "search",
        "search_request; correlation_id={}; query={}; search_type={}; filters={}",
        correlation_id, query, search_type, filters
    );

    // Parse filters
    // this implementation is not used - filters are parsed again in the database layer
    let _search_filters: SearchFilters = match serde_json::from_str(filters) {
        Ok(f) => {
            log::debug!(
                target: "search",
                "filters_parsed; correlation_id={}; parsed_successfully=true",
                correlation_id
            );
            f
        }
        Err(e) => {
            log::warn!(
                target: "search",
                "filters_parse_failed; correlation_id={}; error={}; using_defaults=true",
                correlation_id, e
            );
            SearchFilters {
                camera: None,
                lens: None,
                iso_range: None,
                aperture_range: None,
                focal_length_range: None,
                date_range: None,
                has_comment: false,
                star_rating: 0,
                file_extension: None,
                tag_ids: None,
            }
        }
    };

    // Validate and set default sort parameters
    let sort_field = sort_field.unwrap_or_else(|| "exif_date_time_original".to_string());
    let sort_order = sort_order.unwrap_or_else(|| "desc".to_string());

    // Validate sort parameters for security
    let valid_sort_fields = vec!["exif_date_time_original", "photo_date", "path", "star"];
    let valid_sort_orders = vec!["asc", "desc"];

    if !valid_sort_fields.contains(&sort_field.as_str()) {
        log::warn!(
            target: "search",
            "invalid_sort_field; correlation_id={}; sort_field={}; using_default=exif_date_time_original",
            correlation_id, sort_field
        );
        return Err("Invalid sort field".to_string());
    }

    if !valid_sort_orders.contains(&sort_order.as_str()) {
        log::warn!(
            target: "search",
            "invalid_sort_order; correlation_id={}; sort_order={}; using_default=desc",
            correlation_id, sort_order
        );
        return Err("Invalid sort order".to_string());
    }

    log::debug!(
        target: "search",
        "sort_params; correlation_id={}; sort_field={}; sort_order={}",
        correlation_id, sort_field, sort_order
    );

    // Get max_photos_per_fetch from config
    let max_photos_per_fetch = state.config.max_photos_per_fetch;

    log::debug!(
        target: "search",
        "max_photos_config; correlation_id={}; max_photos_per_fetch={}",
        correlation_id, max_photos_per_fetch
    );

    // Use the search_photos method from the SQLite struct
    let result = meta_db.search_photos(
        query,
        search_type,
        filters,
        &sort_field,
        &sort_order,
        max_photos_per_fetch,
    );
    let duration = start_time.elapsed();

    match &result {
        Ok(response) => {
            // Try to parse the response to count results
            let result_count = match serde_json::from_str::<Vec<serde_json::Value>>(response) {
                Ok(data) => data.len(),
                Err(_) => 0,
            };

            log::info!(
                target: "search",
                "search_response; correlation_id={}; result_count={}; duration_ms={}; success=true",
                correlation_id, result_count, duration.as_millis()
            );
        }
        Err(error) => {
            log::error!(
                target: "search",
                "search_response; correlation_id={}; duration_ms={}; success=false; error={}",
                correlation_id, duration.as_millis(), error
            );
        }
    }

    result
}

#[tauri::command]
async fn get_filter_options(
    filter_type: &str,
    state: tauri::State<'_, AppState>,
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

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_dates(window: tauri::Window, state: tauri::State<AppState>) -> String {
    println!("get_dates is called from {}", window.label());

    // First try to get dates from SQLite metadata database
    let meta_db = &state.meta_db;
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

#[tauri::command]
async fn get_dates_num(
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
    let missing_dates: Vec<_> = dates.dates.iter()
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

#[tauri::command]
async fn link_file_to_public(
    from_file_path: &str,
    to_file_name: &str,
    _state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let from = path::Path::new(from_file_path);
    let to = path::Path::new("../public/").join(to_file_name.to_string());
    log::debug!(target: "file_service", "create_symlink; from={:?}; to={:?}", from, to);

    if cfg!(target_os = "windows") {
        return match std::fs::copy(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "copy_file_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    } else {
        match fs::remove_file(to.as_path()) {
            Ok(_) => {}
            Err(e) => {
                log::error!(target: "file_service", "delete_file_failed; file={:?}; error={:?}", to.clone(), e);
                // return Ok("false".to_string());
            }
        };

        #[cfg(unix)]
        return match symlink(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "create_symlink_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
        #[cfg(windows)]
        return match symlink_file(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "create_symlink_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    }
}


#[derive(serde::Deserialize, Debug)]
#[serde(tag = "type")]
enum PhotoRequest {
    #[serde(rename = "search")]
    Search {
        // 検索の種類を指定 (recent, date, text_search, favorites, album_photos)
        search_type: String,

        // 検索クエリ (date検索なら日付文字列、text検索なら検索テキスト、album_photosならalbum_id等)
        query: Option<String>,

        // フィルタリング条件
        star: Option<i32>,
        has_comment: Option<bool>,
        extension: Option<String>,

        // ページネーション
        page: Option<u32>,
        limit: Option<u32>,
        offset: Option<u32>,

        // ソート
        sort_value: Option<i32>,

        // 追加パラメータ (album_id等、柔軟に対応)
        params: Option<serde_json::Value>,
    },
}

#[tauri::command]
async fn get_photos_unified(
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
                        Err(_e) => return Err(()),
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
                    log::info!(target: "get_photos", "recent_complete; json_length={}", json_result.len());
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
                    let date = match value::date::Date::try_from_string(
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

                    // Use unified collection query instead of legacy album_photos table
                    let conn = meta_db.get_connection().map_err(|e| {
                        log::error!(target: "get_photos", "album_db_connection_failed; error={}", e);
                    })?;

                    let mut stmt = conn.prepare(
                        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.created_at, pm.updated_at,
                                pm.google_photos_url, pm.exif_iso, pm.exif_fnumber, pm.exif_date_time,
                                pm.exif_date_time_original, pm.exif_lens_model, pm.exif_make, pm.exif_lens_make,
                                pm.exif_model, pm.exif_xresolution, pm.exif_yresolution, pm.exif_resolution_unit,
                                pm.exif_copyright, pm.exif_exposure_time, pm.exif_shutter_speed_value,
                                pm.exif_focal_length, pm.exif_focal_length_in35mm_film, pm.exif_digital_zoom_ratio,
                                pm.exif_exposure_mode, pm.exif_white_balance_mode, pm.exif_orientation, pm.css_style,
                                pci.order_index, pci.added_at
                         FROM photo_collection_items pci 
                         JOIN photo_metadata pm ON pci.photo_path = pm.path 
                         JOIN photo_collections pc ON pci.collection_id = pc.id
                         WHERE pc.id = ?1 AND pc.type = 'album' AND pm.delete_flg = 0
                         ORDER BY pci.order_index, pci.added_at"
                    ).map_err(|e| {
                        log::error!(target: "get_photos", "album_prepare_failed; error={}", e);
                    })?;

                    let photos = stmt.query_map(params![album_id], |row| {
                        let path: String = row.get("path")?;
                        let _photo_date: String = row.get("photo_date")?;
                        let star: i32 = row.get("star")?;
                        let comment: String = row.get("comment")?;
                        
                        // Create a file from the path
                        let file = file::File::new(path);
                        
                        // Create photo with the file and no config
                        let mut photo = photo::Photo::new(file, None);
                        
                        // Set the star and comment from database
                        photo.star = if star > 0 { Some(star) } else { None };
                        photo.comment = if !comment.is_empty() { Some(comment) } else { None };
                        
                        Ok(photo)
                    }).map_err(|e| {
                        log::error!(target: "get_photos", "album_query_failed; error={}", e);
                    })?;

                    let photo_list: Result<Vec<_>, _> = photos.collect();
                    let photos = photo_list.map_err(|e| {
                        log::error!(target: "get_photos", "album_collect_failed; error={}", e);
                    })?;

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
                        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url,
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
                         GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url
                         ORDER BY pm.photo_date DESC", 
                        placeholders
                    );
                    
                    let mut stmt = conn.prepare(&query_sql).map_err(|e| {
                        log::error!(target: "get_photos", "tag_prepare_failed; error={}", e);
                    })?;
                    
                    let mut params: Vec<&dyn rusqlite::ToSql> = tag_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
                    let tag_count = tag_ids.len() as i32;
                    params.push(&tag_count);
                    
                    let photo_iter = stmt.query_map(params.as_slice(), |row| {
                        let photo_path = row.get::<_, String>("path").unwrap_or_default();
                        
                        // Create Photo entity from file path
                        let file_result = crate::value::file::File::new_if_exists(photo_path.clone());
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
                        
                        let comment = row.get::<_, Option<String>>("comment").unwrap_or_default().unwrap_or_default();
                        photo.set_comment(comment);
                        
                        // Set CSS style
                        if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
                            photo.set_css_style(css_style);
                        }
                        
                        // Process tags from concatenated string
                        let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
                        photo.set_tags_from_string(tags_string);
                        
                        Ok(photo)
                    }).map_err(|e| {
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
                "search" => {
                    let search_query = query.unwrap_or_default();
                    
                    // Get search parameters from params or use defaults
                    let (search_type_param, filters_str, sort_field, sort_order) = if let Some(ref params) = params {
                        let search_type_param = params.get("search_type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("text")
                            .to_string();
                        let filters_str = params.get("filters")
                            .and_then(|v| v.as_str())
                            .unwrap_or("{}")
                            .to_string();
                        let sort_field = params.get("sort_field")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let sort_order = params.get("sort_order")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        (search_type_param, filters_str, sort_field, sort_order)
                    } else {
                        ("text".to_string(), "{}".to_string(), None, None)
                    };
                    
                    log::info!(target: "get_photos", "search_request; query={}; search_type={}", search_query, search_type_param);
                    
                    // Use existing search_photos implementation
                    let max_photos_per_fetch = limit.unwrap_or(1000);
                    match meta_db.search_photos(&search_query, &search_type_param, &filters_str, 
                                               &sort_field.unwrap_or("photo_date".to_string()), 
                                               &sort_order.unwrap_or("DESC".to_string()), 
                                               max_photos_per_fetch) {
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
                                GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '')) as tags
                         FROM photo_metadata pm
                         LEFT JOIN photo_tags pt ON pm.path = pt.photo_path
                         LEFT JOIN tags t ON pt.tag_id = t.id
                         WHERE pm.delete_flg = 1 
                         GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url
                         ORDER BY pm.updated_at DESC").map_err(|e| {
                        log::error!(target: "get_photos", "trash_prepare_failed; error={}", e);
                    })?;
                    
                    log::debug!(target: "get_photos", "trash_query_prepared; executing_query");
                    
                    let photo_iter = stmt.query_map([], |row| {
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
                        let trash_file_result = crate::value::file::File::new_if_exists(trash_file_path.clone());
                        if trash_file_result.is_none() {
                            return Err(rusqlite::Error::InvalidPath(trash_file_path.into()));
                        }
                        
                        // Create Photo entity from original path (DB path), not trash path
                        let mut photo = if let Some(file) = crate::value::file::File::new_if_exists(photo_path.clone()) {
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
                        
                        let comment = row.get::<_, Option<String>>("comment").unwrap_or_default().unwrap_or_default();
                        photo.set_comment(comment);
                        
                        // Set CSS style
                        if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
                            photo.set_css_style(css_style);
                        }
                        
                        // Process tags from concatenated string
                        let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
                        photo.set_tags_from_string(tags_string);
                        
                        Ok(photo)
                    }).map_err(|e| {
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
                    match meta_db.get_all_collections(Some("album")) {
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
                    match meta_db.get_all_collections(Some("tag")) {
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
                    match meta_db.get_all_collections(Some("tag")) {
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

#[tauri::command]
async fn get_next_photo(
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

#[tauri::command]
async fn get_prev_photo(
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

#[tauri::command]
fn get_photo_info(path_str: &str, window: tauri::Window, state: tauri::State<AppState>) -> String {
    match file::File::new_if_exists(path_str.to_string()) {
        Some(f) => {
            let photo = photo::Photo::new(f, Option::None);
            let exif_data = exif::ExifData::new(photo.file.clone());
            let photo_meta = photo_meta::PhotoMeta::new_with_data(photo, &state.meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);
            let json = serde_json::to_string(&photo_meta_with_exif).unwrap();
            return json;
        }
        None => {
            return "{}".to_string();
        }
    }
}

#[tauri::command]
fn save_star(window: tauri::Window, state: tauri::State<AppState>, path_str: &str, star_num: i32) {
    let db = &state.meta_db;
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let star = star::Star::new(star_num);
    photo_service::save_photo_star(db, &photo, star);
}

#[tauri::command]
fn save_comment(
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

#[tauri::command]
fn show_importer(
    path_str: Option<&str>,
    date_str: Option<&str>,
    _window: tauri::Window,
    page: usize,
    num: usize,
    state: tauri::State<AppState>,
) -> String {
    let path: &str;
    let cp: String;
    if path_str.is_none() || path_str.unwrap() == "" {
        path = &state.config.export_from[0];
    } else {
        let p = path_str.unwrap();
        let cpp = fs::canonicalize(path::Path::new(p));
        if cpp.is_err() {
            path = "/";
        } else {
            cp = cpp.unwrap().display().to_string();
            path = cp.as_str();
        }
    }
    let filter: Option<date::Date>;
    if date_str.is_none() || date_str.unwrap() == "" {
        filter = Option::None;
    } else {
        let date = date::Date::from_string(&date_str.unwrap().to_string(), Option::Some("-"));
        filter = Option::Some(date);
    }

    let mut importer = importer::Importer::new(path.to_string(), page, num, filter);
    importer.set_importer_paths(state.config.export_from.clone());

    let json = serde_json::to_string(&importer).unwrap();
    // println!("{:?}", &json);
    return json;
}

#[tauri::command]
async fn import_photos(
    window: tauri::Window,
    files: Vec<&str>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "importer", "import_photos_request; file_count={}", files.len());

    // Convert Vec<&str> to Vec<String>
    let file_strings: Vec<String> = files.iter().map(|s| s.to_string()).collect();

    // Get app handle for job processing
    let app_handle = window.app_handle().clone();

    // Submit jobs to the queue
    log::debug!(target: "importer", "acquiring_lock; target=job_queue_manager");
    let job_queue_manager = state.job_queue_manager.lock().unwrap();
    log::debug!(target: "importer", "lock_acquired; action=submitting_jobs");

    match job_queue_manager.submit_import_jobs(file_strings, app_handle) {
        Ok(job_unit_id) => {
            log::info!(target: "importer", "import_jobs_submitted; job_unit_id={}", job_unit_id);
            Ok(job_unit_id)
        }
        Err(e) => {
            log::error!(target: "importer", "submit_import_jobs_failed; error={}", e);
            Err(e)
        }
    }
}

#[tauri::command]
fn get_import_progress(state: tauri::State<AppState>) -> String {
    let ip = &state.import_progress;
    _ = ip.lock().unwrap().get_import_progress();
    return serde_json::to_string(ip).unwrap();
}

#[tauri::command]
async fn get_job_progress(
    job_unit_id: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.lock().unwrap();
    match job_queue_manager.get_job_progress(job_unit_id) {
        Ok(progress) => Ok(serde_json::to_string(&progress).unwrap()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn get_photos_to_import_under_directory(
    path_str: &str,
    date_after_str: Option<&str>,
    _window: tauri::Window,
    _state: tauri::State<AppState>,
) -> String {
    let d = dir::Dir::new(path_str.to_string());
    let filter: Option<date::Date>;
    if date_after_str.is_none() || date_after_str.unwrap() == "" {
        filter = Option::None;
    } else {
        let date = date::Date::from_string(&date_after_str.unwrap().to_string(), Option::Some("-"));
        filter = Option::Some(date);
    }

    let files = d.find_all_files(filter);
    return serde_json::to_string(&files.files).unwrap();
}

#[tauri::command]
async fn move_photos_to_exif_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    // Check if date_str is empty
    if date_str.trim().is_empty() {
        return Err(());
    }
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    window.emit("move_files", "start").unwrap();
    log::debug!(target: "photo", "move_photos_to_exif_date; target_date={:?}", date);
    let dates = state.repo_db.move_photos_to_exif_date(date).await;
    log::debug!(target: "photo", "move_photos_completed; dates={:?}", dates);
    window.emit("move_files", "end_move").unwrap();
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("move_files", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("move_files", "faile").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_db(window: tauri::Window, state: tauri::State<'_, AppState>) -> Result<String, ()> {
    let dates = state.repo_db.get_dates();
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("create_db", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_db_in_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    // Check if date_str is empty
    if date_str.trim().is_empty() {
        return Err(());
    }
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    let dates = date::Dates::new(&[date]);
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("create_db", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_thumbnails(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let dates = state.repo_db.get_dates();
    let c = &state.config;
    let origin = PathBuf::from(c.import_to.clone());
    let dest = PathBuf::from(c.thumbnail_store.clone());
    match photo_service::create_thumbnails(
        dates,
        &origin,
        &dest,
        c.thumbnail_parallel as u32,
        c.thumbnail_compression_quality,
        c.thumbnail_ratio,
        c.thumbnail_ignore_file_size,
    )
    .await
    {
        Ok(ret) => {
            window.emit("create_thumbnails", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_thumbnails", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_thumbnails_in_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    // Check if date_str is empty
    if date_str.trim().is_empty() {
        return Err(());
    }
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    let dates = date::Dates::new(&[date]);
    let c = &state.config;
    let origin = PathBuf::from(c.import_to.clone());
    let dest = PathBuf::from(c.thumbnail_store.clone());
    match photo_service::create_thumbnails(
        dates,
        &origin,
        &dest,
        c.thumbnail_parallel as u32,
        c.thumbnail_compression_quality,
        c.thumbnail_ratio,
        c.thumbnail_ignore_file_size,
    )
    .await
    {
        Ok(ret) => {
            window.emit("create_thumbnails", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_thumbnails", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> String {
    let new_config = Config::new();
    serde_json::to_string(&new_config).unwrap()
}

#[tauri::command]
fn save_config(state: tauri::State<AppState>, config: Config) -> String {
    if config.save() {
        return "{result: true}".to_string();
    } else {
        return "{result: false}".to_string();
    }
}

#[tauri::command]
fn get_all_job_units(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let job_units = {
        let manager = job_queue_manager.lock().unwrap();
        manager.get_all_job_units()
    };

    match serde_json::to_string(&job_units) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize job units: {}", e)),
    }
}

#[tauri::command]
fn get_all_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let jobs = {
        let manager = job_queue_manager.lock().unwrap();
        manager.get_all_jobs()
    };

    match serde_json::to_string(&jobs) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize jobs: {}", e)),
    }
}

#[tauri::command]
fn retry_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "job_queue",
        "manual_retry_request; correlation_id={}; job_id={}",
        correlation_id,
        job_id
    );

    let job_queue_manager = state.job_queue_manager.clone();
    let app_handle = window.app_handle().clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
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
}

#[tauri::command]
fn delete_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.delete_job(job_id)
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to delete job: {}", e)),
    }
}

#[tauri::command]
fn delete_job_unit(
    job_unit_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.delete_job_unit(job_unit_id)
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to delete job unit: {}", e)),
    }
}

#[tauri::command]
fn cleanup_completed_jobs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.cleanup_completed_jobs()
    };

    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to cleanup completed jobs: {}", e)),
    }
}

// to avoid event happens twice in same time.
#[tauri::command]
fn lock(t: bool) -> bool {
    if !t {
        IN_LOCKING.store(false, Ordering::SeqCst);
        return true;
    } else {
        if IN_LOCKING.load(Ordering::SeqCst) {
            return false;
        } else {
            IN_LOCKING.store(true, Ordering::SeqCst);
            return true;
        }
    }
}

#[tauri::command]
async fn upload_to_google_photos(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    selected_files: Vec<String>,
) -> Result<Vec<String>, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "google_photos",
        "upload_request; correlation_id={}; files_count={}",
        correlation_id,
        selected_files.len()
    );

    // Check if user is authenticated
    if !crate::domain_service::token_storage_service::TokenStorageService::has_stored_tokens() {
        let error = "Not authenticated with Google Photos. Please login first.".to_string();
        log::error!(target: "google_photos", "upload_error; correlation_id={}; error={}", correlation_id, error);
        return Err(error);
    }

    // Submit jobs to queue manager
    let job_queue_manager = state.job_queue_manager.lock().map_err(|_| {
        let error = "Failed to acquire job queue manager lock".to_string();
        log::error!(target: "google_photos", "upload_error; correlation_id={}; error={}", correlation_id, error);
        error
    })?;

    let job_unit_id = job_queue_manager.submit_google_photos_upload_jobs(
        selected_files,
        _window.app_handle().clone(),
    ).map_err(|e| {
        log::error!(target: "google_photos", "submit_jobs_error; correlation_id={}; error={}", correlation_id, e);
        format!("Failed to submit upload jobs: {}", e)
    })?;

    log::info!(
        target: "google_photos",
        "upload_jobs_submitted; correlation_id={}; job_unit_id={}",
        correlation_id,
        job_unit_id
    );

    Ok(vec![job_unit_id])
}

// Google OAuth token management commands
#[tauri::command]
async fn store_google_tokens(
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "store_tokens_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::store_google_tokens(
        &access_token,
        &refresh_token,
        expires_in,
    ) {
        Ok(()) => {
            log::info!(target: "token_storage", "store_tokens_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "token_storage", "store_tokens_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn is_google_authenticated(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    let is_authenticated =
        crate::domain_service::token_storage_service::TokenStorageService::has_stored_tokens();

    log::info!(
        target: "token_storage",
        "check_authentication; correlation_id={}; authenticated={}",
        correlation_id,
        is_authenticated
    );

    Ok(is_authenticated)
}

#[tauri::command]
#[cfg(debug_assertions)]
async fn get_google_token_info(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "get_token_info_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::get_token_info() {
        Ok(info) => {
            log::info!(target: "token_storage", "get_token_info_success; correlation_id={}", correlation_id);
            Ok(info)
        }
        Err(e) => {
            log::error!(target: "token_storage", "get_token_info_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn logout_google(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "logout_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::delete_google_tokens()
    {
        Ok(()) => {
            log::info!(target: "token_storage", "logout_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "token_storage", "logout_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn move_to_trash(
    path_str: &str,
    sort_value: i32,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let date = photo.get_imported_dir_date(state.config.import_to.clone());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    log::info!(target: "photo", "move_to_trash; path={:?}", path_str);
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    file_service::move_to_trash(file, trash);

    // Delete from database
    meta_db.delete_photo(&photo);

    return Ok(date.to_string());
}


#[tauri::command]
async fn restore_from_trash(
    path_str: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "restore_from_trash; path={}", path_str);

    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let meta_db = &state.meta_db;

    // First, move the file back from trash to library
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    let library_path = state.config.import_to.clone();

    // Move file from trash back to library
    match file_service::restore_from_trash(file, trash, library_path) {
        Ok(_) => {
            // Update database to restore photo (set delete_flg = 0)
            meta_db.restore_photo_from_trash(&photo);
            Ok("Photo restored successfully".to_string())
        }
        Err(e) => Err(format!("Failed to restore file: {}", e)),
    }
}

#[tauri::command]
async fn delete_permanently(
    path_str: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "delete_permanently; path={}", path_str);

    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let meta_db = &state.meta_db;
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());

    // Remove file from trash directory permanently
    match file_service::remove_from_trash_permanently(file, trash) {
        Ok(_) => {
            // Delete thumbnail if it exists
            let _ = thumbnail_service::delete_thumbnail(&photo, &state.config);

            // Permanently delete from database
            meta_db.delete_photo_permanently(&photo);
            Ok("Photo deleted permanently".to_string())
        }
        Err(e) => Err(format!("Failed to delete file permanently: {}", e)),
    }
}

#[tauri::command]
async fn empty_trash(state: tauri::State<'_, AppState>) -> Result<String, String> {
    log::info!(target: "trash", "empty_trash; starting_bulk_delete");

    let meta_db = &state.meta_db;
    let conn = meta_db
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Get all photos in trash
    let mut stmt = conn
        .prepare("SELECT path FROM photo_metadata WHERE delete_flg = 1")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let path: String = row.get(0)?;
            Ok(path)
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut deleted_count = 0;

    for row in rows {
        if let Ok(path) = row {
            let photo = photo::Photo::new(file::File::new(path.clone()), Option::None);
            let file = file::File::new(path);
            let trash = trash::Trash::new(state.config.trash_path.to_string());

            // Remove file from trash permanently
            if file_service::remove_from_trash_permanently(file, trash).is_ok() {
                // Permanently delete from database
                meta_db.delete_photo_permanently(&photo);
                deleted_count += 1;
            }
        }
    }

    log::info!(target: "trash", "empty_trash; completed; deleted_count={}", deleted_count);
    Ok(format!(
        "Permanently deleted {} photos from trash",
        deleted_count
    ))
}

#[tauri::command]
async fn save_css_style(
    photo_path: &str,
    css_style: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    match sqlite_db.save_css_style(photo_path, css_style) {
        Ok(()) => Ok("{\"result\": true}".to_string()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn get_css_style(
    photo_path: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    match sqlite_db.get_css_style(photo_path) {
        Some(css_style) => Ok(css_style),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
fn get_download_dir(state: tauri::State<AppState>) -> Result<String, String> {
    Ok(state.config.download_dir.clone())
}

#[tauri::command]
async fn open_file_in_default_app(file_path: &str) -> Result<(), String> {
    use std::process::Command;

    let result = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", file_path])
            .status()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(file_path).status()
    } else {
        Command::new("xdg-open").arg(file_path).status()
    };

    match result {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err("Failed to open file".to_string()),
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}

#[tauri::command]
async fn save_styled_copy_from_frontend(
    original_photo_path: &str,
    css_style: &str,
    image_data: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::fs;
    use std::path::Path;

    // 1. Generate SHA256 hash of normalized CSS
    let normalized_css = normalize_css_style(css_style);
    let mut hasher = Sha256::new();
    hasher.update(normalized_css.as_bytes());
    let css_hash = format!("{:x}", hasher.finalize());
    let short_hash = &css_hash[..12]; // Use first 12 chars

    // 2. Parse original photo path
    let original_path = Path::new(original_photo_path);
    let parent_dir = original_path
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let original_name = original_path
        .file_stem()
        .ok_or_else(|| "Cannot get file name".to_string())?
        .to_string_lossy();

    // 3. Create new filename with hash
    let new_filename = format!("{}-{}.jpg", original_name, short_hash);
    let new_path = parent_dir.join(&new_filename);
    let new_path_str = new_path.to_string_lossy().to_string();

    // 4. Check if styled copy already exists
    if new_path.exists() {
        return Ok(new_path_str);
    }

    // 5. Decode base64 image data and save
    use base64::{engine::general_purpose, Engine as _};
    let image_bytes = general_purpose::STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;

    fs::write(&new_path, image_bytes).map_err(|e| format!("Failed to write image file: {}", e))?;

    // 6. Create Photo object and add to database
    let new_file = file::File::new(new_path_str.clone());
    let mut new_photo = photo::Photo::new(new_file, Some(state.config.clone()));
    new_photo.load_exif();

    // 7. Set initial metadata (copy from original photo if exists)
    let meta_db = &state.meta_db;
    let original_photo = photo::Photo::new(file::File::new(original_photo_path.to_string()), None);
    let original_meta = meta_db.get_photo_meta(original_photo);

    // Extract date for thumbnail generation before consuming new_photo
    let photo_dir_date = new_photo.get_imported_dir_date(state.config.import_to.clone());

    // 8. Record the new photo in database
    match meta_db.record_photos_meta_data(vec![new_photo]) {
        Ok(_) => {
            // Copy star rating and comment from original
            if original_meta.star.star() > 0 {
                let new_photo_for_star =
                    photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_star(&new_photo_for_star, original_meta.star);
            }
            if !original_meta.comment.comment().is_empty() {
                let new_photo_for_comment =
                    photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_comment(&new_photo_for_comment, original_meta.comment);
            }
        }
        Err(e) => {
            log::warn!(target: "photo", "record_photo_metadata_failed; error={:?}", e);
        }
    }

    // 9. Generate thumbnail using existing thumbnail infrastructure
    let config = state.config.clone();
    let import_path = std::path::PathBuf::from(&config.import_to);
    let thumbnail_path = std::path::PathBuf::from(&config.thumbnail_store);
    let dates = date::Dates::new(&[photo_dir_date]);

    // Generate thumbnail asynchronously
    tokio::spawn(async move {
        if let Err(e) = photo_service::create_thumbnails(
            dates,
            &import_path,
            &thumbnail_path,
            1, // single thread for one photo
            config.thumbnail_compression_quality,
            config.thumbnail_ratio,
            config.thumbnail_ignore_file_size,
        )
        .await
        {
            log::warn!(target: "photo", "create_thumbnail_failed; error={:?}", e);
        }
    });

    Ok(new_path_str)
}

fn normalize_css_style(css: &str) -> String {
    use std::collections::HashMap;

    // Parse CSS properties and sort them alphabetically
    let mut properties = HashMap::new();

    // Simple CSS parsing - extract transform and filter properties
    if let Some(transform_start) = css.find("transform:") {
        if let Some(transform_end) = css[transform_start..].find(';') {
            let transform_value = css[transform_start + 10..transform_start + transform_end].trim();
            properties.insert("transform", transform_value);
        }
    }

    if let Some(filter_start) = css.find("filter:") {
        if let Some(filter_end) = css[filter_start..].find(';') {
            let filter_value = css[filter_start + 7..filter_start + filter_end].trim();
            properties.insert("filter", filter_value);
        }
    }

    // Sort properties alphabetically and create normalized CSS
    let mut sorted_props: Vec<_> = properties.iter().collect();
    sorted_props.sort_by_key(|&(key, _)| key);

    let normalized = sorted_props
        .iter()
        .map(|(key, value)| format!("{}: {};", key, value))
        .collect::<Vec<_>>()
        .join(" ");

    normalized
}

// Logging commands
#[tauri::command]
async fn get_logs(
    log_type: String,
    lines: Option<usize>,
    since: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    logging_service.get_logs(&log_type, lines, since.as_deref())
}

#[tauri::command]
async fn submit_frontend_logs(
    logs: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.submit_frontend_logs(&logs)
}

#[tauri::command]
async fn set_logging_enabled(
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

#[tauri::command]
async fn get_logging_status(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    // Always read the current saved configuration to get the latest state
    let config = Config::new();
    Ok(serde_json::json!({
        "enabled": config.logging_enabled,
        "level": config.logging_level
    }))
}

#[tauri::command]
async fn clear_backend_logs(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.clear_backend_logs()
}

#[tauri::command]
async fn clear_frontend_logs(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    logging_service.clear_frontend_logs()
}

#[tauri::command]
async fn export_logs_to_download_dir(
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

// Tag management commands


#[tauri::command]
async fn create_tag(
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

#[tauri::command]
async fn delete_tag(tag_id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
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

#[tauri::command]
async fn add_tag_to_photo(
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

#[tauri::command]
async fn remove_tag_from_photo(
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

#[tauri::command]
async fn remove_all_tags_from_photo(
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "remove_all_tags_from_photo_request; correlation_id={}; photo_path={}", correlation_id, photo_path);

    match meta_db.remove_all_tags_from_photo(&photo_path) {
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

#[tauri::command]
async fn get_tags_for_photo(
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(i32, String, Option<String>)>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "get_tags_for_photo_request; correlation_id={}; photo_path={}", correlation_id, photo_path);

    match meta_db.get_tags_for_photo(&photo_path) {
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

#[tauri::command]
async fn search_photos_by_tags(
    tag_ids: Vec<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "search_photos_by_tags_request; correlation_id={}; tag_ids={:?}", correlation_id, tag_ids);

    match meta_db.get_photos_with_tags(&tag_ids) {
        Ok(photos) => {
            log::info!(target: "tags", "search_photos_by_tags_success; correlation_id={}; count={}", correlation_id, photos.len());
            Ok(photos)
        }
        Err(e) => {
            log::error!(target: "tags", "search_photos_by_tags_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

// Album management commands

#[tauri::command]
async fn create_album(
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

#[tauri::command]
async fn update_album(
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

    match meta_db.update_collection(id, Some(&name), Some(&description), None, cover_photo_path.as_deref()) {
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

#[tauri::command]
async fn delete_album(id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
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

#[tauri::command]
async fn add_photo_to_album(
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

#[tauri::command]
async fn remove_photo_from_album(
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

#[tauri::command]
async fn get_album_photos(
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

#[tauri::command]
async fn get_album_photos_with_metadata(
    album_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "get_album_photos_with_metadata_request; correlation_id={}; album_id={}", correlation_id, album_id);

    match meta_db.get_album_photos_with_metadata(album_id) {
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

#[tauri::command]
async fn reorder_album_photos(
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

// Unified PhotoCollection API endpoints

#[tauri::command]
async fn create_collection(
    collection_type: String,
    name: String,
    description: Option<String>,
    color: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "create_collection_request; correlation_id={}; type={}; name={}", correlation_id, collection_type, name);

    match meta_db.create_collection(&collection_type, &name, description.as_deref(), color.as_deref()) {
        Ok(collection_id) => {
            log::info!(target: "photo_collections", "create_collection_success; correlation_id={}; collection_id={}", correlation_id, collection_id);
            Ok(collection_id)
        }
        Err(e) => {
            log::error!(target: "photo_collections", "create_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn get_all_collections(
    collection_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "get_all_collections_request; correlation_id={}; type={:?}", correlation_id, collection_type);

    match meta_db.get_all_collections(collection_type.as_deref()) {
        Ok(collections) => {
            log::info!(target: "photo_collections", "get_all_collections_success; correlation_id={}; count={}", correlation_id, collections.len());
            serde_json::to_string(&collections).map_err(|e| e.to_string())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "get_all_collections_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn update_collection(
    id: i32,
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
    cover_photo_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "update_collection_request; correlation_id={}; id={}", correlation_id, id);

    match meta_db.update_collection(id, name.as_deref(), description.as_deref(), color.as_deref(), cover_photo_path.as_deref()) {
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

#[tauri::command]
async fn delete_collection(id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
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

#[tauri::command]
async fn add_photo_to_collection(
    collection_id: i32,
    photo_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "add_photo_to_collection_request; correlation_id={}; collection_id={}; photo_path={}", correlation_id, collection_id, photo_path);

    match meta_db.add_photo_to_collection(collection_id, &photo_path) {
        Ok(()) => {
            log::info!(target: "photo_collections", "add_photo_to_collection_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "add_photo_to_collection_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn remove_photo_from_collection(
    collection_id: i32,
    photo_path: String,
    state: tauri::State<'_, AppState>,
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

#[tauri::command]
async fn get_collection_photos(
    collection_id: i32,
    ordered: Option<bool>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;

    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "photo_collections", "get_collection_photos_request; correlation_id={}; collection_id={}; ordered={:?}", correlation_id, collection_id, ordered);

    match meta_db.get_collection_photos(collection_id, ordered.unwrap_or(false)) {
        Ok(photos) => {
            log::info!(target: "photo_collections", "get_collection_photos_success; correlation_id={}; count={}", correlation_id, photos.len());
            serde_json::to_string(&photos).map_err(|e| e.to_string())
        }
        Err(e) => {
            log::error!(target: "photo_collections", "get_collection_photos_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use crate::repository::*;
    let c = config::Config::new();
    // if c.repository.store == "memory".to_string() {
    //     db = repository::RepoDB::new();
    // } else {
    //     db = repository::RepoDB::new("".to_string());
    // }
    let ip: importer::ImportProgress = importer::ImportProgress::new();

    // Create job queue manager with same database instance
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(c.import_to.clone());
    // Initialize the database to ensure job queue tables are created
    log::info!(target: "app", "initializing_job_queue_database");
    if let Err(e) = sqlite_db.init_db() {
        log::error!(target: "app", "job_queue_database_init_failed; error={}", e);
        panic!("Failed to initialize job queue database: {}", e);
    }
    log::info!(target: "app", "job_queue_database_initialized");
    let job_queue_manager =
        job_queue_service::JobQueueManager::new(sqlite_db, c.copy_parallel as usize);

    // Initialize logging service
    let logging_service =
        logging_service::LoggingService::new().expect("Failed to initialize logging service");

    // Clean up log files if logging is disabled
    if let Err(e) = logging_service.cleanup_log_files_if_disabled(c.logging_enabled) {
        log::warn!(target: "app", "cleanup_log_files_failed; error={}", e);
    }

    // Setup backend logging to file only if logging is enabled
    if c.logging_enabled {
        if let Err(e) = logging_service.setup_backend_logging() {
            log::warn!(target: "app", "setup_backend_logging_failed; error={}", e);
            // Continue without file logging
            env_logger::Builder::from_default_env()
                .filter_level(log::LevelFilter::Debug)
                .init();
        }
    } else {
        // When logging is disabled, setup minimal console logging for critical messages only
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Error)
            .init();
    }

    let state = AppState {
        repo_db: repository::RepoDB::new(c.import_to.to_string()),
        meta_db: repository::MetaDB::new(c.import_to.to_string()),
        import_progress: Mutex::new(ip),
        job_queue_manager: Arc::new(Mutex::new(job_queue_manager)),
        logging_service: Arc::new(logging_service),
        config: c,
    };

    state.repo_db.connect();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            let submenu = SubmenuBuilder::new(app, "File")
                .text("home", "HOME")
                .text("load_dates", "Load Date List")
                .text("import", "Import")
                .text("create_db", "Create DB")
                .text("login", "Login to Google")
                .text("job_queue", "Job Queue")
                .text("pref", "Preferences")
                .text("quit", "Quit")
                .build()?;

            let help_submenu = SubmenuBuilder::new(app, "?")
                .text("show_log", "Show log")
                .text("github", "GitHub")
                .separator()
                .text("privacy_policy", "Privacy Policy")
                .text("terms_of_use", "Terms of Use")
                .separator()
                .text("about", "About")
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&submenu)
                .item(&help_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, e| {
                if e.id == "quit" {
                    std::process::exit(0)
                } else if e.id == "close" {
                    app.exit(0)
                } else if e.id == "home" {
                    app.emit("click_menu", "HOME").unwrap();
                } else if e.id == "show_log" {
                    app.emit("click_menu_static", "show_log").unwrap();
                } else if e.id == "about" {
                    app.emit("click_menu_static", "about").unwrap();
                } else if e.id == "github" {
                    app.emit("click_menu_static", "github").unwrap();
                } else if e.id == "load_dates" {
                    app.emit("click_menu", "load_dates").unwrap();
                } else if e.id == "create_db" {
                    app.emit("click_menu", "create_db").unwrap();
                } else if e.id == "import" {
                    app.emit("click_menu", "import").unwrap();
                } else if e.id == "login" {
                    app.emit("click_menu", "login").unwrap();
                } else if e.id == "job_queue" {
                    app.emit("click_menu", "job_queue").unwrap();
                } else if e.id == "pref" {
                    app.emit("click_menu", "pref").unwrap();
                } else {
                    log::debug!(target: "app", "unhandled_menu_event; event={:?}", e);
                }
            });

            // Start background job processing
            log::info!(target: "job_queue", "starting_background_job_processing");
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let job_queue_manager = state.job_queue_manager.lock().unwrap();
            job_queue_manager.start_background_processing(app_handle);
            log::info!(target: "job_queue", "background_job_processing_started");

            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            search_photos,
            get_filter_options,
            get_dates,
            get_photos_unified,
            get_photo_info,
            get_next_photo,
            get_prev_photo,
            show_importer,
            import_photos,
            get_import_progress,
            get_job_progress,
            get_all_job_units,
            get_all_jobs,
            retry_job,
            delete_job,
            delete_job_unit,
            cleanup_completed_jobs,
            get_photos_to_import_under_directory,
            get_dates_num,
            move_to_trash,
            restore_from_trash,
            delete_permanently,
            empty_trash,
            lock,
            create_db,
            create_db_in_date,
            create_thumbnails,
            create_thumbnails_in_date,
            get_config,
            save_config,
            save_star,
            save_comment,
            link_file_to_public,
            move_photos_to_exif_date,
            upload_to_google_photos,
            store_google_tokens,
            is_google_authenticated,
            logout_google,
            #[cfg(debug_assertions)]
            get_google_token_info,
            save_css_style,
            get_css_style,
            get_download_dir,
            open_file_in_default_app,
            save_styled_copy_from_frontend,
            get_logs,
            submit_frontend_logs,
            set_logging_enabled,
            get_logging_status,
            clear_backend_logs,
            clear_frontend_logs,
            export_logs_to_download_dir,
            create_tag,
            delete_tag,
            add_tag_to_photo,
            remove_tag_from_photo,
            remove_all_tags_from_photo,
            get_tags_for_photo,
            search_photos_by_tags,
            create_album,
            update_album,
            delete_album,
            add_photo_to_album,
            remove_photo_from_album,
            get_album_photos,
            get_album_photos_with_metadata,
            reorder_album_photos,
            // Unified PhotoCollection API
            create_collection,
            get_all_collections,
            update_collection,
            delete_collection,
            add_photo_to_collection,
            remove_photo_from_collection,
            get_collection_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
