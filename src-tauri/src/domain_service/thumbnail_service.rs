use crate::entity::{config, photo};
use std::fs;
use std::path::Path;

pub fn delete_thumbnail(
    photo: &photo::Photo,
    config: &config::Config,
) -> Result<(), std::io::Error> {
    // Construct thumbnail path similar to how it's done in photo.rs
    let import_path = &config.import_to;
    let thumbnail_store = &config.thumbnail_store;
    let thumbnail_path = photo.file.path.replace(import_path, thumbnail_store);

    // Handle different file extensions (similar to photo.rs logic)
    let ext_regex = regex::Regex::new(r"\.JPG$").unwrap();
    let thumbnail_path_ext_changed = ext_regex.replace(&thumbnail_path, ".jpg").to_string();

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
