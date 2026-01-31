//! Photo handlers module.
//!
//! This module contains individual handlers for different photo search types,
//! extracted from the main photo_commands.rs to improve maintainability.

pub mod album;
pub mod burst;
pub mod collections;
pub mod date;
pub mod navigation;
pub mod person;
pub mod recent;
pub mod search;
pub mod tag;
pub mod trash;
pub mod unknown_faces;

use crate::app_state::AppState;
use crate::repository::{MetaDB, RepoDB};
use tauri::State;

/// Common context passed to all handlers
pub struct HandlerContext<'a> {
    pub repo_db: &'a RepoDB,
    pub meta_db: &'a MetaDB,
    pub config: crate::entity::config::Config,
}

impl<'a> HandlerContext<'a> {
    pub fn from_state(state: &'a State<'_, AppState>) -> Self {
        Self {
            repo_db: &state.repo_db,
            meta_db: &state.meta_db,
            config: state.config.clone(),
        }
    }
}

/// Common search parameters extracted from PhotoRequest
#[derive(Debug, Clone)]
pub struct SearchParams {
    pub query: Option<String>,
    pub star: i32,
    pub has_comment: bool,
    pub extension: String,
    pub page: u32,
    pub limit: u32,
    pub offset: u32,
    pub sort_value: i32,
    pub params: Option<serde_json::Value>,
}

impl SearchParams {
    pub fn new(
        query: Option<String>,
        star: Option<i32>,
        has_comment: Option<bool>,
        extension: Option<String>,
        page: Option<u32>,
        limit: Option<u32>,
        offset: Option<u32>,
        sort_value: Option<i32>,
        params: Option<serde_json::Value>,
    ) -> Self {
        Self {
            query,
            star: star.unwrap_or(-1),
            has_comment: has_comment.unwrap_or(false),
            extension: extension.unwrap_or_else(|| "all".to_string()),
            page: page.unwrap_or(1),
            limit: limit.unwrap_or(1000),
            offset: offset.unwrap_or(0),
            sort_value: sort_value.unwrap_or(0),
            params,
        }
    }
}
