//! Common helpers for job-related commands
//!
//! This module provides shared utilities for creating and running jobs
//! across different command modules (face detection, AI tagging, etc.)

use crate::domain_service::job_queue::executor::process_new_jobs;
use crate::entity::config::Config;
use crate::entity::job_queue::{Job, JobType, JobUnit, QueuedJob};
use crate::entity::photo::Photo;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::AppHandle;

/// Check if a file path is an image file
pub fn is_image_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".webp")
        || lower.ends_with(".heic")
        || lower.ends_with(".heif")
}

/// Filter photos to only include image files
pub fn filter_image_paths(photos: &[Photo]) -> Vec<String> {
    photos
        .iter()
        .filter(|p| is_image_file(&p.file.path))
        .map(|p| p.file.path.clone())
        .collect()
}

/// Result of creating and starting a job
#[derive(Debug)]
pub struct JobCreationResult {
    pub job_unit_id: String,
    pub job_id: i64,
    pub photo_count: usize,
}

impl JobCreationResult {
    /// Format as JSON response
    pub fn to_json(&self) -> String {
        format!(
            r#"{{"result": "started", "job_unit_id": "{}", "job_id": {}, "photo_count": {}}}"#,
            self.job_unit_id, self.job_id, self.photo_count
        )
    }
}

/// Create and start a job for processing images
///
/// # Arguments
/// * `meta_db` - Database for storing job info
/// * `job_type` - Type of job (AiTagging, FaceDetection, etc.)
/// * `image_paths` - List of image paths to process
/// * `app_handle` - Tauri app handle for triggering processing
/// * `correlation_id` - Correlation ID for logging
/// * `log_target` - Log target name (e.g., "ai_tagging", "face_detection")
///
/// # Returns
/// Result containing job creation info or error
pub fn create_and_start_job(
    meta_db: &SQLite,
    job_type: JobType,
    image_paths: Vec<String>,
    app_handle: AppHandle,
    correlation_id: &str,
    log_target: &str,
) -> Result<JobCreationResult, String> {
    let photo_count = image_paths.len();
    let job_type_str = format!("{:?}", job_type).to_lowercase();

    // Create job unit first (required for foreign key constraint)
    let job_types = vec![job_type_str.clone()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    meta_db
        .create_job_unit(&job_unit)
        .map_err(|e| format!("Failed to create job unit: {}", e))?;

    // Create job
    let job = Job::new(job_unit_id.clone(), job_type, image_paths);
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Add job to queue
    let job_id = meta_db
        .create_job(&queued_job)
        .map_err(|e| format!("Failed to create job: {}", e))?;

    log::info!(
        target: log_target,
        "job_created; correlation_id={}; job_id={}; job_unit_id={}; photos={}",
        correlation_id,
        job_id,
        job_unit_id,
        photo_count
    );

    // Trigger job processing with a new SQLite instance wrapped in Arc
    let config = Config::new();
    let db = Arc::new(SQLite::new(config.import_to.clone()));
    process_new_jobs(db, 1, app_handle);

    Ok(JobCreationResult {
        job_unit_id,
        job_id,
        photo_count,
    })
}

/// Normalize date format (convert YYYY/MM/DD to YYYY-MM-DD)
pub fn normalize_date(date: &str) -> String {
    date.replace('/', "-")
}

/// No photos response
pub const NO_PHOTOS_RESPONSE: &str = r#"{"result": "no_photos", "count": 0}"#;

/// No images response
pub const NO_IMAGES_RESPONSE: &str = r#"{"result": "no_images", "count": 0}"#;
