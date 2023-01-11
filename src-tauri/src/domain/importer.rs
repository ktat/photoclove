use crate::value::file;
use super::photo;
use crate::repository;
use crate::repository::dir;
use serde::{Serialize, Deserialize};
use std::thread;
use std::fs;
use std::path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Importer {
    pub dirs_files: dir::DirsFiles,
    pub selected_photos: Vec<photo::Photo>,
    pub page: u32,
    pub num: u32,
}

impl Importer {
    pub fn new(dir: String, page: u32, num: u32) -> Importer {
        let sort = repository::Sort::Time;
        let dir = dir::Dir::new(dir);
        return Importer{
            dirs_files: dir.find_files_and_dirs(sort, page, num),
            selected_photos: Vec::new(),
            page: page,
            num: num,
        }
    }

    pub fn add_photo_file(&mut self, file: file::File) {
        self.selected_photos.push(photo::Photo::new(file));
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

    pub fn import_photos (&self, destination_dir: file::Dir) {
        let mut handles = vec![];
        let photos = &self.selected_photos;
        print!("Selected photos: {:?}", self.selected_photos);
        
        for photo in photos {
            print!("target: {}", photo.file.path);
            let filename = photo.file.filename();
            let destination_date_dir = path::Path::new(&destination_dir.path).join(photo.file.created_date());
            // TODO: check directory exists.
            fs::create_dir(destination_date_dir.clone());
            let destination_path = path::Path::new(&destination_date_dir).join(filename);
            let p = photo.file.path.clone();
            let handle = thread::spawn(move || {
                if p == destination_path.display().to_string() {
                     println!("ignore same file: {:?} to {:?}\n", p, destination_path);
                } else {
                    let result = fs::copy(p, destination_path.clone());
                    // print!("copy {:?} to {:?}\n", p, destination_path);
                    if result.is_err() {
                        println!("copy error: {:?}: {}", result.err(), destination_path.display());
                    }
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().expect("Failed to join on thread");
        }        
    }
}

