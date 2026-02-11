use crate::entity::photo;
use crate::repository::meta_db;
use crate::repository::{self, MetaInfoDB};
use crate::value::{comment, exif, file, star};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct PhotoMeta {
    photo: photo::Photo,
    pub star: star::Star,
    pub comment: comment::Comment,
    pub google_photo_url: Option<String>,
    pub tags: Option<Vec<photo::PhotoTag>>,
    pub storage_sync: Option<String>,
}
#[derive(Debug)]
pub struct PhotoMetas {
    data: IndexMap<String, PhotoMeta>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PhotoMetaWithExif {
    meta: PhotoMeta,
    exif: exif::ExifData,
}

impl PhotoMetaWithExif {
    pub fn new(photo_meta: PhotoMeta, exif: exif::ExifData) -> PhotoMetaWithExif {
        PhotoMetaWithExif {
            meta: photo_meta,
            exif: exif,
        }
    }
}

impl PhotoMeta {
    pub fn new(photo: photo::Photo) -> PhotoMeta {
        PhotoMeta {
            photo: photo,
            star: star::Star::new(0),
            comment: comment::Comment::new(""),
            google_photo_url: None,
            tags: None,
            storage_sync: None,
        }
    }

    pub fn new_with_data(photo: photo::Photo, meta_db: &repository::MetaDB) -> PhotoMeta {
        meta_db.get_photo_meta(photo)
    }

    #[allow(dead_code)]
    pub fn set_star(&mut self, star: star::Star) {
        self.star = star
    }
    #[allow(dead_code)]
    pub fn set_comment(&mut self, comment: comment::Comment) {
        self.comment = comment
    }
}

impl PhotoMetas {
    pub fn new() -> PhotoMetas {
        PhotoMetas {
            data: IndexMap::new(),
        }
    }

    pub fn keys(&self) -> indexmap::map::Keys<'_, String, PhotoMeta> {
        self.data.keys()
    }

    #[allow(dead_code)]
    pub fn iter(&self) -> indexmap::map::Iter<'_, String, PhotoMeta> {
        self.data.iter()
    }

    pub fn get(&self, key: &str) -> Option<&PhotoMeta> {
        return self.data.get(key);
    }

    pub fn insert(&mut self, key: &str, value: PhotoMeta) {
        self.data.insert(key.to_owned(), value);
    }

    #[allow(dead_code)]
    pub fn remove(&mut self, key: &str) -> Option<PhotoMeta> {
        self.data.shift_remove(key)
    }

    #[allow(dead_code)]
    pub fn get_with_photo(&self, photo: photo::Photo) -> Option<&PhotoMeta> {
        return self.get(&photo.file.path);
    }
}

#[allow(dead_code)]
impl PhotoMeta {
    pub fn new_from_photo(photo: &photo::Photo) -> PhotoMeta {
        PhotoMeta {
            photo: photo.clone(),
            star: star::Star::new(0),
            comment: comment::Comment::new(""),
            google_photo_url: None,
            tags: None,
            storage_sync: None,
        }
    }

    pub fn new_from_photo_info(record: &meta_db::PhotoInfo) -> Option<PhotoMeta> {
        // Use from_relative since DB stores relative paths after #194 migration.
        // File::new_if_exists would fail because relative paths don't resolve from process CWD.
        let f = file::File::from_relative(record.path.clone());
        let mut photo = photo::Photo::new(f, Option::None);
        photo.set_time(record.date.clone());
        photo.set_css_style(record.css_style.clone());
        // Set orientation from database record
        if let Some(ref orientation) = record.orientation {
            photo.meta_data.orientation = orientation.clone();
        }
        return Some(PhotoMeta {
            photo: photo,
            star: star::Star::new(record.star),
            comment: comment::Comment::new(&record.comment),
            google_photo_url: record.google_photo_url.clone(),
            tags: record.tags.clone(),
            storage_sync: record.storage_sync.clone(),
        });
    }

    /// Create PhotoMeta from DB record for photos in trash
    /// Uses DB info for photo date/metadata since file is in trash, not at original path
    pub fn new_from_photo_info_from_trash(
        record: &meta_db::PhotoInfo,
        _trash_path: &str,
        _library_path: &str,
    ) -> Option<PhotoMeta> {
        // DB stores relative paths after #194 migration
        // Use from_relative since metadata doesn't need the file to physically exist
        let f = file::File::from_relative(record.path.clone());
        let mut photo = photo::Photo::new(f, Option::None);
        photo.set_time(record.date.clone());
        photo.set_css_style(record.css_style.clone());
        // Set orientation from database record
        if let Some(ref orientation) = record.orientation {
            photo.meta_data.orientation = orientation.clone();
        }
        Some(PhotoMeta {
            photo: photo,
            star: star::Star::new(record.star),
            comment: comment::Comment::new(&record.comment),
            google_photo_url: record.google_photo_url.clone(),
            tags: record.tags.clone(),
            storage_sync: record.storage_sync.clone(),
        })
    }

    pub fn clone(&self) -> PhotoMeta {
        PhotoMeta {
            photo: self.photo.clone(),
            star: self.star.clone(),
            comment: self.comment.clone(),
            google_photo_url: self.google_photo_url.clone(),
            tags: self.tags.clone(),
            storage_sync: self.storage_sync.clone(),
        }
    }

    pub fn tags_string(&self) -> Option<String> {
        if let Some(tags) = &self.tags {
            if tags.is_empty() {
                None
            } else {
                // Convert back to string format for directory mode
                let tag_strings: Vec<String> = tags
                    .iter()
                    .map(|tag| {
                        let color_str = tag.color.as_ref().map_or("", |c| c.as_str());
                        format!("{}:{}:{}", tag.id, tag.name, color_str)
                    })
                    .collect();
                Some(tag_strings.join(","))
            }
        } else {
            None
        }
    }

    pub fn photo(&self) -> &photo::Photo {
        &self.photo
    }

    pub fn photo_time(&self) -> String {
        if self.photo.is_exif_empty() && self.photo.is_meta_empty() {
            let mut photo = self.photo.clone();
            photo.load_exif();
            return photo.time();
        } else {
            return self.photo.time();
        }
    }

    pub fn date_key(&self) -> String {
        return self.photo.get_imported_dir_date().to_string();
    }
}
