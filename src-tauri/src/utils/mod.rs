//! Utility modules

pub mod cache;
pub mod exif_thumbnail;

// Re-export commonly used cache functions for backwards compatibility
pub use cache::{generate_cache_path, get_cache_dir};
