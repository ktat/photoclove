pub mod db;
pub mod dir;
use crate::domain::config;
use crate::domain::photo;
use crate::value::date;
use std::collections::HashMap;

pub type RepoDB = crate::repository::db::directory::Directory;

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum Sort {
    PhotoTime,
    Time,
    Name,
}

pub fn sort_from_int(i: i32) -> Sort {
    match i {
        0 => Sort::PhotoTime,
        1 => Sort::Name,
        2 => Sort::Name,
        _ => Sort::PhotoTime,
    }
}

pub(crate) trait RepositoryDB {
    fn connect(&self);
    fn get_dates(&self) -> date::Dates;
    fn new_connect(&self) -> RepoDB;
    fn get_next_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo>;
    fn get_prev_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo>;
    fn get_photos_in_date(
        &self,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos;
    fn record_photos(&self, photos: Vec<photo::Photo>) -> Result<bool, &str>;
    fn get_photo_meta_data_in_date(&self, date: date::Date) -> HashMap<String, String>;
}
trait RepositoryConfig {
    fn get_cofnig(&mut self) -> config::Config;
}
