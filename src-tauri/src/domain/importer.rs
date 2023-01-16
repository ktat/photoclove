use crate::value::file;
use super::photo;
use crate::repository;
use crate::repository::dir;
use serde::{Serialize, Deserialize};
use std::{thread,time,fs,path,sync::{Arc,Mutex},io::{self, Write, Read}};
use std::sync::atomic::{AtomicUsize, Ordering};

const BLOCK_SIZE: usize = 16 * 1024 * 1024; // 16MB
static IN_PROGRESS_NUM: AtomicUsize = AtomicUsize::new(1);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Importer {
    pub dirs_files: dir::DirsFiles,
    pub page: u32,
    pub num: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImportProgress {
    pub now_importing: bool,
    pub progress: usize,
    pub num: usize,
}

impl ImportProgress {
    pub fn new() -> ImportProgress {
        return ImportProgress{
            now_importing: false,
            num: 0,
            progress: 0,
        };
    }

    pub fn get_import_progress(&self) -> usize {
        return IN_PROGRESS_NUM.load(Ordering::SeqCst)
    }

    pub fn reset_import_progress(&self)  {
        IN_PROGRESS_NUM.store(0, Ordering::SeqCst)
    }
}

pub struct ImporterSelected {
    selected_photos: Vec<photo::Photo>
}

fn copy_file(src: &str, dst: &path::PathBuf) -> io::Result<usize> {
    let src_path = path::Path::new(src);
    let src_file = fs::File::open(src_path).unwrap();
    let dst_file = fs::File::create(dst.as_path()).unwrap();

    let mut reader = io::BufReader::new(src_file);
    let mut writer = dst_file;
    let mut buffer = [0u8; BLOCK_SIZE];
    let mut total_bytes = 0;

    loop {
        let bytes_read = reader.read(&mut buffer).unwrap();
        if bytes_read == 0 {
            break;
        }
        total_bytes += bytes_read;
        writer.write_all(&buffer[..bytes_read])?;
    }

    Ok(total_bytes)
}

impl ImporterSelected {
    pub fn new() -> ImporterSelected {
        ImporterSelected{
            selected_photos: Vec::new(),
        }
    }

    pub fn import_photos (
        &self, 
        destination_dir: Arc<path::PathBuf>, 
        copy_parallel: usize, 
        progress: Arc<&Mutex<ImportProgress>>
    ) -> bool {
        progress.lock().unwrap().now_importing = true;
        progress.lock().unwrap().num = self.selected_photos.len();
        let mut handles = vec![];
        let mut photos_chunks :Vec<Vec<photo::Photo>> = Vec::new();
        let len = self.selected_photos.len();
        let n = len / copy_parallel;
        let mut i = 0;
        let mut photos: Vec<photo::Photo> = Vec::new();
        for photo in &self.selected_photos {
            photos.push(photo::Photo::fast_new(file::File::new(photo.file.path.clone())));
            i += 1;
            if i > n {
                photos_chunks.push(photos);
                i = 0;
                photos = Vec::new();
            }
        }
        if photos.len() > 0 {
            photos_chunks.push(photos);
        }
        let ln = photos_chunks.len();
        
        let ten_millis = time::Duration::from_millis(100);
        let t1 = time::SystemTime::now();
        for photos in photos_chunks {
            let arc_path = Arc::clone(&destination_dir);
            let handle = thread::spawn(move || {
            let mut n: usize= 0;
            for photo in photos {
                let filename = photo.file.filename();
                let destination_date_dir = arc_path.join(photo.file.created_date());
                let destination_path = destination_date_dir.join(filename);
                // TODO: check directory exists.
                fs::create_dir(destination_date_dir.clone());
                let p = photo.file.path.clone();
                if p == destination_path.display().to_string() {
                     println!("ignore same file: {:?} to {:?}\n", p, destination_path);
                } else {
                    let result = fs::copy(p, destination_path.clone());
                    // let result = copy_file(&p, &destination_path.clone());
                    thread::sleep(ten_millis);
                    // print!("copy {:?} to {:?}\n", p, destination_path);
                    if result.is_err() {
                        println!("copy error: {:?}: {}", result.err(), destination_path.display());
                    }
                }
                let t2 = time::SystemTime::now();
                let diff = t2.duration_since(t1).unwrap();
                n += 1;
                if diff.as_secs() > 2 {
                    let current_num = IN_PROGRESS_NUM.load(Ordering::SeqCst);
                    IN_PROGRESS_NUM.store(current_num + n, Ordering::SeqCst);
                    n = 0;
                }
            }});
            handles.push(handle);
        }
        drop(progress);

        // for handle in handles {
        //     handle.join().expect("Failed to join on thread");
        // } 
        return true;       
    }

    pub fn add_photo_file(&mut self, file: file::File) {
        self.selected_photos.push(photo::Photo::fast_new(file));
    }

    pub fn remove_photo_file (&mut self, file: file::File) {
        let mut new_photos: Vec<photo::Photo> = Vec::new();
        for photo in &self.selected_photos {
            if photo.file.path != file.path {
                new_photos.push(photo::Photo::new(photo.file.clone()))
            }
        }
        self.selected_photos = new_photos
    }

    
}

impl Importer {
    pub fn new(directory: String, page: u32, num: u32) -> Importer {
        let sort = repository::Sort::Time;
        let dir = dir::Dir::new(directory);
        return Importer{
            dirs_files: dir.find_files_and_dirs(sort, page, num),
            page: page,
            num: num,
        }
    }

    pub fn update(&mut self, directory: String, page: u32, num: u32) {
        let dir = dir::Dir::new(directory);
        let sort = repository::Sort::Time;
        self.dirs_files = dir.find_files_and_dirs(sort, page, num)
    }

}


