use crate::app_state::AppState;
use crate::domain_service::photo_service;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::date;
use std::path::PathBuf;
use tauri::Emitter;

/// Move photos to directories organized by their EXIF date
///
/// This command extracts EXIF date information from photos and moves them
/// to date-based directory structures.
///
/// # Arguments
/// * `window` - Tauri window for emitting progress events
/// * `state` - Application state containing database and configuration
/// * `date_str` - Target date string (format: YYYY/MM/DD)
///
/// # Returns
/// * `Ok(String)` - JSON string with operation results
/// * `Err(())` - If date_str is empty
#[tauri::command]
pub async fn move_photos_to_exif_date(
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

/// Create or update database metadata for all photos via Job Queue
///
/// Submits a job to the job queue to record metadata for all photos.
/// This allows the operation to be tracked and managed through the job queue UI.
///
/// # Arguments
/// * `app_handle` - Tauri app handle for job processing
/// * `state` - Application state containing job queue manager
///
/// # Returns
/// * `Ok(String)` - Job unit ID for tracking progress
/// * `Err(String)` - Error message if job submission fails
#[tauri::command]
pub async fn create_db(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "database_commands", "create_db; status=submitting_job");

    log::debug!(target: "database_commands", "acquiring_lock; target=job_queue_manager");
    let job_queue_manager = state.job_queue_manager.lock().unwrap();
    log::debug!(target: "database_commands", "lock_acquired; action=submitting_job");

    job_queue_manager
        .submit_create_db_job(app_handle)
        .map_err(|e| {
            log::error!(target: "database_commands", "create_db; status=failed; error={}", e);
            e
        })
}

/// Create or update database metadata for photos in a specific date
///
/// Records metadata only for photos in the specified date directory.
///
/// # Arguments
/// * `window` - Tauri window for emitting progress events
/// * `state` - Application state containing database and configuration
/// * `date_str` - Target date string (format: YYYY/MM/DD)
///
/// # Returns
/// * `Ok(String)` - JSON string with operation results
/// * `Err(())` - If date_str is empty
#[tauri::command]
pub async fn create_db_in_date(
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

/// Create thumbnails for all photos
///
/// Generates thumbnail images for all photos in all date directories.
/// Uses configuration settings for thumbnail size, quality, and parallelism.
///
/// # Arguments
/// * `window` - Tauri window for emitting progress events
/// * `state` - Application state containing database and configuration
/// * `date_str` - Not used (kept for API compatibility)
///
/// # Returns
/// * `Ok(String)` - JSON string with operation results
/// * `Err(())` - On error
#[tauri::command]
pub async fn create_thumbnails(
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

/// Create thumbnails for photos in a specific date
///
/// Generates thumbnail images only for photos in the specified date directory.
/// Uses configuration settings for thumbnail size, quality, and parallelism.
///
/// # Arguments
/// * `window` - Tauri window for emitting progress events
/// * `state` - Application state containing database and configuration
/// * `date_str` - Target date string (format: YYYY/MM/DD)
///
/// # Returns
/// * `Ok(String)` - JSON string with operation results
/// * `Err(())` - If date_str is empty
#[tauri::command]
pub async fn create_thumbnails_in_date(
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
