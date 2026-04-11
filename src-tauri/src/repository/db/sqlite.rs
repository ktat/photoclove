extern crate rusqlite;

use crate::domain::photo;
use crate::domain::photo_meta;
use crate::repository::*;
use crate::value::config;
use crate::value::date;
use crate::value::file;
use async_trait::async_trait;
use rusqlite::{params, Connection, Result};
#[derive(Debug)]
struct Dates {
    id: u16,
    date: String,
}

#[derive(Debug)]
struct Photos {
    id: u16,
    date_id: u16,
    path: String,
}

#[derive(Debug)]
struct PhotoExif {
    id: u16,
    photo_id: u16,
    key_name: String,
    value: String,
}

pub struct SQLite {
    pub path: file::File,
    conn: rusqlite::Connection,
}

#[async_trait]
impl RepositoryDB for SQLite {
    fn connect(&self) {
        // nothing to do
    }
    fn new_connect(&self) -> RepoDB {
        // nothing to do
        RepoDB::new(self.path.path.clone())
    }
    fn get_dates(&self) -> date::Dates {
        date::Dates { dates: Vec::new() }
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
        has_comment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        // SQLite implementation not fully implemented yet, return empty
        photo::Photos::new()
    }
    async fn get_next_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        opt_conf: Option<config::Config>,
    ) -> Option<photo::Photo> {
        // SQLite implementation not fully implemented yet
        Option::None
    }
    async fn get_prev_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        opt_conf: Option<config::Config>,
    ) -> Option<photo::Photo> {
        // SQLite implementation not fully implemented yet
        Option::None
    }
    async fn get_recent_photos(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        page: u32,
        sort: Sort,
        num: u32,
        offset: usize,
        star: i32,
        has_comment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        // SQLite implementation not fully implemented yet, return empty
        photo::Photos::new()
    }
    fn record_photos(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        return Ok(true);
    }
    fn get_photo_meta_data_in_date(&self, date: date::Date) -> HashMap<String, String> {
        HashMap::new()
    }
}

impl SQLite {
    pub fn new(path: String) -> Result<SQLite, rusqlite::Error> {
        let f = file::File::new(path);
        let conn = Connection::open("my_database.db")?;
        let mut s = SQLite { path: f, conn };
        s.init();
        Ok(s)
    }

    fn init(&mut self) {
        if !self.path.create_file_if_not_exists() {
            let create_sql = self.create_sql();
        }
    }

    fn create_sql(&mut self) -> String {
        "
        CREATE TABLE photos (
            id varchar,
            in_trushbox bool,
            created_at datetime
        );

         CREATE TABLE dates (
            id date
        );

         CREATE TABLE photo_comments (
            id int,
            photo_id varchar,
            comment text
        );
        "
        .to_string()
    }
}

static SETUP_SQL: [&str; 1] = ["
    CREATE TABLE dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE
    );
    CREATE INDEX idx_dates_date ON dates(date);

    CREATE TABLE photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_id INTEGER,
        path TEXT UNIQUE
    );

    CREATE TABLE photo_exif (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER,
        key_name TEXT,
        value TEXT,
        UNIQUE (photo_id, key_name)
    );
    CREATE INDEX idx_photo_exif_kv ON photo_exif(key_name, value);

    "];

pub fn setup(version: usize) {
    let mut i = 0;
    for sql in SETUP_SQL {
        i += 1;
        if version < i {
            // execute sql
        }
    }
}
