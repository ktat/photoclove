//! Image processing and caching commands
//!
//! This module contains Tauri commands for:
//! - Image resizing and thumbnail generation
//! - EXIF thumbnail extraction
//! - Image caching and cache management
//! - File linking for public directory

use crate::entity::config::Config;
use crate::utils;
use std::{fs, path};

#[cfg(unix)]
use std::os::unix::fs::symlink;

#[cfg(windows)]
use std::os::windows::fs::symlink_file;

/// Links a file to the public directory for serving through the web interface.
///
/// On Windows, this creates a copy of the file.
/// On Unix systems, this creates a symbolic link.
///
/// # Arguments
///
/// * `from_file_path` - Source file path to link from
/// * `to_file_name` - Target filename in the public directory
/// * `_state` - Application state (unused)
///
/// # Returns
///
/// "true" on success, "false" on failure
#[tauri::command]
pub async fn link_file_to_public(
    from_file_path: &str,
    to_file_name: &str,
    _state: tauri::State<'_, crate::AppState>,
) -> Result<String, ()> {
    let from = path::Path::new(from_file_path);
    let to = path::Path::new("../public/").join(to_file_name.to_string());
    log::debug!(target: "file_service", "create_symlink; from={:?}; to={:?}", from, to);

    if cfg!(target_os = "windows") {
        return match std::fs::copy(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "copy_file_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    } else {
        match fs::remove_file(to.as_path()) {
            Ok(_) => {}
            Err(e) => {
                log::error!(target: "file_service", "delete_file_failed; file={:?}; error={:?}", to.clone(), e);
                // return Ok("false".to_string());
            }
        };

        #[cfg(unix)]
        return match symlink(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "create_symlink_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
        #[cfg(windows)]
        return match symlink_file(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "create_symlink_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    }
}

/// Helper function to get the thumbnail cache path for a photo.
///
/// Uses the common cache path generation function from utils module.
///
/// # Arguments
///
/// * `photo_path` - Path to the photo file
/// * `import_directory` - Optional import directory context
///
/// # Returns
///
/// Cache path as a String
pub(crate) fn get_thumbnail_path_for_photo(
    photo_path: &str,
    import_directory: Option<&str>,
) -> Result<String, String> {
    // Use common cache path generation function
    utils::generate_cache_path(photo_path, import_directory)
}

/// Helper function to clear all import thumbnail cache files.
///
/// Removes all cached thumbnail files from the specified cache directory.
///
/// # Arguments
///
/// * `cache_dir` - Path to the cache directory
///
/// # Returns
///
/// Number of files removed
pub(crate) fn clear_import_thumbnail_cache(cache_dir: &path::Path) -> Result<usize, String> {
    let mut removed_count = 0;

    if let Ok(entries) = fs::read_dir(cache_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        log::warn!(target: "image", "cache_clear_failed; file={}; error={}", entry.path().display(), e);
                    } else {
                        removed_count += 1;
                        log::debug!(target: "image", "cache_file_removed; file={}", entry.path().display());
                    }
                }
            }
        }
    }

    log::info!(target: "image", "import_cache_cleared; removed_files={}", removed_count);
    Ok(removed_count)
}

/// Gets a resized version of an image, either from cache or by generating a new thumbnail.
///
/// This function implements a sophisticated thumbnail generation strategy:
/// 1. First checks if a valid cached thumbnail exists
/// 2. If enabled, tries to extract EXIF embedded thumbnail (fastest method)
/// 3. Falls back to loading and resizing the full image (unless skip_resize_fallback is true)
///
/// The function automatically caches generated thumbnails for faster subsequent access.
///
/// # Arguments
///
/// * `path_str` - Path to the source image file
/// * `max_size` - Maximum dimension (width or height) for the resized image
/// * `import_directory` - Optional import directory context (enables EXIF thumbnail extraction)
/// * `skip_resize_fallback` - If true, returns original image path instead of resizing when EXIF extraction fails
/// * `state` - Application state containing configuration
///
/// # Returns
///
/// File path to the cached thumbnail or base64-encoded data URL
#[tauri::command]
pub fn get_resized_image(
    path_str: &str,
    max_size: u32,
    import_directory: Option<&str>,
    skip_resize_fallback: Option<bool>,
    state: tauri::State<crate::AppState>,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    use image::imageops::FilterType;
    use image::io::Reader as ImageReader;
    use image::GenericImageView;
    use std::fs::File;
    use std::io::BufReader;
    use std::io::Write;
    use std::time::Instant;

    let start_time = Instant::now();
    log::debug!(target: "image", "resize_request; path={}; max_size={}; import_directory={:?}", path_str, max_size, import_directory);

    // Get cache directory and create if needed
    let cache_dir = utils::get_cache_dir()?;
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;
    }

    // Generate cache path using common function
    let cache_path_str = utils::generate_cache_path(path_str, import_directory)?;
    let cache_path = path::Path::new(&cache_path_str);

    // Check if cached file exists and is newer than source
    if cache_path.exists() {
        if let Ok(cache_metadata) = fs::metadata(&cache_path) {
            if let Ok(source_metadata) = fs::metadata(path_str) {
                if let (Ok(cache_modified), Ok(source_modified)) =
                    (cache_metadata.modified(), source_metadata.modified())
                {
                    if cache_modified >= source_modified {
                        // Cache is valid, return convertFileSrc path
                        log::info!(target: "image", "cache_hit; cache_path={}", cache_path.display());

                        // Return the cache file path for convertFileSrc
                        let cache_path_str = cache_path
                            .to_str()
                            .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
                        return Ok(cache_path_str.to_string());
                    }
                }
            }
        }
    }

    log::debug!(target: "image", "cache_miss; generating_thumbnail");

    // First, try to extract EXIF embedded thumbnail using kamadak-exif (much faster!)
    // For import mode (when import_directory is provided), always use EXIF thumbnail
    // For library mode, use EXIF thumbnail only if use_exif_thumbnail config is enabled
    let exif_start = Instant::now();
    let should_use_exif = import_directory.is_some() || state.config.use_exif_thumbnail;

    if should_use_exif {
        if let Ok(file) = File::open(path_str) {
            let mut bufreader = BufReader::new(&file);

            if let Ok(exif_reader) = kexif::Reader::new().read_from_container(&mut bufreader) {
                // Try to get the thumbnail
                if let Some(thumbnail_field) =
                    exif_reader.get_field(kexif::Tag::JPEGInterchangeFormat, kexif::In::THUMBNAIL)
                {
                    if let Some(length_field) = exif_reader.get_field(
                        kexif::Tag::JPEGInterchangeFormatLength,
                        kexif::In::THUMBNAIL,
                    ) {
                        if let (
                            kexif::Value::Long(ref offset_vec),
                            kexif::Value::Long(ref length_vec),
                        ) = (&thumbnail_field.value, &length_field.value)
                        {
                            if let (Some(&offset), Some(&length)) =
                                (offset_vec.get(0), length_vec.get(0))
                            {
                                // Read the thumbnail data
                                use std::io::{Read, Seek, SeekFrom};
                                drop(bufreader);
                                if let Ok(mut file) = File::open(path_str) {
                                    if file.seek(SeekFrom::Start(offset as u64)).is_ok() {
                                        let mut thumbnail_data = vec![0u8; length as usize];
                                        if file.read_exact(&mut thumbnail_data).is_ok() {
                                            // Find JPEG start marker (FFD8) and trim any leading data
                                            let jpeg_start = thumbnail_data
                                                .windows(2)
                                                .position(|w| w[0] == 0xFF && w[1] == 0xD8);
                                            let jpeg_data_slice =
                                                if let Some(start_pos) = jpeg_start {
                                                    &thumbnail_data[start_pos..]
                                                } else {
                                                    &thumbnail_data[..]
                                                };

                                            // Find JPEG end marker (FFD9) and trim any trailing data
                                            let jpeg_end = jpeg_data_slice
                                                .windows(2)
                                                .rposition(|w| w[0] == 0xFF && w[1] == 0xD9);

                                            let jpeg_data: Vec<u8> = if let Some(end_pos) = jpeg_end
                                            {
                                                // EOI marker found - extract valid JPEG data including the marker
                                                jpeg_data_slice[..end_pos + 2].to_vec()
                                            } else {
                                                // No EOI marker found - append it
                                                log::debug!(target: "image", "exif_thumbnail_missing_eoi; appending_marker");
                                                let mut complete_jpeg = jpeg_data_slice.to_vec();
                                                complete_jpeg.push(0xFF);
                                                complete_jpeg.push(0xD9);
                                                complete_jpeg
                                            };

                                            let exif_time = exif_start.elapsed();

                                            // Save to cache file
                                            if let Ok(mut cache_file) = File::create(&cache_path) {
                                                if cache_file.write_all(&jpeg_data).is_ok() {
                                                    log::info!(target: "image", "exif_thumbnail_cached; cache_path={}; jpeg_start_offset={}; exif_ms={}; total_ms={}",
                                                    cache_path.display(), jpeg_start.unwrap_or(0), exif_time.as_millis(), start_time.elapsed().as_millis());

                                                    // Return cache file path
                                                    let cache_path_str = cache_path
                                                        .to_str()
                                                        .ok_or_else(|| {
                                                            "Failed to convert cache path to string"
                                                                .to_string()
                                                        })?;
                                                    return Ok(cache_path_str.to_string());
                                                }
                                            }

                                            // If cache write failed, fall through to return data URL
                                            let base64_string =
                                                general_purpose::STANDARD.encode(&jpeg_data);
                                            log::warn!(target: "image", "cache_write_failed; returning_data_url");
                                            return Ok(format!(
                                                "data:image/jpeg;base64,{}",
                                                base64_string
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // EXIF thumbnail not found or disabled, log and proceed to fallback
    let exif_time = exif_start.elapsed();
    if should_use_exif {
        log::debug!(target: "image", "no_exif_thumbnail; import_mode={}; exif_check_ms={}; skip_resize_fallback={}",
            import_directory.is_some(), exif_time.as_millis(), skip_resize_fallback.unwrap_or(false));
    } else {
        log::debug!(target: "image", "exif_thumbnail_disabled; import_mode=false; use_exif_thumbnail=false");
    }

    // Check if we should skip resize fallback (for import mode performance)
    if skip_resize_fallback.unwrap_or(false) {
        log::info!(target: "image", "skip_resize_fallback; returning_original_path; path={}", path_str);
        return Ok(path_str.to_string());
    }

    // Fallback: Load and resize the full image
    let load_start = Instant::now();
    let img = ImageReader::open(path_str)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    let load_time = load_start.elapsed();

    let (width, height) = img.dimensions();
    log::debug!(target: "image", "image_loaded; width={}; height={}; load_ms={}", width, height, load_time.as_millis());

    // Calculate new dimensions maintaining aspect ratio
    let (new_width, new_height) = if width > height {
        if width > max_size {
            let ratio = max_size as f32 / width as f32;
            (max_size, (height as f32 * ratio) as u32)
        } else {
            (width, height)
        }
    } else {
        if height > max_size {
            let ratio = max_size as f32 / height as f32;
            ((width as f32 * ratio) as u32, max_size)
        } else {
            (width, height)
        }
    };

    log::debug!(target: "image", "resizing; new_width={}; new_height={}", new_width, new_height);

    // Resize the image using Triangle (bilinear) filter - much faster than Lanczos3
    let resize_start = Instant::now();
    let resized = img.resize(new_width, new_height, FilterType::Triangle);
    let resize_time = resize_start.elapsed();

    // Encode as JPEG with quality setting
    let encode_start = Instant::now();
    let mut jpeg_data = Vec::new();

    // Use JpegEncoder to set quality explicitly (85 is a good balance)
    use image::codecs::jpeg::JpegEncoder;
    {
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_data, 85);
        // Use encode_image instead of encode - this properly handles the entire DynamicImage
        resized
            .write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
    } // encoder is dropped here, ensuring all data is flushed

    let encode_time = encode_start.elapsed();

    // Save to cache file
    if let Ok(mut cache_file) = File::create(&cache_path) {
        if cache_file.write_all(&jpeg_data).is_ok() {
            let total_time = start_time.elapsed();
            log::info!(target: "image", "resize_cached; cache_path={}; exif_ms={}; load_ms={}; resize_ms={}; encode_ms={}; total_ms={}",
                cache_path.display(), exif_time.as_millis(), load_time.as_millis(), resize_time.as_millis(), encode_time.as_millis(), total_time.as_millis());

            // Return cache file path
            let cache_path_str = cache_path
                .to_str()
                .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
            return Ok(cache_path_str.to_string());
        }
    }

    // If cache write failed, return data URL
    let base64_string = general_purpose::STANDARD.encode(jpeg_data);
    log::warn!(target: "image", "cache_write_failed_resize; returning_data_url");
    Ok(format!("data:image/jpeg;base64,{}", base64_string))
}

/// Gets the cache path for a photo's thumbnail.
///
/// This is a thin wrapper around the internal helper function.
///
/// # Arguments
///
/// * `photo_path` - Path to the photo file
/// * `import_directory` - Optional import directory context
///
/// # Returns
///
/// Cache path as a String
#[tauri::command]
pub fn get_thumbnail_path(
    photo_path: &str,
    import_directory: Option<&str>,
) -> Result<String, String> {
    get_thumbnail_path_for_photo(photo_path, import_directory)
}

/// Clears all import thumbnail cache files.
///
/// Removes all cached thumbnails from the standard cache directory.
/// Useful for freeing up disk space or forcing thumbnail regeneration.
///
/// # Returns
///
/// Number of cache files removed
#[tauri::command]
pub fn clear_import_cache() -> Result<usize, String> {
    log::info!(target: "image", "clear_import_cache_request");

    // Get cache directory
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())?
        .join("photoclove")
        .join("thumbnails");

    // Clear all cache files
    clear_import_thumbnail_cache(&cache_dir)
}
