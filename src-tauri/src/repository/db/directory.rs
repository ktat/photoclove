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
        let mut dirs = self.path.find_date_like_directories();
        for mut dir in dirs.dirs {
            let d = dir.to_date();
            if d.is_some() {
                dates.dates.push(d.unwrap())
            }
        }
        dates.dates.sort_by(|a,b| 
            b.to_string().cmp(&a.to_string())
        );
        dates
    }
    fn get_photos_in_date(&self, date: date::Date, sort: Sort, num: u32, page: u32) -> photo::Photos {
        let dir = self.path.child(date.to_string());
        let files = dir.find_files();
        let mut photos = photo::Photos::new();
        let mut i = 0;
        let start_index = num * (page - 1);
        let end_index = start_index + num - 1;
        for f in files.files {
            i += 1;
            if (i - 1) < start_index { photos.has_prev = true; continue }
            if (i - 1) > end_index {  photos.has_next = true; break }

            let p = photo::Photo::new(f);
            photos.files.push(p)
        }
        if sort == Sort::Time {
            photos.files.sort_by(|a,b| a.file.created_date().cmp(&b.file.created_date()));
        } else {
            photos.files.sort_by(|a,b| a.file.path.cmp(&b.file.path));
        }
        photos
    }
    fn get_next_photo_in_date(&self, path: &str, date: date::Date, sort: Sort) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut next_is_target = false;
        
        'outer: loop {
            let photos = self.get_photos_in_date(date.clone(), sort, 100, page);
            if photos.files.len() == 0 {
                break 'outer;
            }
            for photo in photos.files {
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

    fn get_prev_photo_in_date(&self, path: &str, date: date::Date, sort: Sort) -> Option<photo::Photo> {
        let mut page: u32 = 1;
        let mut prev_is_target = false;
        let mut ret: Option<photo::Photo> = None;
        
        'outer: loop {
            let photos = self.get_photos_in_date(date.clone(), sort, 100, page);
            if photos.files.len() == 0 {
                break 'outer;
            }
            for photo in photos.files {
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
}

impl Directory {
    pub fn new(path: String) -> Directory {
        let dir = file::Dir::new(path);
        Directory{ path: dir }
    }
}
