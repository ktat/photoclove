//! Job handler module aggregator.
//!
//! This module serves as a routing layer that re-exports job handler submodules
//! and their main processing functions.
//! Actual implementations are in the respective submodules.

pub(crate) mod create_db;
pub(crate) mod google_photos;
pub(crate) mod import;
pub(crate) mod thumbnail;

pub(crate) use create_db::process_create_db_job;
pub(crate) use google_photos::process_google_photos_upload_job;
pub(crate) use import::process_import_job;
pub(crate) use thumbnail::process_thumbnail_job;
