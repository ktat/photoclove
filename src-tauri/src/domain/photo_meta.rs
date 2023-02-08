use crate::domain::photo;
use crate::repository::meta_db;
use crate::value::{comment, file, star};
use std::collections::{hash_map::Iter, hash_map::Keys, HashMap};

pub struct PhotoMeta {
    photo: photo::Photo,
    pub star: star::Star,
    pub comment: comment::Comment,
}

impl PhotoMeta {
    pub fn new(photo: photo::Photo) -> PhotoMeta {
        PhotoMeta {
            photo: photo,
            star: star::Star::new(0),
            comment: comment::Comment::new(""),
        }
    }

    pub fn set_star(&mut self, star: star::Star) {
        self.star = star
    }
    pub fn set_comment(&mut self, comment: comment::Comment) {
        self.comment = comment
    }
}

pub struct PhotoMetas {
    data: HashMap<String, PhotoMeta>,
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

    pub fn new_from_photo_info(record: &meta_db::PhotoInfo) -> PhotoMeta {
        PhotoMeta {
            photo: photo::Photo::new(file::File::new(record.path.clone())),
            star: star::Star::new(record.star),
            comment: comment::Comment::new(&record.comment),
        }
    }

    pub fn clone(&self) -> PhotoMeta {
        PhotoMeta {
            photo: self.photo.clone(),
            star: self.star.clone(),
            comment: self.comment.clone(),
        }
    }

    pub fn photo_time(&self) -> String {
        return self.photo.time.clone();
    }
}
