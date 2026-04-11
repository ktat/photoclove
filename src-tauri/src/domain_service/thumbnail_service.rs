use crate::entity::{config, photo};
use crate::utils;
use std::fs;
use std::path::Path;

pub fn delete_thumbnail(
    photo: &photo::Photo,
    config: &config::Config,
) -> Result<(), std::io::Error> {
    // Construct thumbnail path: thumbnail_store + "/" + relative_path
    let thumbnail_store = &config.thumbnail_store;
    let thumbnail_path = format!(
        "{}/{}",
        thumbnail_store.trim_end_matches('/'),
        photo.file.path.trim_start_matches('/')
    );

    // Handle different file extensions (similar to photo.rs logic)
    let thumbnail_path_ext_changed = if thumbnail_path.ends_with(".JPG") {
        format!("{}.jpg", &thumbnail_path[..thumbnail_path.len() - 4])
    } else {
        thumbnail_path.clone()
    };

    let mut deleted_files = 0;

    if thumbnail_path == thumbnail_path_ext_changed {
        // Video files - thumbnail has .jpg extension added
        let thumbnail_path_for_movie = format!("{}.jpg", thumbnail_path);
        let thumbnail_file = Path::new(&thumbnail_path_for_movie);

        if thumbnail_file.exists() {
            log::info!(target: "thumbnail_service", "delete_thumbnail; type=video; path={:?}", thumbnail_path_for_movie);
            fs::remove_file(thumbnail_file)?;
            deleted_files += 1;
        }
    } else {
        // Image files - thumbnail has extension changed to lowercase
        let thumbnail_file = Path::new(&thumbnail_path_ext_changed);

        if thumbnail_file.exists() {
            log::info!(target: "thumbnail_service", "delete_thumbnail; type=image; path={:?}", thumbnail_path_ext_changed);
            fs::remove_file(thumbnail_file)?;
            deleted_files += 1;
        }
    }

    if deleted_files > 0 {
        log::info!(target: "thumbnail_service", "delete_thumbnail; status=success; files_deleted={}", deleted_files);
    } else {
        log::debug!(target: "thumbnail_service", "delete_thumbnail; status=no_thumbnail; photo_path={}", photo.file.path);
    }

    Ok(())
}

/// Delete persistent decoded cache files for a RAW/HEIC photo.
///
/// Removes the base file ({hash}.jpg) and progressive variants (_exif, _full)
/// from the persistent cache directory ({thumbnail_store}/.cache/).
pub fn delete_decoded_cache(photo_path: &str, thumbnail_store: &str) {
    let base_path = match utils::generate_persistent_cache_path(photo_path, thumbnail_store) {
        Ok(p) => p,
        Err(e) => {
            log::warn!(target: "thumbnail_service", "delete_decoded_cache; error={}; photo_path={}", e, photo_path);
            return;
        }
    };

    let mut deleted = 0;
    for suffix in &[".jpg", "_exif.jpg", "_full.jpg"] {
        let path_str = format!("{}{}", base_path, suffix);
        let path = Path::new(&path_str);
        if path.exists() {
            if let Err(e) = fs::remove_file(path) {
                log::warn!(target: "thumbnail_service", "delete_decoded_cache; failed={}; error={}", path_str, e);
            } else {
                deleted += 1;
            }
        }
    }

    if deleted > 0 {
        log::info!(target: "thumbnail_service", "delete_decoded_cache; photo_path={}; deleted={}", photo_path, deleted);
    }
}
