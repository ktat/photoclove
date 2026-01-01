use crate::entity::job_queue;
use crate::repository::MetaInfoDB;
use crate::value::file;
use chrono::Datelike;
use regex::Regex;
use sha2::{Digest, Sha256};
use tauri::{Emitter, Manager};

/// Process import job - copies files from source to destination with timestamp preservation
pub(crate) fn process_import_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
) -> Result<Vec<String>, String> {
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
    if let Err(e) = app_handle.emit(
        "import_progress",
        (&job.job_unit_id, "Processing import job", 0),
    ) {
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
        let source_dir = std::path::Path::new(file_path)
            .parent()
            .ok_or_else(|| format!("Cannot get parent directory for: {}", file_path))?;
        log::debug!(target: "import_job", "source_dir; path={}", source_dir.display());

        log::debug!(target: "import_job", "uuid; status=getting_or_creating");
        let uuid = get_or_create_source_uuid(source_dir)
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
            let filename = std::path::Path::new(file_path)
                .file_name()
                .ok_or_else(|| format!("Cannot get filename from: {}", file_path))?
                .to_string_lossy();

            log::debug!(target: "import_job", "date; filename_analysis={}", filename);

            // Pattern for filenames like IMG_20250710_xxxxxx.jpg
            if let Some(captures) = Regex::new(r"(\d{4})(\d{2})(\d{2})")
                .unwrap()
                .captures(&filename)
            {
                let year = captures.get(1).unwrap().as_str().parse::<i32>().unwrap();
                let month = captures.get(2).unwrap().as_str().parse::<u32>().unwrap();
                let day = captures.get(3).unwrap().as_str().parse::<u32>().unwrap();

                if let Some(date) = crate::value::date::Date::new(year, month, day) {
                    log::debug!(target: "import_job", "date; filename_extracted={}-{:02}-{:02}", year, month, day);
                    date
                } else {
                    return Err(format!(
                        "Invalid date extracted from filename: {}-{:02}-{:02}",
                        year, month, day
                    ));
                }
            } else {
                log::debug!(target: "import_job", "date; method=file_modification_time; reason=no_filename_pattern");
                // Use file modification time as fallback for files without date information
                let metadata = std::fs::metadata(file_path)
                    .map_err(|e| format!("Cannot get file metadata: {}", e))?;
                let modified = metadata
                    .modified()
                    .map_err(|e| format!("Cannot get file modification time: {}", e))?;
                let datetime = chrono::DateTime::<chrono::Utc>::from(modified);

                if let Some(date) =
                    crate::value::date::Date::new(datetime.year(), datetime.month(), datetime.day())
                {
                    log::debug!(target: "import_job", "date; modification_time={}-{:02}-{:02}", datetime.year(), datetime.month(), datetime.day());
                    date
                } else {
                    return Err(format!("Failed to create date from file modification time"));
                }
            }
        };

        log::debug!(target: "import_job", "date; final_date={}", date.to_string());

        let filename = std::path::Path::new(file_path)
            .file_name()
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
        let trash_file_path = trash_path.join(
            destination_path
                .strip_prefix("/")
                .unwrap_or(&destination_path),
        );
        log::debug!(target: "import_job", "trash_check; path={}", trash_file_path.display());
        if trash_file_path.exists() {
            log::info!(target: "import_job", "file_skip; reason=in_trash; file={}", file_path);
            continue;
        }

        // Create destination directories
        log::debug!(target: "import_job", "directory_creation; path={}", destination_uuid_dir.display());
        if let Err(e) = std::fs::create_dir_all(&destination_uuid_dir) {
            let error_msg = format!(
                "Failed to create destination directory {}: {}",
                destination_uuid_dir.display(),
                e
            );
            log::error!(target: "import_job", "processing_error; error={}", error_msg);
            return Err(error_msg);
        }
        log::debug!(target: "import_job", "directory_creation; status=success");

        // Copy the file with timestamp preservation
        log::debug!(target: "import_job", "file_copy; status=starting");
        log::debug!(target: "import_job", "file_copy; from={}", file_path);
        log::debug!(target: "import_job", "file_copy; to={}", destination_path.display());

        match copy_file_with_timestamp(file_path, &destination_path.display().to_string()) {
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
                let mut destination_photo =
                    crate::entity::photo::Photo::new(destination_file, Some(config.clone()));
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
        if let Err(e) = app_handle.emit("import_progress", (&job.job_unit_id, file_path, progress))
        {
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

/// Copy file with timestamp preservation
fn copy_file_with_timestamp(from: &str, to: &str) -> std::io::Result<u64> {
    log::debug!(target: "file_ops", "copy_with_timestamp; status=starting");
    log::debug!(target: "file_ops", "copy_with_timestamp; from={}", from);
    log::debug!(target: "file_ops", "copy_with_timestamp; to={}", to);

    // Check if source file exists
    if !std::path::Path::new(from).exists() {
        log::error!(target: "file_ops", "copy_error; reason=source_not_found; file={}", from);
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Source file not found: {}", from),
        ));
    }

    log::debug!(target: "file_ops", "copy_with_timestamp; source_exists=true");
    let result = std::fs::copy(from, to);

    match &result {
        Ok(bytes) => {
            log::debug!(target: "file_ops", "copy_result; status=success; bytes={}", bytes)
        }
        Err(e) => log::error!(target: "file_ops", "copy_result; status=failed; error={}", e),
    }

    // Preserve original file's modification time
    log::debug!(target: "file_ops", "timestamp_preservation; status=starting");
    if let Ok(meta) = std::fs::metadata(from) {
        if let Ok(modified) = meta.modified() {
            let ft = filetime::FileTime::from_system_time(modified);
            match filetime::set_file_mtime(to, ft) {
                Ok(_) => log::debug!(target: "file_ops", "timestamp_preservation; status=success"),
                Err(e) => {
                    log::warn!(target: "file_ops", "timestamp_preservation; status=failed; error={}", e)
                }
            }
        }
    }

    result
}

/// Helper function to get or create UUID for source directory
/// .photoclove-uuid file should be placed in the parent directory of the directory containing images
/// For example: if images are at /path/to/target/image1.jpg, UUID file should be at /path/to/.photoclove-uuid
fn get_or_create_source_uuid(source_dir: &std::path::Path) -> std::io::Result<String> {
    // Get the parent directory of the source directory containing images
    let parent_dir = source_dir.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Cannot get parent directory of source directory",
        )
    })?;

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
        Ok(_) => {
            log::debug!(target: "uuid", "uuid_file; status=created; path={}", uuid_file.display())
        }
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
