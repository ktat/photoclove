use crate::entity::photo;
use crate::repository::meta_db;
use crate::repository::{self, MetaInfoDB};
use crate::value::{comment, exif, file, star};
use serde::{Deserialize, Serialize};
use std::collections::{hash_map::Iter, hash_map::Keys, HashMap};

#[derive(Serialize, Deserialize, Debug)]
pub struct PhotoMeta {
    photo: photo::Photo,
    pub star: star::Star,
    pub comment: comment::Comment,
}
#[derive(Debug)]
pub struct PhotoMetas {
    data: HashMap<String, PhotoMeta>,
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
        }
    }

    pub fn new_with_data(photo: photo::Photo, meta_db: &repository::MetaDB) -> PhotoMeta {
        meta_db.get_photo_meta(photo)
    }

    pub fn set_star(&mut self, star: star::Star) {
        self.star = star
    }
    pub fn set_comment(&mut self, comment: comment::Comment) {
        self.comment = comment
    }
}

impl PhotoMetas {
    pub fn new() -> PhotoMetas {
        PhotoMetas {
            data: HashMap::new(),
        }
    }

    pub fn keys(&self) -> Keys<'_, String, PhotoMeta> {
        self.data.keys()
    }

    pub fn iter(&self) -> Iter<'_, String, PhotoMeta> {
        self.data.iter()
    }

    pub fn get(&self, key: &str) -> Option<&PhotoMeta> {
        return self.data.get(key);
    }

    pub fn insert(&mut self, key: &str, value: PhotoMeta) {
        self.data.insert(key.to_owned(), value);
    }

    pub fn get_with_photo(&self, photo: photo::Photo) -> Option<&PhotoMeta> {
        return self.get(&photo.file.path);
    }
}

impl PhotoMeta {
    pub fn new_from_photo(photo: &photo::Photo) -> PhotoMeta {
        PhotoMeta {
            photo: photo.clone(),
            star: star::Star::new(0),
            comment: comment::Comment::new(""),
        }
    }

    pub fn new_from_photo_info(record: &meta_db::PhotoInfo) -> Option<PhotoMeta> {
        let f = file::File::new_if_exists(record.path.clone());
        if f.is_none() {
            return None;
        }
        let mut photo = photo::Photo::new(f.unwrap(), Option::None);
        photo.set_time(record.date.clone());
        return Some(PhotoMeta {
            photo: photo,
            star: star::Star::new(record.star),
            comment: comment::Comment::new(&record.comment),
        });
    }

    pub fn clone(&self) -> PhotoMeta {
        PhotoMeta {
            photo: self.photo.clone(),
            star: self.star.clone(),
            comment: self.comment.clone(),
        }
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
}
