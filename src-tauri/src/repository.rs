pub mod db;
pub mod dir;
pub mod meta_db;
use crate::domain::{config, photo, photo_meta};
use crate::value::{comment, date, star};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path;

pub type RepoDB = crate::repository::db::directory::Directory;
pub type MetaDB = crate::repository::meta_db::tsv::Tsv;

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum Sort {
    PhotoTime,
    Time,
    Name,
}
pub struct DatesNum {
    data: HashMap<String, i32>,
}

impl DatesNum {
    pub fn new() -> DatesNum {
        DatesNum {
            data: HashMap::new(),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.data).unwrap()
    }
}

pub fn sort_from_int(i: i32) -> Sort {
    match i {
        0 => Sort::PhotoTime,
        1 => Sort::Name,
        2 => Sort::Name,
        _ => Sort::PhotoTime,
    }
}

#[async_trait]
pub(crate) trait RepositoryDB {
    fn connect(&self);
    fn new_connect(&self) -> RepoDB;
    fn get_dates(&self) -> date::Dates;
    async fn get_next_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo>;
    async fn get_prev_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo>;
    async fn get_photos_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos;
    fn get_photo_count_per_dates(&self, dates: date::Dates, meta_data: DatesNum) -> DatesNum;
    fn get_photo_count_in_date(&self, date: date::Date) -> i32;
}
trait RepositoryConfig {
    fn get_cofnig(&mut self) -> config::Config;
}

pub(crate) trait MetaInfoDB {
    fn connect(&self, path: String);
    fn new_connect(&self) -> MetaDB;
    fn record_photo_metas(
        &self,
        info_path: path::PathBuf,
        photo_metas: photo_meta::PhotoMetas,
    ) -> Result<bool, &str>;
    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str>;
    fn record_photos_all_meta_data(&self, dates: date::Dates) -> Result<bool, &str>;
    fn get_photo_meta_data_in_date(
        &self,
        date: date::Date,
    ) -> Result<photo_meta::PhotoMetas, String>;
    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta;
    fn save_star(&self, photo: &photo::Photo, star: star::Star);
    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment);
    fn get_photo_count_per_dates(&self, dates: date::Dates) -> DatesNum;
}
