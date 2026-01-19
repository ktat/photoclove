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
//! - `albums` - Album management
//! - `collections` - Unified collection operations
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
mod albums;
mod collections;
mod job_queue;
mod recovery_queue;
mod burst_groups;

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
            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
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
                        Some(format!("Failed to create directory: {}", e)),
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

    // ==================== Tag Operations ====================

    pub fn get_all_tags(&self) -> Result<Vec<(i32, String, Option<String>)>, String> {
        tags::get_all_tags(self)
    }

    pub fn get_all_tags_with_photo_count(&self) -> Result<Vec<(i32, String, Option<String>, i32)>, String> {
        tags::get_all_tags_with_photo_count(self)
    }

    pub fn remove_all_tags_from_photo(&self, photo_path: &str) -> Result<i32, String> {
        tags::remove_all_tags_from_photo(self, photo_path)
    }

    pub fn get_tags_for_photo(&self, photo_path: &str) -> Result<Vec<(i32, String, Option<String>)>, String> {
        tags::get_tags_for_photo(self, photo_path)
    }

    // ==================== Album Operations ====================

    pub fn get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String> {
        albums::get_album_photos(self, album_id)
    }

    pub fn get_album_photos_with_metadata(&self, album_id: i32, config: config::Config) -> Result<Vec<photo::Photo>, String> {
        albums::get_album_photos_with_metadata(self, album_id, config)
    }

    pub fn reorder_album_photos(&self, album_id: i32, photo_order: Vec<String>) -> Result<(), String> {
        albums::reorder_album_photos(self, album_id, photo_order)
    }

    // ==================== Collection Operations ====================

    pub fn create_collection(
        &self,
        collection_type: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
    ) -> Result<i32, String> {
        collections::create_collection(self, collection_type, name, description, color)
    }

    pub fn get_all_collections(
        &self,
        collection_type: Option<&str>,
        config: config::Config,
    ) -> Result<Vec<serde_json::Value>, String> {
        collections::get_all_collections(self, collection_type, config)
    }

    pub fn update_collection(
        &self,
        id: i32,
        name: Option<&str>,
        description: Option<&str>,
        color: Option<&str>,
        cover_photo_path: Option<&str>,
    ) -> Result<(), String> {
        collections::update_collection(self, id, name, description, color, cover_photo_path)
    }

    pub fn delete_collection(&self, id: i32) -> Result<bool, String> {
        collections::delete_collection(self, id)
    }

    pub fn add_photo_to_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> {
        collections::add_photo_to_collection(self, collection_id, photo_path)
    }

    pub fn add_photos_to_collection_bulk(&self, collection_id: i32, photo_paths: &[String]) -> Result<usize, String> {
        collections::add_photos_to_collection_bulk(self, collection_id, photo_paths)
    }

    pub fn remove_photo_from_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> {
        collections::remove_photo_from_collection(self, collection_id, photo_path)
    }

    pub fn get_collection_photos(
        &self,
        collection_id: i32,
        ordered: bool,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        collections::get_collection_photos(self, collection_id, ordered, config)
    }

    /// Get photos by one or more collection IDs with unified sort order.
    /// For multiple IDs, uses AND logic (photos must be in ALL specified collections).
    pub fn get_photos_by_collection_ids(
        &self,
        collection_ids: &[i32],
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        collections::get_photos_by_collection_ids(self, collection_ids, sort_value, config)
    }

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

    pub fn get_photos_in_group(&self, group_id: &str) -> Result<Vec<String>, String> {
        burst_groups::get_photos_in_group(self, group_id)
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
        // Get all photos with EXIF date for grouping
        // Only select columns needed for burst grouping: path, make, model, date_time_original
        let conn = self.get_connection().map_err(|e| format!("Failed to connect: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT path, exif_make, exif_model, exif_date_time_original, burst_group_id
                 FROM photo_metadata
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                   AND exif_date_time_original IS NOT NULL
                   AND exif_date_time_original != ''
                 ORDER BY exif_date_time_original ASC",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let photos = stmt
            .query_map([], |row| {
                Ok(utils::row_to_photo_for_grouping(row))
            })
            .map_err(|e| format!("Failed to query photos: {}", e))?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();

        Ok(photos)
    }

    pub fn get_photos_for_grouping_in_date(&self, date_str: &str) -> Result<Vec<photo::Photo>, String> {
        // Get photos with EXIF date for grouping in a specific date
        // Only select columns needed for burst grouping
        let conn = self.get_connection().map_err(|e| format!("Failed to connect: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT path, exif_make, exif_model, exif_date_time_original, burst_group_id
                 FROM photo_metadata
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                   AND exif_date_time_original IS NOT NULL
                   AND exif_date_time_original != ''
                   AND date(photo_date) = ?1
                 ORDER BY exif_date_time_original ASC",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let photos = stmt
            .query_map(rusqlite::params![date_str], |row| {
                Ok(utils::row_to_photo_for_grouping(row))
            })
            .map_err(|e| format!("Failed to query photos: {}", e))?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();

        Ok(photos)
    }

    pub fn get_manual_group_photo_paths_in_date(&self, date_str: &str) -> Result<std::collections::HashSet<String>, String> {
        let conn = self.get_connection().map_err(|e| format!("Failed to connect: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT pm.path FROM photo_metadata pm
                 INNER JOIN burst_groups bg ON pm.burst_group_id = bg.id
                 WHERE bg.is_manual = 1
                   AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
                   AND date(pm.photo_date) = ?1",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let paths = stmt
            .query_map(rusqlite::params![date_str], |row| row.get(0))
            .map_err(|e| format!("Failed to query manual group photos: {}", e))?
            .collect::<Result<std::collections::HashSet<String>, _>>()
            .map_err(|e| format!("Failed to collect photo paths: {}", e))?;

        Ok(paths)
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

    // Tag management trait implementations (used by tag_commands.rs)
    fn get_all_tags(&self) -> Result<Vec<(i32, String, Option<String>)>, String> {
        tags::get_all_tags(self)
    }

    fn get_all_tags_with_photo_count(&self) -> Result<Vec<(i32, String, Option<String>, i32)>, String> {
        tags::get_all_tags_with_photo_count(self)
    }

    fn remove_all_tags_from_photo(&self, photo_path: &str) -> Result<i32, String> {
        tags::remove_all_tags_from_photo(self, photo_path)
    }

    fn get_tags_for_photo(&self, photo_path: &str) -> Result<Vec<(i32, String, Option<String>)>, String> {
        tags::get_tags_for_photo(self, photo_path)
    }

    // Album management trait implementations (used by album_commands.rs)
    fn get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String> {
        albums::get_album_photos(self, album_id)
    }

    fn get_album_photos_with_metadata(&self, album_id: i32, config: config::Config) -> Result<Vec<photo::Photo>, String> {
        albums::get_album_photos_with_metadata(self, album_id, config)
    }

    fn reorder_album_photos(&self, album_id: i32, photo_order: Vec<String>) -> Result<(), String> {
        albums::reorder_album_photos(self, album_id, photo_order)
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
}
