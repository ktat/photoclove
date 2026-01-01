// just a dummy module for test

use crate::domain_service::dir_service;
use crate::entity::{config, photo, photo_meta};
use crate::repository::{self, RepoDB, RepositoryDB, Sort};
use crate::value::{date, exif, file};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Deserialize, Serialize)]
struct PhotoInfo {
    path: String,
    date: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DatesNum {
    data: HashMap<String, i32>,
}

#[derive(Clone)]
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
        log::debug!(target: "directory", "photo_count_check; dir={:?}", dir);
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
        offset: usize,
        star: i32,
        hasComment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        let dir = self.path.child(date.to_string());
        let mut photos = photo::Photos::new();
        let mut conf: config::Config = config::Config::template();
        let has_opt = opt_conf.is_some();
        if has_opt {
            conf = opt_conf.unwrap();
        }

        // Parse extension filter
        let extension_filters: Vec<&str> = if extension == "all" || extension.is_empty() {
            vec![]
        } else {
            extension
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect()
        };
        if meta_data.keys().len() == 0 {
            let files = dir_service::find_files(&dir);
            for f in files.files {
                // Apply extension filter
                if !extension_filters.is_empty() {
                    let file_extension = f.path.split('.').last().unwrap_or("").to_lowercase();
                    if !extension_filters
                        .iter()
                        .any(|&ext| ext.to_lowercase() == file_extension)
                    {
                        continue;
                    }
                }

                let mut p: photo::Photo;
                if has_opt {
                    p = photo::Photo::new(f.clone(), Option::Some(conf.clone()));
                    p.set_has_thumbnail();
                } else {
                    p = photo::Photo::new(f.clone(), Option::None);
                }
                let mut meta = exif::ExifData::empty();
                let result = meta_data.get(&f.path);
                if result.is_none() {
                    log::debug!(target: "directory", "photo_meta_missing; file={:?}", &f);
                    meta.date_time = f.created_datetime();
                    log::debug!(target: "directory", "photo_meta_fallback; date_time={}", meta.date_time);
                    // No metadata available, use defaults
                    p.set_star(0);
                    p.set_comment("".to_string());
                } else {
                    let photo_meta = result.unwrap();
                    meta.date_time = photo_meta.photo_time();
                    // Set star and comment from metadata
                    p.set_star(photo_meta.star.star());
                    p.set_comment(photo_meta.comment.comment());
                }
                p.embed_exif(meta);
                photos.photos.push(p)
            }
        } else {
            for f in meta_data.keys() {
                let md = meta_data.get(f).unwrap();
                if star > 0 && md.star.star() < star {
                    continue;
                }
                if hasComment && md.comment.comment().len() == 0 {
                    continue;
                }

                // Apply extension filter
                if !extension_filters.is_empty() {
                    let file_extension = f.split('.').last().unwrap_or("").to_lowercase();
                    if !extension_filters
                        .iter()
                        .any(|&ext| ext.to_lowercase() == file_extension)
                    {
                        continue;
                    }
                }
                let file_result = file::File::new_if_exists(f.to_string());
                if file_result.is_none() {
                    continue;
                }
                let file = file_result.unwrap();
                let mut p: photo::Photo;
                if has_opt {
                    p = photo::Photo::new(file, Option::Some(conf.clone()));
                    p.set_has_thumbnail();
                } else {
                    p = photo::Photo::new(file, Option::None);
                }
                let mut meta = exif::ExifData::empty();
                let photo_meta = meta_data.get(f).unwrap();
                meta.date_time = photo_meta.photo_time();
                p.embed_exif(meta);
                // Set CSS style from metadata
                p.set_css_style(photo_meta.photo().css_style.clone());
                // Set star and comment from metadata
                p.set_star(photo_meta.star.star());
                p.set_comment(photo_meta.comment.comment());
                // Set tags from metadata
                p.set_tags_from_string(photo_meta.tags_string());
                photos.photos.push(p)
            }
        }
        // Sort photos based on the specified sort type and direction
        log::info!(target: "sorting", "sort_photos; sort_type={:?}; photo_count={}", sort, photos.photos.len());
        match sort {
            // Shot time (EXIF photo time) sorts
            Sort::PhotoTimeDesc | Sort::PhotoTime => {
                log::debug!(target: "sorting", "applying_photo_time_desc_sort");
                // Log first 3 photos' time values for debugging
                if photos.photos.len() > 0 {
                    let sample_size = std::cmp::min(3, photos.photos.len());
                    for i in 0..sample_size {
                        log::debug!(target: "sorting", "before_sort_sample; index={}; time={}; path={}",
                            i, photos.photos[i].time(), photos.photos[i].file.path);
                    }
                }
                // Descending: newest photos first (reverse chronological)
                photos.photos.sort_by(|a, b| match b.time().cmp(&a.time()) {
                    Ordering::Equal => a.file.path.cmp(&b.file.path),
                    other => other,
                });
                // Log after sorting
                if photos.photos.len() > 0 {
                    let sample_size = std::cmp::min(3, photos.photos.len());
                    for i in 0..sample_size {
                        log::debug!(target: "sorting", "after_sort_sample; index={}; time={}; path={}",
                            i, photos.photos[i].time(), photos.photos[i].file.path);
                    }
                }
            }
            Sort::PhotoTimeAsc => {
                // Ascending: oldest photos first (chronological)
                photos.photos.sort_by(|a, b| match a.time().cmp(&b.time()) {
                    Ordering::Equal => a.file.path.cmp(&b.file.path),
                    other => other,
                });
            }

            // Added time (created_at in database) sorts
            Sort::AddedTimeDesc => {
                // Descending: newest additions first
                photos
                    .photos
                    .sort_by(|a, b| match b.file.created_at.cmp(&a.file.created_at) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
            }
            Sort::AddedTimeAsc => {
                // Ascending: oldest additions first
                photos
                    .photos
                    .sort_by(|a, b| match a.file.created_at.cmp(&b.file.created_at) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
            }

            // Star rating sorts
            Sort::StarDesc => {
                // Descending: 5 star → 0 star
                photos.photos.sort_by(|a, b| {
                    let star_a = a.star.unwrap_or(0);
                    let star_b = b.star.unwrap_or(0);
                    match star_b.cmp(&star_a) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }
            Sort::StarAsc => {
                // Ascending: 0 star → 5 star
                photos.photos.sort_by(|a, b| {
                    let star_a = a.star.unwrap_or(0);
                    let star_b = b.star.unwrap_or(0);
                    match star_a.cmp(&star_b) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }

            // File name sorts
            Sort::NameDesc => {
                // Descending: Z→A
                photos.photos.sort_by(|a, b| b.file.path.cmp(&a.file.path));
            }
            Sort::NameAsc | Sort::Name => {
                // Ascending: A→Z
                photos.photos.sort_by(|a, b| a.file.path.cmp(&b.file.path));
            }

            // Legacy Time (file created time)
            Sort::Time => {
                photos.photos.sort_by(|a, b| {
                    match a.file.created_date().cmp(&b.file.created_date()) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }
        }

        let mut start_index = (num * (page - 1)) as usize;
        start_index = start_index + offset;
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

    async fn get_recent_photos(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        page: u32,
        _sort: Sort,
        num: u32,
        offset: usize,
        star: i32,
        hasComment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        let mut photos = photo::Photos::new();
        let mut conf: config::Config = config::Config::template();
        let has_opt = opt_conf.is_some();
        if has_opt {
            conf = opt_conf.unwrap();
        }

        // Parse extension filter
        let extension_filters: Vec<&str> = if extension == "all" || extension.is_empty() {
            vec![]
        } else {
            extension
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect()
        };

        // Use metadata to get all photos (recent photos are already sorted by DB query)
        for f in meta_data.keys() {
            let md = meta_data.get(f).unwrap();
            if star > 0 && md.star.star() < star {
                continue;
            }
            if hasComment && md.comment.comment().len() == 0 {
                continue;
            }

            // Apply extension filter
            if !extension_filters.is_empty() {
                let file_extension = f.split('.').last().unwrap_or("").to_lowercase();
                if !extension_filters
                    .iter()
                    .any(|&ext| ext.to_lowercase() == file_extension)
                {
                    continue;
                }
            }
            let file_result = file::File::new_if_exists(f.to_string());
            if file_result.is_none() {
                continue;
            }
            let file = file_result.unwrap();
            let mut p: photo::Photo;
            if has_opt {
                p = photo::Photo::new(file, Option::Some(conf.clone()));
                p.set_has_thumbnail();
            } else {
                p = photo::Photo::new(file, Option::None);
            }
            let mut meta = exif::ExifData::empty();
            let photo_meta = meta_data.get(f).unwrap();
            meta.date_time = photo_meta.photo_time();
            p.embed_exif(meta);
            p.set_css_style(photo_meta.photo().css_style.clone());
            p.set_star(photo_meta.star.star());
            p.set_comment(photo_meta.comment.comment());
            // Set tags from metadata
            p.set_tags_from_string(photo_meta.tags_string());
            photos.photos.push(p)
        }

        // Photos are already sorted by database query (created_at DESC)
        // No additional sorting needed

        // Apply pagination
        let mut start_index = (num * (page - 1)) as usize;
        start_index = start_index + offset;
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
        config: Option<config::Config>,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut next_is_target = false;

        'outer: loop {
            let photos = self
                .get_photos_in_date(
                    meta_data,
                    date.clone(),
                    sort,
                    100,
                    page,
                    0,
                    0,
                    false,
                    "all",
                    Option::None,
                )
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
        config: Option<config::Config>,
    ) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut prev_is_target = false;
        let mut ret: Option<photo::Photo> = None;

        'outer: loop {
            let photos = self
                .get_photos_in_date(
                    meta_data,
                    date.clone(),
                    sort,
                    100,
                    page,
                    0,
                    0,
                    false,
                    "all",
                    Option::None,
                )
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

    async fn move_photos_to_exif_date(&self, date: date::Date) -> date::Dates {
        let dir = self.path.child(date.to_string());
        let files = dir_service::find_files(&dir);
        let mut dates_to_be_changed: HashMap<String, bool> = HashMap::new();
        for file in files.files {
            let photo = photo::Photo::new_with_exif(file);
            let new_dir = self.path.child(photo.created_date_string());
            if dir.path != new_dir.path {
                dates_to_be_changed
                    .entry(photo.created_date_string())
                    .or_insert(true);
                let filename = photo.file.filename();
                let new_pathbuf = new_dir.as_pathbuf();
                let new_path = new_pathbuf.as_path().join(filename);
                fs::rename(&photo.file.path, &new_path.display().to_string());
                log::info!(target: "directory", "file_move; from={}; to={}", photo.file.path, new_path.display().to_string());
            }
        }
        let mut dates = date::Dates::new(&[]);
        if dates_to_be_changed.keys().len() > 0 {
            dates_to_be_changed.insert(date.to_string(), true);
            for date_string in dates_to_be_changed.keys() {
                // Skip empty date strings
                if !date_string.trim().is_empty() {
                    dates
                        .dates
                        .push(date::Date::from_string(date_string, Option::Some("-")));
                }
            }
        }
        return dates;
    }
}
