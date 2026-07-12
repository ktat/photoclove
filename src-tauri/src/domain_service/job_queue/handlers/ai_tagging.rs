//! AI Tagging Job Handler
//!
//! Processes AI auto-tagging jobs for photos.

use super::utils::{cleanup_kill_file, get_resume_start_index, log_resume_info, should_stop_job};
use crate::domain_service::ai_tagging::categories::AutoTagCategory;
use crate::domain_service::ai_tagging::service::{get_service, AITaggingConfig};
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::path::Path;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process AI tagging job - classifies photos and applies auto-tags
pub(crate) fn process_ai_tagging_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
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
        (&job.job_unit_id, "Initializing AI tagging", 0),
    ) {
        log::error!(
            target: "ai_tagging_job",
            "progress_event_error; error={}",
            e
        );
    }

    // Convert config categories from String to AutoTagCategory
    let enabled_categories = if config.ai_tagging.enabled_categories.is_empty() {
        None
    } else {
        Some(
            config
                .ai_tagging
                .enabled_categories
                .iter()
                .filter_map(|s| s.parse::<AutoTagCategory>().ok())
                .collect(),
        )
    };

    // Initialize the AI service with configuration from app state
    let service_config = AITaggingConfig {
        enabled: config.ai_tagging.enabled,
        auto_tag_on_import: config.ai_tagging.auto_tag_on_import,
        confidence_threshold: config.ai_tagging.confidence_threshold,
        max_tags_per_image: config.ai_tagging.max_tags_per_image as usize,
        enabled_categories,
        model_type: config.ai_tagging.model_type.clone(),
        custom_labels: config.ai_tagging.custom_labels.clone(),
        use_exif_thumbnail: config.ai_tagging.use_exif_thumbnail,
        min_thumbnail_size: config.ai_tagging.min_thumbnail_size,
    };

    // Get the global service and initialize if needed
    // Use unwrap_or_else to recover from poisoned lock (can happen if previous job panicked)
    let service = get_service();
    {
        let mut svc = service.lock().unwrap_or_else(|poisoned| {
            log::warn!(
                target: "ai_tagging_job",
                "recovering_poisoned_lock; status=recovered"
            );
            poisoned.into_inner()
        });

        svc.set_config(service_config);

        if !svc.is_ready() {
            log::info!(
                target: "ai_tagging_job",
                "service_init; status=initializing"
            );
            svc.initialize()?;
        }
    }

    let total_photos = job.job.target.len();
    let mut successful = 0;
    let mut failed = 0;
    let job_id = job.id.unwrap_or(0);

    // Calculate start index for resume functionality
    let start_index = get_resume_start_index(job);
    log_resume_info("ai_tagging_job", start_index, total_photos);

    for (index, photo_path) in job.job.target.iter().enumerate().skip(start_index) {
        // Check for stop signal
        if should_stop_job(job_id) {
            log::info!(target: "ai_tagging_job", "stopped; job_id={}; index={}", job_id, index);
            cleanup_kill_file(job_id);
            return Err("Job stopped by user".to_string());
        }

        log::debug!(
            target: "ai_tagging_job",
            "classifying; photo={}; progress={}/{}",
            photo_path,
            index + 1,
            total_photos
        );

        // Update progress in database and emit event (with last_processed_id for resume)
        let processed = (index + 1) as i64;
        let _ = db.update_job_progress_with_last_id(job_id, processed, index as i64);

        let progress = (index as f64 / total_photos as f64) * 100.0;
        if let Err(e) = app_handle.emit(
            "ai_tagging_progress",
            (
                &job.job_unit_id,
                format!("Processing {}/{}", index + 1, total_photos),
                progress,
            ),
        ) {
            log::error!(
                target: "ai_tagging_job",
                "progress_event_error; error={}",
                e
            );
        }

        // Tag the photo
        let result = {
            let svc = service.lock().unwrap_or_else(|poisoned| {
                log::warn!(
                    target: "ai_tagging_job",
                    "recovering_poisoned_lock_in_loop; status=recovered"
                );
                poisoned.into_inner()
            });
            svc.tag_photo(Path::new(photo_path))
        };

        if result.success {
            successful += 1;

            // Store tags in database
            for tag in &result.tags {
                // Get or create the collection for this AI tag
                let collection_id = match db.get_or_create_collection(&tag.tag_name, "tag") {
                    Ok(id) => id,
                    Err(e) => {
                        log::error!(
                            target: "ai_tagging_job",
                            "collection_error; tag={}; error={}",
                            tag.tag_name,
                            e
                        );
                        continue;
                    }
                };

                // Add photo to collection with confidence metadata
                let metadata = serde_json::json!({
                    "confidence": tag.confidence,
                    "model": tag.model,
                    "auto_generated": true
                });

                if let Err(e) = db.add_photo_to_collection_with_metadata(
                    collection_id,
                    photo_path,
                    Some(metadata.to_string()),
                ) {
                    log::error!(
                        target: "ai_tagging_job",
                        "add_photo_error; photo={}; collection={}; error={}",
                        photo_path,
                        tag.tag_name,
                        e
                    );
                }
            }

            log::debug!(
                target: "ai_tagging_job",
                "photo_tagged; path={}; tags={}",
                photo_path,
                result.tags.len()
            );
        } else {
            failed += 1;
            log::warn!(
                target: "ai_tagging_job",
                "photo_tagging_failed; path={}; error={}",
                photo_path,
                result.error.unwrap_or_else(|| "Unknown error".to_string())
            );
        }
    }

    log::info!(
        target: "ai_tagging_job",
        "execution; status=completed; total={}; successful={}; failed={}",
        total_photos,
        successful,
        failed
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

    // Emit event to refresh UI tags
    if let Err(e) = app_handle.emit("tags_updated", ()) {
        log::error!(
            target: "ai_tagging_job",
            "tags_event_error; error={}",
            e
        );
    }

    Ok(())
}
