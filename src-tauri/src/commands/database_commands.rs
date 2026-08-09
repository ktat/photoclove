use super::run_blocking;
use crate::app_state::AppState;
use crate::domain_service::photo_service;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::date;
use std::path::PathBuf;
use tauri::Emitter;

/// Bring each moved file's database row and thumbnail to its new location.
///
/// A failure here is logged and skipped rather than aborting: the files are
/// already moved, so stopping would leave the rest of them worse off than
/// finishing does.
fn follow_moved_files(state: &tauri::State<'_, AppState>, moved: &[crate::repository::MovedFile]) {
    for m in moved {
        match state.meta_db.relocate_photo(&m.from, &m.to, &m.to_date) {
            Ok(true) => {}
            Ok(false) => {
                log::warn!(target: "photo", "relocate_photo_no_row; from={}; to={}", m.from, m.to)
            }
            Err(e) => {
                log::error!(target: "photo", "relocate_photo_failed; from={}; to={}; error={}", m.from, m.to, e)
            }
        }

        let store = &state.config.thumbnail_store;
        let from = crate::entity::photo::thumbnail_path_in_store(store, &m.from);
        let to = crate::entity::photo::thumbnail_path_in_store(store, &m.to);
        // A photo with no thumbnail yet is normal, not an error.
        if !std::path::Path::new(&from).exists() {
            continue;
        }
        if let Some(parent) = std::path::Path::new(&to).parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                log::error!(target: "photo", "thumbnail_dir_failed; dir={}; error={}", parent.display(), e);
                continue;
            }
        }
        match std::fs::rename(&from, &to) {
            Ok(_) => log::info!(target: "photo", "thumbnail_moved; from={}; to={}", from, to),
            Err(e) => {
                log::error!(target: "photo", "thumbnail_move_failed; from={}; to={}; error={}", from, to, e)
            }
        }
    }
}

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
    // Date separator ("-" or "/") is auto-detected by Date::try_from_string.
    let date = date::Date::from_string(&date_str.to_string(), None);
    let _ = window.emit("move_files", "start");
    log::debug!(target: "photo", "move_photos_to_exif_date; target_date={:?}", date);
    // Videos are dated from the database, not re-probed: a container's
    // creation_time does not say which clock it came from, so trusting it
    // would move some clips a timezone offset into the wrong day.
    let stored_capture_times = state
        .meta_db
        .get_stored_capture_times(date)
        .unwrap_or_else(|e| {
            log::warn!(target: "photo", "stored_capture_times_failed; date={}; error={}", date, e);
            std::collections::HashMap::new()
        });
    let (dates, moved) = state
        .repo_db
        .move_photos_to_exif_date(date, stored_capture_times)
        .await;
    // Renaming the file is only half a move: the database row carries the
    // star, comment, tags and cloud-sync state, and the thumbnail is stored
    // under the same relative path. Left behind, the row points at a file that
    // is gone and the thumbnail is orphaned while the photo shows none.
    follow_moved_files(&state, &moved);
    log::debug!(target: "photo", "move_photos_completed; dates={:?}; moved={}", dates, moved.len());
    let _ = window.emit("move_files", "end_move");
    let meta_db = state.meta_db.clone();
    let result = run_blocking(move || {
        meta_db
            .record_photos_all_meta_data(dates)
            .map_err(|e| e.to_string())
    })
    .await;
    match result {
        Ok((ret, _inserted)) => {
            let _ = window.emit("move_files", "finish");
            Ok(serde_json::to_string(&ret).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(_) => {
            let _ = window.emit("move_files", "failed");
            Ok("false".to_string())
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
    let job_queue_manager = state.job_queue_manager.lock().map_err(|e| {
        log::error!(target: "database_commands", "lock_failed; error={}", e);
        "Failed to acquire job queue lock".to_string()
    })?;
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
    // Date separator ("-" or "/") is auto-detected by Date::try_from_string.
    let date = date::Date::from_string(&date_str.to_string(), None);
    let dates = date::Dates::new(&[date]);
    let meta_db = state.meta_db.clone();
    let result = run_blocking(move || {
        meta_db
            .record_photos_all_meta_data(dates)
            .map_err(|e| e.to_string())
    })
    .await;
    match result {
        Ok((ret, inserted)) => {
            // Report the actual outcome so the UI can show an honest message instead
            // of a blanket success: `inserted` = rows newly added, `total` = photos now
            // indexed for this date.
            let total: usize = ret.values().sum();
            log::info!(target: "database_commands", "create_db_in_date; status=finish; inserted={}; total={}", inserted, total);
            let _ = window.emit(
                "create_db",
                serde_json::json!({ "status": "finish", "inserted": inserted, "total": total }),
            );
            Ok(serde_json::to_string(&ret).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(_) => {
            let _ = window.emit("create_db", serde_json::json!({ "status": "failed" }));
            Ok("false".to_string())
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
    _date_str: &str,
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
        Some(&c.raw_processing),
    )
    .await
    {
        Ok(ret) => {
            let _ = window.emit("create_thumbnails", "finish");
            Ok(serde_json::to_string(&ret).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(_) => {
            let _ = window.emit("create_thumbnails", "failed");
            Ok("false".to_string())
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
    // Date separator ("-" or "/") is auto-detected by Date::try_from_string.
    let date = date::Date::from_string(&date_str.to_string(), None);
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
        Some(&c.raw_processing),
    )
    .await
    {
        Ok(ret) => {
            let _ = window.emit("create_thumbnails", "finish");
            Ok(serde_json::to_string(&ret).unwrap_or_else(|_| "{}".to_string()))
        }
        Err(_) => {
            let _ = window.emit("create_thumbnails", "failed");
            Ok("false".to_string())
        }
    }
}
