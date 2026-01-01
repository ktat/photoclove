pub mod db;
pub mod dir;
pub mod meta_db;
use crate::entity::{config, photo, photo_meta};
use crate::value::{comment, date, star};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path;

pub type RepoDB = crate::repository::db::directory::Directory;
pub type MetaDB = crate::repository::meta_db::sqlite::SQLite;

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum Sort {
    // Shot time (EXIF photo time) with direction
    PhotoTimeDesc, // Value 0: Shot time descending (newest first)
    PhotoTimeAsc,  // Value 1: Shot time ascending (oldest first)

    // Added time (created_at in database) with direction
    AddedTimeDesc, // Value 2: Added time descending (newest first)
    AddedTimeAsc,  // Value 3: Added time ascending (oldest first)

    // Star rating with direction
    StarDesc, // Value 4: Star rating descending (5→0)
    StarAsc,  // Value 5: Star rating ascending (0→5)

    // File name with direction
    NameDesc, // Value 6: File name Z→A
    NameAsc,  // Value 7: File name A→Z

    // Legacy variants for backwards compatibility
    PhotoTime, // Fallback to PhotoTimeDesc
    Time,      // File created time (for import mode)
    Name,      // Fallback to NameAsc
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

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn contains_key(&self, key: &str) -> bool {
        self.data.contains_key(key)
    }
}

pub fn sort_from_int(i: i32) -> Sort {
    match i {
        0 => Sort::PhotoTimeDesc, // Shot time descending
        1 => Sort::PhotoTimeAsc,  // Shot time ascending
        2 => Sort::AddedTimeDesc, // Added time descending
        3 => Sort::AddedTimeAsc,  // Added time ascending
        4 => Sort::StarDesc,      // Star rating descending
        5 => Sort::StarAsc,       // Star rating ascending
        6 => Sort::NameDesc,      // File name Z→A
        7 => Sort::NameAsc,       // File name A→Z
        _ => Sort::PhotoTimeDesc, // Default fallback
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
        conifg: Option<config::Config>,
    ) -> Option<photo::Photo>;
    async fn get_prev_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        conifg: Option<config::Config>,
    ) -> Option<photo::Photo>;
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
        conifg: Option<config::Config>,
    ) -> photo::Photos;
    async fn get_recent_photos(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        page: u32,
        sort: Sort,
        num: u32,
        offset: usize,
        star: i32,
        hasComment: bool,
        extension: &str,
        conifg: Option<config::Config>,
    ) -> photo::Photos;
    async fn move_photos_to_exif_date(&self, date: date::Date) -> date::Dates;
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
    fn record_photos_all_meta_data(
        &self,
        dates: date::Dates,
    ) -> Result<HashMap<String, usize>, &str>;
    fn get_photo_meta_data_in_date(
        &self,
        date: date::Date,
    ) -> Result<photo_meta::PhotoMetas, String>;
    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta;
    fn get_photo_meta_from_trash(
        &self,
        photo: photo::Photo,
        trash_path: String,
        library_path: String,
    ) -> photo_meta::PhotoMeta;
    fn save_star(&self, photo: &photo::Photo, star: star::Star);
    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment);
    fn delete_photo(&self, photo: &photo::Photo);
    fn delete_photo_permanently(&self, photo: &photo::Photo);
    fn restore_photo_from_trash(&self, photo: &photo::Photo);
    fn update_photo_path(&self, old_path: &str, new_path: &str) -> Result<bool, &str>;
    fn get_photo_count_per_dates(&self, dates: date::Dates) -> DatesNum;
    fn get_recent_photos_metadata(&self, limit: u32) -> Result<photo_meta::PhotoMetas, String>;

    // Tag management methods
    fn get_all_tags(&self) -> Result<Vec<(i32, String, Option<String>)>, String>;
    fn get_all_tags_with_photo_count(
        &self,
    ) -> Result<Vec<(i32, String, Option<String>, i32)>, String>;
    fn create_tag(&self, name: &str, color: Option<&str>) -> Result<i32, String>;
    fn delete_tag(&self, tag_id: i32) -> Result<bool, String>;
    fn add_tag_to_photo(&self, photo_path: &str, tag_id: i32) -> Result<(), String>;
    fn remove_tag_from_photo(&self, photo_path: &str, tag_id: i32) -> Result<bool, String>;
    fn remove_all_tags_from_photo(&self, photo_path: &str) -> Result<i32, String>;
    fn get_tags_for_photo(
        &self,
        photo_path: &str,
    ) -> Result<Vec<(i32, String, Option<String>)>, String>;
    fn get_photos_with_tags(&self, tag_ids: &[i32]) -> Result<Vec<String>, String>;

    // Album management methods
    fn get_all_albums(&self) -> Result<Vec<(i32, String, String, Option<String>, i32)>, String>;
    fn create_album(&self, name: &str, description: &str) -> Result<i32, String>;
    fn update_album(
        &self,
        id: i32,
        name: &str,
        description: &str,
        cover_photo_path: Option<&str>,
    ) -> Result<bool, String>;
    fn delete_album(&self, id: i32) -> Result<bool, String>;
    fn add_photo_to_album(&self, album_id: i32, photo_path: &str) -> Result<(), String>;
    fn remove_photo_from_album(&self, album_id: i32, photo_path: &str) -> Result<bool, String>;
    fn get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String>;
    fn get_album_photos_with_metadata(
        &self,
        album_id: i32,
        config: config::Config,
    ) -> Result<Vec<photo::Photo>, String>;
    fn reorder_album_photos(&self, album_id: i32, photo_order: Vec<String>) -> Result<(), String>;

    // Unified PhotoCollection methods
    fn create_collection(
        &self,
        collection_type: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
    ) -> Result<i32, String>;
    fn get_all_collections(
        &self,
        collection_type: Option<&str>,
        config: config::Config,
    ) -> Result<Vec<serde_json::Value>, String>;
    fn update_collection(
        &self,
        id: i32,
        name: Option<&str>,
        description: Option<&str>,
        color: Option<&str>,
        cover_photo_path: Option<&str>,
    ) -> Result<(), String>;
    fn delete_collection(&self, id: i32) -> Result<bool, String>;
    fn add_photo_to_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String>;
    fn remove_photo_from_collection(
        &self,
        collection_id: i32,
        photo_path: &str,
    ) -> Result<(), String>;
    fn get_collection_photos(
        &self,
        collection_id: i32,
        ordered: bool,
    ) -> Result<Vec<photo::Photo>, String>;
}
