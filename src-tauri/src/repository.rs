pub mod db;
use rexif;
use crate::domain::config::*;
use crate::domain::photo::*;
use crate::value::date::*;

pub type RepoDB = crate::repository::db::directory::directory::Directory;

pub(crate) trait RepositoryDB {  
    fn connect(&self);
    fn get_dates(&self) -> date::Dates;
    fn embed_photo_exif_data(&self, photo: photo::Photo);
    fn get_photos_in_date(&self, date: date::Date) -> photo::Photos;
}

trait RepositoryConfig {
    fn get_cofnig(&mut self) -> config::Config;
}