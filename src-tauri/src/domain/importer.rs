use crate::domain::photo;
use crate::repository::{self};
use crate::repository::{dir, MetaInfoDB};
use crate::value::{date, file};
use filetime;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::{
    fs,
    io::{self},
    path,
    sync::{Arc, Mutex},
    thread, time,
};

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
        if self.num < progress {
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
    ) -> bool {
        progress.lock().unwrap().now_importing = true;
        progress.lock().unwrap().num = self.selected_photo_files.len();
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
        for files in photos_file_chunks {
            let window = window.clone();
            let meta_db = origin_meta_db.new_connect();
            let arc_dest_path = Arc::clone(&destination_dir);
            let arc_trash_path = Arc::clone(&trash_dir);
            // eprintln!("{:?}", &arc_trash_path);
            let handle = thread::spawn(move || {
                let mut n: usize = 0;
                let mut photos: Vec<photo::Photo> = Vec::new();
                for file in files {
                    let filename = file.filename();
                    let photo = photo::Photo::new_with_exif(file.clone());
                    let destination_date_dir = arc_dest_path.join(photo.created_date_string());
                    let destination_path = destination_date_dir.join(filename);
                    if !destination_date_dir.exists() {
                        match fs::create_dir(destination_date_dir.clone()) {
                            Ok(_) => {}
                            Err(e) => {
                                eprintln!("cannot create directory: {}", e);
                            }
                        }
                    }
                    let p = file.path.clone();
                    if p == destination_path.display().to_string() {
                        eprintln!("ignore same file: {:?} to {:?}\n", p, destination_path);
                        n += 1;
                        continue;
                    } else {
                        let trash_file_path = arc_trash_path
                            .join(destination_path.clone().strip_prefix("/").unwrap());
                        eprintln!("trash_file_path: {:?}", &trash_file_path);
                        if trash_file_path.exists() {
                            n += 1;
                            continue;
                        }
                        let result = copy_file(&p, &destination_path.display().to_string());
                        thread::sleep(sleep_millis);
                        eprintln!("copy {:?} to {:?}\n", p, destination_path);
                        if result.is_err() {
                            eprintln!(
                                "copy error: {:?}: {}",
                                result.err(),
                                destination_path.display()
                            );
                        }
                    }
                    let df = file::File::new(destination_path.display().to_string());
                    let mut d_photo = photo::Photo::new(df.clone());
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
                                eprintln!("Error on emit: {:?}", e);
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

        return true;
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
