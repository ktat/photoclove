// just a dummy module for test

use crate::domain::photo;
use crate::repository::*;
use crate::value::{date, file, meta};
use csv::{Reader, Writer};
use file_lock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::{fs, path};
use tempfile;

static META_INFO_FILE_NAME: &str = ".photoclove-dir-info.tsv";
#[derive(Debug, Deserialize, Serialize)]
struct PhotoInfo {
    path: String,
    date: String,
}

pub struct Directory {
    path: file::Dir,
}

impl RepositoryDB for Directory {
    fn connect(&self) {
        // nothing to do
    }
    fn new_connect(&self) -> RepoDB {
        // nothing to do
        RepoDB::new(self.path.path.clone())
    }
    fn get_dates(&self) -> date::Dates {
        let mut dates = date::Dates { dates: Vec::new() };
        let mut dirs = self.path.find_date_like_directories();
        for mut dir in dirs.dirs {
            let d = dir.to_date();
            if d.is_some() {
                dates.dates.push(d.unwrap())
            }
        }
        dates
            .dates
            .sort_by(|a, b| b.to_string().cmp(&a.to_string()));
        dates
    }
    fn get_photos_in_date(
        &self,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos {
        let meta_data = self.get_photo_meta_data_in_date(date);
        let dir = self.path.child(date.to_string());
        let files = dir.find_files();
        let mut photos = photo::Photos::new();
        let mut i = 0;
        let start_index = num * (page - 1);
        let end_index = start_index + num - 1;
        for f in files.files {
            i += 1;
            if (i - 1) < start_index {
                photos.has_prev = true;
                continue;
            }
            if (i - 1) > end_index {
                photos.has_next = true;
                break;
            }

            let mut p = photo::Photo::new(f.clone());
            let mut meta = meta::MetaData::empty();
            let result = meta_data.get(&f.path);
            if result.is_none() {
                eprintln!("no meta info: {:?}", &f);
                meta.DateTime = f.created_datetime();
            } else {
                meta.DateTime = result.unwrap().to_string();
            }
            p.embed_meta(meta);
            photos.files.push(p)
        }
        if sort == Sort::Name {
            photos.files.sort_by(|a, b| a.file.path.cmp(&b.file.path));
        } else if sort == Sort::Time {
            photos
                .files
                .sort_by(|a, b| a.file.created_date().cmp(&b.file.created_date()));
        } else {
            // photo time
            photos.files.sort_by(|a, b| a.time.cmp(&b.time));
        }
        photos
    }

    fn get_photo_meta_data_in_date(&self, date: date::Date) -> HashMap<String, String> {
        let dir = self.path.child(date.to_string());
        let info_path = path::Path::new(&dir.path).join(META_INFO_FILE_NAME);

        if info_path.exists() {
            let file = match fs::OpenOptions::new().read(true).open(&info_path) {
                Ok(file) => file,
                Err(e) => {
                    panic!("{:?} => {:?}", info_path, e);
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

    fn get_next_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut next_is_target = false;

        'outer: loop {
            let photos = self.get_photos_in_date(date.clone(), sort, 100, page);
            if photos.files.len() == 0 {
                break 'outer;
            }
            for photo in photos.files {
                if next_is_target {
                    return Option::Some(photo);
                }
                if photo.file.path == path.to_string() {
                    next_is_target = true;
                }
            }
            page += 1
        }
        return Option::None;
    }

    fn get_prev_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut prev_is_target = false;
        let mut ret: Option<photo::Photo> = None;

        'outer: loop {
            let photos = self.get_photos_in_date(date.clone(), sort, 100, page);
            if photos.files.len() == 0 {
                break 'outer;
            }
            for photo in photos.files {
                if photo.file.path == path.to_string() {
                    prev_is_target = true;
                }
                if prev_is_target {
                    return ret;
                }
                ret = Option::Some(photo)
            }
            page += 1
        }
        return Option::None;
    }

    fn record_photos(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
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

        return Ok(true);
    }
}

impl Directory {
    pub fn new(path: String) -> Directory {
        let dir = file::Dir::new(path);
        Directory { path: dir }
    }
}
