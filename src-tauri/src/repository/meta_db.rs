//! Metadata database module aggregator.
//!
//! This module serves as a routing layer that re-exports metadata database submodules.
//! Actual implementations are in the respective submodules (primarily `sqlite`).
//!
//! Also defines shared types used across submodules.

use crate::entity::photo;
use serde::{Deserialize, Serialize};

mod migrations;
pub mod sqlite;
#[derive(Debug, Deserialize, Serialize)]
pub struct PhotoInfo {
    pub path: String,
    pub date: String,
    pub star: i32,
    pub comment: String,
    pub css_style: Option<String>,
    pub google_photo_url: Option<String>,
    pub tags: Option<Vec<photo::PhotoTag>>,
    pub orientation: Option<String>,
}
