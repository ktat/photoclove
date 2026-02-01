//! SQLite repository implementation for PhotoClove
//!
//! This module provides the SQLite-based storage for photo metadata.
//! The implementation is split into several submodules for maintainability:
//!
//! - `utils` - Helper functions for row parsing
//! - `date_summary` - Date summary table operations
//! - `dates` - Date retrieval operations
//! - `photo_metadata` - Photo metadata recording and retrieval
//! - `photo_crud` - Photo CRUD operations (star, comment, delete, restore)
//! - `filter_options` - Filter dropdown options (cameras, lenses, extensions)
//! - `search_debug` - Debug helpers for search operations
//! - `search` - Search and filter operations
//! - `exif` - EXIF data operations
//! - `counts` - Photo count operations
//! - `tags` - Tag management
//! - `collections` - Unified collection operations (albums and tags)
//! - `job_queue` - Background job queue
//! - `recovery_queue` - Recovery queue for failed operations

use crate::entity::{config, photo, photo_meta};
use crate::repository::{DatesNum, MetaInfoDB};
use crate::value::{comment, date, star};
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use std::path;

mod utils;
mod date_summary;
mod dates;
mod photo_metadata;
mod photo_crud;
mod filter_options;
mod search_debug;
mod search;
mod exif;
mod counts;
mod tags;
mod collections;
mod job_queue;
mod recovery_queue;
mod burst_groups;
pub mod face_detection;
pub mod stats;
pub mod achievements;

#[derive(Clone)]
pub struct SQLite {
    db_path: String,
}

impl SQLite {
    pub fn new(path: String) -> SQLite {
        let sqlite = SQLite {
            db_path: path + "/photoclove.db",
        };

        if let Err(e) = sqlite.init_db() {
            log::error!(target: "sqlite", "db_init_error; error={}", e);
        }

        // Validate date_summary currency on startup
        if let Err(_) = date_summary::check_date_summary_currency(&sqlite) {
            log::info!(target: "date_summary", "startup_validation; status=failed; action=rebuilding");
            let _ = date_summary::rebuild_date_summary(&sqlite);
        }

        sqlite
    }

    pub fn init_db(&self) -> Result<()> {
        let conn = self.get_connection()?;
        super::migrations::run_migrations(&conn)?;

        // Populate date_summary if it's empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM date_summary", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 {
            log::info!(target: "date_summary", "initial_population; status=populating");
            let now = date::DateTime::now().to_db_string();
            conn.execute(
                "INSERT INTO date_summary (date, photo_count, created_at, updated_at)
                 SELECT date(photo_date) as date_only, COUNT(*) as count, ? as created_at, ? as updated_at
                 FROM photo_metadata
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                 GROUP BY date(photo_date)",
                params![now, now],
            )?;
            log::info!(target: "date_summary", "initial_population; status=completed");
        }

        Ok(())
    }

    pub fn get_connection(&self) -> Result<Connection> {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&self.db_path).parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                        Some(format!("Failed to create directory '{}': {}", parent.display(), e)),
                    )
                })?;
            }
        }
        Connection::open(&self.db_path)
    }

    /// Get the database path
    pub fn db_path(&self) -> &str {
        &self.db_path
    }

    // ==================== Date Operations ====================

    pub fn get_available_dates(&self) -> Result<Vec<date::Date>, String> {
        dates::get_available_dates(self)
    }

    // ==================== Count Operations ====================

    pub fn has_metadata(&self) -> bool {
        counts::has_metadata(self)
    }

    // ==================== Search/Filter Operations ====================

    pub fn get_camera_options(&self) -> Result<String, String> {
        search::get_camera_options(self)
    }

    pub fn get_lens_options(&self) -> Result<String, String> {
        search::get_lens_options(self)
    }

    pub fn get_extension_options(&self) -> Result<String, String> {
        search::get_extension_options(self)
    }

    pub fn search_photos(
        &self,
        query: &str,
        search_type: &str,
        filters: &str,
        sort_field: &str,
        sort_order: &str,
        max_photos_per_fetch: u32,
    ) -> Result<String, String> {
        search::search_photos(self, query, search_type, filters, sort_field, sort_order, max_photos_per_fetch)
    }

    // ==================== Photo CRUD Operations ====================

    /// Delete photo permanently without updating date_summary (for batch operations)
    pub fn delete_photo_permanently_no_summary(&self, photo: &photo::Photo) {
        photo_crud::delete_photo_permanently_no_summary(self, photo)
    }

    /// Get all photo paths in a directory from database
    pub fn get_photo_paths_in_directory(&self, dir_path: &str) -> Result<Vec<String>, String> {
        photo_crud::get_photo_paths_in_directory(self, dir_path)
    }

    /// Delete photo record by path
    pub fn delete_photo_by_path(&self, path: &str) {
        photo_crud::delete_photo_by_path(self, path)
    }

    /// Restore photo from trash without updating date_summary (for batch operations)
    pub fn restore_photo_from_trash_no_summary(&self, photo: &photo::Photo) {
        photo_crud::restore_photo_from_trash_no_summary(self, photo)
    }

    /// Get trash path for photo
    pub fn get_trash_path_for_photo(&self, original_path: &str, trash_base_path: &str) -> Option<String> {
        photo_crud::get_trash_path_for_photo(self, original_path, trash_base_path)
    }

    #[allow(dead_code)]
    pub fn get_photo_created_at(&self, photo: &photo::Photo) -> String {
        photo_crud::get_photo_created_at(self, photo)
    }

    pub fn save_google_photos_url(&self, photo_path: &str, google_photos_url: &str) -> Result<(), String> {
        photo_crud::save_google_photos_url(self, photo_path, google_photos_url)
    }

    pub fn save_css_style(&self, photo_path: &str, css_style: &str) -> Result<(), String> {
        photo_crud::save_css_style(self, photo_path, css_style)
    }

    pub fn get_css_style(&self, photo_path: &str) -> Option<String> {
        photo_crud::get_css_style(self, photo_path)
    }

    // ==================== EXIF Operations ====================

    pub fn update_exif_if_changed(&self, path: &str, exif_data: &crate::value::exif::ExifData) -> Result<bool, String> {
        exif::update_exif_if_changed(self, path, exif_data)
    }

    // ==================== Date Summary Operations ====================

    pub fn update_date_summary_for_date(&self, date: &str, delta: i32) -> Result<(), String> {
        date_summary::update_date_summary_for_date(self, date, delta)
    }

    // ==================== Collection Operations (non-trait) ====================

    pub fn reorder_collection_items(
        &self,
        collection_id: i32,
        photo_order: Vec<String>,
    ) -> Result<(), String> {
        collections::reorder_collection_items(self, collection_id, photo_order)
    }

    // ==================== Job Queue Operations ====================

    pub fn create_job_unit(&self, job_unit: &crate::entity::job_queue::JobUnit) -> Result<(), String> {
        job_queue::create_job_unit(self, job_unit)
    }

    pub fn create_job(&self, queued_job: &crate::entity::job_queue::QueuedJob) -> Result<i64, String> {
        job_queue::create_job(self, queued_job)
    }

    pub fn get_pending_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_pending_jobs(self)
    }

    pub fn update_job_status(
        &self,
        job_id: i64,
        status: &crate::entity::job_queue::JobStatus,
        error_message: Option<String>,
    ) -> Result<(), String> {
        job_queue::update_job_status(self, job_id, status, error_message)
    }

    pub fn update_job_progress(&self, job_id: i64, processed_count: i64) -> Result<(), String> {
        job_queue::update_job_progress(self, job_id, processed_count)
    }

    pub fn update_job_progress_with_last_id(
        &self,
        job_id: i64,
        processed_count: i64,
        last_processed_id: i64,
    ) -> Result<(), String> {
        job_queue::update_job_progress_with_last_id(self, job_id, processed_count, last_processed_id)
    }

    pub fn get_job_by_id(&self, job_id: i64) -> Result<Option<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_job_by_id(self, job_id)
    }

    pub fn get_job_unit_progress(&self, job_unit_id: &str) -> Result<crate::entity::job_queue::JobProgress, String> {
        job_queue::get_job_unit_progress(self, job_unit_id)
    }

    pub fn update_job_unit_status_if_complete(&self, job_unit_id: &str) -> Result<(), String> {
        job_queue::update_job_unit_status_if_complete(self, job_unit_id)
    }

    pub fn cleanup_completed_jobs(&self) -> Result<(), String> {
        job_queue::cleanup_completed_jobs(self)
    }

    pub fn get_jobs_for_unit(&self, job_unit_id: &str) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_jobs_for_unit(self, job_unit_id)
    }

    pub fn reset_running_jobs_to_pending(&self) -> Result<usize, String> {
        job_queue::reset_running_jobs_to_pending(self)
    }

    pub fn get_all_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_all_jobs(self)
    }

    pub fn delete_job(&self, job_id: i64) -> Result<(), String> {
        job_queue::delete_job(self, job_id)
    }

    pub fn delete_job_unit(&self, job_unit_id: &str) -> Result<(), String> {
        job_queue::delete_job_unit(self, job_unit_id)
    }

    // ==================== Recovery Queue Operations ====================

    #[allow(dead_code)] // Reserved for future implementation - see improvement/todo-recovery-queue.md
    pub fn add_to_recovery_queue(
        &self,
        operation_type: crate::entity::recovery_queue::OperationType,
        target_path: &str,
        error_reason: &str,
    ) -> Result<i64, String> {
        recovery_queue::add_to_recovery_queue(self, operation_type, target_path, error_reason)
    }

    pub fn get_recovery_pending_count(&self) -> Result<i32, String> {
        recovery_queue::get_pending_count(self)
    }

    pub fn get_recovery_pending_items(&self) -> Result<Vec<crate::entity::recovery_queue::RecoveryItem>, String> {
        recovery_queue::get_pending_items(self)
    }

    pub fn get_recovery_all_items(&self) -> Result<Vec<crate::entity::recovery_queue::RecoveryItem>, String> {
        recovery_queue::get_all_items(self)
    }

    pub fn update_recovery_status(
        &self,
        id: i64,
        status: crate::entity::recovery_queue::RecoveryStatus,
    ) -> Result<(), String> {
        recovery_queue::update_status(self, id, status)
    }

    pub fn increment_recovery_retry(&self, id: i64) -> Result<(), String> {
        recovery_queue::increment_retry(self, id)
    }

    pub fn delete_recovery_item(&self, id: i64) -> Result<(), String> {
        recovery_queue::delete_item(self, id)
    }

    pub fn cleanup_old_recovery_items(&self) -> Result<usize, String> {
        recovery_queue::cleanup_old_items(self)
    }

    pub fn get_recovery_item(&self, id: i64) -> Result<Option<crate::entity::recovery_queue::RecoveryItem>, String> {
        recovery_queue::get_item(self, id)
    }

    // ==================== Burst Group Operations ====================

    pub fn save_burst_group(&self, group: &crate::entity::burst_group::BurstGroup) -> Result<(), String> {
        burst_groups::save_burst_group(self, group)
    }

    pub fn update_photo_burst_group(&self, photo_path: &str, group_id: &str) -> Result<(), String> {
        burst_groups::update_photo_burst_group(self, photo_path, group_id)
    }

    pub fn clear_photo_burst_group(&self, photo_path: &str) -> Result<(), String> {
        burst_groups::clear_photo_burst_group(self, photo_path)
    }

    pub fn clear_burst_group_photos(&self, group_id: &str) -> Result<usize, String> {
        burst_groups::clear_burst_group_photos(self, group_id)
    }

    pub fn delete_burst_group(&self, group_id: &str) -> Result<(), String> {
        burst_groups::delete_burst_group(self, group_id)
    }

    pub fn count_photos_in_group(&self, group_id: &str) -> Result<usize, String> {
        burst_groups::count_photos_in_group(self, group_id)
    }

    pub fn get_photo_burst_group_id(&self, photo_path: &str) -> Result<Option<String>, String> {
        burst_groups::get_photo_burst_group_id(self, photo_path)
    }

    pub fn get_manual_group_photo_paths(&self) -> Result<std::collections::HashSet<String>, String> {
        burst_groups::get_manual_group_photo_paths(self)
    }

    pub fn clear_auto_burst_groups(&self) -> Result<(), String> {
        burst_groups::clear_auto_burst_groups(self)
    }

    pub fn clear_auto_burst_groups_in_date(&self, date_str: &str) -> Result<(), String> {
        burst_groups::clear_auto_burst_groups_in_date(self, date_str)
    }

    pub fn get_all_photos_for_grouping(&self) -> Result<Vec<photo::Photo>, String> {
        burst_groups::get_all_photos_for_grouping(self)
    }

    pub fn get_photos_for_grouping_in_date(&self, date_str: &str) -> Result<Vec<photo::Photo>, String> {
        burst_groups::get_photos_for_grouping_in_date(self, date_str)
    }

    pub fn get_manual_group_photo_paths_in_date(&self, date_str: &str) -> Result<std::collections::HashSet<String>, String> {
        burst_groups::get_manual_group_photo_paths_in_date(self, date_str)
    }

}

// ==================== MetaInfoDB Trait Implementation ====================

impl MetaInfoDB for SQLite {
    fn connect(&self, _path: String) {
        // Connection is managed per operation
    }

    fn new_connect(&self) -> SQLite {
        SQLite::new(self.db_path.replace("/photoclove.db", ""))
    }

    fn record_photo_metas(
        &self,
        info_path: path::PathBuf,
        photo_metas: photo_meta::PhotoMetas,
    ) -> Result<bool, &str> {
        photo_metadata::record_photo_metas(self, info_path, photo_metas)
    }

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<bool, &str> {
        photo_metadata::record_photos_meta_data(self, photos)
    }

    fn record_photos_all_meta_data(&self, dates: date::Dates) -> Result<HashMap<String, usize>, &str> {
        photo_metadata::record_photos_all_meta_data(self, dates)
    }

    fn get_photo_meta_data_in_date(&self, date: date::Date) -> Result<photo_meta::PhotoMetas, String> {
        photo_metadata::get_photo_meta_data_in_date(self, date)
    }

    fn get_photo_meta(&self, photo: photo::Photo) -> photo_meta::PhotoMeta {
        photo_metadata::get_photo_meta(self, photo)
    }

    fn get_photo_meta_from_trash(
        &self,
        photo: photo::Photo,
        trash_path: String,
        library_path: String,
    ) -> photo_meta::PhotoMeta {
        photo_metadata::get_photo_meta_from_trash(self, photo, trash_path, library_path)
    }

    fn save_star(&self, photo: &photo::Photo, star: star::Star) {
        photo_crud::save_star(self, photo, star)
    }

    fn save_comment(&self, photo: &photo::Photo, comment: comment::Comment) {
        photo_crud::save_comment(self, photo, comment)
    }

    fn delete_photo(&self, photo: &photo::Photo) {
        photo_crud::delete_photo(self, photo)
    }

    fn delete_photo_permanently(&self, photo: &photo::Photo) {
        photo_crud::delete_photo_permanently(self, photo)
    }

    fn restore_photo_from_trash(&self, photo: &photo::Photo) {
        photo_crud::restore_photo_from_trash(self, photo)
    }

    fn update_photo_path(&self, old_path: &str, new_path: &str) -> Result<bool, &str> {
        photo_crud::update_photo_path(self, old_path, new_path)
    }

    fn get_photo_count_per_dates(&self, dates: date::Dates) -> DatesNum {
        counts::get_photo_count_per_dates(self, dates)
    }

    fn get_recent_photos_metadata(&self, limit: u32) -> Result<photo_meta::PhotoMetas, String> {
        photo_metadata::get_recent_photos_metadata(self, limit)
    }

    // Collection-photo relationship trait implementations
    fn get_collections_for_photo(
        &self,
        photo_path: &str,
        collection_type: Option<&str>,
    ) -> Result<Vec<(i32, String, Option<String>)>, String> {
        collections::get_collections_for_photo(self, photo_path, collection_type)
    }

    fn remove_all_collections_from_photo(
        &self,
        photo_path: &str,
        collection_type: Option<&str>,
    ) -> Result<i32, String> {
        collections::remove_all_collections_from_photo(self, photo_path, collection_type)
    }

    // Unified PhotoCollection trait implementations
    fn create_collection(
        &self,
        collection_type: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
    ) -> Result<i32, String> {
        collections::create_collection(self, collection_type, name, description, color)
    }

    fn get_all_collections(
        &self,
        collection_type: Option<&str>,
        config: config::Config,
    ) -> Result<Vec<serde_json::Value>, String> {
        collections::get_all_collections(self, collection_type, config)
    }

    fn update_collection(
        &self,
        id: i32,
        name: Option<&str>,
        description: Option<&str>,
        color: Option<&str>,
        cover_photo_path: Option<&str>,
    ) -> Result<(), String> {
        collections::update_collection(self, id, name, description, color, cover_photo_path)
    }

    fn delete_collection(&self, id: i32) -> Result<bool, String> {
        collections::delete_collection(self, id)
    }

    fn add_photo_to_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> {
        collections::add_photo_to_collection(self, collection_id, photo_path)
    }

    fn add_photos_to_collection_bulk(&self, collection_id: i32, photo_paths: &[String]) -> Result<usize, String> {
        collections::add_photos_to_collection_bulk(self, collection_id, photo_paths)
    }

    fn remove_photo_from_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> {
        collections::remove_photo_from_collection(self, collection_id, photo_path)
    }

    fn get_collection_photos(
        &self,
        collection_id: i32,
        ordered: bool,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        collections::get_collection_photos(self, collection_id, ordered, config)
    }

    fn get_photos_by_collection_ids(
        &self,
        collection_ids: &[i32],
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        collections::get_photos_by_collection_ids(self, collection_ids, sort_value, config)
    }

    fn get_collection_type(&self, collection_id: i32) -> Result<Option<String>, String> {
        collections::get_collection_type(self, collection_id)
    }
}

/// Additional methods for AI tagging support
impl SQLite {
    /// Get or create a collection by name and type
    pub fn get_or_create_collection(
        &self,
        name: &str,
        collection_type: &str,
    ) -> Result<i32, String> {
        collections::get_or_create_collection(self, name, collection_type)
    }

    /// Add a photo to a collection with optional metadata
    pub fn add_photo_to_collection_with_metadata(
        &self,
        collection_id: i32,
        photo_path: &str,
        metadata: Option<String>,
    ) -> Result<(), String> {
        collections::add_photo_to_collection_with_metadata(self, collection_id, photo_path, metadata)
    }

    /// Get tags for a photo with metadata (for AI tag confidence display)
    pub fn get_tags_for_photo_with_metadata(
        &self,
        photo_path: &str,
    ) -> Result<Vec<(i32, String, Option<String>, Option<String>)>, String> {
        tags::get_tags_for_photo_with_metadata(self, photo_path)
    }

    // ==================== Face Detection Operations ====================

    /// Save detected faces for a photo
    pub fn save_detected_faces(
        &self,
        photo_path: &str,
        faces: &[face_detection::DetectedFaceInput],
    ) -> Result<Vec<i64>, String> {
        face_detection::save_detected_faces(self, photo_path, faces)
    }

    /// Get detected faces for a photo
    pub fn get_detected_faces(
        &self,
        photo_path: &str,
    ) -> Result<Vec<face_detection::DetectedFaceRecord>, String> {
        face_detection::get_detected_faces(self, photo_path)
    }

    /// Check if a photo has been processed for face detection
    pub fn has_detected_faces(&self, photo_path: &str) -> Result<bool, String> {
        face_detection::has_detected_faces(self, photo_path)
    }

    /// Get a single detected face by ID
    pub fn get_detected_face(
        &self,
        face_id: i64,
    ) -> Result<face_detection::DetectedFaceRecord, String> {
        face_detection::get_detected_face(self, face_id)
    }

    /// Get all face IDs (for batch operations)
    pub fn get_all_face_ids(&self) -> Result<Vec<i64>, String> {
        face_detection::get_all_face_ids(self)
    }

    /// Get all named face embeddings for matching
    pub fn get_named_face_embeddings(
        &self,
    ) -> Result<Vec<face_detection::NamedFaceEmbedding>, String> {
        face_detection::get_named_face_embeddings(self)
    }

    /// Create a new person
    pub fn create_person(&self, name: Option<&str>) -> Result<i64, String> {
        face_detection::create_person(self, name)
    }

    /// Update person name
    pub fn update_person_name(&self, person_id: i64, name: &str) -> Result<(), String> {
        face_detection::update_person_name(self, person_id, name)
    }

    /// Get all persons
    pub fn get_all_persons(&self) -> Result<Vec<face_detection::PersonRecord>, String> {
        face_detection::get_all_persons(self)
    }

    /// Get all persons with face count and thumbnail for list display
    pub fn get_all_persons_for_list(
        &self,
    ) -> Result<Vec<face_detection::PersonListItem>, String> {
        face_detection::get_all_persons_for_list(self)
    }

    /// Get all named persons with face thumbnail info, sorted by similarity to target embedding
    pub fn get_persons_with_faces(
        &self,
        target_embedding: Option<&[f32]>,
    ) -> Result<Vec<face_detection::PersonWithFace>, String> {
        face_detection::get_persons_with_faces(self, target_embedding)
    }

    /// Assign a face to a person
    pub fn assign_face_to_person(&self, face_id: i64, person_id: i64) -> Result<(), String> {
        face_detection::assign_face_to_person(self, face_id, person_id)
    }

    /// Get photos containing a specific person (paths only)
    pub fn get_photos_for_person(&self, person_id: i64) -> Result<Vec<String>, String> {
        face_detection::get_photos_for_person(self, person_id)
    }

    /// Get full photo objects for a specific person
    pub fn get_photos_for_person_full(
        &self,
        person_id: i64,
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        face_detection::get_photos_for_person_full(self, person_id, sort_value, config)
    }

    /// Delete a person
    pub fn delete_person(&self, person_id: i64) -> Result<(), String> {
        face_detection::delete_person(self, person_id)
    }

    /// Get face detection statistics
    pub fn get_face_detection_stats(&self) -> Result<face_detection::FaceDetectionStats, String> {
        face_detection::get_face_detection_stats(self)
    }

    /// Delete a detected face by ID
    pub fn delete_detected_face(&self, face_id: i64) -> Result<(), String> {
        face_detection::delete_detected_face(self, face_id)
    }

    /// Get count of unknown (unassigned) faces
    pub fn get_unknown_faces_count(&self) -> Result<i64, String> {
        face_detection::get_unknown_faces_count(self)
    }

    /// Get unknown (unassigned) faces with pagination
    pub fn get_unknown_faces(
        &self,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<face_detection::UnknownFaceRecord>, String> {
        face_detection::get_unknown_faces(self, limit, offset)
    }

    /// Get full photo objects for photos containing unknown faces
    pub fn get_photos_for_unknown_faces_full(
        &self,
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        face_detection::get_photos_for_unknown_faces_full(self, sort_value, config)
    }
}
