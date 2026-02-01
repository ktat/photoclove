//! Application state and related type definitions.
//!
//! This module contains the core AppState struct that holds the application's
//! shared state, along with related type definitions for search filters,
//! metadata information, and batch operations.

use crate::domain_service::{job_queue_service, logging_service};
use crate::entity::config::Config;
use crate::entity::importer;
use crate::repository;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Main application state that holds references to repositories, services,
/// and configuration. This is shared across all Tauri commands.
#[derive(Clone)]
pub struct AppState {
    /// Repository for photo data
    pub repo_db: repository::RepoDB,

    /// Repository for metadata
    pub meta_db: repository::MetaDB,

    /// Progress tracker for photo import operations
    pub import_progress: Arc<Mutex<importer::ImportProgress>>,

    /// Job queue manager for background tasks
    pub job_queue_manager: Arc<Mutex<job_queue_service::JobQueueManager>>,

    /// Logging service for application logs
    pub logging_service: Arc<logging_service::LoggingService>,

    /// Application configuration
    pub config: Config,

    /// Whether initial setup is needed (no config or no DB)
    pub needs_setup: bool,
}

/// Result of a batch operation on multiple photos.
///
/// Tracks success/failure counts, failed paths, and date changes
/// resulting from operations like trash, restore, or delete.
#[derive(serde::Serialize, Debug, Clone)]
pub struct BatchOperationResult {
    /// Number of successfully processed items
    pub succeeded: usize,

    /// Number of failed items
    pub failed: usize,

    /// Paths of items that failed to process
    pub failed_paths: Vec<String>,

    /// Map of date strings to count changes (for updating date counts in UI)
    pub date_changes: HashMap<String, i32>,

    /// Human-readable result message
    pub message: String,
}

/// Request type for fetching photos with various search and filter options.
///
/// This enum uses serde's tagged representation to support different
/// types of photo queries (recent, by date, text search, favorites, album photos).
#[derive(serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub enum PhotoRequest {
    /// Search request with comprehensive filtering and pagination
    #[serde(rename = "search")]
    Search {
        /// Type of search: recent, date, text_search, favorites, album_photos
        search_type: String,

        /// Search query (date string for date search, text for text search, album_id for album_photos, etc.)
        query: Option<String>,

        /// Filter by star rating
        star: Option<i32>,

        /// Filter by presence of comments
        has_comment: Option<bool>,

        /// Filter by file extension
        extension: Option<String>,

        /// Page number for pagination
        page: Option<u32>,

        /// Number of items per page
        limit: Option<u32>,

        /// Offset for pagination
        offset: Option<u32>,

        /// Sort value/order
        sort_value: Option<i32>,

        /// Additional parameters (for album_id, etc.) - flexible JSON value
        params: Option<serde_json::Value>,
    },
}
