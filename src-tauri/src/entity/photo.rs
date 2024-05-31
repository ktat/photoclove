use crate::entity::config::Config;
use crate::value::{date, exif, file};
use regex;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photo {
    pub file: file::File,
    pub dir: file::Dir,
    pub meta_data: exif::ExifData,
    time: String,
    is_exif_not_loaded: bool,
    is_meta_not_loaded: bool,
    pub has_thumbnail: bool,
    import_to: String,
    thumbnail_store: String,
    has_config: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photos {
    pub photos: Vec<Photo>,
    pub has_next: bool,
    pub has_prev: bool,
}

impl Photo {
    pub fn new(file: file::File, opt_conf: Option<Config>) -> Photo {
        let created_time = file.created_datetime();
        let dir = file.dir.clone();
        let mut import_to: String = "".to_string();
        let mut thumbnail_store: String = "".to_string();
        let has_config = opt_conf.is_some();
        if has_config {
            let conf = opt_conf.unwrap();
            import_to = conf.clone().import_to;
            thumbnail_store = conf.clone().thumbnail_store;
        }

        Photo {
            file: file,
            time: created_time,
            dir: file::Dir::new(dir),
            meta_data: exif::ExifData::empty(),
            is_exif_not_loaded: true,
            is_meta_not_loaded: true,
            has_thumbnail: false,
            import_to: import_to,
            thumbnail_store: thumbnail_store,
            has_config: has_config,
        }
    }

    pub fn time(&self) -> String {
        self.time.clone()
    }

    pub fn new_with_exif(file: file::File) -> Photo {
        let mut photo = Photo::new(file.clone(), Option::None);
        let meta = exif::ExifData::new(file);
        photo.embed_exif(meta);
        photo.is_exif_not_loaded = false;
        photo
    }

    pub fn embed_exif(&mut self, exif: exif::ExifData) {
        self.time = exif.date_time.clone();
        self.meta_data = exif;
        self.is_exif_not_loaded = false;
    }

    pub fn set_has_thumbnail(&mut self) {
        if self.has_config {
            let import_path = self.import_to.clone();
            let thumbnail_store = self.thumbnail_store.clone();
            let thumbnail_path = self.file.path.replace(&import_path, &thumbnail_store);
            let ext_regex = regex::Regex::new(r"\.JPG$").unwrap();
            let thumbnail_path_ext_changed = ext_regex.replace(&thumbnail_path, ".jpg");
            let file_option = fs::OpenOptions::new()
                .read(true)
                .open(&thumbnail_path_ext_changed.to_string());
            self.has_thumbnail = file_option.is_ok();
        } else {
            eprintln!("called set_has_thumbnail from photo doesn't have config");
        }
    }

    pub fn load_exif(&mut self) {
        if self.is_exif_empty() {
            let meta = exif::ExifData::new(self.file.clone());
            self.embed_exif(meta);
            self.is_exif_not_loaded = false;
        }
    }

    pub fn get_imported_dir_date(&self, import_path: String) -> date::Date {
        let path = self.file.path.clone();
        let reg = regex::Regex::new(r"/?[^/]+$").unwrap();
        let date_file_string = path.replace(&import_path, "");
        let date_string_with_slash = reg.replace(&date_file_string, "");
        let reg2 = regex::Regex::new(r"^/").unwrap();
        let date_string = reg2.replace(&date_string_with_slash, "");

        return date::Date::from_string(&date_string.to_string(), Option::Some("-"));
    }

    pub fn set_time(&mut self, time: String) {
        self.time = time;
        self.is_meta_not_loaded = false;
    }

    pub fn is_meta_empty(&self) -> bool {
        self.is_meta_not_loaded
    }

    pub fn is_exif_empty(&self) -> bool {
        self.is_exif_not_loaded
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
    use crate::entity::photo;
    use crate::value::file;

    #[test]
    fn test_constructor() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f, Option::None);
        assert_eq!(p.file.path, "/tmp/photoclove.test.dummy.jpg".to_string())
    }
    #[test]
    fn test_photos() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let f2 = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f, Option::None);
        let p2 = photo::Photo::new(f2, Option::None);
        let mut photos = photo::Photos::new();
        photos.photos.push(p);
        photos.photos.push(p2);

        assert_eq!(photos.photos.len(), 2);
    }
}
