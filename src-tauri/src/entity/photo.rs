use crate::entity::config::Config;
use crate::value::{date, exif, file};
use regex;
use serde::{Deserialize, Serialize};

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
    pub css_style: Option<String>,
    pub star: Option<i32>,
    pub comment: Option<String>,
    pub tags: Option<Vec<(i32, String, Option<String>)>>,
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
            css_style: None,
            star: None,
            comment: None,
            tags: None,
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

    pub fn get_thumbnail_path(&self) -> Option<String> {
        if !self.has_config {
            return None;
        }

        let import_path = &self.import_to;
        let thumbnail_store = &self.thumbnail_store;
        let thumbnail_path = self.file.path.replace(import_path, thumbnail_store);
        let ext_regex = regex::Regex::new(r"\.(?i)jpe?g$").unwrap();
        let thumbnail_path_ext_changed = ext_regex.replace(&thumbnail_path, ".jpg").to_string();

        if thumbnail_path == thumbnail_path_ext_changed {
            // maybe movie files
            Some(format!("{}.jpg", thumbnail_path))
        } else {
            Some(thumbnail_path_ext_changed)
        }
    }

    pub fn set_has_thumbnail(&mut self) {
        if self.has_config {
            let import_path = self.import_to.clone();
            let thumbnail_store = self.thumbnail_store.clone();
            let thumbnail_path = self.file.path.replace(&import_path, &thumbnail_store);
            let ext_regex = regex::Regex::new(r"\.(?i)jpe?g$").unwrap();
            let thumbnail_path_ext_changed = ext_regex.replace(&thumbnail_path, ".jpg").to_string();

            log::debug!(target: "photo", "thumbnail_check; original_path={}; import_path={}; thumbnail_store={}; thumbnail_path={}",
                self.file.path, import_path, thumbnail_store, thumbnail_path_ext_changed);

            if thumbnail_path == thumbnail_path_ext_changed {
                // maybe movie files
                let thumbnail_path_for_movie = format!("{}.jpg", thumbnail_path);
                let p = std::path::Path::new(&thumbnail_path_for_movie);
                self.has_thumbnail = p.exists();
                log::debug!(target: "photo", "thumbnail_check_movie; thumbnail_path={}; exists={}",
                    thumbnail_path_for_movie, self.has_thumbnail);
            } else {
                let p = std::path::Path::new(&thumbnail_path_ext_changed);
                self.has_thumbnail = p.exists();
                log::debug!(target: "photo", "thumbnail_check_photo; thumbnail_path={}; exists={}",
                    thumbnail_path_ext_changed, self.has_thumbnail);
            }
        } else {
            log::error!(target: "photo", "thumbnail_check_without_config; photo_path={:?}", self.file.path);
        }
    }

    pub fn load_exif(&mut self) {
        if self.is_exif_empty() {
            let meta = exif::ExifData::new(self.file.clone());
            self.embed_exif(meta);
            self.is_exif_not_loaded = false;
        }
    }

    pub fn get_imported_dir_date(&self) -> date::Date {
        let import_path = self.import_to.clone();
        if import_path.is_empty() {
            log::error!(target: "photo", "get_imported_dir_date_error_no_import_path; path={}, import_path={}", self.file.path, import_path);
            panic!("Import path is not set in Photo entity");
        }
        let path = self.file.path.clone();
        let reg = regex::Regex::new(r"/?[^/]+$").unwrap();
        let date_file_string = path.replace(&import_path, "");
        let date_string_with_slash = reg.replace(&date_file_string, "");
        let reg2 = regex::Regex::new(r"^/").unwrap();
        let date_string = reg2.replace(&date_string_with_slash, "");

        // Handle UUID-based directory structure: extract only the date part
        // For paths like "2025-06-20/cb06329f-01ad-4895-842e-dea81d3eaac4", we want just "2025-06-20"
        let date_only = if date_string.contains("/") {
            // Split by "/" and take the first part (the date)
            date_string
                .split("/")
                .next()
                .unwrap_or(&date_string)
                .to_string()
        } else {
            date_string.to_string()
        };

        // Check if date_only is empty before parsing
        if date_only.trim().is_empty() {
            log::error!(target: "photo", "get_imported_dir_date_error; path={}; import_path={}; date_string={}; date_only={}", 
                path, import_path, date_string, date_only);
            panic!("Invalid date string extracted from path: empty date_only");
        }

        return date::Date::from_string(&date_only, Option::Some("-"));
    }

    pub fn set_time(&mut self, time: String) {
        self.time = time;
        self.is_meta_not_loaded = false;
    }

    pub fn set_css_style(&mut self, css_style: Option<String>) {
        self.css_style = css_style;
    }

    pub fn set_star(&mut self, star: i32) {
        self.star = Some(star);
    }

    pub fn set_comment(&mut self, comment: String) {
        self.comment = Some(comment);
    }

    pub fn set_tags(&mut self, tags: Vec<(i32, String, Option<String>)>) {
        self.tags = Some(tags);
    }

    pub fn set_tags_from_string(&mut self, tags_string: Option<String>) {
        if let Some(tag_str) = tags_string {
            if !tag_str.is_empty() {
                let mut tags = Vec::new();
                for tag_entry in tag_str.split(',') {
                    let parts: Vec<&str> = tag_entry.split(':').collect();
                    if parts.len() >= 2 {
                        if let Ok(tag_id) = parts[0].parse::<i32>() {
                            let tag_name = parts[1].to_string();
                            let tag_color = if parts.len() > 2 && !parts[2].is_empty() {
                                Some(parts[2].to_string())
                            } else {
                                None
                            };
                            tags.push((tag_id, tag_name, tag_color));
                        }
                    }
                }
                self.tags = Some(tags);
            }
        }
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

        // Check if the replacement resulted in a valid date string
        if replaced == self.time || replaced.trim().is_empty() {
            log::error!(target: "photo", "created_date_parse_error; time={}; replaced={}", self.time, replaced);
            panic!("Invalid time format for date parsing: {}", self.time);
        }

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
