use crate::domain::photo;
use serde::{Deserialize, Serialize};
use std::collections::{hash_map::Iter, hash_map::Keys, HashMap};

pub mod tsv;
// pub mod sqlite;

#[derive(Debug, Deserialize, Serialize)]
pub struct PhotoInfo {
    path: String,
    date: String,
}

pub struct MetaInfo {
    pub date: String,
}
pub struct PhotoMetas {
    data: HashMap<String, MetaInfo>,
}

impl PhotoMetas {
    pub fn new() -> PhotoMetas {
        PhotoMetas {
            data: HashMap::new(),
        }
    }

    pub fn keys(&self) -> Keys<'_, String, MetaInfo> {
        self.data.keys()
    }

    pub fn iter(&self) -> Iter<'_, String, MetaInfo> {
        self.data.iter()
    }

    pub fn get(&self, key: &str) -> Option<&MetaInfo> {
        return self.data.get(key);
    }
}

impl MetaInfo {
    pub fn new_from_photo(photo: &photo::Photo) -> MetaInfo {
        MetaInfo {
            date: photo.time.clone(),
        }
    }

    pub fn new_from_photo_info(record: &PhotoInfo) -> MetaInfo {
        MetaInfo {
            date: record.date.clone(),
        }
    }
}
