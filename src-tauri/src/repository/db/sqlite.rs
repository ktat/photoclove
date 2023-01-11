extern crate rusqlite;

use crate::repository::*;
use crate::value::file;
use crate::value::date;
use crate::domain::photo;
use rusqlite::{Connection, Result};


pub struct SQLite {
    pub path: file::File,
    conn: rusqlite::Connection,
}

 impl RepositoryDB for SQLite {
    fn connect(&self) {
        // nothing to do
    }
    fn get_dates(&self) -> date::Dates {
        date::Dates{ dates: Vec::new()}
    }        
    fn get_photos_in_date(&self, date: date::Date, sort: Sort, num: u32, page: u32) -> photo::Photos {
        photo::Photos::new()
    }
    fn get_next_photo_in_date(&self, path: &str, date: date::Date, sort: Sort) -> Option<photo::Photo> { Option::None}
    fn get_prev_photo_in_date(&self, path: &str, date: date::Date, sort: Sort) -> Option<photo::Photo> { Option::None}
 }

 impl SQLite {
    pub fn new(path: String) -> SQLite{
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
        if ! self.path.create_file_if_not_exists()  {
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
        ".to_string()
    }
}

