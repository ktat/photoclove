use crate::domain::photo_meta;
use crate::domain_service::{self, dir_service};
use crate::{
    domain::photo, repository, repository::meta_db, repository::MetaInfoDB, value::comment,
    value::date, value::file, value::star,
};
use csv::{ReaderBuilder, WriterBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path;

static META_INFO_FILE_NAME: &str = ".photoclove-dir-info.tsv";

pub struct Tsv {
    path: file::Dir,
}

impl Tsv {
    pub fn new(path: String) -> Tsv {
        Tsv {
            path: file::Dir::new(path),
        }
    }

    pub fn meta_file_path_from_photo(&self, photo: &photo::Photo) -> path::PathBuf {
        let dir = photo.dir.clone();
        let info_path = path::Path::new(&dir.path).join(META_INFO_FILE_NAME);
        return info_path;
    }

    pub fn meta_file_path_for_date(&self, date: String) -> path::PathBuf {
        let dir = self.path.child(date);
        path::Path::new(&dir.path).join(META_INFO_FILE_NAME)
    }

    pub fn get_lock(&self) -> file_lock::FileLock {
        let file_options = file_lock::FileOptions::new()
            .write(true)
            .read(true)
            .create(true)
            .append(true);
        let temp = tempfile::NamedTempFile::new().unwrap();
        let file_lock = file_lock::FileLock::lock(temp.path(), true, file_options);
        if file_lock.is_ok() {
            return file_lock.unwrap();
        } else {
            panic!("Error getting lock: {:?}", file_lock.err());
        }
    }

    fn read_photo_metas(&self, read_info_path: String) -> photo_meta::PhotoMetas {
        let file_option = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&read_info_path);
        let mut photo_metas = photo_meta::PhotoMetas::new();
        if file_option.is_ok() {
            let file = file_option.unwrap();
            let mut rdr = ReaderBuilder::new()
                .delimiter('\t' as u8)
                .flexible(true)
                .from_reader(file);
            for result in rdr.deserialize() {
                let record: meta_db::PhotoInfo = result.unwrap();
                match photo_meta::PhotoMeta::new_from_photo_info(&record) {
                    Some(photo_meta) => photo_metas.insert(&record.path.clone(), photo_meta),
                    _ => (),
                }
            }
        }
        return photo_metas;
    }

    fn write_photo_metas(&self, write_info_path: String, photo_metas: photo_meta::PhotoMetas) {
        let write_file_option = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(write_info_path.clone());
        if write_file_option.is_ok() {
            let write_file = write_file_option.unwrap();
            let mut wtr = WriterBuilder::new()
                .delimiter('\t' as u8)
                .from_writer(write_file);
            for (path, meta_info) in photo_metas.iter() {
                let record = meta_db::PhotoInfo {
                    path: path.to_string(),
                    date: meta_info.photo_time(),
                    star: meta_info.star.star(),
                    comment: meta_info.comment.comment(),
                };
                wtr.serialize(record).unwrap();
            }
        } else {
            panic!(
                "error writing file: {}({:?})",
                write_info_path,
                write_file_option.err()
            );
        }
    }
}

impl MetaInfoDB for Tsv {
    fn connect(&self, path: String) {}

    fn new_connect(&self) -> Tsv {
        Tsv::new(self.path.path.clone())
    }

    fn record_photo_metas(
        &self,
        info_path: path::PathBuf,
        photo_metas: photo_meta::PhotoMetas,
    ) -> Result<bool, &str> {
        let file_lock = self.get_lock();
        let write_info_path = info_path.display().to_string();
        self.write_photo_metas(write_info_path, photo_metas);
        file_lock.unlock().unwrap();
        Ok(true)
    }

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        let mut date_set = HashMap::new();
        for photo in photos {
            let mut photo = photo.clone();
            photo.load_exif();
            let date = &photo.dir.to_date().unwrap().to_string();
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
            let file_lock = self.get_lock();

            let info_path = self.meta_file_path_for_date(date.to_string());
            let read_info_path = info_path.display().to_string();
            let mut photo_metas = self.read_photo_metas(read_info_path.clone());
            for photo in photo_set {
                match photo_metas.get(&photo.file.path.clone()) {
                    Some(data) => {}
                    _ => {
                        photo_metas.insert(
                            &photo.file.path.clone(),
                            photo_meta::PhotoMeta::new_from_photo(photo),
                        );
                    }
                }
            }
            self.write_photo_metas(read_info_path.clone(), photo_metas);

            file_lock.unlock().unwrap();
            eprintln!("{:?}: csv creation end", date);
        }

        Ok(true)
    }

    fn record_photos_all_meta_data(&self, dates: date::Dates) -> Result<bool, &str> {
        for date in dates.dates {
            let date_dir = self.path.child(date.to_string());
            let files = dir_service::find_files(&date_dir);
            let photos = domain_service::photo_service::photos_from_dir(files);
            let result = self.record_photos_meta_data(photos.photos);
            if result.is_err() {
                eprintln!("{:?}", result.err());
            }
        }
        Ok(true)
    }

    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta {
        let date = photo.dir.clone().to_date().unwrap();
        let photo_metas = match self.get_photo_meta_data_in_date(date) {
            Ok(data) => data,
            Err(e) => photo_meta::PhotoMetas::new(),
        };
        match photo_metas.get(&photo.file.path) {
            Some(meta) => {
                return meta.clone();
            }
            None => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        }
    }

    fn get_photo_count_per_dates(&self, dates: date::Dates) -> repository::DatesNum {
        let mut dates_num = repository::DatesNum {
            data: HashMap::new(),
        };
        for date in dates.dates {
            match self.get_photo_meta_data_in_date(date) {
                Ok(data) => {
                    dates_num
                        .data
                        .insert(date.to_string(), data.iter().count() as i32);
                }
                Err(e) => (),
            };
        }
        dates_num
    }

    fn get_photo_meta_data_in_date(
        &self,
        date: date::Date,
    ) -> Result<photo_meta::PhotoMetas, String> {
        let info_path = self.meta_file_path_for_date(date.to_string());
        eprintln!("{:?}", info_path);
        if info_path.exists() {
            let file = match fs::OpenOptions::new().read(true).open(&info_path) {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("{:?} => {:?}", info_path, e);
                    return Err("cannot open file".to_string());
                }
            };
            let mut photo_metas = photo_meta::PhotoMetas::new();
            let mut rdr = ReaderBuilder::new()
                .delimiter('\t' as u8)
                .flexible(true)
                .from_reader(file);
            for result in rdr.deserialize() {
                if result.is_ok() {
                    let record: meta_db::PhotoInfo = result.unwrap();
                    match photo_meta::PhotoMeta::new_from_photo_info(&record) {
                        Some(photo_meta) => photo_metas.insert(&record.path.clone(), photo_meta),
                        _ => (),
                    }
                } else {
                    eprintln!("parse error: {:?}", result.err());
                }
            }
            return Ok(photo_metas);
        } else {
            eprintln!("file doesn't exist: {:?} ({:?})", info_path, date);
            return Err("file doesn't exist".to_string());
        }
    }

    fn save_star(&self, photo: &photo::Photo, star: star::Star) {
        let mut dir = photo.dir.clone();
        let mut photo_metas = match self.get_photo_meta_data_in_date(dir.to_date().unwrap()) {
            Ok(data) => data,
            Err(e) => photo_meta::PhotoMetas::new(),
        };
        let file_path = photo.file.path.clone();
        match photo_metas.get(&file_path) {
            Some(data) => {
                let mut new_data = data.clone();
                new_data.set_star(star);
                photo_metas.insert(&file_path, new_data);
            }
            _ => {
                let mut data = photo_meta::PhotoMeta::new_from_photo(photo);
                data.set_star(star);
                photo_metas.insert(&file_path, data);
            }
        }
        let info_path = self.meta_file_path_from_photo(photo);
        self.record_photo_metas(info_path, photo_metas);
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        let mut dir = photo.dir.clone();
        let mut photo_metas = match self.get_photo_meta_data_in_date(dir.to_date().unwrap()) {
            Ok(data) => data,
            Err(e) => photo_meta::PhotoMetas::new(),
        };
        let file_path = photo.file.path.clone();
        match photo_metas.get(&file_path) {
            Some(data) => {
                let mut new_data = data.clone();
                new_data.set_comment(comment);
                photo_metas.insert(&file_path, new_data);
            }
            _ => {
                let mut data = photo_meta::PhotoMeta::new_from_photo(photo);
                data.set_comment(comment);
                photo_metas.insert(&file_path, data);
            }
        }
        let info_path = self.meta_file_path_from_photo(photo);
        self.record_photo_metas(info_path, photo_metas);
    }
}
