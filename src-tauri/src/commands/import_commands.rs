use crate::app_state::AppState;
use crate::dir;
use crate::entity::importer;
use crate::value::*;
use std::{fs, path};
use tauri::Manager;

/// Show importer UI with photos from a directory
///
/// Displays photos available for import from a specific directory, with optional date filtering
/// and pagination support.
///
/// # Arguments
/// * `path_str` - Optional directory path to show photos from. If None, uses first export_from path from config
/// * `date_str` - Optional date filter in string format
/// * `_window` - Tauri window handle (unused)
/// * `page` - Page number for pagination
/// * `num` - Number of items per page
/// * `state` - Application state containing configuration
///
/// # Returns
/// JSON string representation of the Importer object containing photos to import
#[tauri::command]
pub fn show_importer(
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

/// Import photos into the PhotoClove library
///
/// Submits photo import jobs to the job queue for processing. Photos will be copied
/// to the library and metadata will be extracted.
///
/// # Arguments
/// * `window` - Tauri window handle for emitting progress events
/// * `files` - Vector of file paths to import
/// * `state` - Application state containing job queue manager
///
/// # Returns
/// * `Ok(String)` - Job unit ID for tracking import progress
/// * `Err(String)` - Error message if submission fails
#[tauri::command]
pub async fn import_photos(
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

/// Get current import progress
///
/// Returns the current state of photo imports, including number of photos processed,
/// success count, and error count.
///
/// # Arguments
/// * `state` - Application state containing import progress
///
/// # Returns
/// JSON string representation of ImportProgress
#[tauri::command]
pub fn get_import_progress(state: tauri::State<AppState>) -> String {
    let ip = &state.import_progress;
    _ = ip.lock().unwrap().get_import_progress();
    return serde_json::to_string(ip).unwrap();
}

/// Get progress for a specific job unit
///
/// Retrieves detailed progress information for a job unit, including total jobs,
/// completed jobs, and current status.
///
/// # Arguments
/// * `job_unit_id` - Unique identifier for the job unit
/// * `state` - Application state containing job queue manager
///
/// # Returns
/// * `Ok(String)` - JSON string representation of job progress
/// * `Err(String)` - Error message if job unit not found or error occurs
#[tauri::command]
pub async fn get_job_progress(
    job_unit_id: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_queue_manager = state.job_queue_manager.lock().unwrap();
    match job_queue_manager.get_job_progress(job_unit_id) {
        Ok(progress) => Ok(serde_json::to_string(&progress).unwrap()),
        Err(e) => Err(e),
    }
}

/// Get list of photos available for import under a directory
///
/// Scans a directory recursively to find all importable photo files, with optional
/// date filtering to only include photos after a specific date.
///
/// # Arguments
/// * `path_str` - Directory path to scan for photos
/// * `date_after_str` - Optional date filter (only include photos after this date)
/// * `_window` - Tauri window handle (unused)
/// * `_state` - Application state (unused)
///
/// # Returns
/// JSON string representation of file list found under the directory
#[tauri::command]
pub fn get_photos_to_import_under_directory(
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
