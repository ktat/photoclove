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
//! - `face_api` - AI tagging, face detection, and collection helpers

use crate::entity::{config, photo, photo_meta};
use crate::repository::{DatesNum, MetaInfoDB};
use crate::value::{comment, date, star};
use rusqlite::Result;
use std::collections::HashMap;
use std::path;

pub mod achievements;
mod burst_groups;
mod collections;
mod connection;
mod counts;
mod date_summary;
mod dates;
mod exif;
mod face_api;
pub mod face_detection;
mod filter_options;
mod job_queue;
mod photo_crud;
mod photo_metadata;
mod recovery_queue;
mod search;
mod search_debug;
pub mod stats;
mod tags;
mod utils;

pub use connection::SQLite;

impl SQLite {
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
        search::search_photos(
            self,
            query,
            search_type,
            filters,
            sort_field,
            sort_order,
            max_photos_per_fetch,
        )
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

    /// Soft delete many photos in one transaction; returns affected dates.
    pub fn delete_photos_batch(&self, paths: &[String]) -> Result<Vec<String>, String> {
        photo_crud::delete_photos_batch(self, paths)
    }

    /// Restore photo from trash without updating date_summary (for batch operations)
    pub fn restore_photo_from_trash_no_summary(&self, photo: &photo::Photo) {
        photo_crud::restore_photo_from_trash_no_summary(self, photo)
    }

    /// Get trash path for photo
    pub fn get_trash_path_for_photo(
        &self,
        original_path: &str,
        trash_base_path: &str,
        import_to: &str,
    ) -> Option<String> {
        photo_crud::get_trash_path_for_photo(self, original_path, trash_base_path, import_to)
    }

    #[allow(dead_code)]
    pub fn get_photo_created_at(&self, photo: &photo::Photo) -> String {
        photo_crud::get_photo_created_at(self, photo)
    }

    pub fn save_google_photos_url(
        &self,
        photo_path: &str,
        google_photos_url: &str,
    ) -> Result<(), String> {
        photo_crud::save_google_photos_url(self, photo_path, google_photos_url)
    }

    pub fn save_css_style(&self, photo_path: &str, css_style: &str) -> Result<(), String> {
        photo_crud::save_css_style(self, photo_path, css_style)
    }

    pub fn get_css_style(&self, photo_path: &str) -> Option<String> {
        photo_crud::get_css_style(self, photo_path)
    }

    // ==================== EXIF Operations ====================

    pub fn update_exif_if_changed(
        &self,
        path: &str,
        exif_data: &crate::value::exif::ExifData,
    ) -> Result<bool, String> {
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

    pub fn create_job_unit(
        &self,
        job_unit: &crate::entity::job_queue::JobUnit,
    ) -> Result<(), String> {
        job_queue::create_job_unit(self, job_unit)
    }

    pub fn create_job(
        &self,
        queued_job: &crate::entity::job_queue::QueuedJob,
    ) -> Result<i64, String> {
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
        job_queue::update_job_progress_with_last_id(
            self,
            job_id,
            processed_count,
            last_processed_id,
        )
    }

    pub fn get_job_by_id(
        &self,
        job_id: i64,
    ) -> Result<Option<crate::entity::job_queue::QueuedJob>, String> {
        job_queue::get_job_by_id(self, job_id)
    }

    pub fn get_job_unit_progress(
        &self,
        job_unit_id: &str,
    ) -> Result<crate::entity::job_queue::JobProgress, String> {
        job_queue::get_job_unit_progress(self, job_unit_id)
    }

    pub fn update_job_unit_status_if_complete(&self, job_unit_id: &str) -> Result<(), String> {
        job_queue::update_job_unit_status_if_complete(self, job_unit_id)
    }

    pub fn cleanup_completed_jobs(&self) -> Result<(), String> {
        job_queue::cleanup_completed_jobs(self)
    }

    pub fn get_jobs_for_unit(
        &self,
        job_unit_id: &str,
    ) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> {
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

    pub fn get_recovery_pending_items(
        &self,
    ) -> Result<Vec<crate::entity::recovery_queue::RecoveryItem>, String> {
        recovery_queue::get_pending_items(self)
    }

    pub fn get_recovery_all_items(
        &self,
    ) -> Result<Vec<crate::entity::recovery_queue::RecoveryItem>, String> {
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

    pub fn get_recovery_item(
        &self,
        id: i64,
    ) -> Result<Option<crate::entity::recovery_queue::RecoveryItem>, String> {
        recovery_queue::get_item(self, id)
    }

    // ==================== Burst Group Operations ====================

    pub fn save_burst_group(
        &self,
        group: &crate::entity::burst_group::BurstGroup,
    ) -> Result<(), String> {
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

    pub fn get_manual_group_photo_paths(
        &self,
    ) -> Result<std::collections::HashSet<String>, String> {
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

    pub fn get_photos_for_grouping_in_date(
        &self,
        date_str: &str,
    ) -> Result<Vec<photo::Photo>, String> {
        burst_groups::get_photos_for_grouping_in_date(self, date_str)
    }

    pub fn get_manual_group_photo_paths_in_date(
        &self,
        date_str: &str,
    ) -> Result<std::collections::HashSet<String>, String> {
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

    fn record_photos_meta_data(&self, photos: Vec<photo::Photo>) -> Result<usize, &str> {
        photo_metadata::record_photos_meta_data(self, photos)
    }

    fn record_photos_all_meta_data(
        &self,
        dates: date::Dates,
    ) -> Result<(HashMap<String, usize>, usize), &str> {
        photo_metadata::record_photos_all_meta_data(self, dates)
    }

    fn get_photo_meta_data_in_date(
        &self,
        date: date::Date,
    ) -> Result<photo_meta::PhotoMetas, String> {
        photo_metadata::get_photo_meta_data_in_date(self, date)
    }

    fn get_stored_capture_times(
        &self,
        date: date::Date,
    ) -> Result<HashMap<String, String>, String> {
        photo_metadata::get_stored_capture_times(self, date)
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

    fn add_photos_to_collection_bulk(
        &self,
        collection_id: i32,
        photo_paths: &[String],
    ) -> Result<usize, String> {
        collections::add_photos_to_collection_bulk(self, collection_id, photo_paths)
    }

    fn remove_photo_from_collection(
        &self,
        collection_id: i32,
        photo_path: &str,
    ) -> Result<(), String> {
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
