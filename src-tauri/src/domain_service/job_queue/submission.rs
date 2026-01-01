use super::executor::process_new_jobs;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;

/// Submit Google Photos upload jobs in batches
pub fn submit_google_photos_upload_jobs(
    db: Arc<SQLite>,
    max_concurrent: usize,
    photos: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    const GOOGLE_PHOTOS_BATCH_SIZE: usize = 50;

    log::info!(
        target: "google_photos",
        "submit_jobs; total_photos={}; batch_size={}",
        photos.len(),
        GOOGLE_PHOTOS_BATCH_SIZE
    );

    let total_chunks = (photos.len() + GOOGLE_PHOTOS_BATCH_SIZE - 1) / GOOGLE_PHOTOS_BATCH_SIZE;

    // Create single job unit for all Google Photos upload jobs
    let job_types = vec!["google_photos_upload".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    log::info!(
        target: "google_photos",
        "create_job_unit; job_unit_id={}; total_chunks={}; total_photos={}",
        job_unit_id,
        total_chunks,
        photos.len()
    );

    // Save job unit
    db.create_job_unit(&job_unit)?;

    // Create multiple jobs within the single job unit
    for (chunk_index, chunk) in photos.chunks(GOOGLE_PHOTOS_BATCH_SIZE).enumerate() {
        // Create Google Photos upload job data
        let job_data = job_queue::GooglePhotosUploadJob {
            photo_paths: chunk.to_vec(),
            album_id: None,
            chunk_index,
            total_chunks,
        };

        // Serialize job data to store in target field
        let job_data_json = serde_json::to_string(&job_data)
            .map_err(|e| format!("Failed to serialize job data: {}", e))?;

        // Create the job with serialized data in target field (using same job_unit_id)
        let upload_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::GooglePhotosUpload,
            vec![job_data_json], // Store serialized job data
        );

        // Queue the job
        let queued = job_queue::QueuedJob::new(job_unit_id.clone(), upload_job);
        let job_id = db.create_job(&queued)?;

        log::info!(
            target: "google_photos",
            "job_created; job_unit_id={}; job_id={}; batch={}/{}; photos_in_batch={}",
            job_unit_id,
            job_id,
            chunk_index + 1,
            total_chunks,
            chunk.len()
        );
    }

    // Start processing
    process_new_jobs(db, max_concurrent, app_handle);

    log::info!(
        target: "google_photos",
        "submit_complete; job_unit_id={}; jobs_created={}",
        job_unit_id,
        total_chunks
    );

    Ok(job_unit_id)
}

/// Submit import jobs - creates job unit and starts processing
pub fn submit_import_jobs(
    db: Arc<SQLite>,
    max_concurrent: usize,
    files: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!(target: "job_queue", "submit_import; files={}", files.len());

    // Create job unit - only list import initially, dependent jobs will be added later
    let job_types = vec!["import".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    log::info!(target: "job_queue", "job_unit_created; id={}", job_unit_id);

    // Save job unit
    db.create_job_unit(&job_unit)?;
    log::info!(target: "job_queue", "job_unit_saved; status=success");

    // Create only the import job initially
    // Thumbnail and create_db jobs will be created when import completes
    let import_job = job_queue::Job::new(job_unit_id.clone(), job_queue::JobType::Import, files);

    // Queue only the import job
    let import_queued = job_queue::QueuedJob::new(job_unit_id.clone(), import_job);
    let import_id = db.create_job(&import_queued)?;

    log::info!(target: "job_queue", "import_job_created; id={}", import_id);

    // Immediately start processing the newly submitted jobs
    log::info!(target: "job_queue", "import_job; status=starting_processing");
    process_new_jobs(db, max_concurrent, app_handle);

    Ok(job_unit_id)
}

/// Submit create database job for all photos
pub fn submit_create_db_job(
    db: Arc<SQLite>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!(target: "job_queue", "submit_create_db_job; status=starting");

    // Create job unit for create_db
    let job_types = vec!["create_db".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    log::info!(target: "job_queue", "create_db_job_unit; job_unit_id={}", job_unit_id);

    // Save job unit
    db.create_job_unit(&job_unit)?;
    log::info!(target: "job_queue", "create_db_job_unit; status=saved");

    // Create create_db job (empty target, will process all photos)
    let create_db_job = job_queue::Job::new(
        job_unit_id.clone(),
        job_queue::JobType::CreateDb,
        vec![], // Empty target - handler will process all photos
    );

    // Queue the create_db job
    let create_db_queued = job_queue::QueuedJob::new(job_unit_id.clone(), create_db_job);
    let create_db_id = db.create_job(&create_db_queued)?;

    log::info!(target: "job_queue", "create_db_job_created; id={}", create_db_id);

    // Immediately start processing the newly submitted job
    log::info!(target: "job_queue", "create_db_job; status=starting_processing");
    process_new_jobs(db, 1, app_handle); // Use 1 concurrent job for DB creation

    Ok(job_unit_id)
}
