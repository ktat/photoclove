// just a dummy module for test

use crate::domain::photo;
use crate::repository::{meta_db, RepoDB, RepositoryDB, Sort};
use crate::value::{date, file, meta};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Serialize)]
struct PhotoInfo {
    path: String,
    date: String,
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

    async fn get_photos_in_date(
        &self,
        meta_data: &meta_db::PhotoMetas,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos {
        let dir = self.path.child(date.to_string());
        let mut photos = photo::Photos::new();
        if meta_data.keys().len() == 0 {
            let files = dir.find_files();
            for f in files.files {
                let mut p = photo::Photo::new(f.clone());
                let mut meta = meta::MetaData::empty();
                let result = meta_data.get(&f.path);
                if result.is_none() {
                    eprintln!("no meta info: {:?}", &f);
                    meta.DateTime = f.created_datetime();
                    eprintln!("use instead: {}", meta.DateTime);
                } else {
                    meta.DateTime = result.unwrap().date.to_string();
                }
                p.embed_meta(meta);
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
                let mut meta = meta::MetaData::empty();
                meta.DateTime = meta_data.get(f).unwrap().date.clone();
                p.embed_meta(meta);
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
            photos.photos.sort_by(|a, b| match a.time.cmp(&b.time) {
                Ordering::Equal => a.file.path.cmp(&b.file.path),
                other => other,
            });
        }

        let mut start_index = (num * (page - 1)) as usize;
        let mut end_index = start_index + (num as usize);

        if photos.photos.len() > 0 {
            photos.has_next = true;

            if photos.photos.len() < end_index {
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
        meta_data: &meta_db::PhotoMetas,
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
        meta_data: &meta_db::PhotoMetas,
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
