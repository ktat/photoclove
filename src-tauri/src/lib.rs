use crate::domain_service::{file_service, photo_service, job_queue_service, logging_service};
use crate::entity::importer;
use crate::entity::*;
use crate::repository::RepositoryDB;
use crate::repository::*;
use crate::value::*;
use entity::config::Config;
use rusqlite::ToSql;
use serde_json::json;
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
        },
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
        },
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
    let result = meta_db.search_photos(query, search_type, filters, &sort_field, &sort_order, max_photos_per_fetch);
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
        "cameras" => {
            sqlite_db.get_camera_options().unwrap_or_else(|_| "[]".to_string())
        }
        "lenses" => {
            sqlite_db.get_lens_options().unwrap_or_else(|_| "[]".to_string())
        }
        "extensions" => {
            sqlite_db.get_extension_options().unwrap_or_else(|_| "[]".to_string())
        }
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
                println!("get_dates() - SQLite returned {} dates", dates.len());
                let mut date_list = date::Dates::empty();
                date_list.dates = dates;
                let json_result = date_list.to_json();
                println!("get_dates() - JSON result: {}", json_result);
                println!("get_dates() - FINAL JSON SENT TO REACT: {}", json_result);
                return json_result;
            }
            Err(e) => {
                eprintln!("Error getting dates from SQLite: {}", e);
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
    println!("get_dates() - FINAL JSON SENT TO REACT: {}", filesystem_json);
    filesystem_json
}

#[tauri::command]
async fn get_dates_num(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    dates_str: &str,
) -> Result<String, ()> {
    println!("get_dates_num() - Input dates_str: {:?}", dates_str);
    let mut dates = date::Dates::empty();
    let splitted = dates_str.split(",");
    for date_tupple in splitted.enumerate() {
        let date_str = date_tupple.1;
        println!("get_dates_num() - Processing date: {:?}", date_str);
        dates.dates.push(date::Date::from_string(
            &date_str.to_string(),
            Option::Some("-"),
        ));
    }
    println!("get_dates_num() - Parsed {} dates", dates.dates.len());
    
    let meta_db = &state.meta_db;
    let db = &state.repo_db;
    
    println!("get_dates_num() - Getting photo count from meta_db (SQLite)");
    let meta_data = meta_db.get_photo_count_per_dates(dates.clone());
    println!("get_dates_num() - Meta data result: {}", meta_data.to_json());
    
    println!("get_dates_num() - Getting photo count from repo_db (filesystem)");
    let dates_num = db.get_photo_count_per_dates(dates, meta_data);
    let final_json = dates_num.to_json();
    println!("get_dates_num() - FINAL RESULT JSON: {}", final_json);
    
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
    eprintln!("{:?} => {:?}", from, to);

    if cfg!(target_os = "windows") {
        return match std::fs::copy(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot copy file {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    } else {
        match fs::remove_file(to.as_path()) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Cannot delete file {:?} : {:?}", to.clone(), e);
                // return Ok("false".to_string());
            }
        };

        #[cfg(unix)]
        return match symlink(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot create symlink {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
        #[cfg(windows)]
        return match symlink_file(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot create symlink {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    }
}

#[tauri::command]
async fn get_photos(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    state: tauri::State<'_, AppState>,
    offset: u32,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photos = repo_db
        .get_photos_in_date(
            &meta_data,
            date,
            repository::sort_from_int(sort_value),
            num,
            page,
            offset as usize,
            0,
            false,
            "all",
            Option::Some(state.config.clone()),
        )
        .await;
    Ok(photos.to_json())
}

#[tauri::command]
async fn get_photos_with_filter(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    star: i32,
    has_comment: bool,
    extension: &str,
    state: tauri::State<'_, AppState>,
    offset: u32,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photos = repo_db
        .get_photos_in_date(
            &meta_data,
            date,
            repository::sort_from_int(sort_value),
            num,
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

#[tauri::command]
async fn get_recent_photos(
    limit: Option<u32>,
    sort_value: i32,
    star: i32,
    has_comment: bool,
    extension: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let limit = limit.unwrap_or(60);
    
    // Get recent photos metadata directly from database using SQL
    let meta_data = match meta_db.get_recent_photos_metadata(limit) {
        Ok(data) => data,
        Err(_e) => return Err(()),
    };
    
    let photos = repo_db
        .get_recent_photos(
            &meta_data,
            1, // page
            repository::sort_from_int(sort_value),
            limit,
            0, // offset
            star,
            has_comment,
            extension,
            Option::Some(state.config.clone()),
        )
        .await;
    
    Ok(photos.to_json())
}

#[tauri::command]
async fn get_next_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
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
    eprintln!("import_photos called with {} files", files.len());
    
    // Convert Vec<&str> to Vec<String>
    let file_strings: Vec<String> = files.iter().map(|s| s.to_string()).collect();
    
    // Get app handle for job processing
    let app_handle = window.app_handle().clone();
    
    // Submit jobs to the queue
    eprintln!("Acquiring job_queue_manager lock...");
    let job_queue_manager = state.job_queue_manager.lock().unwrap();
    eprintln!("Lock acquired, submitting jobs...");
    
    match job_queue_manager.submit_import_jobs(file_strings, app_handle) {
        Ok(job_unit_id) => {
            eprintln!("Import jobs submitted with job unit ID: {}", job_unit_id);
            Ok(job_unit_id)
        }
        Err(e) => {
            eprintln!("Failed to submit import jobs: {}", e);
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
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    window.emit("move_files", "start").unwrap();
    eprintln!("target date: {:?}", date);
    let dates = state.repo_db.move_photos_to_exif_date(date).await;
    eprintln!("date: {:?}", dates);
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
fn retry_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.clone();
    let result = {
        let manager = job_queue_manager.lock().unwrap();
        manager.retry_job(job_id)
    };
    
    match result {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(format!("Failed to retry job: {}", e)),
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
fn delete_job_unit(job_unit_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
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
    date_str: &str,
    access_token: &str,
    reflesh_token: &str,
    selected_files: Vec<&str>,
) -> Result<bool, ()> {
    eprintln!("{:?}", date_str);
    eprintln!("{:?}", selected_files);
    let photos =
        google_photos::GooglePhotos::new(access_token.to_string(), reflesh_token.to_string(), state.config.import_to.clone());
    photos.upload_photo(selected_files).await;
    return Ok(true);
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
    eprintln!("to Trash: {:?}", path_str);
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    file_service::move_to_trash(file, trash);
    
    // Delete from database
    meta_db.delete_photo(&photo);
    
    return Ok(date.to_string());
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
        Command::new("open")
            .arg(file_path)
            .status()
    } else {
        Command::new("xdg-open")
            .arg(file_path)
            .status()
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
    use std::path::Path;
    use sha2::{Sha256, Digest};
    use std::fs;
    
    // 1. Generate SHA256 hash of normalized CSS
    let normalized_css = normalize_css_style(css_style);
    let mut hasher = Sha256::new();
    hasher.update(normalized_css.as_bytes());
    let css_hash = format!("{:x}", hasher.finalize());
    let short_hash = &css_hash[..12]; // Use first 12 chars
    
    // 2. Parse original photo path
    let original_path = Path::new(original_photo_path);
    let parent_dir = original_path.parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let original_name = original_path.file_stem()
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
    use base64::{Engine as _, engine::general_purpose};
    let image_bytes = general_purpose::STANDARD.decode(image_data)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;
    
    fs::write(&new_path, image_bytes)
        .map_err(|e| format!("Failed to write image file: {}", e))?;
    
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
                let new_photo_for_star = photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_star(&new_photo_for_star, original_meta.star);
            }
            if !original_meta.comment.comment().is_empty() {
                let new_photo_for_comment = photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_comment(&new_photo_for_comment, original_meta.comment);
            }
        }
        Err(e) => {
            eprintln!("Warning: Failed to record photo metadata: {:?}", e);
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
        ).await {
            eprintln!("Warning: Failed to create thumbnail: {:?}", e);
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

// Tag management commands
#[tauri::command]
async fn get_all_tags(state: tauri::State<'_, AppState>) -> Result<Vec<(i32, String, Option<String>)>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "get_all_tags_request; correlation_id={}", correlation_id);
    
    match meta_db.get_all_tags() {
        Ok(tags) => {
            log::info!(target: "tags", "get_all_tags_success; correlation_id={}; count={}", correlation_id, tags.len());
            Ok(tags)
        }
        Err(e) => {
            log::error!(target: "tags", "get_all_tags_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn create_tag(name: String, color: Option<String>, state: tauri::State<'_, AppState>) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "create_tag_request; correlation_id={}; name={}", correlation_id, name);
    
    match meta_db.create_tag(&name, color.as_deref()) {
        Ok(tag_id) => {
            log::info!(target: "tags", "create_tag_success; correlation_id={}; tag_id={}", correlation_id, tag_id);
            Ok(tag_id)
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
    log::info!(target: "tags", "delete_tag_request; correlation_id={}; tag_id={}", correlation_id, tag_id);
    
    match meta_db.delete_tag(tag_id) {
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
async fn add_tag_to_photo(photo_path: String, tag_id: i32, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "add_tag_to_photo_request; correlation_id={}; photo_path={}; tag_id={}", correlation_id, photo_path, tag_id);
    
    match meta_db.add_tag_to_photo(&photo_path, tag_id) {
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
async fn remove_tag_from_photo(photo_path: String, tag_id: i32, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "tags", "remove_tag_from_photo_request; correlation_id={}; photo_path={}; tag_id={}", correlation_id, photo_path, tag_id);
    
    match meta_db.remove_tag_from_photo(&photo_path, tag_id) {
        Ok(removed) => {
            log::info!(target: "tags", "remove_tag_from_photo_success; correlation_id={}; removed={}", correlation_id, removed);
            Ok(removed)
        }
        Err(e) => {
            log::error!(target: "tags", "remove_tag_from_photo_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn get_tags_for_photo(photo_path: String, state: tauri::State<'_, AppState>) -> Result<Vec<(i32, String, Option<String>)>, String> {
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
async fn search_photos_by_tags(tag_ids: Vec<i32>, state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
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
async fn get_all_albums(state: tauri::State<'_, AppState>) -> Result<Vec<(i32, String, String, Option<String>, i32)>, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "get_all_albums_request; correlation_id={}", correlation_id);
    
    match meta_db.get_all_albums() {
        Ok(albums) => {
            log::info!(target: "albums", "get_all_albums_success; correlation_id={}; count={}", correlation_id, albums.len());
            Ok(albums)
        }
        Err(e) => {
            log::error!(target: "albums", "get_all_albums_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn create_album(name: String, description: String, state: tauri::State<'_, AppState>) -> Result<i32, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "create_album_request; correlation_id={}; name={}", correlation_id, name);
    
    match meta_db.create_album(&name, &description) {
        Ok(album_id) => {
            log::info!(target: "albums", "create_album_success; correlation_id={}; album_id={}", correlation_id, album_id);
            Ok(album_id)
        }
        Err(e) => {
            log::error!(target: "albums", "create_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn update_album(id: i32, name: String, description: String, cover_photo_path: Option<String>, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "update_album_request; correlation_id={}; id={}; name={}", correlation_id, id, name);
    
    match meta_db.update_album(id, &name, &description, cover_photo_path.as_deref()) {
        Ok(updated) => {
            log::info!(target: "albums", "update_album_success; correlation_id={}; updated={}", correlation_id, updated);
            Ok(updated)
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
    log::info!(target: "albums", "delete_album_request; correlation_id={}; id={}", correlation_id, id);
    
    match meta_db.delete_album(id) {
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
async fn add_photo_to_album(album_id: i32, photo_path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "add_photo_to_album_request; correlation_id={}; album_id={}; photo_path={}", correlation_id, album_id, photo_path);
    
    match meta_db.add_photo_to_album(album_id, &photo_path) {
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
async fn remove_photo_from_album(album_id: i32, photo_path: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let meta_db = &state.meta_db;
    let logging_service = &state.logging_service;
    
    let correlation_id = logging_service.generate_correlation_id();
    log::info!(target: "albums", "remove_photo_from_album_request; correlation_id={}; album_id={}; photo_path={}", correlation_id, album_id, photo_path);
    
    match meta_db.remove_photo_from_album(album_id, &photo_path) {
        Ok(removed) => {
            log::info!(target: "albums", "remove_photo_from_album_success; correlation_id={}; removed={}", correlation_id, removed);
            Ok(removed)
        }
        Err(e) => {
            log::error!(target: "albums", "remove_photo_from_album_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn get_album_photos(album_id: i32, state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
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
async fn reorder_album_photos(album_id: i32, photo_order: Vec<String>, state: tauri::State<'_, AppState>) -> Result<(), String> {
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
    eprintln!("Initializing job queue database...");
    if let Err(e) = sqlite_db.init_db() {
        eprintln!("Failed to initialize job queue database: {}", e);
        panic!("Failed to initialize job queue database: {}", e);
    }
    eprintln!("Job queue database initialized successfully");
    let job_queue_manager = job_queue_service::JobQueueManager::new(sqlite_db, c.copy_parallel as usize);
    
    // Initialize logging service
    let logging_service = logging_service::LoggingService::new()
        .expect("Failed to initialize logging service");
    
    // Clean up log files if logging is disabled
    if let Err(e) = logging_service.cleanup_log_files_if_disabled(c.logging_enabled) {
        eprintln!("Warning: Failed to cleanup log files: {}", e);
    }
    
    // Setup backend logging to file only if logging is enabled
    if c.logging_enabled {
        if let Err(e) = logging_service.setup_backend_logging() {
            eprintln!("Warning: Failed to setup backend logging: {}", e);
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
                    eprintln!("{:?}", e);
                }
            });
            
            // Start background job processing
            eprintln!("Starting background job processing...");
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let job_queue_manager = state.job_queue_manager.lock().unwrap();
            job_queue_manager.start_background_processing(app_handle);
            eprintln!("Background job processing started");
            
            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            search_photos,
            get_filter_options,
            get_dates,
            get_photos,
            get_photos_with_filter,
            get_recent_photos,
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
            save_css_style,
            get_css_style,
            get_download_dir,
            open_file_in_default_app,
            save_styled_copy_from_frontend,
            get_logs,
            submit_frontend_logs,
            set_logging_enabled,
            get_logging_status,
            get_all_tags,
            create_tag,
            delete_tag,
            add_tag_to_photo,
            remove_tag_from_photo,
            get_tags_for_photo,
            search_photos_by_tags,
            get_all_albums,
            create_album,
            update_album,
            delete_album,
            add_photo_to_album,
            remove_photo_from_album,
            get_album_photos,
            reorder_album_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
