use crate::app_state::AppState;
use crate::domain_service::{achievements, photo_service};
use crate::entity::photo;
use crate::repository;
use crate::repository::MetaInfoDB;
use crate::value::{date, file};
use base64::{engine::general_purpose, Engine as _};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

/// Saves CSS style for a photo to the database
///
/// # Arguments
/// * `photo_path` - Path to the photo file
/// * `css_style` - CSS style string to save
/// * `state` - Application state containing database connection
///
/// # Returns
/// * `Ok(String)` - JSON string with result: true on success
/// * `Err(String)` - Error message on failure
#[tauri::command]
pub async fn save_css_style(
    photo_path: &str,
    css_style: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    match sqlite_db.save_css_style(photo_path, css_style) {
        Ok(()) => Ok("{\"result\": true}".to_string()),
        Err(e) => Err(e),
    }
}

/// Retrieves CSS style for a photo from the database
///
/// # Arguments
/// * `photo_path` - Path to the photo file
/// * `state` - Application state containing database connection
///
/// # Returns
/// * `Ok(String)` - CSS style string, or empty string if not found
/// * `Err(String)` - Error message on failure
#[tauri::command]
pub async fn get_css_style(
    photo_path: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    match sqlite_db.get_css_style(photo_path) {
        Some(css_style) => Ok(css_style),
        None => Ok("".to_string()),
    }
}

/// Saves a styled copy of a photo with CSS transformations applied
///
/// This command:
/// 1. Generates a SHA256 hash of the normalized CSS style
/// 2. Creates a new filename based on the original name + hash
/// 3. Decodes the base64 image data from the frontend
/// 4. Saves the image file to disk
/// 5. Records the new photo in the database with metadata copied from the original
/// 6. Generates a thumbnail asynchronously
///
/// # Arguments
/// * `original_photo_path` - Path to the original photo
/// * `css_style` - CSS style string used to transform the photo
/// * `image_data` - Base64-encoded JPEG image data from the frontend
/// * `app_handle` - Tauri app handle for emitting events
/// * `state` - Application state containing database and config
///
/// # Returns
/// * `Ok(String)` - Path to the newly created styled copy
/// * `Err(String)` - Error message on failure
#[tauri::command]
pub async fn save_styled_copy_from_frontend(
    original_photo_path: &str,
    css_style: &str,
    image_data: &str,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // 1. Generate SHA256 hash of normalized CSS
    let normalized_css = normalize_css_style(css_style);
    let mut hasher = Sha256::new();
    hasher.update(normalized_css.as_bytes());
    let css_hash = format!("{:x}", hasher.finalize());
    let short_hash = &css_hash[..12]; // Use first 12 chars

    // 2. Parse original photo path
    let original_path = Path::new(original_photo_path);
    let parent_dir = original_path
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let original_name = original_path
        .file_stem()
        .ok_or_else(|| "Cannot get file name".to_string())?
        .to_string_lossy();

    // 3. Create new filename with hash
    let new_filename = format!("{}-{}.jpg", original_name, short_hash);
    let new_path = parent_dir.join(&new_filename);
    let new_path_str = new_path.to_string_lossy().to_string();

    // 4. Check if styled copy already exists
    if new_path.exists() {
        return Ok(new_path_str);
    }

    // 5. Decode base64 image data and save
    let image_bytes = general_purpose::STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;

    fs::write(&new_path, image_bytes).map_err(|e| format!("Failed to write image file: {}", e))?;

    // TODO: Copy EXIF metadata from original photo to styled copy
    // Canvas.toBlob() loses all EXIF data. To preserve EXIF:
    // 1. Add rexiv2 crate (requires system gexiv2 library)
    // 2. Read EXIF from original_photo_path
    // 3. Write EXIF to new_path (except Orientation which may need updating)
    // See improvement/165-4-exif-format.md for details

    // 6. Create Photo object and add to database
    let new_file = file::File::new(new_path_str.clone());
    let mut new_photo = photo::Photo::new(new_file, Some(state.config.clone()));
    new_photo.load_exif();

    // 7. Set initial metadata (copy from original photo if exists)
    let meta_db = &state.meta_db;
    let original_photo = photo::Photo::new(file::File::new(original_photo_path.to_string()), None);
    let original_meta = meta_db.get_photo_meta(original_photo);

    // Extract date for thumbnail generation before consuming new_photo
    let photo_dir_date = new_photo.get_imported_dir_date();

    // 8. Record the new photo in database
    match meta_db.record_photos_meta_data(vec![new_photo]) {
        Ok(_) => {
            // Copy star rating and comment from original
            if original_meta.star.star() > 0 {
                let new_photo_for_star =
                    photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_star(&new_photo_for_star, original_meta.star);
            }
            if !original_meta.comment.comment().is_empty() {
                let new_photo_for_comment =
                    photo::Photo::new(file::File::new(new_path_str.clone()), None);
                meta_db.save_comment(&new_photo_for_comment, original_meta.comment);
            }
        }
        Err(e) => {
            log::warn!(target: "photo", "record_photo_metadata_failed; error={:?}", e);
        }
    }

    // 9. Generate thumbnail using existing thumbnail infrastructure
    let config = state.config.clone();
    let import_path = std::path::PathBuf::from(&config.import_to);
    let thumbnail_path = std::path::PathBuf::from(&config.thumbnail_store);
    let dates = date::Dates::new(&[photo_dir_date]);

    // Generate thumbnail asynchronously
    tokio::spawn(async move {
        if let Err(e) = photo_service::create_thumbnails(
            dates,
            &import_path,
            &thumbnail_path,
            1, // single thread for one photo
            config.thumbnail_compression_quality,
            config.thumbnail_ratio,
            config.thumbnail_ignore_file_size,
            Some(&config.raw_processing),
        )
        .await
        {
            log::warn!(target: "photo", "create_thumbnail_failed; error={:?}", e);
        }
    });

    // Check first_edit achievement
    let _ = achievements::check_and_emit_achievement(
        &app_handle,
        &state.config.import_to,
        "first_edit",
    );

    Ok(new_path_str)
}

/// Normalizes CSS style string for consistent hashing
///
/// This helper function parses CSS properties, extracts transform, filter, and clip-path values,
/// sorts them alphabetically, and creates a normalized CSS string. This ensures that
/// equivalent CSS styles produce the same hash regardless of property order.
///
/// # Arguments
/// * `css` - Raw CSS style string
///
/// # Returns
/// * Normalized CSS string with properties sorted alphabetically
pub(crate) fn normalize_css_style(css: &str) -> String {
    use std::collections::HashMap;

    // Parse CSS properties and sort them alphabetically
    let mut properties = HashMap::new();

    // Simple CSS parsing - extract transform, filter, and clip-path properties
    if let Some(transform_start) = css.find("transform:") {
        if let Some(transform_end) = css[transform_start..].find(';') {
            let transform_value = css[transform_start + 10..transform_start + transform_end].trim();
            properties.insert("transform", transform_value);
        }
    }

    if let Some(filter_start) = css.find("filter:") {
        if let Some(filter_end) = css[filter_start..].find(';') {
            let filter_value = css[filter_start + 7..filter_start + filter_end].trim();
            properties.insert("filter", filter_value);
        }
    }

    // Extract clip-path for crop information
    if let Some(clip_start) = css.find("clip-path:") {
        if let Some(clip_end) = css[clip_start..].find(';') {
            let clip_value = css[clip_start + 10..clip_start + clip_end].trim();
            properties.insert("clip-path", clip_value);
        }
    }

    // Sort properties alphabetically and create normalized CSS
    let mut sorted_props: Vec<_> = properties.iter().collect();
    sorted_props.sort_by_key(|&(key, _)| key);

    let normalized = sorted_props
        .iter()
        .map(|(key, value)| format!("{}: {};", key, value))
        .collect::<Vec<_>>()
        .join(" ");

    normalized
}
