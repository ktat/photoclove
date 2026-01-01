use sha2::{Digest, Sha256};
/// Common utility functions for PhotoClove
///
/// This module provides shared functionality to avoid code duplication
/// following the DRY (Don't Repeat Yourself) principle.
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

/// Generate cache path for a photo thumbnail/resized image
///
/// This function generates a consistent cache file path based on the photo path
/// and optional import directory. The same algorithm is used by both
/// `get_thumbnail_path_for_photo` and `get_resized_image` commands.
///
/// # Arguments
///
/// * `photo_path` - The path to the original photo
/// * `import_directory` - Optional import directory to include in the hash
///
/// # Returns
///
/// The cache file path as a String
pub fn generate_cache_path(
    photo_path: &str,
    import_directory: Option<&str>,
) -> Result<String, String> {
    // Get cache directory
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())?
        .join("photoclove")
        .join("thumbnails");

    // Generate cache filename from path hash
    let mut hasher = DefaultHasher::new();
    photo_path.hash(&mut hasher);

    // If import_directory is provided, include it in hash to avoid collisions
    if let Some(dir) = import_directory {
        // Generate SHA256 hash of directory path
        let mut sha_hasher = Sha256::new();
        sha_hasher.update(dir.as_bytes());
        let dir_uuid = format!("{:x}", sha_hasher.finalize());
        dir_uuid.hash(&mut hasher);

        log::debug!(
            target: "image",
            "cache_path_with_uuid; photo_path={}; import_directory={}; dir_uuid={}",
            photo_path,
            dir,
            dir_uuid
        );
    }

    let hash = hasher.finish();
    let cache_filename = format!("{:x}.jpg", hash);
    let cache_path = cache_dir.join(&cache_filename);

    cache_path
        .to_str()
        .ok_or_else(|| "Failed to convert cache path to string".to_string())
        .map(|s| s.to_string())
}

/// Get the cache directory path for thumbnails
///
/// # Returns
///
/// PathBuf pointing to the cache directory
pub fn get_cache_dir() -> Result<PathBuf, String> {
    dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())
        .map(|dir| dir.join("photoclove").join("thumbnails"))
}
