use crate::entity::config::Config;
use crate::value::{date, exif, file};
use regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PhotoTag {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
}

impl PhotoTag {
    pub fn new(id: i32, name: String, color: Option<String>) -> Self {
        PhotoTag { id, name, color }
    }
}

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
    pub tags: Option<Vec<PhotoTag>>,
    pub burst_group_id: Option<String>,
    pub burst_count: Option<u32>,
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
            file,
            time: created_time,
            dir: file::Dir::new(dir),
            meta_data: exif::ExifData::empty(),
            is_exif_not_loaded: true,
            is_meta_not_loaded: true,
            has_thumbnail: false,
            import_to,
            thumbnail_store,
            has_config,
            css_style: None,
            star: None,
            comment: None,
            tags: None,
            burst_group_id: None,
            burst_count: None,
        }
    }

    pub fn time(&self) -> String {
        self.time.clone()
    }

    /// Get absolute path by combining import_to + relative file.path
    pub fn absolute_path(&self) -> String {
        if self.import_to.is_empty() {
            // No import_to set, return path as-is (may already be absolute)
            return self.file.path.clone();
        }
        file::to_absolute_path(&self.file.path, &self.import_to)
    }

    pub fn new_with_exif(file: file::File) -> Photo {
        let mut photo = Photo::new(file.clone(), Option::None);
        let meta = exif::ExifData::new(file);
        photo.embed_exif(meta);
        photo.is_exif_not_loaded = false;
        photo
    }

    /// Create a Photo from database row data with pre-loaded exif data.
    /// Used for bulk operations like grouping where we load from DB.
    pub fn from_db_row(
        file: file::File,
        meta_data: exif::ExifData,
        star: Option<i32>,
        comment: Option<String>,
        burst_group_id: Option<String>,
    ) -> Photo {
        Photo {
            file,
            time: String::new(),
            dir: file::Dir::new(String::new()),
            meta_data,
            is_exif_not_loaded: false,
            is_meta_not_loaded: false,
            has_thumbnail: false,
            import_to: String::new(),
            thumbnail_store: String::new(),
            has_config: false,
            css_style: None,
            star,
            comment,
            tags: None,
            burst_group_id,
            burst_count: None,
        }
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

        let thumbnail_store = &self.thumbnail_store;
        // file.path is relative (e.g., "2024-01-15/uuid/photo.jpg")
        // Construct thumbnail path: thumbnail_store + "/" + relative_path
        let thumbnail_path = format!(
            "{}/{}",
            thumbnail_store.trim_end_matches('/'),
            self.file.path.trim_start_matches('/')
        );

        // RAW and HEIC/AVIF files: thumbnail is {filename_lowercase}.jpg
        if crate::utils::raw_file::is_raw_file(&self.file.path)
            || crate::utils::raw_file::is_heic_or_avif(&self.file.path)
        {
            let lowercase_path = thumbnail_path.to_lowercase();
            return Some(format!("{}.jpg", lowercase_path));
        }

        let ext_regex = regex::Regex::new(r"\.(?i)jpe?g$").unwrap();
        if ext_regex.is_match(&thumbnail_path) {
            // JPEG file: normalize extension to .jpg
            Some(ext_regex.replace(&thumbnail_path, ".jpg").to_string())
        } else {
            // Non-JPEG file (movie, etc.): append .jpg
            Some(format!("{}.jpg", thumbnail_path))
        }
    }

    pub fn set_has_thumbnail(&mut self) {
        if self.has_config {
            let thumbnail_store = self.thumbnail_store.clone();
            // file.path is relative; construct thumbnail path: thumbnail_store + "/" + relative_path
            let thumbnail_path = format!(
                "{}/{}",
                thumbnail_store.trim_end_matches('/'),
                self.file.path.trim_start_matches('/')
            );

            // RAW and HEIC/AVIF files: thumbnail is {filename_lowercase}.jpg
            if crate::utils::raw_file::is_raw_file(&self.file.path)
                || crate::utils::raw_file::is_heic_or_avif(&self.file.path)
            {
                let raw_thumbnail_path = format!("{}.jpg", thumbnail_path.to_lowercase());
                let p = std::path::Path::new(&raw_thumbnail_path);
                self.has_thumbnail = p.exists();
                log::debug!(target: "photo", "thumbnail_check_raw; thumbnail_path={}; exists={}",
                    raw_thumbnail_path, self.has_thumbnail);
            } else {
                let ext_regex = regex::Regex::new(r"\.(?i)jpe?g$").unwrap();

                if ext_regex.is_match(&thumbnail_path) {
                    // JPEG file: normalize extension to .jpg
                    let thumbnail_path_normalized =
                        ext_regex.replace(&thumbnail_path, ".jpg").to_string();
                    let p = std::path::Path::new(&thumbnail_path_normalized);
                    self.has_thumbnail = p.exists();
                    log::debug!(target: "photo", "thumbnail_check_photo; thumbnail_path={}; exists={}",
                    thumbnail_path_normalized, self.has_thumbnail);
                } else {
                    // Non-JPEG file (movie, etc.): append .jpg
                    let thumbnail_path_for_movie = format!("{}.jpg", thumbnail_path);
                    let p = std::path::Path::new(&thumbnail_path_for_movie);
                    self.has_thumbnail = p.exists();
                    log::debug!(target: "photo", "thumbnail_check_movie; thumbnail_path={}; exists={}",
                    thumbnail_path_for_movie, self.has_thumbnail);
                }
            } // end else (non-RAW)
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
        // file.path is relative: "2024-01-15/uuid/filename.jpg" or "2024-01-15/filename.jpg"
        // The first path component is the date directory
        let path = self.file.path.trim_start_matches('/');

        let date_only = path.split('/').next().unwrap_or("");

        if date_only.trim().is_empty() {
            log::error!(target: "photo", "get_imported_dir_date_error; path={}", self.file.path);
            panic!(
                "Invalid date string extracted from relative path: {}",
                self.file.path
            );
        }

        date::Date::from_string(&date_only.to_string(), Option::Some("-"))
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

    #[allow(dead_code)]
    pub fn set_tags(&mut self, tags: Vec<PhotoTag>) {
        self.tags = Some(tags);
    }

    pub fn set_burst_group_id(&mut self, burst_group_id: Option<String>) {
        self.burst_group_id = burst_group_id;
    }

    pub fn set_burst_count(&mut self, burst_count: u32) {
        self.burst_count = Some(burst_count);
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
                            tags.push(PhotoTag::new(tag_id, tag_name, tag_color));
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
        // Support multiple date delimiters: '/', '-', ':'
        let re = regex::Regex::new(r"^([0-9]{4})[/\-:]([0-9]{1,2})[/\-:]([0-9]{1,2}).+$").unwrap();
        let replaced = re.replace(&self.time, "$1-$2-$3").to_string();
        replaced
    }

    pub fn created_date(&self) -> date::Date {
        // Support multiple date delimiters: '/', '-', ':'
        let re = regex::Regex::new(r"^([0-9]{4})[/\-:]([0-9]{1,2})[/\-:]([0-9]{1,2}).+$").unwrap();
        let replaced = re.replace(&self.time, "$1-$2-$3").to_string();

        // Check if the replacement resulted in a valid date string
        if replaced == self.time || replaced.trim().is_empty() {
            log::error!(target: "photo", "created_date_parse_error; time={}; replaced={}", self.time, replaced);
            panic!("Invalid time format for date parsing: {}", self.time);
        }

        date::Date::from_string(&replaced, Option::Some("-"))
    }

    /// Get the datetime as milliseconds since epoch for grouping comparison.
    /// Returns None if the date cannot be parsed.
    pub fn get_datetime_ms(&self) -> Option<i64> {
        let datetime_str = &self.meta_data.date_time_original;
        if datetime_str.is_empty() {
            return None;
        }

        // Parse format: "YYYY:MM:DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
        let re = regex::Regex::new(r"^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})")
            .ok()?;
        let caps = re.captures(datetime_str)?;

        let year: i32 = caps.get(1)?.as_str().parse().ok()?;
        let month: u32 = caps.get(2)?.as_str().parse().ok()?;
        let day: u32 = caps.get(3)?.as_str().parse().ok()?;
        let hour: u32 = caps.get(4)?.as_str().parse().ok()?;
        let min: u32 = caps.get(5)?.as_str().parse().ok()?;
        let sec: u32 = caps.get(6)?.as_str().parse().ok()?;

        use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
        let date = NaiveDate::from_ymd_opt(year, month, day)?;
        let time = NaiveTime::from_hms_opt(hour, min, sec)?;
        let datetime = NaiveDateTime::new(date, time);

        Some(datetime.and_utc().timestamp_millis())
    }

    /// Lowercase file extension without the dot (empty string if none).
    pub fn extension(&self) -> String {
        std::path::Path::new(&self.file.path)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    }

    /// True if the file is a supported video (mp4/webm/mov/...).
    pub fn is_video(&self) -> bool {
        crate::utils::raw_file::is_video_file(&self.file.path)
    }

    /// True if the file is a RAW camera file.
    pub fn is_raw(&self) -> bool {
        crate::utils::raw_file::is_raw_file(&self.file.path)
    }

    /// True if the file is a HEIC/HEIF/AVIF file.
    pub fn is_heic_or_avif(&self) -> bool {
        crate::utils::raw_file::is_heic_or_avif(&self.file.path)
    }

    /// True if the file is a supported still image (standard + RAW).
    pub fn is_image(&self) -> bool {
        crate::utils::raw_file::is_supported_image(&self.file.path)
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

    #[test]
    fn test_type_predicates() {
        let mk = |p: &str| photo::Photo::new(file::File::from_relative(p.to_string()), None);
        assert!(mk("2026-06-29/uuid/DJI.MP4").is_video());
        assert!(!mk("2026-06-29/uuid/DJI.MP4").is_image());
        assert!(mk("d/x.jpg").is_image());
        assert!(!mk("d/x.jpg").is_video());
        assert!(mk("d/x.CR2").is_raw());
        assert!(mk("d/x.heic").is_heic_or_avif());
        assert_eq!(mk("d/x.MP4").extension(), "mp4");
        assert_eq!(mk("d/noext").extension(), "");
    }
}
