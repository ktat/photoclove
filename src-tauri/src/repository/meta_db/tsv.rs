use crate::domain_service;
use crate::{domain::photo, repository::MetaInfoDB, value::date, value::file};
use csv::{Reader, Writer};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path;

static META_INFO_FILE_NAME: &str = ".photoclove-dir-info.tsv";

pub struct Tsv {
    path: file::Dir,
}

#[derive(Debug, Deserialize, Serialize)]
struct PhotoInfo {
    path: String,
    date: String,
}

impl Tsv {
    pub fn new(path: String) -> Tsv {
        Tsv {
            path: file::Dir::new(path),
        }
    }
}

impl MetaInfoDB for Tsv {
    fn connect(&self, path: String) {}

    fn new_connect(&self) -> Tsv {
        Tsv::new(self.path.path.clone())
    }

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        let mut date_set = HashMap::new();
        for photo in photos {
            let date = &photo.created_date();
            let v = date_set.get(date);
            let mut photos_set: Vec<photo::Photo> = Vec::new();
            if v.is_none() {
                photos_set.push(photo);
                date_set.insert(date.to_string(), photos_set);
            } else {
                photos_set = v.unwrap().to_vec();
                photos_set.push(photo);
                date_set.insert(date.to_string(), photos_set);
            }
        }

        for (date, photo_set) in date_set.iter() {
            eprintln!("{:?}: csv creation start", date);
            let dir = photo_set[0].dir.clone();
            let info_path = path::Path::new(&dir.path).join(META_INFO_FILE_NAME);

            let temp = tempfile::NamedTempFile::new().unwrap();
            let file_options = file_lock::FileOptions::new()
                .write(true)
                .read(true)
                .create(true)
                .append(true);
            let file_lock = match file_lock::FileLock::lock(temp.path(), true, file_options) {
                Ok(lock) => lock,
                Err(err) => panic!("Error getting lock: {}", err),
            };
            let read_info_path = info_path.display().to_string();
            let write_info_path = read_info_path.clone();
            let file = match fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .open(&read_info_path)
            {
                Ok(file) => file,
                Err(e) => {
                    panic!("{:?} => {:?}", read_info_path, e);
                }
            };
            let mut photo_meta: HashMap<String, String> = HashMap::new();
            let mut rdr = Reader::from_reader(file);
            for result in rdr.deserialize() {
                let record: PhotoInfo = result.unwrap();
                photo_meta.insert(record.path, record.date);
            }
            for photo in photo_set {
                photo_meta.insert(photo.file.path.clone(), photo.time.clone());
            }

            let write_file = match fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .open(write_info_path)
            {
                Ok(file) => file,
                Err(e) => {
                    panic!("{}", e);
                }
            };

            let mut wtr = Writer::from_writer(write_file);
            for (path, date) in photo_meta.iter() {
                let record = PhotoInfo {
                    path: path.to_string(),
                    date: date.to_string(),
                };
                wtr.serialize(record).unwrap();
            }

            file_lock.unlock().unwrap();
            eprintln!("{:?}: csv creation end", date);
        }

        Ok(true)
    }

    fn record_photos_all_meta_data(&self, dates: date::Dates) -> Result<bool, &str> {
        for date in dates.dates {
            let date_dir = self.path.child(date.to_string());
            let files = date_dir.find_files();
            let photos = domain_service::photo_service::photos_from_dir(files);
            let result = self.record_photos_meta_data(photos.photos);
            if result.is_err() {
                eprintln!("{:?}", result.err());
            }
        }
        Ok(true)
    }

    fn get_photo_meta_data_in_date(&self, date: date::Date) -> HashMap<String, String> {
        let dir = self.path.child(date.to_string());
        let info_path = path::Path::new(&dir.path).join(META_INFO_FILE_NAME);

        if info_path.exists() {
            let file = match fs::OpenOptions::new().read(true).open(&info_path) {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("{:?} => {:?}", info_path, e);
                    return HashMap::new();
                }
            };
            let mut photo_meta: HashMap<String, String> = HashMap::new();
            let mut rdr = Reader::from_reader(file);
            for result in rdr.deserialize() {
                let record: PhotoInfo = result.unwrap();
                photo_meta.insert(record.path, record.date);
            }
            return photo_meta;
        }
        return HashMap::new();
    }
}
