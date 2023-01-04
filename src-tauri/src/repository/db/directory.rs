// just a dummy module for test

use crate::repository::*;
use crate::value::file;
use crate::value::date;
use crate::domain::photo;
pub struct Directory {
    path: file::Dir
}

impl RepositoryDB for Directory {
    fn connect(&self) {
        // nothing to do
    }
    fn get_dates(&self) -> date::Dates {
        let mut dates = date::Dates{ dates: Vec::new()};
        let dirs = self.path.find_date_like_directories();
        for mut dir in dirs.dirs {
            dates.dates.push(dir.to_date())
        }
        dates
    }
    fn get_photos_in_date(&self, date: date::Date, sort: Sort, num: u32, page: u32) -> photo::Photos {
        let dir = self.path.child(date.to_string());
        let files = dir.find_files();
        let mut photos = photo::Photos{ files: Vec::new() };
        let mut i = 0;
        let start_index = num * (page - 1);
        let end_index = start_index + num - 1;
        for f in files.files {
            i += 1;
            if (i - 1) < start_index { continue }
            if (i - 1) > end_index {  break }

            let p = photo::Photo::new(f);
            photos.files.push(p)
        }
        photos
    }
    fn embed_photo_exif_data(&self, mut photo: photo::Photo) {
        photo.exif_entries = photo.exif();
    }
}

impl Directory {
    pub fn new(path: String) -> Directory {
        let dir = file::Dir::new(path);
        Directory{ path: dir }
    }
}
