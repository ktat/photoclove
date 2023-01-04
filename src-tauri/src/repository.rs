pub mod db;
use crate::domain::photo;
use crate::domain::config;
use crate::value::date;

pub type RepoDB = crate::repository::db::directory::Directory;

pub enum Sort {
    Time,
    Name,
}

pub(crate) trait RepositoryDB {  
    fn connect(&self);
    fn get_dates(&self) -> date::Dates;
    fn embed_photo_exif_data(&self, photo: photo::Photo);
    fn get_photos_in_date(&self, date: date::Date, sort: Sort, num: u32, page: u32) -> photo::Photos;
}

trait RepositoryConfig {
    fn get_cofnig(&mut self) -> config::Config;
}