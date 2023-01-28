extern crate rusqlite;

use crate::domain::photo;
use crate::repository::*;
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
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
    ) -> photo::Photos {
        photo::Photos::new()
    }
    async fn get_next_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        self.get_photos_in_date(date, sort, 100, 1).await;
        Option::None
    }
    async fn get_prev_photo_in_date(
        &self,
        path: &str,
        date: date::Date,
        sort: Sort,
    ) -> Option<photo::Photo> {
        self.get_photos_in_date(date, sort, 100, 1).await;
        Option::None
    }
    fn record_photos(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        return Ok(true);
    }
    fn get_photo_meta_data_in_date(&self, date: date::Date) -> HashMap<String, String> {
        HashMap::new()
    }
}

impl SQLite {
    pub fn new(path: String) -> SQLite {
        let f = file::File::new(path);
        let conn = Connection::open("my_database.db");
        let mut s = SQLite {
            path: f,
            conn: conn.unwrap(),
        };
        s.init();
        s
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

         CREATE TABLE photo_tags (
            id int,
            photo_id varchar,
            tag_id int,
            created_at datetime
        );

         CREATE TABLE tags (
            id int,
            name varchar,
        );
        "
        .to_string()
    }
}

static SETUP_SQL: [&str; 1] = ["
    CREATE TABLE dates (
        id int auto_increment,
        date date,
        primary key (id),
        unique (date)
    );
    CREATE INDEX date on dates(date);

    CREATE TABLE photos (
        id int auto_increment,
        date_id int,
        path varchar,
        primary key (id),
        unique (path)
    );

    CREATE TABLE photo_exif (
        id int auto_increment,
        photo_id int,
        key_name varchar,
        value varchar,
        unique (photo_id,key_name)
    );
    CREATE INDEX photo_exif_kv on photo_exif(key_name,value);

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
