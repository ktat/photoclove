use serde::{Deserialize, Serialize};

pub mod sqlite;
#[derive(Debug, Deserialize, Serialize)]
pub struct PhotoInfo {
    pub path: String,
    pub date: String,
    pub star: i32,
    pub comment: String,
    pub css_style: Option<String>,
    pub google_photo_url: Option<String>,
}
