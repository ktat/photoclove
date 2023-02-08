use crate::domain::photo_meta;
use crate::domain_service;
use crate::repository::meta_db;
use crate::{
    domain::photo, repository::MetaInfoDB, value::comment, value::date, value::file, value::star,
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
        let write_info_path = info_path.display().to_string();
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

        let file_options = file_lock::FileOptions::new()
            .write(true)
            .read(true)
            .create(true)
            .truncate(true);
        let temp = tempfile::NamedTempFile::new().unwrap();
        let file_lock = match file_lock::FileLock::lock(temp.path(), true, file_options) {
            Ok(lock) => lock,
            Err(err) => panic!("Error getting lock: {}", err),
        };

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

        file_lock.unlock().unwrap();

        Ok(true)
    }

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        let mut date_set = HashMap::new();
        for photo in photos {
            let mut photo = photo.clone();
            photo.load_exif();
            let date = &photo.dir.path.clone();
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
            let info_path = self.meta_file_path_from_photo(&photo_set[0]);

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
            let mut photo_metas = photo_meta::PhotoMetas::new();
            let mut rdr = ReaderBuilder::new()
                .delimiter('\t' as u8)
                .flexible(true)
                .from_reader(file);
            for result in rdr.deserialize() {
                let record: meta_db::PhotoInfo = result.unwrap();
                photo_metas.insert(
                    &record.path.clone(),
                    photo_meta::PhotoMeta::new_from_photo_info(&record),
                );
            }
            for photo in photo_set {
                photo_metas.insert(
                    &photo.file.path.clone(),
                    photo_meta::PhotoMeta::new_from_photo(photo),
                );
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

            let mut wtr = WriterBuilder::new()
                .delimiter('\t' as u8)
                .from_writer(write_file);
            for (path, meta_info) in photo_metas.iter() {
                let record = meta_db::PhotoInfo {
                    path: path.to_string(),
                    date: meta_info.photo_time(),
                    star: 0,
                    comment: "".to_string(),
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
            eprintln!("{:?}", &date_dir);
            let files = date_dir.find_files();
            let photos = domain_service::photo_service::photos_from_dir(files);
            let result = self.record_photos_meta_data(photos.photos);
            if result.is_err() {
                eprintln!("{:?}", result.err());
            }
        }
        Ok(true)
    }

    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta {
        let photo_metas = self.get_photo_meta_data_in_date(photo.created_date());
        match photo_metas.get(&photo.file.path) {
            Some(meta) => return meta.clone(),
            None => {
                return photo_meta::PhotoMeta::new(photo.clone());
            }
        }
    }

    fn get_photo_meta_data_in_date(&self, date: date::Date) -> photo_meta::PhotoMetas {
        let info_path = self.meta_file_path_for_date(date.to_string());

        if info_path.exists() {
            let file = match fs::OpenOptions::new().read(true).open(&info_path) {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("{:?} => {:?}", info_path, e);
                    return photo_meta::PhotoMetas::new();
                }
            };
            let mut photo_metas = photo_meta::PhotoMetas::new();
            let mut rdr = ReaderBuilder::new()
                .delimiter('\t' as u8)
                .flexible(true)
                .from_reader(file);
            for result in rdr.deserialize() {
                let record: meta_db::PhotoInfo = result.unwrap();
                photo_metas.insert(
                    &record.path.clone(),
                    photo_meta::PhotoMeta::new_from_photo_info(&record),
                );
            }
            return photo_metas;
        }
        return photo_meta::PhotoMetas::new();
    }

    fn save_star(&self, photo: &photo::Photo, star: star::Star) {
        let mut photo_metas = self.get_photo_meta_data_in_date(photo.created_date());
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
        eprintln!("{}", info_path.display());
        self.record_photo_metas(info_path, photo_metas);
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        let mut photo_metas = self.get_photo_meta_data_in_date(photo.created_date());
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
        eprintln!("{}", info_path.display());
        self.record_photo_metas(info_path, photo_metas);
    }
}
