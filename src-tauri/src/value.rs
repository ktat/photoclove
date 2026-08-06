//! Value object module aggregator.
//!
//! This module serves as a routing layer that re-exports all value object submodules.
//! Actual implementations are in the respective submodules.

pub mod comment;
pub mod date;
pub mod exif;
pub mod file;
pub mod star;
pub mod video_metadata;
