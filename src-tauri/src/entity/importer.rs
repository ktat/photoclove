use crate::entity::photo;
use crate::repository::{self};
use crate::repository::{dir, MetaInfoDB};
use crate::value::{date, file};
use filetime;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::{
    fs,
    io::{self, Read, Write},
    path,
    sync::{Arc, Mutex, RwLock},
    thread, time,
};
use tauri::Emitter;
use uuid::Uuid;

static IN_PROGRESS_NUM: AtomicUsize = AtomicUsize::new(1);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Importer {
    pub dirs_files: dir::DirsFiles,
    pub page: usize,
    pub num: usize,
    pub paths: Vec<String>,
}

pub struct ImporterSelectedFiles {
    selected_photo_files: Vec<file::File>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImportProgress {
    pub start_time: time::SystemTime,
    pub current_time: u64,
    pub now_importing: bool,
    pub progress: usize,
    pub num: usize,
    pub num_per_sec: f32,
}

impl ImportProgress {
    pub fn new() -> ImportProgress {
        return ImportProgress {
            start_time: time::SystemTime::now(),
            current_time: 0,
            now_importing: false,
            num: 0,
            progress: 0,
            num_per_sec: 0.0,
        };
    }

    pub fn get_import_progress(&mut self) -> usize {
        self.progress = IN_PROGRESS_NUM.load(Ordering::SeqCst);
        self.current_time = time::SystemTime::now()
            .duration_since(self.start_time)
            .unwrap()
            .as_secs();
        let t = self.current_time as f32;
        let progress = self.progress;
        if self.num <= progress {
            self.reset_import_progress()
        } else {
            self.num_per_sec = 0.5;
            if t > 0.0 && progress > 0 {
                self.num_per_sec = (progress as f32) / t;
            }
        }
        return self.progress;
    }

    pub fn reset_import_progress(&mut self) {
        self.now_importing = false;
        self.num = 0;
        self.progress = 0;
        self.num_per_sec = 0.0;
        self.start_time = time::SystemTime::now();
        IN_PROGRESS_NUM.store(0, Ordering::SeqCst)
    }
}

fn is_sha256_hash(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn get_directory_sha256_hash(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn migrate_files_from_sha256_to_uuid(
    destination_dir: &path::Path,
    sha256_hash: &str,
    uuid: &str,
    origin_meta_db: &repository::MetaDB,
) -> Result<(), Box<dyn std::error::Error>> {
    // Find all date directories in the destination
    let entries = fs::read_dir(destination_dir)?;
    
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() {
            // Check if this looks like a date directory (YYYY-MM-DD format)
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                if dir_name.len() == 10 && dir_name.chars().nth(4) == Some('-') && dir_name.chars().nth(7) == Some('-') {
                    let sha256_dir = path.join(sha256_hash);
                    let uuid_dir = path.join(uuid);
                    
                    if sha256_dir.exists() && sha256_dir.is_dir() {
                        // Create UUID directory if it doesn't exist
                        if !uuid_dir.exists() {
                            fs::create_dir_all(&uuid_dir)?;
                        }
                        
                        // Move files from SHA256 directory to UUID directory
                        let files = fs::read_dir(&sha256_dir)?;
                        for file_entry in files {
                            let file_entry = file_entry?;
                            let file_path = file_entry.path();
                            
                            if file_path.is_file() {
                                let file_name = file_path.file_name().unwrap();
                                let dest_path = uuid_dir.join(file_name);
                                
                                // Move the file
                                fs::rename(&file_path, &dest_path)?;
                                
                                // Update database record
                                if let Err(e) = origin_meta_db.update_photo_path(
                                    &file_path.to_string_lossy(),
                                    &dest_path.to_string_lossy()
                                ) {
                                    log::error!(target: "importer", "database_update_failed; error={}", e);
                                }
                            }
                        }
                        
                        // Remove the empty SHA256 directory
                        if let Err(e) = fs::remove_dir(&sha256_dir) {
                            log::warn!(target: "importer", "sha256_dir_removal_failed; path={}; error={}", sha256_dir.display(), e);
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

fn get_or_create_source_uuid(
    source_path: &str,
    destination_dir: Option<&path::Path>,
    origin_meta_db: Option<&repository::MetaDB>
) -> Result<String, Box<dyn std::error::Error>> {
    // Get the parent directory of the image file's directory
    // For /foo/bar/image.png, we want to create .photoclove-uuid in /foo/
    let image_parent = path::Path::new(source_path)
        .parent()
        .ok_or("Cannot get parent directory of image file")?;
    
    let source_parent = image_parent
        .parent()
        .ok_or("Cannot get parent directory of image file's directory")?;
    
    let uuid_file_path = source_parent.join(".photoclove-uuid");
    
    // Calculate SHA256 hash of the source directory path
    let sha256_hash = get_directory_sha256_hash(&image_parent.to_string_lossy());
    
    // Check if there's an existing SHA256 hash directory in the destination
    let has_existing_sha256_dir = if let Some(dest_dir) = destination_dir {
        // Look for any date directories that contain the SHA256 hash
        if let Ok(entries) = fs::read_dir(dest_dir) {
            entries.filter_map(|entry| entry.ok())
                .any(|entry| {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                            // Check if this looks like a date directory (YYYY-MM-DD format)
                            if dir_name.len() == 10 && dir_name.chars().nth(4) == Some('-') && dir_name.chars().nth(7) == Some('-') {
                                return path.join(&sha256_hash).exists();
                            }
                        }
                    }
                    false
                })
        } else {
            false
        }
    } else {
        false
    };
    
    // Check if .photoclove-uuid file exists
    if uuid_file_path.exists() {
        // Read the UUID from the file
        let mut file = fs::File::open(&uuid_file_path)?;
        let mut uuid_string = String::new();
        file.read_to_string(&mut uuid_string)?;
        let uuid_string = uuid_string.trim();
        
        // Validate that it's a valid UUID
        if Uuid::parse_str(uuid_string).is_ok() {
            return Ok(uuid_string.to_string());
        }
    }
    
    // Try to create .photoclove-uuid file
    match fs::File::create(&uuid_file_path) {
        Ok(mut file) => {
            // Successfully created the file
            let new_uuid = Uuid::new_v4().to_string();
            file.write_all(new_uuid.as_bytes())?;
            
            // If there was an existing SHA256 directory, migrate files from it to the new UUID directory
            if has_existing_sha256_dir {
                if let (Some(dest_dir), Some(meta_db)) = (destination_dir, origin_meta_db) {
                    if let Err(e) = migrate_files_from_sha256_to_uuid(dest_dir, &sha256_hash, &new_uuid, meta_db) {
                        log::error!(target: "importer", "migration_failed; from=sha256; to=uuid; error={}", e);
                    }
                }
            }
            
            Ok(new_uuid)
        }
        Err(_) => {
            // Failed to create .photoclove-uuid file, fall back to SHA256 hash
            Ok(sha256_hash)
        }
    }
}

fn copy_file(from: &str, to: &str) -> io::Result<u64> {
    let result = fs::copy(from.clone(), to.clone());

    let meta = std::fs::metadata(from).unwrap();
    let ft = filetime::FileTime::from_system_time(meta.modified().unwrap());
    filetime::set_file_mtime(to, ft)?;

    result
}

impl ImporterSelectedFiles {
    pub fn new() -> ImporterSelectedFiles {
        ImporterSelectedFiles {
            selected_photo_files: Vec::new(),
        }
    }

    pub fn import_photos(
        &self,
        window: &tauri::Window,
        origin_repo_db: &repository::RepoDB,
        origin_meta_db: &repository::MetaDB,
        destination_dir: Arc<path::PathBuf>,
        trash_dir: Arc<path::PathBuf>,
        copy_parallel: usize,
        progress: Arc<&Mutex<ImportProgress>>,
    ) -> Result<date::Dates, ()> {
        progress.lock().unwrap().start_time = time::SystemTime::now();
        progress.lock().unwrap().now_importing = true;
        progress.lock().unwrap().num = self.selected_photo_files.len();
        
        // Determine the source UUID for the import session
        let source_uuid = if let Some(first_file) = self.selected_photo_files.first() {
            match get_or_create_source_uuid(
                &first_file.path,
                Some(destination_dir.as_ref()),
                Some(origin_meta_db)
            ) {
                Ok(uuid) => Some(uuid),
                Err(e) => {
                    log::error!(target: "importer", "source_uuid_creation_failed; error={}", e);
                    None
                }
            }
        } else {
            None
        };
        
        let mut handles = vec![];
        let mut photos_file_chunks: Vec<Vec<file::File>> = Vec::new();
        let len = self.selected_photo_files.len();
        let n = len / copy_parallel;
        let mut i = 0;
        let mut files: Vec<file::File> = Vec::new();
        for file in &self.selected_photo_files {
            files.push(file::File::new(file.path.clone()));
            i += 1;
            if i > n {
                photos_file_chunks.push(files);
                i = 0;
                files = Vec::new();
            }
        }
        if files.len() > 0 {
            photos_file_chunks.push(files);
        }

        let sleep_millis = time::Duration::from_millis(100);
        let t1 = time::SystemTime::now();
        let mut arc_date_list = Arc::new(RwLock::new(HashMap::new()));
        for files in photos_file_chunks {
            let window = window.clone();
            let meta_db = origin_meta_db.new_connect();
            let arc_dest_path = Arc::clone(&destination_dir);
            let arc_trash_path = Arc::clone(&trash_dir);
            let arc_date_list_clone = Arc::clone(&arc_date_list);
            let source_uuid_clone = source_uuid.clone();
            // log::debug!(target: "importer", "trash_path; path={:?}", &arc_trash_path);
            let handle = thread::spawn(move || {
                let mut n: usize = 0;
                let mut photos: Vec<photo::Photo> = Vec::new();
                for file in files {
                    let filename = file.filename();
                    let photo = photo::Photo::new_with_exif(file.clone());
                    let destination_date_dir = arc_dest_path.join(photo.created_date_string());
                    arc_date_list_clone
                        .write()
                        .unwrap()
                        .entry(photo.created_date_string())
                        .or_insert(true);
                    
                    // Create the final destination path with UUID if available
                    let destination_path = if let Some(ref uuid) = source_uuid_clone {
                        let uuid_dir = destination_date_dir.join(uuid);
                        if !uuid_dir.exists() {
                            match fs::create_dir_all(&uuid_dir) {
                                Ok(_) => {}
                                Err(e) => {
                                    log::error!(target: "importer", "uuid_dir_creation_failed; path={}; error={}", uuid_dir.display(), e);
                                }
                            }
                        }
                        uuid_dir.join(filename)
                    } else {
                        // Fallback to original behavior if UUID is not available
                        if !destination_date_dir.exists() {
                            match fs::create_dir(destination_date_dir.clone()) {
                                Ok(_) => {}
                                Err(e) => {
                                    log::error!(target: "importer", "dir_creation_failed; path={}; error={}", destination_date_dir.display(), e);
                                }
                            }
                        }
                        destination_date_dir.join(filename)
                    };
                    
                    // Ensure the date directory exists
                    if !destination_date_dir.exists() {
                        match fs::create_dir_all(&destination_date_dir) {
                            Ok(_) => {}
                            Err(e) => {
                                log::error!(target: "importer", "date_dir_creation_failed; path={}; error={}", destination_date_dir.display(), e);
                            }
                        }
                    }
                    let p = file.path.clone();
                    if p == destination_path.display().to_string() {
                        log::info!(target: "importer", "file_ignored; reason=same_file; from={}; to={}", p, destination_path.display());
                        n += 1;
                        continue;
                    } else {
                        let trash_file_path = arc_trash_path
                            .join(destination_path.clone().strip_prefix("/").unwrap());
                        log::debug!(target: "importer", "trash_file_check; path={}", trash_file_path.display());
                        if trash_file_path.exists() {
                            n += 1;
                            continue;
                        }
                        let result = copy_file(&p, &destination_path.display().to_string());
                        thread::sleep(sleep_millis);
                        log::info!(target: "importer", "file_copied; from={}; to={}", p, destination_path.display());
                        if result.is_err() {
                            log::error!(target: "importer", "file_copy_failed; error={:?}; path={}", result.err(), destination_path.display());
                        }
                    }
                    let df = file::File::new(destination_path.display().to_string());
                    let mut d_photo = photo::Photo::new(df.clone(), Option::None);
                    d_photo.embed_exif(photo.meta_data);
                    photos.push(d_photo);

                    let t2 = time::SystemTime::now();
                    let diff = t2.duration_since(t1).unwrap();
                    n += 1;
                    if diff.as_secs() > 2 {
                        let current_num = IN_PROGRESS_NUM.load(Ordering::SeqCst);
                        IN_PROGRESS_NUM.store(current_num + n, Ordering::SeqCst);
                        match window.emit("import", current_num + n) {
                            Ok(()) => (),
                            Err(e) => {
                                log::error!(target: "importer", "event_emit_failed; event=import; error={:?}", e);
                            }
                        }
                        n = 0;
                    }
                }
                meta_db.record_photos_meta_data(photos).unwrap();

                let current_num = IN_PROGRESS_NUM.load(Ordering::SeqCst);
                IN_PROGRESS_NUM.store(current_num + n, Ordering::SeqCst);
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().expect("Failed to join on thread");
        }

        progress.lock().unwrap().reset_import_progress();
        drop(progress);

        let mut dates: date::Dates = date::Dates::empty();
        for key in arc_date_list.read().unwrap().keys() {
            // Skip empty keys
            if !key.trim().is_empty() {
                dates
                    .dates
                    .push(date::Date::from_string(key, Option::Some("-")));
            }
        }

        return Result::Ok(dates);
    }

    pub fn add_photo_file(&mut self, file: file::File) {
        self.selected_photo_files.push(file);
    }
}

impl Importer {
    pub fn new(
        directory: String,
        page: usize,
        num: usize,
        date_after: Option<date::Date>,
    ) -> Importer {
        let sort = repository::Sort::Time;
        let dir = dir::Dir::new(directory);
        return Importer {
            dirs_files: dir.find_files_and_dirs(sort, page, num, date_after),
            page: page,
            num: num,
            paths: vec![],
        };
    }

    pub fn set_importer_paths(&mut self, paths: Vec<String>) {
        for path in paths {
            let r = file::File::new_if_exists(path.clone());
            if r.is_some() {
                self.paths.push(path);
            }
        }
    }

    pub fn update(
        &mut self,
        directory: String,
        page: usize,
        num: usize,
        date_after: Option<date::Date>,
    ) {
        let dir = dir::Dir::new(directory);
        let sort = repository::Sort::Time;
        self.dirs_files = dir.find_files_and_dirs(sort, page, num, date_after)
    }
}
