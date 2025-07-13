use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::MetaInfoDB;
use crate::value::file;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use sha2::{Sha256, Digest};
use uuid::Uuid;
use regex::Regex;
use chrono;

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
                            eprintln!("=== FOUND {} PENDING JOBS ===", pending_jobs.len());
                            for (idx, job) in pending_jobs.iter().enumerate() {
                                eprintln!("Job {}: ID={:?}, Type={:?}, Unit={}, Files={}", 
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

                // Cleanup completed jobs after each batch
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

    fn process_job(db: Arc<SQLite>, job: job_queue::QueuedJob, app_handle: tauri::AppHandle) {
        let job_id = job.id.unwrap();
        eprintln!("=== STARTING JOB PROCESSING ===");
        eprintln!("Job ID: {}", job_id);
        eprintln!("Job Type: {:?}", job.job.job_type);
        eprintln!("Job Unit ID: {}", job.job_unit_id);
        eprintln!("Target files count: {}", job.job.target.len());
        for (i, target) in job.job.target.iter().enumerate() {
            eprintln!("  Target file {}: {}", i + 1, target);
        }
        eprintln!("==============================");

        // Mark job as running
        eprintln!("Updating job {} status to running...", job_id);
        if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Running, None) {
            eprintln!("ERROR: Failed to update job status to running: {}", e);
            return;
        }
        eprintln!("Job {} status updated to running successfully", job_id);

        // Process the job based on type
        eprintln!("Starting job execution for job {} (type: {:?})", job_id, job.job.job_type);
        let result = match job.job.job_type {
            job_queue::JobType::Import => {
                eprintln!("Calling process_import_job for job {}", job_id);
                Self::process_import_job(&job, &app_handle)
            },
            job_queue::JobType::Thumbnail => {
                eprintln!("Calling process_thumbnail_job for job {}", job_id);
                Self::process_thumbnail_job(&job, &app_handle)
            },
            job_queue::JobType::CreateDb => {
                eprintln!("Calling process_create_db_job for job {}", job_id);
                Self::process_create_db_job(&job, &app_handle)
            },
        };
        
        eprintln!("Job {} execution completed with result: {:?}", job_id, result.is_ok());

        // Update job status based on result
        match result {
            Ok(_) => {
                if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Completed, None) {
                    eprintln!("Failed to update job status to completed: {}", e);
                }
                eprintln!("Job {} completed successfully", job_id);
                
                // Check if all jobs in the job unit are completed and update job unit status
                if let Err(e) = db.update_job_unit_status_if_complete(&job.job_unit_id) {
                    eprintln!("Failed to update job unit status: {}", e);
                }
                
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
        eprintln!("=== IMPORT JOB EXECUTION START ===");
        eprintln!("Import job for {} files", job.job.target.len());
        
        // Get app state to access configuration
        eprintln!("Getting app state and configuration...");
        let state = app_handle.state::<crate::AppState>();
        let config = &state.config;
        let destination_dir = &config.import_to;
        let trash_path = std::path::Path::new(&config.trash_path);
        
        eprintln!("Configuration loaded:");
        eprintln!("  Destination directory: {}", destination_dir);
        eprintln!("  Trash path: {}", config.trash_path);
        
        // Emit progress event
        eprintln!("Emitting import progress event...");
        if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, "Processing import job", 0)) {
            eprintln!("ERROR: Failed to emit import_progress event: {}", e);
        } else {
            eprintln!("Import progress event emitted successfully");
        }
        
        let mut imported_photos = Vec::new();
        eprintln!("Starting to process {} files for import", job.job.target.len());
        
        for (i, file_path) in job.job.target.iter().enumerate() {
            eprintln!("");
            eprintln!("--- Processing file {} of {} ---", i + 1, job.job.target.len());
            eprintln!("Source file: {}", file_path);
            
            // Create file and photo objects
            eprintln!("Creating file and photo objects...");
            let source_file = file::File::new(file_path.clone());
            let mut photo = crate::entity::photo::Photo::new(source_file.clone(), Some(config.clone()));
            eprintln!("Loading EXIF data...");
            photo.load_exif();
            eprintln!("EXIF data loaded successfully");
            
            // Get or create UUID for the source directory
            let source_dir = std::path::Path::new(file_path).parent()
                .ok_or_else(|| format!("Cannot get parent directory for: {}", file_path))?;
            eprintln!("Source directory: {}", source_dir.display());
            
            eprintln!("Getting or creating UUID for source directory...");
            let uuid = Self::get_or_create_source_uuid(source_dir)
                .map_err(|e| format!("Failed to get UUID for source directory: {}", e))?;
            eprintln!("UUID: {}", uuid);
            
            // Determine destination date directory using the same logic as original importer
            eprintln!("Determining date from photo...");
            eprintln!("Photo time field: '{}'", photo.time());
            
            // Use the same approach as original importer: photo.created_date()
            let date = if !photo.time().is_empty() {
                eprintln!("Using photo.created_date() method...");
                let created_date = photo.created_date();
                eprintln!("Photo created_date result: {}-{:02}-{:02}", created_date.year, created_date.month, created_date.day);
                created_date
            } else {
                eprintln!("Photo time is empty, trying to extract from filename...");
                // Try to extract date from filename (like IMG_20250710_190245626.jpg)
                let filename = std::path::Path::new(file_path).file_name()
                    .ok_or_else(|| format!("Cannot get filename from: {}", file_path))?
                    .to_string_lossy();
                
                eprintln!("Analyzing filename for date: {}", filename);
                
                // Pattern for filenames like IMG_20250710_xxxxxx.jpg
                if let Some(captures) = Regex::new(r"(\d{4})(\d{2})(\d{2})")
                    .unwrap()
                    .captures(&filename) {
                    let year = captures.get(1).unwrap().as_str().parse::<i32>().unwrap();
                    let month = captures.get(2).unwrap().as_str().parse::<u32>().unwrap();
                    let day = captures.get(3).unwrap().as_str().parse::<u32>().unwrap();
                    
                    if let Some(date) = crate::value::date::Date::new(year, month, day) {
                        eprintln!("Extracted date from filename: {}-{:02}-{:02}", year, month, day);
                        date
                    } else {
                        return Err(format!("Invalid date extracted from filename: {}-{:02}-{:02}", year, month, day));
                    }
                } else {
                    eprintln!("No date pattern found in filename, using file modification time as fallback");
                    // Use file modification time as fallback for files without date information
                    let metadata = std::fs::metadata(file_path)
                        .map_err(|e| format!("Cannot get file metadata: {}", e))?;
                    let modified = metadata.modified()
                        .map_err(|e| format!("Cannot get file modification time: {}", e))?;
                    let datetime = chrono::DateTime::<chrono::Utc>::from(modified);
                    
                    if let Some(date) = crate::value::date::Date::new(datetime.year(), datetime.month(), datetime.day()) {
                        eprintln!("Using file modification time as fallback: {}-{:02}-{:02}", datetime.year(), datetime.month(), datetime.day());
                        date
                    } else {
                        return Err(format!("Failed to create date from file modification time"));
                    }
                }
            };
            
            eprintln!("Final date determined: {}", date.to_string());
            
            let filename = std::path::Path::new(file_path).file_name()
                .ok_or_else(|| format!("Cannot get filename from: {}", file_path))?
                .to_string_lossy();
            eprintln!("Filename: {}", filename);
            
            // Build destination path: [destination_dir]/[YYYY-MM-DD]/[UUID]/[filename]
            let destination_date_dir = std::path::Path::new(destination_dir).join(date.to_string());
            let destination_uuid_dir = destination_date_dir.join(&uuid);
            let destination_path = destination_uuid_dir.join(filename.as_ref());
            
            eprintln!("Destination path: {}", destination_path.display());
            
            // Skip if source and destination are the same
            if file_path == &destination_path.display().to_string() {
                eprintln!("SKIPPING: Source and destination are the same: {}", file_path);
                continue;
            }
            
            // Skip if file exists in trash
            let trash_file_path = trash_path.join(destination_path.strip_prefix("/").unwrap_or(&destination_path));
            eprintln!("Checking trash path: {}", trash_file_path.display());
            if trash_file_path.exists() {
                eprintln!("SKIPPING: File exists in trash: {}", file_path);
                continue;
            }
            
            // Create destination directories
            eprintln!("Creating destination directory: {}", destination_uuid_dir.display());
            if let Err(e) = std::fs::create_dir_all(&destination_uuid_dir) {
                let error_msg = format!("Failed to create destination directory {}: {}", destination_uuid_dir.display(), e);
                eprintln!("ERROR: {}", error_msg);
                return Err(error_msg);
            }
            eprintln!("Destination directory created successfully");
            
            // Copy the file with timestamp preservation
            eprintln!("Starting file copy operation...");
            eprintln!("  FROM: {}", file_path);
            eprintln!("  TO:   {}", destination_path.display());
            
            match Self::copy_file_with_timestamp(file_path, &destination_path.display().to_string()) {
                Ok(bytes_copied) => {
                    eprintln!("SUCCESS: File copied successfully ({} bytes)", bytes_copied);
                    eprintln!("  Source: {}", file_path);
                    eprintln!("  Destination: {}", destination_path.display());
                    
                    // Create photo object for the copied file
                    eprintln!("Creating photo object for copied file...");
                    let destination_file = file::File::new(destination_path.display().to_string());
                    let mut destination_photo = crate::entity::photo::Photo::new(destination_file, Some(config.clone()));
                    destination_photo.embed_exif(photo.meta_data);
                    imported_photos.push(destination_photo);
                    eprintln!("Photo object created and added to imported_photos list");
                }
                Err(e) => {
                    let error_msg = format!("Failed to copy file {}: {}", file_path, e);
                    eprintln!("ERROR: {}", error_msg);
                    return Err(error_msg);
                }
            }
            
            // Emit progress
            let progress = ((i + 1) as f64 / job.job.target.len() as f64) * 100.0;
            if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, file_path, progress)) {
                eprintln!("Failed to emit import_progress event: {}", e);
            }
        }
        
        // Record metadata for imported photos
        eprintln!("");
        eprintln!("=== RECORDING METADATA ===");
        if !imported_photos.is_empty() {
            eprintln!("Recording metadata for {} imported photos...", imported_photos.len());
            let meta_db = &state.meta_db;
            if let Err(e) = meta_db.record_photos_meta_data(imported_photos.clone()) {
                let error_msg = format!("Failed to record photo metadata: {:?}", e);
                eprintln!("ERROR: {}", error_msg);
                return Err(error_msg);
            }
            eprintln!("Metadata recorded successfully for {} photos", imported_photos.len());
        } else {
            eprintln!("No photos were imported, skipping metadata recording");
        }
        
        eprintln!("=== IMPORT JOB COMPLETED SUCCESSFULLY ===");
        Ok(())
    }

    fn process_thumbnail_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        eprintln!("Processing thumbnail job for {} files", job.job.target.len());
        
        // Get app state to access configuration
        let state = app_handle.state::<crate::AppState>();
        let config = &state.config;
        
        // Emit progress event
        if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, "Processing thumbnails", 0)) {
            eprintln!("Failed to emit thumbnail_progress event: {}", e);
        }
        
        // Get unique dates from the imported files to create thumbnails for those dates
        let mut dates_set = std::collections::HashSet::new();
        for file_path in &job.job.target {
            // For imported files, extract date from destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
            let path = std::path::Path::new(file_path);
            if let Some(parent) = path.parent() {
                if let Some(uuid_dir) = parent.file_name() {
                    if let Some(date_dir) = parent.parent() {
                        if let Some(date_str) = date_dir.file_name() {
                            dates_set.insert(date_str.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        
        if dates_set.is_empty() {
            return Ok(()); // No dates to process
        }
        
        // Convert to date objects
        let mut dates = Vec::new();
        for date_str in dates_set {
            eprintln!("Processing date string for thumbnails: '{}'", date_str);
            // Only process if it looks like a date (YYYY-MM-DD format)
            if Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap().is_match(&date_str) {
                if let Some(date) = crate::value::date::Date::from_string(&date_str, Some("-")) {
                    eprintln!("Valid date found for thumbnails: {}", date_str);
                    dates.push(date);
                } else {
                    eprintln!("Invalid date format, skipping: {}", date_str);
                }
            } else {
                eprintln!("Not a date pattern, skipping: {}", date_str);
            }
        }
        
        if dates.is_empty() {
            eprintln!("No valid dates found for thumbnail generation, skipping");
            return Ok(());
        }
        
        let dates_obj = crate::value::date::Dates::new(&dates);
        
        // Create thumbnails using the existing photo service
        let origin = std::path::PathBuf::from(&config.import_to);
        let dest = std::path::PathBuf::from(&config.thumbnail_store);
        
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
                eprintln!("Successfully created thumbnails for {} dates", dates.len());
                
                // Emit final progress
                if let Err(e) = app_handle.emit("thumbnail_progress", (&job.job_unit_id, "Thumbnails completed", 100.0)) {
                    eprintln!("Failed to emit thumbnail_progress event: {}", e);
                }
                
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to create thumbnails: {}", e);
                eprintln!("{}", error_msg);
                Err(error_msg)
            }
        }
    }

    fn process_create_db_job(job: &job_queue::QueuedJob, app_handle: &tauri::AppHandle) -> Result<(), String> {
        eprintln!("Processing create_db job for {} files", job.job.target.len());
        
        // Get app state to access configuration and database
        let state = app_handle.state::<crate::AppState>();
        let meta_db = &state.meta_db;
        
        // Emit progress event
        if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, "Creating database entries", 0)) {
            eprintln!("Failed to emit create_db_progress event: {}", e);
        }
        
        // Get unique dates from the imported files
        let mut dates_set = std::collections::HashSet::new();
        for file_path in &job.job.target {
            // For imported files, extract date from destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
            let path = std::path::Path::new(file_path);
            if let Some(parent) = path.parent() {
                if let Some(uuid_dir) = parent.file_name() {
                    if let Some(date_dir) = parent.parent() {
                        if let Some(date_str) = date_dir.file_name() {
                            dates_set.insert(date_str.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        
        if dates_set.is_empty() {
            eprintln!("No dates found for database creation");
            return Ok(());
        }
        
        // Convert to date objects
        let mut dates = Vec::new();
        for date_str in dates_set {
            eprintln!("Processing date string for database: '{}'", date_str);
            // Only process if it looks like a date (YYYY-MM-DD format)
            if Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap().is_match(&date_str) {
                if let Some(date) = crate::value::date::Date::from_string(&date_str, Some("-")) {
                    eprintln!("Valid date found for database: {}", date_str);
                    dates.push(date);
                } else {
                    eprintln!("Invalid date format, skipping: {}", date_str);
                }
            } else {
                eprintln!("Not a date pattern, skipping: {}", date_str);
            }
        }
        
        if dates.is_empty() {
            eprintln!("No valid dates found for database creation, skipping");
            return Ok(());
        }
        
        let dates_obj = crate::value::date::Dates::new(&dates);
        
        // Create database entries for the imported photos using existing functionality
        match meta_db.record_photos_all_meta_data(dates_obj) {
            Ok(result) => {
                eprintln!("Successfully created database entries for {} dates", dates.len());
                eprintln!("Database creation result: {:?}", result);
                
                // Emit final progress
                if let Err(e) = app_handle.emit("create_db_progress", (&job.job_unit_id, "Database entries completed", 100.0)) {
                    eprintln!("Failed to emit create_db_progress event: {}", e);
                }
                
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to create database entries: {:?}", e);
                eprintln!("{}", error_msg);
                Err(error_msg)
            }
        }
    }
    
    // Helper method to copy file with timestamp preservation
    fn copy_file_with_timestamp(from: &str, to: &str) -> std::io::Result<u64> {
        eprintln!("copy_file_with_timestamp called:");
        eprintln!("  FROM: {}", from);
        eprintln!("  TO:   {}", to);
        
        // Check if source file exists
        if !std::path::Path::new(from).exists() {
            eprintln!("ERROR: Source file does not exist: {}", from);
            return Err(std::io::Error::new(std::io::ErrorKind::NotFound, format!("Source file not found: {}", from)));
        }
        
        eprintln!("Source file exists, proceeding with copy...");
        let result = std::fs::copy(from, to);
        
        match &result {
            Ok(bytes) => eprintln!("File copy successful: {} bytes copied", bytes),
            Err(e) => eprintln!("File copy failed: {}", e),
        }
        
        // Preserve original file's modification time
        eprintln!("Preserving file timestamp...");
        if let Ok(meta) = std::fs::metadata(from) {
            if let Ok(modified) = meta.modified() {
                let ft = filetime::FileTime::from_system_time(modified);
                match filetime::set_file_mtime(to, ft) {
                    Ok(_) => eprintln!("File timestamp preserved successfully"),
                    Err(e) => eprintln!("Warning: Failed to preserve timestamp: {}", e),
                }
            }
        }
        
        result
    }
    
    // Helper method to get or create UUID for source directory
    fn get_or_create_source_uuid(source_dir: &std::path::Path) -> std::io::Result<String> {
        let uuid_file = source_dir.join(".photoclove-uuid");
        
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
            Ok(_) => eprintln!("Created UUID file: {}", uuid_file.display()),
            Err(e) => {
                eprintln!("Failed to create UUID file {}: {}", uuid_file.display(), e);
                // Fall back to SHA256 hash of the source directory path
                let mut hasher = Sha256::new();
                hasher.update(source_dir.display().to_string().as_bytes());
                let hash = hasher.finalize();
                return Ok(format!("{:x}", hash));
            }
        }
        
        Ok(new_uuid)
    }
}