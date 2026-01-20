//! AI Tagging Job Handler
//!
//! Processes AI auto-tagging jobs for photos.

use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process AI tagging job - classifies photos and applies auto-tags
pub(crate) fn process_ai_tagging_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    _db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(
        target: "ai_tagging_job",
        "execution; status=processing; files={}",
        job.job.target.len()
    );

    // Get app state to access configuration
    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Check if AI tagging is enabled
    if !config.ai_tagging.enabled {
        log::info!(
            target: "ai_tagging_job",
            "execution; status=skipped; reason=disabled"
        );
        return Ok(());
    }

    // Emit progress event
    if let Err(e) = app_handle.emit(
        "ai_tagging_progress",
        (&job.job_unit_id, "Processing AI tagging", 0),
    ) {
        log::error!(
            target: "ai_tagging_job",
            "progress_event_error; error={}",
            e
        );
    }

    // TODO: Implement actual AI classification
    // 1. Initialize AI classifier (lazy load model)
    // 2. For each photo in job.job.target:
    //    a. Classify the image
    //    b. Create ai: prefixed tags in photo_collections
    //    c. Add photo to collection with confidence in metadata
    // 3. Emit progress updates

    let total_photos = job.job.target.len();
    for (index, photo_path) in job.job.target.iter().enumerate() {
        log::debug!(
            target: "ai_tagging_job",
            "classifying; photo={}; progress={}/{}",
            photo_path,
            index + 1,
            total_photos
        );

        // TODO: Call AITaggingService.tag_photo() here
        // For now, just log that we would process this photo

        // Emit progress
        let progress = ((index + 1) as f64 / total_photos as f64) * 100.0;
        if let Err(e) = app_handle.emit(
            "ai_tagging_progress",
            (&job.job_unit_id, format!("Processing {}/{}", index + 1, total_photos), progress),
        ) {
            log::error!(
                target: "ai_tagging_job",
                "progress_event_error; error={}",
                e
            );
        }
    }

    log::info!(
        target: "ai_tagging_job",
        "execution; status=completed; photos_processed={}",
        total_photos
    );

    // Emit final progress
    if let Err(e) = app_handle.emit(
        "ai_tagging_progress",
        (&job.job_unit_id, "AI tagging completed", 100.0),
    ) {
        log::error!(
            target: "ai_tagging_job",
            "progress_event_error; error={}",
            e
        );
    }

    Ok(())
}
