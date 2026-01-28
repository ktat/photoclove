//! EXIF Thumbnail Extraction Utility
//!
//! This module provides a common utility for extracting embedded JPEG thumbnails
//! from EXIF data in image files.

use image::DynamicImage;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

/// Extract EXIF thumbnail from an image file
///
/// Returns the thumbnail image and its dimensions (width, height) if found.
/// Returns None if the file has no EXIF thumbnail or if extraction fails.
///
/// # Arguments
/// * `path` - Path to the image file
///
/// # Returns
/// * `Some((image, width, height))` if thumbnail is found and successfully decoded
/// * `None` if no thumbnail is found or extraction fails
pub fn extract_exif_thumbnail(path: &Path) -> Option<(DynamicImage, u32, u32)> {
    // Read file to find EXIF APP1 segment and extract thumbnail
    let mut file = File::open(path).ok()?;

    // Read enough to find EXIF segment (typically within first 64KB)
    let mut buffer = vec![0u8; 65536];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    // Find APP1 (EXIF) marker: FF E1
    let mut app1_start: Option<usize> = None;
    for i in 0..buffer.len().saturating_sub(1) {
        if buffer[i] == 0xFF && buffer[i + 1] == 0xE1 {
            app1_start = Some(i);
            break;
        }
    }
    let app1_pos = app1_start?;

    // APP1 structure: FF E1 [length: 2 bytes] "Exif\0\0" [TIFF header...]
    // TIFF header starts at app1_pos + 2 (marker) + 2 (length) + 6 (Exif\0\0) = app1_pos + 10
    let tiff_header_pos = app1_pos + 10;

    if tiff_header_pos >= buffer.len() {
        return None;
    }

    // Now parse EXIF using kamadak-exif to get thumbnail offset/length
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);

    let exif_reader = kexif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    // Get thumbnail offset and length from EXIF
    let mut thumb_offset: Option<u32> = None;
    let mut thumb_length: Option<u32> = None;

    for field in exif.fields() {
        if field.ifd_num == kexif::In::THUMBNAIL {
            match field.tag {
                kexif::Tag::JPEGInterchangeFormat => {
                    if let kexif::Value::Long(ref v) = field.value {
                        thumb_offset = v.first().copied();
                    }
                }
                kexif::Tag::JPEGInterchangeFormatLength => {
                    if let kexif::Value::Long(ref v) = field.value {
                        thumb_length = v.first().copied();
                    }
                }
                _ => {}
            }
        }
    }

    let relative_offset = thumb_offset?;
    let length = thumb_length?;

    if length == 0 || length > 1_000_000 {
        return None;
    }

    // Calculate absolute file offset:
    // JPEGInterchangeFormat offset is relative to TIFF header
    let absolute_offset = tiff_header_pos as u64 + relative_offset as u64;

    log::debug!(
        target: "exif_thumbnail",
        "exif_thumbnail_found; path={}; tiff_header_pos={}; relative_offset={}; absolute_offset={}; length={}",
        path.display(),
        tiff_header_pos,
        relative_offset,
        absolute_offset,
        length
    );

    // Read thumbnail data at absolute position
    let mut file = File::open(path).ok()?;
    file.seek(SeekFrom::Start(absolute_offset)).ok()?;

    let mut thumb_data = vec![0u8; length as usize];
    file.read_exact(&mut thumb_data).ok()?;

    // Verify JPEG magic bytes
    if thumb_data.len() < 2 || thumb_data[0] != 0xFF || thumb_data[1] != 0xD8 {
        log::debug!(
            target: "exif_thumbnail",
            "exif_thumbnail_invalid_jpeg; path={}; first_bytes={:02X}{:02X}",
            path.display(),
            thumb_data.get(0).unwrap_or(&0),
            thumb_data.get(1).unwrap_or(&0)
        );
        return None;
    }

    // Parse thumbnail as JPEG
    let thumb_image = image::load_from_memory_with_format(&thumb_data, image::ImageFormat::Jpeg).ok()?;
    let (width, height) = (thumb_image.width(), thumb_image.height());

    log::debug!(
        target: "exif_thumbnail",
        "exif_thumbnail_extracted; path={}; size={}x{}",
        path.display(),
        width,
        height
    );

    Some((thumb_image, width, height))
}

/// Extract EXIF thumbnail with minimum size check
///
/// Returns the thumbnail only if its minimum dimension meets the size requirement.
///
/// # Arguments
/// * `path` - Path to the image file
/// * `min_size` - Minimum dimension (width or height) required. Set to 0 to disable check.
///
/// # Returns
/// * `Some((image, width, height))` if thumbnail meets size requirement
/// * `None` if no thumbnail, extraction fails, or thumbnail is too small
pub fn extract_exif_thumbnail_with_min_size(
    path: &Path,
    min_size: u32,
) -> Option<(DynamicImage, u32, u32)> {
    let (img, width, height) = extract_exif_thumbnail(path)?;

    if min_size > 0 {
        let min_dim = width.min(height);
        if min_dim < min_size {
            log::debug!(
                target: "exif_thumbnail",
                "exif_thumbnail_too_small; path={}; size={}x{}; min_size={}; rejected",
                path.display(),
                width,
                height,
                min_size
            );
            return None;
        }
    }

    Some((img, width, height))
}
