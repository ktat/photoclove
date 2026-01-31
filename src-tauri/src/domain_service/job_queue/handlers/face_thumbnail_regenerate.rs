//! Face Thumbnail Regeneration Job Handler
//!
//! Regenerates face thumbnails for specified faces or all faces.

use super::utils::{cleanup_kill_file, get_resume_start_index, log_resume_info, should_stop_job};
use crate::domain_service::face_detection::BoundingBox;
use crate::domain_service::face_thumbnail_service;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process face thumbnail regeneration job
pub(crate) fn process_face_thumbnail_regenerate_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(
        target: "face_thumbnail_job",
        "execution; status=processing; targets={}",
        job.job.target.len()
    );

    let state = app_handle.state::<crate::AppState>();
    let thumbnail_store = &state.config.thumbnail_store;
    let thumbnail_size = state.config.face_detection.face_thumbnail_size;

    // If target is empty, regenerate all faces
    let face_ids: Vec<i64> = if job.job.target.is_empty() {
        // Get all face IDs from database
        db.get_all_face_ids()
            .map_err(|e| format!("Failed to get face IDs: {}", e))?
    } else {
        // Parse face IDs from target
        job.job
            .target
            .iter()
            .filter_map(|s| s.parse::<i64>().ok())
            .collect()
    };

    let total = face_ids.len();
    let mut successful = 0;
    let mut failed = 0;

    // Emit initial progress
    let _ = app_handle.emit(
        "face_thumbnail_progress",
        (&job.job_unit_id, format!("Processing 0/{}", total), 0.0),
    );

    let job_id = job.id.unwrap_or(0);

    // Calculate start index for resume functionality
    let start_index = get_resume_start_index(job);
    log_resume_info("face_thumbnail_job", start_index, total);

    for (idx, face_id) in face_ids.iter().enumerate().skip(start_index) {
        // Check for stop signal
        if should_stop_job(job_id) {
            log::info!(target: "face_thumbnail_job", "stopped; job_id={}; index={}", job_id, idx);
            cleanup_kill_file(job_id);
            return Err("Job stopped by user".to_string());
        }

        // Update progress in database and emit event every 10 faces or at the end (with last_processed_id for resume)
        if idx % 10 == 0 || idx == total - 1 {
            let processed = (idx + 1) as i64;
            let _ = db.update_job_progress_with_last_id(job_id, processed, idx as i64);

            let progress = (processed as f64 / total as f64) * 100.0;
            let _ = app_handle.emit(
                "face_thumbnail_progress",
                (
                    &job.job_unit_id,
                    format!("Processing {}/{}", processed, total),
                    progress,
                ),
            );
        }

        // Get face data
        match db.get_detected_face(*face_id) {
            Ok(face) => {
                let bbox = BoundingBox::new(
                    face.bbox_x,
                    face.bbox_y,
                    face.bbox_width,
                    face.bbox_height,
                );

                match face_thumbnail_service::generate_face_thumbnail_from_file(
                    &face.photo_path,
                    &bbox,
                    thumbnail_store,
                    *face_id,
                    thumbnail_size,
                ) {
                    Ok(_) => successful += 1,
                    Err(e) => {
                        failed += 1;
                        log::warn!(
                            target: "face_thumbnail_job",
                            "thumbnail_failed; face_id={}; error={}",
                            face_id,
                            e
                        );
                    }
                }
            }
            Err(e) => {
                failed += 1;
                log::warn!(
                    target: "face_thumbnail_job",
                    "face_not_found; face_id={}; error={}",
                    face_id,
                    e
                );
            }
        }
    }

    log::info!(
        target: "face_thumbnail_job",
        "execution; status=completed; total={}; successful={}; failed={}",
        total,
        successful,
        failed
    );

    // Emit completion
    let _ = app_handle.emit(
        "face_thumbnail_progress",
        (
            &job.job_unit_id,
            format!("Completed: {} generated, {} failed", successful, failed),
            100.0,
        ),
    );

    Ok(())
}
