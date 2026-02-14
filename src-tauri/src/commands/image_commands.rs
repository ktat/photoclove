//! Image processing and caching commands
//!
//! This module contains Tauri commands for:
//! - Image resizing and thumbnail generation
//! - EXIF thumbnail extraction
//! - Image caching and cache management
//! - File linking for public directory

use crate::utils::{self, raw_file};
use std::{fs, path};

#[cfg(unix)]
use std::os::unix::fs::symlink;

#[cfg(windows)]
use std::os::windows::fs::symlink_file;

/// Links a file to the public directory for serving through the web interface.
#[tauri::command]
pub async fn link_file_to_public(
    from_file_path: &str,
    to_file_name: &str,
    _state: tauri::State<'_, crate::AppState>,
) -> Result<String, ()> {
    let from = path::Path::new(from_file_path);
    let to = path::Path::new("../public/").join(to_file_name);
    log::debug!(target: "file_service", "create_symlink; from={:?}; to={:?}", from, to);

    if cfg!(target_os = "windows") {
        match std::fs::copy(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                log::error!(target: "file_service", "copy_file_failed; from={:?}; to={:?}; error={:?}", from, to, e);
                Ok("false".to_string())
            }
        }
    } else {
        match fs::remove_file(to.as_path()) {
            Ok(_) => {}
            Err(e) => {
                log::error!(target: "file_service", "delete_file_failed; file={:?}; error={:?}", to.clone(), e);
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
pub(crate) fn get_thumbnail_path_for_photo(
    photo_path: &str,
    import_directory: Option<&str>,
) -> Result<String, String> {
    utils::generate_cache_path(photo_path, import_directory)
}

/// Helper function to clear all import thumbnail cache files.
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

/// Encode a DynamicImage as JPEG and write to a cache file path.
fn encode_and_cache_jpeg(
    img: &image::DynamicImage,
    cache_path: &path::Path,
    quality: u8,
) -> Result<(), String> {
    use image::codecs::jpeg::JpegEncoder;
    use std::io::Write;

    let mut jpeg_data = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut jpeg_data, quality);
    img.write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    if let Some(parent) = cache_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
    }

    let mut f = fs::File::create(cache_path)
        .map_err(|e| format!("Failed to create cache file: {}", e))?;
    f.write_all(&jpeg_data)
        .map_err(|e| format!("Failed to write cache file: {}", e))?;
    Ok(())
}

/// Gets a resized version of an image, either from cache or by generating a new thumbnail.
///
/// Strategy: 1. Check cache 2. Try EXIF thumbnail 3. Fall back to full decode/resize.
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
        if let Ok(cache_metadata) = fs::metadata(cache_path) {
            if let Ok(source_metadata) = fs::metadata(path_str) {
                if let (Ok(cache_modified), Ok(source_modified)) =
                    (cache_metadata.modified(), source_metadata.modified())
                {
                    if cache_modified >= source_modified {
                        log::info!(target: "image", "cache_hit; cache_path={}", cache_path.display());
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

    let exif_start = Instant::now();
    let should_use_exif = import_directory.is_some() || state.config.use_exif_thumbnail;
    let is_raw = raw_file::is_raw_file(path_str);
    let is_heic_avif = raw_file::is_heic_or_avif(path_str);

    if should_use_exif {
        // For HEIC/AVIF or RAW files, use the dedicated exif_thumbnail extraction
        if is_heic_avif || is_raw {
            let source_path = std::path::Path::new(path_str);
            if let Some((thumb_img, width, height)) =
                utils::exif_thumbnail::extract_exif_thumbnail(source_path)
            {
                if encode_and_cache_jpeg(&thumb_img, cache_path, 85).is_ok() {
                    let exif_time = exif_start.elapsed();
                    log::info!(target: "image", "exif_thumbnail_cached; cache_path={}; size={}x{}; exif_ms={}; total_ms={}",
                        cache_path.display(), width, height, exif_time.as_millis(), start_time.elapsed().as_millis());
                    let cache_path_str = cache_path.to_str().ok_or_else(|| {
                        "Failed to convert cache path to string".to_string()
                    })?;
                    return Ok(cache_path_str.to_string());
                }
            }
        } else {
            // Standard JPEG EXIF thumbnail extraction (original logic)
            if let Ok(file) = File::open(path_str) {
                let mut bufreader = BufReader::new(&file);

                if let Ok(exif_reader) = kexif::Reader::new().read_from_container(&mut bufreader) {
                    if let Some(thumbnail_field) = exif_reader
                        .get_field(kexif::Tag::JPEGInterchangeFormat, kexif::In::THUMBNAIL)
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
                                    (offset_vec.first(), length_vec.first())
                                {
                                    use std::io::{Read, Seek, SeekFrom};
                                    drop(bufreader);
                                    if let Ok(mut file) = File::open(path_str) {
                                        if file.seek(SeekFrom::Start(offset as u64)).is_ok() {
                                            let mut thumbnail_data = vec![0u8; length as usize];
                                            if file.read_exact(&mut thumbnail_data).is_ok() {
                                                let jpeg_start = thumbnail_data
                                                    .windows(2)
                                                    .position(|w| w[0] == 0xFF && w[1] == 0xD8);
                                                let jpeg_data_slice =
                                                    if let Some(start_pos) = jpeg_start {
                                                        &thumbnail_data[start_pos..]
                                                    } else {
                                                        &thumbnail_data[..]
                                                    };

                                                let jpeg_end = jpeg_data_slice
                                                    .windows(2)
                                                    .rposition(|w| w[0] == 0xFF && w[1] == 0xD9);

                                                let jpeg_data: Vec<u8> = if let Some(end_pos) =
                                                    jpeg_end
                                                {
                                                    jpeg_data_slice[..end_pos + 2].to_vec()
                                                } else {
                                                    log::debug!(target: "image", "exif_thumbnail_missing_eoi; appending_marker");
                                                    let mut complete_jpeg =
                                                        jpeg_data_slice.to_vec();
                                                    complete_jpeg.push(0xFF);
                                                    complete_jpeg.push(0xD9);
                                                    complete_jpeg
                                                };

                                                let exif_time = exif_start.elapsed();

                                                if let Ok(mut cache_file) = File::create(cache_path)
                                                {
                                                    if cache_file.write_all(&jpeg_data).is_ok() {
                                                        log::info!(target: "image", "exif_thumbnail_cached; cache_path={}; jpeg_start_offset={}; exif_ms={}; total_ms={}",
                                                    cache_path.display(), jpeg_start.unwrap_or(0), exif_time.as_millis(), start_time.elapsed().as_millis());
                                                        let cache_path_str = cache_path
                                                        .to_str()
                                                        .ok_or_else(|| {
                                                            "Failed to convert cache path to string"
                                                                .to_string()
                                                        })?;
                                                        return Ok(cache_path_str.to_string());
                                                    }
                                                }

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
        } // end else (non-RAW/HEIC)
    }

    // EXIF thumbnail not found or disabled
    let exif_time = exif_start.elapsed();
    if should_use_exif {
        log::debug!(target: "image", "no_exif_thumbnail; import_mode={}; exif_check_ms={}; skip_resize_fallback={}",
            import_directory.is_some(), exif_time.as_millis(), skip_resize_fallback.unwrap_or(false));
    } else {
        log::debug!(target: "image", "exif_thumbnail_disabled; import_mode=false; use_exif_thumbnail=false");
    }

    if skip_resize_fallback.unwrap_or(false) {
        log::info!(target: "image", "skip_resize_fallback; returning_original_path; path={}", path_str);
        return Ok(path_str.to_string());
    }

    // HEIC/AVIF files: use libheif-rs to decode, then resize and cache
    if is_heic_avif {
        if let Some((heic_img, heic_w, heic_h)) =
            utils::heic_decode::decode_heic_to_image(path_str, max_size)
        {
            if encode_and_cache_jpeg(&heic_img, cache_path, 85).is_ok() {
                log::info!(target: "image", "heic_decode_cached; cache_path={}; size={}x{}; total_ms={}",
                    cache_path.display(), heic_w, heic_h, start_time.elapsed().as_millis());
                let cache_path_str = cache_path
                    .to_str()
                    .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
                return Ok(cache_path_str.to_string());
            }
            let base64_string = general_purpose::STANDARD.encode(b"");
            return Ok(format!("data:image/jpeg;base64,{}", base64_string));
        }
        return Err("Failed to decode HEIC/AVIF file".to_string());
    }

    // RAW files: use rawloader to decode, then resize and cache
    if is_raw {
        if let Some((raw_img, raw_w, raw_h)) =
            utils::raw_decode::decode_raw_to_thumbnail(path_str, max_size)
        {
            if encode_and_cache_jpeg(&raw_img, cache_path, 85).is_ok() {
                log::info!(target: "image", "raw_decode_cached; cache_path={}; size={}x{}; total_ms={}",
                    cache_path.display(), raw_w, raw_h, start_time.elapsed().as_millis());
                let cache_path_str = cache_path
                    .to_str()
                    .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
                return Ok(cache_path_str.to_string());
            }
            let base64_string = general_purpose::STANDARD.encode(b"");
            return Ok(format!("data:image/jpeg;base64,{}", base64_string));
        }
        return Err("Failed to decode RAW file".to_string());
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

    let (new_width, new_height) = if width > height {
        if width > max_size {
            let ratio = max_size as f32 / width as f32;
            (max_size, (height as f32 * ratio) as u32)
        } else {
            (width, height)
        }
    } else if height > max_size {
        let ratio = max_size as f32 / height as f32;
        ((width as f32 * ratio) as u32, max_size)
    } else {
        (width, height)
    };

    let resize_start = Instant::now();
    let resized = img.resize(new_width, new_height, FilterType::Triangle);
    let resize_time = resize_start.elapsed();

    let encode_start = Instant::now();
    let mut jpeg_data = Vec::new();
    use image::codecs::jpeg::JpegEncoder;
    {
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_data, 85);
        resized
            .write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
    }
    let encode_time = encode_start.elapsed();

    if let Ok(mut cache_file) = File::create(cache_path) {
        if cache_file.write_all(&jpeg_data).is_ok() {
            let total_time = start_time.elapsed();
            log::info!(target: "image", "resize_cached; cache_path={}; exif_ms={}; load_ms={}; resize_ms={}; encode_ms={}; total_ms={}",
                cache_path.display(), exif_time.as_millis(), load_time.as_millis(), resize_time.as_millis(), encode_time.as_millis(), total_time.as_millis());
            let cache_path_str = cache_path
                .to_str()
                .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
            return Ok(cache_path_str.to_string());
        }
    }

    let base64_string = general_purpose::STANDARD.encode(jpeg_data);
    log::warn!(target: "image", "cache_write_failed_resize; returning_data_url");
    Ok(format!("data:image/jpeg;base64,{}", base64_string))
}

/// Gets the cache path for a photo's thumbnail.
#[tauri::command]
pub fn get_thumbnail_path(
    photo_path: &str,
    import_directory: Option<&str>,
) -> Result<String, String> {
    get_thumbnail_path_for_photo(photo_path, import_directory)
}

/// Clears all import thumbnail cache files.
#[tauri::command]
pub fn clear_import_cache() -> Result<usize, String> {
    log::info!(target: "image", "clear_import_cache_request");
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())?
        .join("photoclove")
        .join("thumbnails");
    clear_import_thumbnail_cache(&cache_dir)
}

/// Inserts a tEXt chunk into PNG data before the IEND chunk.
/// This operates at the chunk level so no re-encoding/quality loss occurs.
fn insert_png_text_chunk(png_data: &[u8], keyword: &str, text: &str) -> Result<Vec<u8>, String> {
    // PNG signature is 8 bytes, then chunks follow
    if png_data.len() < 8 || &png_data[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("Not a valid PNG file".to_string());
    }

    // Build the tEXt chunk data: keyword + null separator + text
    let mut chunk_data = Vec::new();
    chunk_data.extend_from_slice(keyword.as_bytes());
    chunk_data.push(0); // null separator
    chunk_data.extend_from_slice(text.as_bytes());

    // Build the full tEXt chunk: length(4) + "tEXt" + data + CRC(4)
    let chunk_len = chunk_data.len() as u32;
    let mut text_chunk = Vec::new();
    text_chunk.extend_from_slice(&chunk_len.to_be_bytes());
    text_chunk.extend_from_slice(b"tEXt");
    text_chunk.extend_from_slice(&chunk_data);

    // CRC covers chunk type + chunk data
    let mut crc_input = Vec::new();
    crc_input.extend_from_slice(b"tEXt");
    crc_input.extend_from_slice(&chunk_data);
    let crc = crc32fast::hash(&crc_input);
    text_chunk.extend_from_slice(&crc.to_be_bytes());

    // Find IEND chunk position (last 12 bytes: length(4) + "IEND"(4) + CRC(4))
    // Search for IEND chunk type from the end
    let iend_pos = png_data
        .windows(4)
        .rposition(|w| w == b"IEND")
        .ok_or_else(|| "IEND chunk not found in PNG".to_string())?;
    // The chunk starts 4 bytes before the type (length field)
    let insert_pos = iend_pos - 4;

    let mut result = Vec::with_capacity(png_data.len() + text_chunk.len());
    result.extend_from_slice(&png_data[..insert_pos]);
    result.extend_from_slice(&text_chunk);
    result.extend_from_slice(&png_data[insert_pos..]);

    Ok(result)
}

/// Saves base64 encoded image data to the download directory
#[tauri::command]
pub fn save_image_to_download_dir(
    image_data: &str,
    filename: &str,
    copyright: Option<&str>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    log::info!(target: "image", "save_image_to_download_dir; filename={}; has_copyright={}", filename, copyright.is_some());

    let decoded = STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode base64 image data: {}", e))?;

    // Insert copyright tEXt chunk if provided
    let final_data = match copyright {
        Some(text) if !text.is_empty() => {
            match insert_png_text_chunk(&decoded, "Copyright", text) {
                Ok(data) => {
                    log::info!(target: "image", "png_copyright_inserted; copyright={}", text);
                    data
                }
                Err(e) => {
                    log::warn!(target: "image", "png_copyright_insert_failed; error={}; saving_without_copyright", e);
                    decoded
                }
            }
        }
        _ => decoded,
    };

    let download_dir = &state.config.download_dir;
    fs::create_dir_all(download_dir)
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    let full_path = path::Path::new(download_dir).join(filename);
    let full_path_str = full_path.to_string_lossy().to_string();

    fs::write(&full_path, final_data).map_err(|e| format!("Failed to write image file: {}", e))?;

    log::info!(target: "image", "save_image_to_download_dir_success; path={}", full_path_str);
    Ok(full_path_str)
}

/// Gets a progressive image at the specified quality level for non-browser-native formats.
///
/// Supports RAW (CR2, NEF, ARW, etc.) and HEIC/HEIF/AVIF files.
/// Level 1: EXIF/embedded thumbnail (fast). Level 2: Full decode (slow).
/// Results are cached with level suffix (`{hash}_exif`, `{hash}_full`).
#[tauri::command]
pub fn get_progressive_image(
    path_str: &str,
    max_size: u32,
    quality_level: u32,
    import_directory: Option<&str>,
) -> Result<String, String> {
    use std::time::Instant;
    let start_time = Instant::now();

    let is_raw = raw_file::is_raw_file(path_str);
    let is_heic_avif = raw_file::is_heic_or_avif(path_str);
    if !is_raw && !is_heic_avif {
        return Err("Not a RAW or HEIC/AVIF file".to_string());
    }

    let base_cache_path = utils::generate_cache_path(path_str, import_directory)?;
    let suffix = match quality_level {
        1 => "_exif",
        2 => "_full",
        _ => return Err("Invalid quality level (must be 1 or 2)".to_string()),
    };
    let cache_path_str = format!("{}{}", base_cache_path, suffix);
    let cache_path = path::Path::new(&cache_path_str);

    if cache_path.exists() {
        log::info!(target: "image", "progressive_cache_hit; level={}; path={}", quality_level, cache_path.display());
        return Ok(cache_path_str);
    }

    match quality_level {
        1 => {
            // Level 1: EXIF/embedded thumbnail
            let source_path = std::path::Path::new(path_str);
            if let Some((thumb_img, w, h)) =
                utils::exif_thumbnail::extract_exif_thumbnail(source_path)
            {
                encode_and_cache_jpeg(&thumb_img, cache_path, 85)?;
                log::info!(target: "image", "progressive_exif; path={}; size={}x{}; ms={}",
                    path_str, w, h, start_time.elapsed().as_millis());
                Ok(cache_path_str)
            } else {
                Err("No EXIF thumbnail found".to_string())
            }
        }
        2 => {
            // Level 2: Full decode (RAW or HEIC/AVIF)
            let result = if is_raw {
                utils::raw_decode::decode_raw_to_thumbnail(path_str, max_size)
            } else {
                utils::heic_decode::decode_heic_to_image(path_str, max_size)
            };
            if let Some((decoded_img, w, h)) = result {
                encode_and_cache_jpeg(&decoded_img, cache_path, 90)?;
                log::info!(target: "image", "progressive_full; path={}; size={}x{}; ms={}",
                    path_str, w, h, start_time.elapsed().as_millis());
                Ok(cache_path_str)
            } else {
                Err("Failed to decode file".to_string())
            }
        }
        _ => Err("Invalid quality level".to_string()),
    }
}
