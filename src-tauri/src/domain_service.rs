//! Domain service module aggregator.
//!
//! This module serves as a routing layer that re-exports all domain service submodules.
//! Actual implementations are in the respective submodules.

pub mod ai_tagging;
pub mod dir_service;
pub mod face_detection;
pub mod file_service;
pub mod job_queue;
pub mod job_queue_service;
pub mod logging_service;
pub mod photo_service;
pub mod s3_service;
pub mod thumbnail_service;
pub mod token_storage_service;
