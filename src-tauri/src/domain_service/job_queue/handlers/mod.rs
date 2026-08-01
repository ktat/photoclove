//! Job handler module aggregator.
//!
//! This module serves as a routing layer that re-exports job handler submodules
//! and their main processing functions.
//! Actual implementations are in the respective submodules.

pub(crate) mod utils;

pub(crate) mod ai_tagging;
pub(crate) mod create_db;
pub(crate) mod face_detection;
pub(crate) mod face_thumbnail_regenerate;
pub(crate) mod google_photos;
pub(crate) mod import;
pub(crate) mod insights;
pub(crate) mod recalculate_grouping;
pub(crate) mod s3_sync;
pub(crate) mod thumbnail;
pub(crate) mod video_merge;

pub(crate) use ai_tagging::process_ai_tagging_job;
pub(crate) use create_db::process_create_db_job;
pub(crate) use face_detection::process_face_detection_job;
pub(crate) use face_thumbnail_regenerate::process_face_thumbnail_regenerate_job;
pub(crate) use google_photos::process_google_photos_upload_job;
pub(crate) use import::process_import_job;
pub(crate) use insights::process_insights_job;
pub(crate) use recalculate_grouping::process_recalculate_grouping_job;
pub(crate) use s3_sync::process_s3_sync_job;
pub(crate) use thumbnail::process_thumbnail_job;
pub(crate) use video_merge::process_video_merge_job;
pub(crate) use utils::cleanup_all_kill_files;
