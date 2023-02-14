// just a dummy module for test

use crate::domain::{photo, photo_meta};
use crate::domain_service::dir_service;
use crate::repository::{self, meta_db, RepoDB, RepositoryDB, Sort};
use crate::value::{date, exif, file};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Serialize)]
struct PhotoInfo {
    path: String,
    date: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DatesNum {
    data: HashMap<String, i32>,
}

pub struct Directory {
    path: file::Dir,
}

impl Directory {
    pub fn new(path: String) -> Directory {
        let dir = file::Dir::new(path);
        Directory { path: dir }
    }
}

#[async_trait]
impl RepositoryDB for Directory {
    fn connect(&self) {
        // nothing to do
    }
    fn new_connect(&self) -> RepoDB {
        // nothing to do
        RepoDB::new(self.path.path.clone())
    }
    fn get_dates(&self) -> date::Dates {
        let mut dates = date::Dates::empty();
        let dirs = dir_service::find_date_like_directories(&self.path);
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

    fn get_photo_count_per_dates(
        &self,
        dates: date::Dates,
        meta_data: repository::DatesNum,
    ) -> crate::repository::DatesNum {
        let mut dates_num = repository::DatesNum::new();
        for date in dates.dates {
            let o = meta_data.data.get(&date.to_string());
            match o {
                Some(data) => {
                    dates_num.data.insert(date.to_string(), *data);
                }
                None => {
                    let count = self.get_photo_count_in_date(date);
                    dates_num.data.insert(date.to_string(), count);
                }
            }
        }
        return dates_num;
    }

    fn get_photo_count_in_date(&self, date: date::Date) -> i32 {
        let dir = self.path.child(date.to_string());
        eprintln!("{:?}", dir);
        let files = dir_service::find_files(&dir);
        return files.files.iter().count() as i32;
    }

    async fn get_photos_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos {
        let dir = self.path.child(date.to_string());
        let mut photos = photo::Photos::new();
        if meta_data.keys().len() == 0 {
            let files = dir_service::find_files(&dir);
            for f in files.files {
                let mut p = photo::Photo::new(f.clone());
                let mut meta = exif::ExifData::empty();
                let result = meta_data.get(&f.path);
                if result.is_none() {
                    eprintln!("no meta info: {:?}", &f);
                    meta.date_time = f.created_datetime();
                    eprintln!("use instead: {}", meta.date_time);
                } else {
                    meta.date_time = result.unwrap().photo_time();
                }
                p.embed_exif(meta);
                photos.photos.push(p)
            }
        } else {
            for f in meta_data.keys() {
                let file_result = file::File::new_if_exists(f.to_string());
                if file_result.is_none() {
                    continue;
                }
                let file = file_result.unwrap();
                let mut p = photo::Photo::new(file);
                let mut meta = exif::ExifData::empty();
                meta.date_time = meta_data.get(f).unwrap().photo_time();
                p.embed_exif(meta);
                photos.photos.push(p)
            }
        }
        if sort == Sort::Name {
            photos.photos.sort_by(|a, b| a.file.path.cmp(&b.file.path));
        } else if sort == Sort::Time {
            photos.photos.sort_by(
                |a, b| match a.file.created_date().cmp(&b.file.created_date()) {
                    Ordering::Equal => a.file.path.cmp(&b.file.path),
                    other => other,
                },
            );
        } else {
            // photo time
            photos.photos.sort_by(|a, b| match a.time().cmp(&b.time()) {
                Ordering::Equal => a.file.path.cmp(&b.file.path),
                other => other,
            });
        }

        let mut start_index = (num * (page - 1)) as usize;
        let mut end_index = start_index + (num as usize);

        if photos.photos.len() > 0 {
            photos.has_next = true;

            if photos.photos.len() <= end_index {
                end_index = photos.photos.len();
                photos.has_next = false;
            }
            if start_index >= photos.photos.len() {
                start_index = photos.photos.len() - 1;
            }
            photos.photos = photos.photos[start_index..end_index].to_vec();
            if start_index > 0 {
                photos.has_prev = true;
            }
        }
        photos
    }

    async fn get_next_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut next_is_target = false;

        'outer: loop {
            let photos = self
                .get_photos_in_date(meta_data, date.clone(), sort, 100, page)
                .await;
            if photos.photos.len() == 0 {
                break 'outer;
            }
            for photo in photos.photos {
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

    async fn get_prev_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut prev_is_target = false;
        let mut ret: Option<photo::Photo> = None;

        'outer: loop {
            let photos = self
                .get_photos_in_date(meta_data, date.clone(), sort, 100, page)
                .await;
            if photos.photos.len() == 0 {
                break 'outer;
            }
            for photo in photos.photos {
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
}
