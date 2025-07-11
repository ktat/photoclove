use crate::entity::{job_queue, photo};
use crate::repository::meta_db::sqlite::SQLite;
use crate::value::file;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

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
        let db = Arc::clone(&self.db);
        let is_running = Arc::clone(&self.is_running);
        let max_concurrent = self.max_concurrent_jobs;

        {
            let mut running = is_running.lock().unwrap();
            if *running {
                return; // Already running
            }
            *running = true;
        }

        thread::spawn(move || {
            eprintln!("Job queue background processing started");
            let mut iteration_count = 0;
            
            loop {
                iteration_count += 1;
                if iteration_count <= 3 || iteration_count % 10 == 0 {
                    eprintln!("Background processing loop iteration #{}", iteration_count);
                }
                // Check if we should stop
                {
                    let running = is_running.lock().unwrap();
                    if !*running {
                        break;
                    }
                }

                // Process pending jobs
                if iteration_count <= 3 || iteration_count % 10 == 0 {
                    eprintln!("Checking for pending jobs...");
                }
                match db.get_pending_jobs() {
                    Ok(pending_jobs) => {
                        if iteration_count <= 3 || iteration_count % 10 == 0 {
                            eprintln!("Query returned {} jobs", pending_jobs.len());
                        }
                        if !pending_jobs.is_empty() {
                            eprintln!("Found {} pending jobs", pending_jobs.len());
                            
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
                            
                            // Wait for all jobs in this batch to complete
                            for handle in handles {
                                if let Err(e) = handle.join() {
                                    eprintln!("Job thread panicked: {:?}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Error getting pending jobs: {}", e);
                    }
                }

                // Cleanup completed jobs periodically
                if let Err(e) = db.cleanup_completed_jobs() {
                    eprintln!("Error cleaning up completed jobs: {}", e);
                }

                // Sleep before next iteration
                thread::sleep(Duration::from_secs(2));
            }
            
            eprintln!("Job queue background processing stopped");
        });
    }

    pub fn stop_background_processing(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
    }

    pub fn submit_import_jobs(&self, files: Vec<String>) -> Result<String, String> {
        eprintln!("Submitting import jobs for {} files", files.len());
        
        // Create job unit
        let job_types = vec!["import".to_string(), "thumbnail".to_string(), "create_db".to_string()];
        let job_unit = job_queue::JobUnit::new(job_types);
        let job_unit_id = job_unit.id.clone();
        
        eprintln!("Created job unit with ID: {}", job_unit_id);

        // Save job unit
        self.db.create_job_unit(&job_unit)?;
        eprintln!("Job unit saved to database");

        // Create individual jobs
        let import_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::Import,
            files.clone(),
        );
        let thumbnail_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::Thumbnail,
            files.clone(),
        );
        let create_db_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::CreateDb,
            files,
        );

        // Queue the jobs
        let import_queued = job_queue::QueuedJob::new(job_unit_id.clone(), import_job);
        let thumbnail_queued = job_queue::QueuedJob::new(job_unit_id.clone(), thumbnail_job);
        let create_db_queued = job_queue::QueuedJob::new(job_unit_id.clone(), create_db_job);

        let import_id = self.db.create_job(&import_queued)?;
        let thumbnail_id = self.db.create_job(&thumbnail_queued)?;
        let create_db_id = self.db.create_job(&create_db_queued)?;
        
        eprintln!("Created jobs with IDs: {}, {}, {}", import_id, thumbnail_id, create_db_id);

        Ok(job_unit_id)
    }

    pub fn get_job_progress(&self, job_unit_id: &str) -> Result<job_queue::JobProgress, String> {
        self.db.get_job_unit_progress(job_unit_id)
    }

    fn process_job(db: Arc<SQLite>, mut job: job_queue::QueuedJob, app_handle: tauri::AppHandle) {
        let job_id = job.id.unwrap();
        eprintln!("Processing job {}: {:?}", job_id, job.job.job_type);

        // Mark job as running
        if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Running, None) {
            eprintln!("Failed to update job status to running: {}", e);
            return;
        }

        // Process the job based on type
        let result = match job.job.job_type {
            job_queue::JobType::Import => Self::process_import_job(&job, &app_handle),
            job_queue::JobType::Thumbnail => Self::process_thumbnail_job(&job, &app_handle),
            job_queue::JobType::CreateDb => Self::process_create_db_job(&job, &app_handle),
        };

        // Update job status based on result
        match result {
            Ok(_) => {
                if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Completed, None) {
                    eprintln!("Failed to update job status to completed: {}", e);
                }
                eprintln!("Job {} completed successfully", job_id);
                
                // Emit progress event
                if let Err(e) = app_handle.emit("job_completed", &job.job_unit_id) {
                    eprintln!("Failed to emit job_completed event: {}", e);
                }
            }
            Err(error_msg) => {
                if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Failed, Some(error_msg.clone())) {
                    eprintln!("Failed to update job status to failed: {}", e);
                }
                eprintln!("Job {} failed: {}", job_id, error_msg);
                
                // Emit error event
                if let Err(e) = app_handle.emit("job_failed", (&job.job_unit_id, &error_msg)) {
                    eprintln!("Failed to emit job_failed event: {}", e);
                }
            }
        }
    }

    fn process_import_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        eprintln!("Processing import job for {} files", job.job.target.len());
        
        // Emit progress event
        if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, "Processing import job", 0)) {
            eprintln!("Failed to emit import_progress event: {}", e);
        }
        
        // TODO: Implement actual import logic here
        // For now, simulate processing
        for (i, file_path) in job.job.target.iter().enumerate() {
            eprintln!("Processing file: {}", file_path);
            
            // Simulate work
            thread::sleep(Duration::from_millis(100));
            
            // Emit progress
            let progress = ((i + 1) as f64 / job.job.target.len() as f64) * 100.0;
            if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, file_path, progress)) {
                eprintln!("Failed to emit import_progress event: {}", e);
            }
        }
        
        Ok(())
    }

    fn process_thumbnail_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        eprintln!("Processing thumbnail job for {} files", job.job.target.len());
        
        // Emit progress event
        if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, "Processing thumbnails", 0)) {
            eprintln!("Failed to emit thumbnail_progress event: {}", e);
        }
        
        // TODO: Implement actual thumbnail logic here
        // For now, simulate processing
        for (i, file_path) in job.job.target.iter().enumerate() {
            eprintln!("Creating thumbnail for: {}", file_path);
            
            // Simulate work
            thread::sleep(Duration::from_millis(50));
            
            // Emit progress
            let progress = ((i + 1) as f64 / job.job.target.len() as f64) * 100.0;
            if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, file_path, progress)) {
                eprintln!("Failed to emit thumbnail_progress event: {}", e);
            }
        }
        
        Ok(())
    }

    fn process_create_db_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        eprintln!("Processing create_db job for {} files", job.job.target.len());
        
        // Emit progress event
        if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, "Creating database entries", 0)) {
            eprintln!("Failed to emit create_db_progress event: {}", e);
        }
        
        // TODO: Implement actual database creation logic here
        // For now, simulate processing
        for (i, file_path) in job.job.target.iter().enumerate() {
            eprintln!("Creating DB entry for: {}", file_path);
            
            // Simulate work
            thread::sleep(Duration::from_millis(25));
            
            // Emit progress
            let progress = ((i + 1) as f64 / job.job.target.len() as f64) * 100.0;
            if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, file_path, progress)) {
                eprintln!("Failed to emit create_db_progress event: {}", e);
            }
        }
        
        Ok(())
    }
}