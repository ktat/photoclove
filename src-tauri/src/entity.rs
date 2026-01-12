//! Entity module aggregator.
//!
//! This module serves as a routing layer that re-exports all entity submodules.
//! Actual implementations are in the respective submodules.

pub mod config;
pub mod google_photos;
pub mod importer;
pub mod job_queue;
pub mod photo;
pub mod photo_collection;
pub mod photo_meta;
pub mod trash;
