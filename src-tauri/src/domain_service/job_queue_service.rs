use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::MetaInfoDB;
use crate::value::file;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{Emitter, Manager};
use sha2::{Sha256, Digest};
use regex::Regex;
use chrono::{self, Datelike};
use serde_json;

pub struct JobQueueManager {
    db: Arc<SQLite>,
    is_running: Arc<Mutex<bool>>,
    max_concurrent_jobs: usize,
}

impl JobQueueManager {
    pub fn new(db: SQLite, max_concurrent_jobs: usize) -> Self {
        JobQueueManager {
            db: Arc::new(db),
            is_running: Arc::new(Mutex::new(false)),
            max_concurrent_jobs,
        }
    }

    pub fn start_background_processing(&self, app_handle: tauri::AppHandle) {
        let is_running = Arc::clone(&self.is_running);

        {
            let mut running = is_running.lock().unwrap();
            if *running {
                return; // Already running
            }
            *running = true;
        }

        log::info!(target: "job_queue", "startup; status=starting");
        
        // 1. At startup: Reset any running jobs to pending (they were interrupted)
        log::info!(target: "job_queue", "startup; status=resetting_interrupted_jobs");
        if let Err(e) = self.reset_running_jobs_to_pending() {
            log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
        }
        
        // 2. At startup: Process any existing pending jobs once
        log::info!(target: "job_queue", "startup; status=processing_pending_jobs");
        self.process_startup_jobs(app_handle.clone());
        
        log::info!(target: "job_queue", "startup; status=complete");
        log::info!(target: "job_queue", "startup; status=ready_for_jobs");
    }

    pub fn stop_background_processing(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
    }

    // Reset any jobs that were "running" to "pending" (they were interrupted by app shutdown)
    fn reset_running_jobs_to_pending(&self) -> Result<(), String> {
        log::info!(target: "job_queue", "reset_jobs; status=checking");
        match self.db.reset_running_jobs_to_pending() {
            Ok(count) => {
                if count > 0 {
                    log::info!(target: "job_queue", "reset_jobs; status=reset; count={}", count);
                } else {
                    log::info!(target: "job_queue", "reset_jobs; status=none_found");
                }
                Ok(())
            }
            Err(e) => {
                log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
                Err(e)
            }
        }
    }
    
    // Process existing pending jobs at startup (one-time operation)
    fn process_startup_jobs(&self, app_handle: tauri::AppHandle) {
        let db = Arc::clone(&self.db);
        let max_concurrent = self.max_concurrent_jobs;
        
        log::info!(target: "job_queue", "startup_jobs; status=checking");
        match db.get_pending_jobs() {
            Ok(pending_jobs) => {
                if pending_jobs.is_empty() {
                    log::info!(target: "job_queue", "startup_jobs; status=none_found");
                    return;
                }
                
                log::info!(target: "job_queue", "startup_jobs; status=found; count={}", pending_jobs.len());
                for (idx, job) in pending_jobs.iter().enumerate() {
                    log::info!(target: "job_queue", "startup_job_info; index={}; job_id={:?}; job_type={:?}; unit_id={}; files={}", 
                        idx + 1, job.id, job.job.job_type, job.job_unit_id, job.job.target.len());
                }
                
                // Process jobs in batches up to max_concurrent
                let batch_size = std::cmp::min(pending_jobs.len(), max_concurrent);
                let mut handles = Vec::new();
                
                for job in pending_jobs.into_iter().take(batch_size) {
                    let db_clone = Arc::clone(&db);
                    let app_handle_clone = app_handle.clone();
                    
                    let handle = thread::spawn(move || {
                        Self::process_job(db_clone, job, app_handle_clone)
                    });
                    handles.push(handle);
                }
                
                // Wait for all startup jobs to complete
                for handle in handles {
                    if let Err(e) = handle.join() {
                        log::error!(target: "job_queue", "startup_job_error; error={:?}", e);
                    }
                }
                
                log::info!(target: "job_queue", "startup_jobs; status=complete");
            }
            Err(e) => {
                log::error!(target: "job_queue", "startup_jobs_error; error={}", e);
            }
        }
        
        // Cleanup completed jobs after startup processing
        if let Err(e) = db.cleanup_completed_jobs() {
            log::error!(target: "job_queue", "cleanup_error; error={}", e);
        }
    }
    
    // Process new jobs when they are submitted (called from submit_import_jobs)
    pub fn process_new_jobs(&self, app_handle: tauri::AppHandle) {
        let db = Arc::clone(&self.db);
        let max_concurrent = self.max_concurrent_jobs;
        
        thread::spawn(move || {
            log::info!(target: "job_queue", "new_jobs; status=processing");
            match db.get_pending_jobs() {
                Ok(pending_jobs) => {
                    if pending_jobs.is_empty() {
                        log::info!(target: "job_queue", "new_jobs; status=none_found");
                        return;
                    }
                    
                    log::info!(target: "job_queue", "new_jobs; status=found; count={}", pending_jobs.len());
                    
                    // Separate Google Photos jobs from other jobs
                    let (google_photos_jobs, other_jobs): (Vec<_>, Vec<_>) = pending_jobs.into_iter()
                        .partition(|job| job.job.job_type == job_queue::JobType::GooglePhotosUpload);
                    
                    // Process Google Photos jobs sequentially first
                    if !google_photos_jobs.is_empty() {
                        log::info!(target: "job_queue", "google_photos_jobs; status=processing_sequential; count={}", google_photos_jobs.len());
                        for job in google_photos_jobs {
                            let db_clone = Arc::clone(&db);
                            let app_handle_clone = app_handle.clone();
                            Self::process_job(db_clone, job, app_handle_clone);
                        }
                    }
                    
                    // Process other jobs in batches up to max_concurrent
                    if !other_jobs.is_empty() {
                        let batch_size = std::cmp::min(other_jobs.len(), max_concurrent);
                        let mut handles = Vec::new();
                        
                        for job in other_jobs.into_iter().take(batch_size) {
                            let db_clone = Arc::clone(&db);
                        let app_handle_clone = app_handle.clone();
                        
                        let handle = thread::spawn(move || {
                            Self::process_job(db_clone, job, app_handle_clone)
                        });
                        handles.push(handle);
                    }
                    
                        // Wait for all jobs in this batch to complete
                        for handle in handles {
                            if let Err(e) = handle.join() {
                                log::error!(target: "job_queue", "job_thread_error; error={:?}", e);
                            }
                        }
                    }
                    
                    // Cleanup completed jobs after processing
                    if let Err(e) = db.cleanup_completed_jobs() {
                        log::error!(target: "job_queue", "cleanup_error; error={}", e);
                    }
                    
                    log::info!(target: "job_queue", "new_jobs; status=complete");
                }
                Err(e) => {
                    log::error!(target: "job_queue", "new_jobs_error; error={}", e);
                }
            }
        });
    }

    pub fn submit_google_photos_upload_jobs(
        &self,
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
        self.db.create_job_unit(&job_unit)?;
        
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
            let job_id = self.db.create_job(&queued)?;
            
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
        self.process_new_jobs(app_handle);
        
        log::info!(
            target: "google_photos", 
            "submit_complete; job_unit_id={}; jobs_created={}", 
            job_unit_id,
            total_chunks
        );
        
        Ok(job_unit_id)
    }

    pub fn submit_import_jobs(&self, files: Vec<String>, app_handle: tauri::AppHandle) -> Result<String, String> {
        log::info!(target: "job_queue", "submit_import; files={}", files.len());
        
        // Create job unit - only list import initially, dependent jobs will be added later
        let job_types = vec!["import".to_string()];
        let job_unit = job_queue::JobUnit::new(job_types);
        let job_unit_id = job_unit.id.clone();
        
        log::info!(target: "job_queue", "job_unit_created; id={}", job_unit_id);

        // Save job unit
        self.db.create_job_unit(&job_unit)?;
        log::info!(target: "job_queue", "job_unit_saved; status=success");

        // Create only the import job initially
        // Thumbnail and create_db jobs will be created when import completes
        let import_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::Import,
            files,
        );

        // Queue only the import job
        let import_queued = job_queue::QueuedJob::new(job_unit_id.clone(), import_job);
        let import_id = self.db.create_job(&import_queued)?;
        
        log::info!(target: "job_queue", "import_job_created; id={}", import_id);

        // Immediately start processing the newly submitted jobs
        log::info!(target: "job_queue", "import_job; status=starting_processing");
        self.process_new_jobs(app_handle);

        Ok(job_unit_id)
    }

    pub fn get_job_progress(&self, job_unit_id: &str) -> Result<job_queue::JobProgress, String> {
        self.db.get_job_unit_progress(job_unit_id)
    }

    // Helper method to create dependent jobs after import completes
    fn create_dependent_jobs(db: &Arc<SQLite>, job_unit_id: &str, imported_files: Vec<String>, app_handle: &tauri::AppHandle) -> Result<(), String> {
        log::info!(target: "job_queue", "dependent_jobs; status=creating; job_unit_id={}", job_unit_id);
        log::info!(target: "job_queue", "dependent_jobs; imported_files={}", imported_files.len());
        
        if imported_files.is_empty() {
            log::info!(target: "job_queue", "dependent_jobs; status=skipped; reason=no_imported_files");
            return Ok(());
        }
        
        // Create thumbnail job with destination file paths
        let thumbnail_job = job_queue::Job::new(
            job_unit_id.to_string(),
            job_queue::JobType::Thumbnail,
            imported_files.clone(),
        );
        
        // Create create_db job with destination file paths  
        let create_db_job = job_queue::Job::new(
            job_unit_id.to_string(),
            job_queue::JobType::CreateDb,
            imported_files,
        );

        // Queue the dependent jobs
        let thumbnail_queued = job_queue::QueuedJob::new(job_unit_id.to_string(), thumbnail_job);
        let create_db_queued = job_queue::QueuedJob::new(job_unit_id.to_string(), create_db_job);

        let thumbnail_id = db.create_job(&thumbnail_queued)?;
        let create_db_id = db.create_job(&create_db_queued)?;
        
        log::info!(target: "job_queue", "dependent_jobs; status=created; thumbnail_id={}; create_db_id={}", thumbnail_id, create_db_id);

        // Immediately process the newly created dependent jobs in order
        log::info!(target: "job_queue", "dependent_jobs; status=starting_processing");
        let job_ids = vec![thumbnail_id, create_db_id]; // Process thumbnail first, then create_db
        Self::process_specific_jobs_immediately(db.clone(), job_ids, app_handle.clone());

        Ok(())
    }

    // Static method to immediately process specific jobs (used for dependent jobs)
    fn process_specific_jobs_immediately(db: Arc<SQLite>, job_ids: Vec<i64>, app_handle: tauri::AppHandle) {
        thread::spawn(move || {
            log::info!(target: "job_queue", "specific_jobs; status=processing; job_ids={:?}", job_ids);
            
            // Get all pending jobs and filter for the specific job IDs
            match db.get_pending_jobs() {
                Ok(pending_jobs) => {
                    // Filter and sort jobs by the specified job_ids to maintain order
                    let mut jobs_to_process = Vec::new();
                    for job_id in &job_ids {
                        if let Some(job) = pending_jobs.iter().find(|j| j.id == Some(*job_id)) {
                            jobs_to_process.push(job.clone());
                        }
                    }
                    
                    if jobs_to_process.is_empty() {
                        log::info!(target: "job_queue", "specific_jobs; status=none_found");
                        return;
                    }
                    
                    log::info!(target: "job_queue", "specific_jobs; status=found; count={}", jobs_to_process.len());
                    
                    // Process each dependent job sequentially to maintain order
                    for job in jobs_to_process {
                        log::info!(target: "job_queue", "dependent_job; job_id={:?}; job_type={:?}", job.id, job.job.job_type);
                        let db_clone = Arc::clone(&db);
                        let app_handle_clone = app_handle.clone();
                        
                        // Process job in the same thread to maintain order (thumbnail before create_db)
                        Self::process_job(db_clone, job, app_handle_clone);
                    }
                    
                    // Cleanup completed jobs after processing
                    if let Err(e) = db.cleanup_completed_jobs() {
                        log::error!(target: "job_queue", "dependent_jobs_cleanup_error; error={}", e);
                    }
                    
                    log::info!(target: "job_queue", "dependent_jobs; status=complete");
                }
                Err(e) => {
                    log::error!(target: "job_queue", "dependent_jobs_error; error={}", e);
                }
            }
        });
    }

    fn process_job(db: Arc<SQLite>, job: job_queue::QueuedJob, app_handle: tauri::AppHandle) {
        let job_id = job.id.unwrap();
        log::info!(target: "job_queue", "job_processing; status=starting; job_id={}", job_id);
        log::info!(target: "job_queue", "job_info; job_id={}", job_id);
        log::info!(target: "job_queue", "job_info; job_type={:?}", job.job.job_type);
        log::info!(target: "job_queue", "job_info; job_unit_id={}", job.job_unit_id);
        log::info!(target: "job_queue", "job_info; target_files={}", job.job.target.len());
        for (i, target) in job.job.target.iter().enumerate() {
            log::debug!(target: "job_queue", "job_target; index={}; file={}", i + 1, target);
        }
        log::info!(target: "job_queue", "job_info; status=complete");

        // Mark job as running
        log::info!(target: "job_queue", "job_status_update; job_id={}; status=running", job_id);
        if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Running, None) {
            log::error!(target: "job_queue", "job_status_error; job_id={}; error={}", job_id, e);
            return;
        }
        log::info!(target: "job_queue", "job_status_update; job_id={}; status=running; result=success", job_id);

        // Process the job based on type
        log::info!(target: "job_queue", "job_execution; job_id={}; job_type={:?}; status=starting", job_id, job.job.job_type);
        let result = match job.job.job_type {
            job_queue::JobType::Import => {
                log::info!(target: "job_queue", "import_job; job_id={}; status=calling_process", job_id);
                match Self::process_import_job(&job, &app_handle) {
                    Ok(imported_files) => {
                        // Create dependent jobs when import completes successfully
                        if let Err(e) = Self::create_dependent_jobs(&db, &job.job_unit_id, imported_files, &app_handle) {
                            log::error!(target: "job_queue", "dependent_jobs_error; job_id={}; error={}", job_id, e);
                        }
                        Ok(())
                    },
                    Err(e) => Err(e),
                }
            },
            job_queue::JobType::Thumbnail => {
                log::info!(target: "job_queue", "thumbnail_job; job_id={}; status=calling_process", job_id);
                Self::process_thumbnail_job(&job, &app_handle).map(|_| ())
            },
            job_queue::JobType::CreateDb => {
                log::info!(target: "job_queue", "create_db_job; job_id={}; status=calling_process", job_id);
                Self::process_create_db_job(&job, &app_handle).map(|_| ())
            },
            job_queue::JobType::GooglePhotosUpload => {
                log::info!(target: "job_queue", "google_photos_job; job_id={}; status=calling_process", job_id);
                // Note: This will need to be awaited, but current architecture doesn't support async job processing
                // For now, we'll use a blocking runtime
                tokio::runtime::Runtime::new().unwrap().block_on(
                    Self::process_google_photos_upload_job(&job, &app_handle, &db)
                )
            },
        };
        
        log::info!(target: "job_queue", "job_execution; job_id={}; status=completed; success={}", job_id, result.is_ok());

        // Update job status based on result
        match result {
            Ok(_) => {
                if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Completed, None) {
                    log::error!(target: "job_queue", "job_status_error; job_id={}; target_status=completed; error={}", job_id, e);
                }
                log::info!(target: "job_queue", "job_completed; job_id={}", job_id);
                
                // Check if all jobs in the job unit are completed and update job unit status
                if let Err(e) = db.update_job_unit_status_if_complete(&job.job_unit_id) {
                    log::error!(target: "job_queue", "job_unit_status_error; job_id={}; error={}", job_id, e);
                }
                
                // Check if the entire job unit is now complete
                match db.get_job_unit_progress(&job.job_unit_id) {
                    Ok(progress) => {
                        log::info!(target: "job_queue", "job_unit_progress; job_unit_id={}; completed={}; total={}", job.job_unit_id, progress.completed_jobs, progress.total_jobs);
                        
                        // Emit individual job completion event
                        if let Err(e) = app_handle.emit("job_completed", &job.job_unit_id) {
                            log::error!(target: "job_queue", "event_emit_error; event=job_completed; error={}", e);
                        }
                        
                        // If all jobs are complete, emit legacy import completion events
                        if progress.completed_jobs >= progress.total_jobs {
                            log::info!(target: "job_queue", "all_jobs_complete; job_unit_id={}; status=emitting_events", job.job_unit_id);
                            Self::emit_import_completion_events(&app_handle, &job.job_unit_id, &db);
                        }
                    }
                    Err(e) => {
                        log::error!(target: "job_queue", "job_unit_progress_error; job_unit_id={}; error={}", job.job_unit_id, e);
                        // Still emit job completed event
                        if let Err(e) = app_handle.emit("job_completed", &job.job_unit_id) {
                            log::error!(target: "job_queue", "event_emit_error; event=job_completed; error={}", e);
                        }
                    }
                }
            }
            Err(error_msg) => {
                if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Failed, Some(error_msg.clone())) {
                    log::error!(target: "job_queue", "job_status_error; job_id={}; target_status=failed; error={}", job_id, e);
                }
                log::error!(target: "job_queue", "job_failed; job_id={}; error={}", job_id, error_msg);
                
                // Emit error event
                if let Err(e) = app_handle.emit("job_failed", (&job.job_unit_id, &error_msg)) {
                    log::error!(target: "job_queue", "event_emit_error; event=job_failed; error={}", e);
                }
            }
        }
    }

    fn process_import_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<Vec<String>, String> {
        log::info!(target: "import_job", "execution; status=starting");
        log::info!(target: "import_job", "execution; files={}", job.job.target.len());
        
        // Get app state to access configuration
        log::info!(target: "import_job", "config; status=loading");
        let state = app_handle.state::<crate::AppState>();
        let config = &state.config;
        let destination_dir = &config.import_to;
        let trash_path = std::path::Path::new(&config.trash_path);
        
        log::info!(target: "import_job", "config; status=loaded");
        log::info!(target: "import_job", "config; destination_dir={}", destination_dir);
        log::info!(target: "import_job", "config; trash_path={}", config.trash_path);
        
        // Emit progress event
        log::info!(target: "import_job", "progress_event; status=emitting");
        if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, "Processing import job", 0)) {
            log::error!(target: "import_job", "progress_event_error; error={}", e);
        } else {
            log::info!(target: "import_job", "progress_event; status=success");
        }
        
        let mut imported_photos = Vec::new();
        let mut imported_file_paths = Vec::new();
        log::info!(target: "import_job", "file_processing; status=starting; files={}", job.job.target.len());
        
        for (i, file_path) in job.job.target.iter().enumerate() {
            // Processing section separator
            log::info!(target: "import_job", "file_processing; index={}; total={}; file={}", i + 1, job.job.target.len(), file_path);
            log::debug!(target: "import_job", "file_info; source={}", file_path);
            
            // Create file and photo objects
            log::debug!(target: "import_job", "file_objects; status=creating");
            let source_file = file::File::new(file_path.clone());
            let mut photo = crate::entity::photo::Photo::new(source_file.clone(), Some(config.clone()));
            log::debug!(target: "import_job", "exif; status=loading");
            photo.load_exif();
            log::debug!(target: "import_job", "exif; status=loaded");
            
            // Get or create UUID for the source directory
            let source_dir = std::path::Path::new(file_path).parent()
                .ok_or_else(|| format!("Cannot get parent directory for: {}", file_path))?;
            log::debug!(target: "import_job", "source_dir; path={}", source_dir.display());
            
            log::debug!(target: "import_job", "uuid; status=getting_or_creating");
            let uuid = Self::get_or_create_source_uuid(source_dir)
                .map_err(|e| format!("Failed to get UUID for source directory: {}", e))?;
            log::debug!(target: "import_job", "uuid; value={}", uuid);
            
            // Determine destination date directory using the same logic as original importer
            log::debug!(target: "import_job", "date; status=determining");
            log::debug!(target: "import_job", "date; photo_time={}", photo.time());
            
            // Use the same approach as original importer: photo.created_date()
            let date = if !photo.time().is_empty() {
                log::debug!(target: "import_job", "date; method=photo_created_date");
                let created_date = photo.created_date();
                log::debug!(target: "import_job", "date; created_date={}-{:02}-{:02}", created_date.year, created_date.month, created_date.day);
                created_date
            } else {
                log::debug!(target: "import_job", "date; method=filename_extraction; reason=empty_photo_time");
                // Try to extract date from filename (like IMG_20250710_190245626.jpg)
                let filename = std::path::Path::new(file_path).file_name()
                    .ok_or_else(|| format!("Cannot get filename from: {}", file_path))?
                    .to_string_lossy();
                
                log::debug!(target: "import_job", "date; filename_analysis={}", filename);
                
                // Pattern for filenames like IMG_20250710_xxxxxx.jpg
                if let Some(captures) = Regex::new(r"(\d{4})(\d{2})(\d{2})")
                    .unwrap()
                    .captures(&filename) {
                    let year = captures.get(1).unwrap().as_str().parse::<i32>().unwrap();
                    let month = captures.get(2).unwrap().as_str().parse::<u32>().unwrap();
                    let day = captures.get(3).unwrap().as_str().parse::<u32>().unwrap();
                    
                    if let Some(date) = crate::value::date::Date::new(year, month, day) {
                        log::debug!(target: "import_job", "date; filename_extracted={}-{:02}-{:02}", year, month, day);
                        date
                    } else {
                        return Err(format!("Invalid date extracted from filename: {}-{:02}-{:02}", year, month, day));
                    }
                } else {
                    log::debug!(target: "import_job", "date; method=file_modification_time; reason=no_filename_pattern");
                    // Use file modification time as fallback for files without date information
                    let metadata = std::fs::metadata(file_path)
                        .map_err(|e| format!("Cannot get file metadata: {}", e))?;
                    let modified = metadata.modified()
                        .map_err(|e| format!("Cannot get file modification time: {}", e))?;
                    let datetime = chrono::DateTime::<chrono::Utc>::from(modified);
                    
                    if let Some(date) = crate::value::date::Date::new(datetime.year(), datetime.month(), datetime.day()) {
                        log::debug!(target: "import_job", "date; modification_time={}-{:02}-{:02}", datetime.year(), datetime.month(), datetime.day());
                        date
                    } else {
                        return Err(format!("Failed to create date from file modification time"));
                    }
                }
            };
            
            log::debug!(target: "import_job", "date; final_date={}", date.to_string());
            
            let filename = std::path::Path::new(file_path).file_name()
                .ok_or_else(|| format!("Cannot get filename from: {}", file_path))?
                .to_string_lossy();
            log::debug!(target: "import_job", "file_info; filename={}", filename);
            
            // Build destination path: [destination_dir]/[YYYY-MM-DD]/[UUID]/[filename]
            let destination_date_dir = std::path::Path::new(destination_dir).join(date.to_string());
            let destination_uuid_dir = destination_date_dir.join(&uuid);
            let destination_path = destination_uuid_dir.join(filename.as_ref());
            
            log::debug!(target: "import_job", "destination; path={}", destination_path.display());
            
            // Skip if source and destination are the same
            if file_path == &destination_path.display().to_string() {
                log::info!(target: "import_job", "file_skip; reason=same_path; file={}", file_path);
                continue;
            }
            
            // Skip if file exists in trash
            let trash_file_path = trash_path.join(destination_path.strip_prefix("/").unwrap_or(&destination_path));
            log::debug!(target: "import_job", "trash_check; path={}", trash_file_path.display());
            if trash_file_path.exists() {
                log::info!(target: "import_job", "file_skip; reason=in_trash; file={}", file_path);
                continue;
            }
            
            // Create destination directories
            log::debug!(target: "import_job", "directory_creation; path={}", destination_uuid_dir.display());
            if let Err(e) = std::fs::create_dir_all(&destination_uuid_dir) {
                let error_msg = format!("Failed to create destination directory {}: {}", destination_uuid_dir.display(), e);
                log::error!(target: "import_job", "processing_error; error={}", error_msg);
                return Err(error_msg);
            }
            log::debug!(target: "import_job", "directory_creation; status=success");
            
            // Copy the file with timestamp preservation
            log::debug!(target: "import_job", "file_copy; status=starting");
            log::debug!(target: "import_job", "file_copy; from={}", file_path);
            log::debug!(target: "import_job", "file_copy; to={}", destination_path.display());
            
            match Self::copy_file_with_timestamp(file_path, &destination_path.display().to_string()) {
                Ok(bytes_copied) => {
                    log::info!(target: "import_job", "file_copy; status=success; bytes={}", bytes_copied);
                    log::debug!(target: "import_job", "file_copy; source={}", file_path);
                    log::debug!(target: "import_job", "file_copy; destination={}", destination_path.display());
                    
                    // Add destination path to imported files list
                    let destination_path_str = destination_path.display().to_string();
                    imported_file_paths.push(destination_path_str.clone());
                    log::debug!(target: "import_job", "imported_files; added={}", destination_path_str);
                    
                    // Create photo object for the copied file
                    log::debug!(target: "import_job", "photo_object; status=creating");
                    let destination_file = file::File::new(destination_path_str);
                    let mut destination_photo = crate::entity::photo::Photo::new(destination_file, Some(config.clone()));
                    destination_photo.embed_exif(photo.meta_data);
                    imported_photos.push(destination_photo);
                    log::debug!(target: "import_job", "photo_object; status=created_and_added");
                }
                Err(e) => {
                    let error_msg = format!("Failed to copy file {}: {}", file_path, e);
                    log::error!(target: "import_job", "processing_error; error={}", error_msg);
                    return Err(error_msg);
                }
            }
            
            // Emit progress
            let progress = ((i + 1) as f64 / job.job.target.len() as f64) * 100.0;
            if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, file_path, progress)) {
                log::error!(target: "import_job", "progress_event_error; error={}", e);
            }
        }
        
        // Record metadata for imported photos
        // Processing section separator
        log::info!(target: "import_job", "metadata; status=starting");
        if !imported_photos.is_empty() {
            log::info!(target: "import_job", "metadata; status=recording; photos={}", imported_photos.len());
            let meta_db = &state.meta_db;
            if let Err(e) = meta_db.record_photos_meta_data(imported_photos.clone()) {
                let error_msg = format!("Failed to record photo metadata: {:?}", e);
                log::error!(target: "import_job", "processing_error; error={}", error_msg);
                return Err(error_msg);
            }
            log::info!(target: "import_job", "metadata; status=success; photos={}", imported_photos.len());
        } else {
            log::info!(target: "import_job", "metadata; status=skipped; reason=no_photos");
        }
        
        log::info!(target: "import_job", "execution; status=completed_successfully");
        log::info!(target: "import_job", "execution; imported_files={}", imported_file_paths.len());
        Ok(imported_file_paths)
    }

    fn process_thumbnail_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        log::info!(target: "thumbnail_job", "execution; status=processing; files={}", job.job.target.len());
        
        // Get app state to access configuration
        let state = app_handle.state::<crate::AppState>();
        let config = &state.config;
        
        // Emit progress event
        if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, "Processing thumbnails", 0)) {
            log::error!(target: "thumbnail_job", "progress_event_error; error={}", e);
        }
        
        // Extract unique dates from the imported file paths
        // The imported files have destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
        let mut dates_set = std::collections::HashSet::new();
        
        for file_path in &job.job.target {
            let path = std::path::Path::new(file_path);
            
            // Extract date from destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
            if let Some(parent) = path.parent() {
                if let Some(_uuid_dir) = parent.file_name() {
                    if let Some(date_dir) = parent.parent() {
                        if let Some(date_str) = date_dir.file_name() {
                            let date_string = date_str.to_string_lossy().to_string();
                            if Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap().is_match(&date_string) {
                                log::debug!(target: "thumbnail_job", "date_extraction; date={}", date_string);
                                dates_set.insert(date_string);
                            }
                        }
                    }
                }
            }
        }
        
        if dates_set.is_empty() {
            log::warn!(target: "thumbnail_job", "date_extraction; status=no_valid_dates");
            return Ok(());
        }
        
        // Convert to date objects
        let mut dates = Vec::new();
        for date_str in dates_set {
            log::debug!(target: "thumbnail_job", "date_processing; date={}", date_str);
            let date = crate::value::date::Date::from_string(&date_str, Some("-"));
            dates.push(date);
        }
        
        let dates_obj = crate::value::date::Dates::new(&dates);
        
        // Create thumbnails using the existing photo service
        let origin = std::path::PathBuf::from(&config.import_to);
        let dest = std::path::PathBuf::from(&config.thumbnail_store);
        
        log::info!(target: "thumbnail_job", "thumbnail_creation; dates={}", dates.len());
        log::debug!(target: "thumbnail_job", "thumbnail_paths; origin={}", origin.display());
        log::debug!(target: "thumbnail_job", "thumbnail_paths; destination={}", dest.display());
        
        // Use futures blocking approach for thumbnail creation
        let thumbnail_result = futures::executor::block_on(async {
            crate::domain_service::photo_service::create_thumbnails(
                dates_obj,
                &origin,
                &dest,
                config.thumbnail_parallel as u32,
                config.thumbnail_compression_quality,
                config.thumbnail_ratio,
                config.thumbnail_ignore_file_size,
            ).await
        });
        
        match thumbnail_result {
            Ok(_) => {
                log::info!(target: "thumbnail_job", "thumbnail_creation; status=success; dates={}", dates.len());
                
                // Emit final progress
                if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, "Thumbnails completed", 100.0)) {
                    log::error!(target: "thumbnail_job", "progress_event_error; error={}", e);
                }
                
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to create thumbnails: {}", e);
                log::error!(target: "thumbnail_job", "thumbnail_creation_error; error={}", error_msg);
                Err(error_msg)
            }
        }
    }

    fn process_create_db_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        log::info!(target: "create_db_job", "execution; status=processing; files={}", job.job.target.len());
        
        // Get app state to access configuration and database
        let state = app_handle.state::<crate::AppState>();
        let meta_db = &state.meta_db;
        
        // Emit progress event
        if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, "Creating database entries", 0)) {
            log::error!(target: "create_db_job", "progress_event_error; error={}", e);
        }
        
        // Extract unique dates from the imported file paths
        // The imported files have destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
        let mut dates_set = std::collections::HashSet::new();
        
        for file_path in &job.job.target {
            let path = std::path::Path::new(file_path);
            
            // Extract date from destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
            if let Some(parent) = path.parent() {
                if let Some(_uuid_dir) = parent.file_name() {
                    if let Some(date_dir) = parent.parent() {
                        if let Some(date_str) = date_dir.file_name() {
                            let date_string = date_str.to_string_lossy().to_string();
                            if Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap().is_match(&date_string) {
                                log::debug!(target: "thumbnail_job", "date_extraction; date={}", date_string);
                                dates_set.insert(date_string);
                            }
                        }
                    }
                }
            }
        }
        
        if dates_set.is_empty() {
            log::warn!(target: "create_db_job", "date_extraction; status=no_valid_dates");
            return Ok(());
        }
        
        // Convert to date objects
        let mut dates = Vec::new();
        for date_str in dates_set {
            log::debug!(target: "create_db_job", "date_processing; date={}", date_str);
            let date = crate::value::date::Date::from_string(&date_str, Some("-"));
            dates.push(date);
        }
        
        let dates_obj = crate::value::date::Dates::new(&dates);
        
        log::info!(target: "create_db_job", "database_creation; dates={}", dates.len());
        
        // Create database entries for the imported photos using existing functionality
        match meta_db.record_photos_all_meta_data(dates_obj) {
            Ok(result) => {
                log::info!(target: "create_db_job", "database_creation; status=success; dates={}", dates.len());
                log::debug!(target: "create_db_job", "database_result; result={:?}", result);
                
                // Emit final progress
                if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, "Database entries completed", 100.0)) {
                    log::error!(target: "create_db_job", "progress_event_error; error={}", e);
                }
                
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to create database entries: {:?}", e);
                log::error!(target: "thumbnail_job", "thumbnail_creation_error; error={}", error_msg);
                Err(error_msg)
            }
        }
    }
    
    // Helper method to copy file with timestamp preservation
    fn copy_file_with_timestamp(from: &str, to: &str) -> std::io::Result<u64> {
        log::debug!(target: "file_ops", "copy_with_timestamp; status=starting");
        log::debug!(target: "file_ops", "copy_with_timestamp; from={}", from);
        log::debug!(target: "file_ops", "copy_with_timestamp; to={}", to);
        
        // Check if source file exists
        if !std::path::Path::new(from).exists() {
            log::error!(target: "file_ops", "copy_error; reason=source_not_found; file={}", from);
            return Err(std::io::Error::new(std::io::ErrorKind::NotFound, format!("Source file not found: {}", from)));
        }
        
        log::debug!(target: "file_ops", "copy_with_timestamp; source_exists=true");
        let result = std::fs::copy(from, to);
        
        match &result {
            Ok(bytes) => log::debug!(target: "file_ops", "copy_result; status=success; bytes={}", bytes),
            Err(e) => log::error!(target: "file_ops", "copy_result; status=failed; error={}", e),
        }
        
        // Preserve original file's modification time
        log::debug!(target: "file_ops", "timestamp_preservation; status=starting");
        if let Ok(meta) = std::fs::metadata(from) {
            if let Ok(modified) = meta.modified() {
                let ft = filetime::FileTime::from_system_time(modified);
                match filetime::set_file_mtime(to, ft) {
                    Ok(_) => log::debug!(target: "file_ops", "timestamp_preservation; status=success"),
                    Err(e) => log::warn!(target: "file_ops", "timestamp_preservation; status=failed; error={}", e),
                }
            }
        }
        
        result
    }
    
    // Helper method to get or create UUID for source directory
    // .photoclove-uuid file should be placed in the parent directory of the directory containing images
    // For example: if images are at /path/to/target/image1.jpg, UUID file should be at /path/to/.photoclove-uuid
    fn get_or_create_source_uuid(source_dir: &std::path::Path) -> std::io::Result<String> {
        // Get the parent directory of the source directory containing images
        let parent_dir = source_dir.parent()
            .ok_or_else(|| std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Cannot get parent directory of source directory"
            ))?;
        
        let uuid_file = parent_dir.join(".photoclove-uuid");
        
        // Try to read existing UUID file
        if uuid_file.exists() {
            if let Ok(uuid_content) = std::fs::read_to_string(&uuid_file) {
                let uuid = uuid_content.trim();
                if !uuid.is_empty() {
                    return Ok(uuid.to_string());
                }
            }
        }
        
        // Create new UUID
        let new_uuid = uuid::Uuid::new_v4().to_string();
        
        // Try to write UUID file, but don't fail if we can't
        match std::fs::write(&uuid_file, &new_uuid) {
            Ok(_) => log::debug!(target: "uuid", "uuid_file; status=created; path={}", uuid_file.display()),
            Err(e) => {
                log::warn!(target: "uuid", "uuid_file; status=failed; path={}; error={}", uuid_file.display(), e);
                // Fall back to SHA256 hash of the source directory path
                let mut hasher = Sha256::new();
                hasher.update(source_dir.display().to_string().as_bytes());
                let hash = hasher.finalize();
                return Ok(format!("{:x}", hash));
            }
        }
        
        Ok(new_uuid)
    }

    // Method to emit completion events for backward compatibility with frontend
    fn emit_import_completion_events(
        app_handle: &tauri::AppHandle, 
        job_unit_id: &str, 
        db: &Arc<SQLite>
    ) {
        log::info!(target: "completion_events", "import_completion; status=emitting; job_unit_id={}", job_unit_id);
        
        // Get the imported dates from the completed jobs
        let imported_dates = Self::get_imported_dates_from_job_unit(db, job_unit_id);
        
        // Emit the sequence of events that the original import system used
        // These events trigger frontend to reload date lists and show notifications
        
        // 1. Notify that thumbnail creation is starting
        if let Err(e) = app_handle.emit("import", "start thumbnail creation") {
            log::error!(target: "completion_events", "event_emit_error; event=start_thumbnail_creation; error={}", e);
        }
        
        // 2. Notify that thumbnail creation finished
        if let Err(e) = app_handle.emit("import", "thumbnail creation finish") {
            log::error!(target: "completion_events", "event_emit_error; event=thumbnail_creation_finish; error={}", e);
        }
        
        // 3. Emit final completion event with dates information
        // The frontend expects this to trigger date list reload and notifications
        if let Err(e) = app_handle.emit("import", "finish") {
            log::error!(target: "completion_events", "event_emit_error; event=finish; error={}", e);
        }
        
        // 4. Also emit modern job unit completion event with dates
        let completion_data = serde_json::json!({
            "job_unit_id": job_unit_id,
            "imported_dates": imported_dates,
            "status": "completed"
        });
        
        if let Err(e) = app_handle.emit("import_job_unit_completed", completion_data) {
            log::error!(target: "completion_events", "event_emit_error; event=import_job_unit_completed; error={}", e);
        }
        
        log::info!(target: "completion_events", "import_completion; status=events_emitted");
    }
    
    // Helper method to extract the list of dates that had photos imported
    fn get_imported_dates_from_job_unit(db: &Arc<SQLite>, job_unit_id: &str) -> Vec<String> {
        log::debug!(target: "imported_dates", "extraction; job_unit_id={}", job_unit_id);
        
        // Get all jobs for this job unit to find the import job
        match db.get_jobs_for_unit(job_unit_id) {
            Ok(jobs) => {
                let mut dates_set = std::collections::HashSet::new();
                
                // Look through completed jobs to find dates
                for job in jobs {
                    if job.job.job_type == crate::entity::job_queue::JobType::Import {
                        // Extract dates from the imported file paths
                        for file_path in &job.job.target {
                            // For imported files, extract date from destination path structure
                            let path = std::path::Path::new(file_path);
                            if let Some(parent) = path.parent() {
                                if let Some(_uuid_dir) = parent.file_name() {
                                    if let Some(date_dir) = parent.parent() {
                                        if let Some(date_str) = date_dir.file_name() {
                                            let date_string = date_str.to_string_lossy().to_string();
                                            // Only add if it looks like a date (YYYY-MM-DD format)
                                            if regex::Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap().is_match(&date_string) {
                                                dates_set.insert(date_string);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                let dates: Vec<String> = dates_set.into_iter().collect();
                log::debug!(target: "imported_dates", "extraction; dates={:?}", dates);
                dates
            }
            Err(e) => {
                log::error!(target: "imported_dates", "extraction_error; job_unit_id={}; error={}", job_unit_id, e);
                vec![]
            }
        }
    }

    async fn process_google_photos_upload_job(
        job: &job_queue::QueuedJob,
        app_handle: &tauri::AppHandle,
        db: &Arc<SQLite>,
    ) -> Result<(), String> {
        log::info!(target: "google_photos", "upload_job; status=starting");
        log::info!(target: "job_queue", "job_info; job_unit_id={}", job.job_unit_id);
        
        // Deserialize job data from target field
        let job_data_json = job.job.target.get(0)
            .ok_or_else(|| "No job data found in target field".to_string())?;
        
        let job_data: job_queue::GooglePhotosUploadJob = serde_json::from_str(job_data_json)
            .map_err(|e| format!("Failed to deserialize job data: {}", e))?;
        
        log::info!(
            target: "google_photos", 
            "upload_job_start; job_unit_id={}; batch={}/{}; photos={}", 
            job.job_unit_id,
            job_data.chunk_index + 1, 
            job_data.total_chunks,
            job_data.photo_paths.len()
        );
        
        // Get app state for database path
        let state = app_handle.state::<crate::AppState>();
        let config = &state.config;
        
        // Get fresh access token (will auto-refresh if needed)
        let access_token = crate::domain_service::token_storage_service::TokenStorageService::get_valid_access_token()
            .await
            .map_err(|e| format!("Authentication failed: {}", e))?;
        
        // Get refresh token for GooglePhotos instance (though it won't be used directly anymore)
        let refresh_token = crate::domain_service::token_storage_service::TokenStorageService::get_refresh_token()
            .map_err(|e| format!("Failed to get refresh token: {}", e))?;
        
        // Create GooglePhotos instance
        let google_photos = crate::entity::google_photos::GooglePhotos::new(
            access_token,
            refresh_token,
            config.import_to.clone(), // db_path
        );
        
        // Emit progress event
        if let Err(e) = app_handle.emit("upload_progress", (
            &job.job_unit_id, 
            format!("Starting batch {} of {}", job_data.chunk_index + 1, job_data.total_chunks),
            0
        )) {
            log::error!(target: "google_photos", "Failed to emit progress event: {}", e);
        }
        
        // Upload photos in this batch
        let photo_refs: Vec<&str> = job_data.photo_paths.iter().map(|s| s.as_str()).collect();
        
        log::info!(
            target: "google_photos", 
            "starting_upload; job_unit_id={}; files={:?}", 
            job.job_unit_id,
            photo_refs
        );
        
        // Use the existing upload_photo method which handles the batching internally
        // This now returns Result<(), String> so we can properly handle errors
        match google_photos.upload_photo(photo_refs).await {
            Ok(()) => {
                // Emit completion event
                if let Err(e) = app_handle.emit("upload_progress", (
                    &job.job_unit_id,
                    format!("Completed batch {} of {}", job_data.chunk_index + 1, job_data.total_chunks),
                    100
                )) {
                    log::error!(target: "google_photos", "Failed to emit completion event: {}", e);
                }
                
                log::info!(
                    target: "google_photos", 
                    "upload_job_complete; job_unit_id={}; batch={}/{}", 
                    job.job_unit_id,
                    job_data.chunk_index + 1,
                    job_data.total_chunks
                );
                
                log::info!(target: "google_photos", "upload_job; status=complete");
                Ok(())
            }
            Err(error_msg) => {
                log::error!(
                    target: "google_photos", 
                    "upload_job_failed; job_unit_id={}; batch={}/{}; error={}", 
                    job.job_unit_id,
                    job_data.chunk_index + 1,
                    job_data.total_chunks,
                    error_msg
                );
                
                // Emit error event
                if let Err(e) = app_handle.emit("upload_error", (
                    &job.job_unit_id,
                    format!("Batch {} of {} failed: {}", job_data.chunk_index + 1, job_data.total_chunks, error_msg)
                )) {
                    log::error!(target: "google_photos", "Failed to emit error event: {}", e);
                }
                
                log::error!(target: "google_photos", "upload_job; status=failed; error={}", error_msg);
                Err(error_msg)
            }
        }
    }

    pub fn get_all_job_units(&self) -> Result<Vec<job_queue::JobUnit>, String> {
        // This method would need to be implemented in the database layer
        // For now, return a placeholder
        Ok(vec![])
    }

    pub fn get_all_jobs(&self) -> Result<Vec<job_queue::QueuedJob>, String> {
        match self.db.get_all_jobs() {
            Ok(jobs) => Ok(jobs),
            Err(e) => Err(format!("Failed to get jobs: {}", e)),
        }
    }

    pub fn retry_job(&self, job_id: i64, app_handle: tauri::AppHandle) -> Result<bool, String> {
        log::info!(target: "job_retry", "manual_retry; status=starting");
        log::info!(target: "job_retry", "manual_retry; job_id={}", job_id);
        
        // Reset job status to pending so it can be retried
        match self.db.update_job_status(job_id, &job_queue::JobStatus::Pending, None) {
            Ok(()) => {
                log::info!(target: "job_retry", "status_reset; job_id={}; status=pending", job_id);
                
                // Immediately process the retried job
                log::info!(target: "job_retry", "retry_processing; job_id={}; status=starting", job_id);
                Self::process_specific_jobs_immediately(self.db.clone(), vec![job_id], app_handle);
                
                Ok(true)
            },
            Err(e) => Err(format!("Failed to retry job: {}", e)),
        }
    }

    pub fn delete_job(&self, job_id: i64) -> Result<bool, String> {
        match self.db.delete_job(job_id) {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to delete job: {}", e)),
        }
    }

    pub fn delete_job_unit(&self, job_unit_id: String) -> Result<bool, String> {
        match self.db.delete_job_unit(&job_unit_id) {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to delete job unit: {}", e)),
        }
    }

    pub fn cleanup_completed_jobs(&self) -> Result<bool, String> {
        match self.db.cleanup_completed_jobs() {
            Ok(()) => Ok(true),
            Err(e) => Err(format!("Failed to cleanup completed jobs: {}", e)),
        }
    }
}