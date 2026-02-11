use crate::entity::burst_group::BurstGroup;
use crate::entity::job_queue;
use crate::entity::photo::Photo;
use crate::repository::meta_db::sqlite::SQLite;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use uuid::Uuid;

/// Process recalculate grouping job - recalculates burst groups based on new threshold settings
pub(crate) fn process_recalculate_grouping_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(target: "recalculate_grouping", "job; status=starting; job_unit_id={}", job.job_unit_id);

    // Deserialize job data from target field
    let job_data_json = job
        .job
        .target.first()
        .ok_or_else(|| "No job data found in target field".to_string())?;

    let job_data: job_queue::RecalculateGroupingJob = serde_json::from_str(job_data_json)
        .map_err(|e| format!("Failed to deserialize job data: {}", e))?;

    log::info!(
        target: "recalculate_grouping",
        "job_params; threshold_seconds={}; min_group_size={}",
        job_data.threshold_seconds,
        job_data.min_group_size
    );

    // Get app state for database access
    let state = app_handle.state::<crate::AppState>();
    let meta_db = &state.meta_db;

    // Emit initial progress
    emit_progress(app_handle, &job.job_unit_id, "Starting recalculation...", 0);

    // Step 1: Get all manual groups to preserve them
    let manual_group_photos = meta_db.get_manual_group_photo_paths()?;
    log::info!(
        target: "recalculate_grouping",
        "preserve_manual; manual_photo_count={}",
        manual_group_photos.len()
    );
    emit_progress(app_handle, &job.job_unit_id, "Preserving manual groups...", 10);

    // Step 2: Clear all auto burst groups
    meta_db.clear_auto_burst_groups()?;
    log::debug!(target: "recalculate_grouping", "cleared_auto_groups");
    emit_progress(app_handle, &job.job_unit_id, "Cleared auto groups...", 20);

    // Step 3: Get all photos (excluding those in manual groups)
    let all_photos = meta_db.get_all_photos_for_grouping()?;
    let photos_to_group: Vec<Photo> = all_photos
        .into_iter()
        .filter(|p| !manual_group_photos.contains(&p.file.path))
        .collect();

    let total_photos = photos_to_group.len();
    log::info!(
        target: "recalculate_grouping",
        "photos_to_process; total={}",
        total_photos
    );
    emit_progress(
        app_handle,
        &job.job_unit_id,
        &format!("Processing {} photos...", total_photos),
        30,
    );

    // Step 4: Group photos by camera (make + model)
    let mut photos_by_camera: HashMap<String, Vec<&Photo>> = HashMap::new();
    for photo in &photos_to_group {
        let make = if photo.meta_data.make.is_empty() {
            "unknown"
        } else {
            &photo.meta_data.make
        };
        let model = if photo.meta_data.model.is_empty() {
            "unknown"
        } else {
            &photo.meta_data.model
        };
        let camera_key = format!("{}_{}", make, model);
        photos_by_camera.entry(camera_key).or_default().push(photo);
    }

    let camera_count = photos_by_camera.len();
    log::info!(
        target: "recalculate_grouping",
        "cameras_found; count={}",
        camera_count
    );

    // Step 5: For each camera, sort by time and group consecutive shots
    let threshold_ms = (job_data.threshold_seconds as i64) * 1000;
    let min_size = job_data.min_group_size as usize;
    let mut new_groups = 0u32;
    let mut processed_cameras = 0;

    for (camera_key, mut camera_photos) in photos_by_camera {
        // Sort by datetime
        camera_photos.sort_by(|a, b| {
            let a_time = &a.meta_data.date_time_original;
            let b_time = &b.meta_data.date_time_original;
            a_time.cmp(b_time)
        });

        // Group consecutive shots within threshold
        let mut current_group: Vec<&Photo> = Vec::new();
        let mut last_time_ms: Option<i64> = None;

        for photo in camera_photos {
            let photo_time_ms = photo.get_datetime_ms();

            let should_start_new_group = match (last_time_ms, photo_time_ms) {
                (Some(last), Some(current)) => (current - last).abs() > threshold_ms,
                _ => true, // Start new group if time is unknown
            };

            if should_start_new_group {
                // Save previous group if it meets minimum size
                if current_group.len() >= min_size {
                    let group_id = format!("auto_{}", Uuid::new_v4());
                    let group = BurstGroup::new_auto(group_id.clone());
                    meta_db.save_burst_group(&group)?;

                    for group_photo in &current_group {
                        meta_db.update_photo_burst_group(&group_photo.file.path, &group_id)?;
                    }
                    new_groups += 1;
                }
                current_group.clear();
            }

            current_group.push(photo);
            last_time_ms = photo_time_ms;
        }

        // Don't forget the last group
        if current_group.len() >= min_size {
            let group_id = format!("auto_{}", Uuid::new_v4());
            let group = BurstGroup::new_auto(group_id.clone());
            meta_db.save_burst_group(&group)?;

            for group_photo in &current_group {
                meta_db.update_photo_burst_group(&group_photo.file.path, &group_id)?;
            }
            new_groups += 1;
        }

        processed_cameras += 1;
        let progress = 30 + ((processed_cameras as f64 / camera_count as f64) * 60.0) as i32;
        emit_progress(
            app_handle,
            &job.job_unit_id,
            &format!("Processing camera {} of {}...", processed_cameras, camera_count),
            progress,
        );

        log::debug!(
            target: "recalculate_grouping",
            "camera_processed; camera={}; groups_so_far={}",
            camera_key,
            new_groups
        );
    }

    // Update progress to completion
    let job_id = job.id.unwrap_or(0);
    let total = job.job.target.len() as i64;
    let _ = db.update_job_progress(job_id, if total > 0 { total } else { 1 });

    // Emit completion
    emit_progress(
        app_handle,
        &job.job_unit_id,
        &format!("Created {} groups", new_groups),
        100,
    );

    // Emit specific event for grouping completion
    if let Err(e) = app_handle.emit("grouping_recalculate_complete", new_groups) {
        log::error!(target: "recalculate_grouping", "event_emit_error; error={}", e);
    }

    log::info!(
        target: "recalculate_grouping",
        "job_complete; new_groups={}",
        new_groups
    );

    Ok(())
}

fn emit_progress(app_handle: &tauri::AppHandle, job_unit_id: &str, message: &str, progress: i32) {
    if let Err(e) = app_handle.emit("grouping_progress", (job_unit_id, message, progress)) {
        log::error!(target: "recalculate_grouping", "progress_event_error; error={}", e);
    }
}
