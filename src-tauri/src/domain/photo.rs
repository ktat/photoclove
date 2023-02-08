use crate::value::{date, exif, file};
use regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photo {
    pub file: file::File,
    pub dir: file::Dir,
    pub time: String,
    pub meta_data: exif::ExifData,
    is_meta_not_loaded: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photos {
    pub photos: Vec<Photo>,
    pub has_next: bool,
    pub has_prev: bool,
}

impl Photo {
    pub fn new(file: file::File) -> Photo {
        let created_time = file.created_datetime();
        let d = file.path.clone();
        let p = std::path::Path::new(&d);

        Photo {
            file: file,
            time: created_time,
            dir: file::Dir::new(p.parent().unwrap().display().to_string()),
            meta_data: exif::ExifData::empty(),
            is_meta_not_loaded: true,
        }
    }

    pub fn new_with_exif(file: file::File) -> Photo {
        let mut photo = Photo::new(file.clone());
        let meta = exif::ExifData::new(file);
        photo.embed_exif(meta);
        photo.is_meta_not_loaded = false;
        photo
    }

    pub fn embed_exif(&mut self, meta: exif::ExifData) {
        self.time = meta.date_time.clone();
        self.meta_data = meta;
        self.is_meta_not_loaded = false;
    }

    pub fn load_exif(&mut self) {
        if self.is_meta_empty() {
            let meta = exif::ExifData::new(self.file.clone());
            self.embed_exif(meta);
            self.is_meta_not_loaded = false;
        }
    }

    pub fn is_meta_empty(&self) -> bool {
        self.is_meta_not_loaded
    }

    pub fn created_date_string(&self) -> String {
        let re = regex::Regex::new(r"^([0-9]{4})/([0-9]{1,2})/([0-9]{1,2}).+$").unwrap();
        let replaced = re.replace(&self.time, "$1-$2-$3").to_string();
        replaced
    }

    pub fn created_date(&self) -> date::Date {
        let re = regex::Regex::new(r"^([0-9]{4})/([0-9]{1,2})/([0-9]{1,2}).+$").unwrap();
        let replaced = re.replace(&self.time, "$1-$2-$3").to_string();
        date::Date::from_string(&replaced, Option::Some("-"))
    }
}

impl Photos {
    pub fn new() -> Photos {
        Photos {
            photos: Vec::new(),
            has_next: false,
            has_prev: false,
        }
    }
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::photo;
    use crate::value::file;

    #[test]
    fn test_constructor() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f);
        assert_eq!(p.file.path, "/tmp/photoclove.test.dummy.jpg".to_string())
    }
    #[test]
    fn test_photos() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let f2 = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f);
        let p2 = photo::Photo::new(f2);
        let mut photos = photo::Photos::new();
        photos.photos.push(p);
        photos.photos.push(p2);

        assert_eq!(photos.photos.len(), 2);
    }
}
