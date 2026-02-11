//! EXIF Thumbnail Extraction Utility
//!
//! This module provides a common utility for extracting embedded JPEG thumbnails
//! from EXIF data in image files.

use crate::utils::raw_file;
use image::DynamicImage;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

/// Extract EXIF thumbnail from an image file
///
/// Returns the thumbnail image and its dimensions (width, height) if found.
/// Returns None if the file has no EXIF thumbnail or if extraction fails.
/// Routes to RAW-specific extraction when the file is a RAW format.
///
/// # Arguments
/// * `path` - Path to the image file
///
/// # Returns
/// * `Some((image, width, height))` if thumbnail is found and successfully decoded
/// * `None` if no thumbnail is found or extraction fails
pub fn extract_exif_thumbnail(path: &Path) -> Option<(DynamicImage, u32, u32)> {
    let path_str = path.to_string_lossy();

    // Route RAW files to dedicated extraction path
    if raw_file::is_raw_file(&path_str) {
        return extract_raw_exif_thumbnail(path);
    }

    extract_jpeg_exif_thumbnail(path)
}

/// Extract EXIF thumbnail from JPEG files (original logic)
/// Uses APP1 marker scanning to locate TIFF header position
fn extract_jpeg_exif_thumbnail(path: &Path) -> Option<(DynamicImage, u32, u32)> {
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
            thumb_data.first().unwrap_or(&0),
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

/// Extract EXIF thumbnail from TIFF-based RAW files (CR2, NEF, ARW, DNG, ORF, RW2, etc.)
///
/// For TIFF-based RAW files, the TIFF header is at offset 0 in the file,
/// so JPEGInterchangeFormat offset is the absolute file offset directly.
fn extract_raw_exif_thumbnail(path: &Path) -> Option<(DynamicImage, u32, u32)> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);

    let exif_reader = kexif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok();

    if let Some(ref exif) = exif {
        // Get thumbnail offset and length from EXIF IFD1 (THUMBNAIL)
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

        if let (Some(offset), Some(length)) = (thumb_offset, thumb_length) {
            if length > 0 && length <= 10_000_000 {
                let absolute_offset = offset as u64;

                log::debug!(
                    target: "exif_thumbnail",
                    "raw_exif_thumbnail_found; path={}; absolute_offset={}; length={}",
                    path.display(),
                    absolute_offset,
                    length
                );

                if let Some(result) = read_jpeg_at_offset(path, absolute_offset, length as usize) {
                    return Some(result);
                }
            }
        }
    }

    // Fallback: scan for embedded JPEG (for formats like 3FR that lack IFD1 thumbnail)
    log::debug!(
        target: "exif_thumbnail",
        "raw_exif_thumbnail_ifd1_not_found; trying_jpeg_scan; path={}",
        path.display()
    );
    extract_raw_embedded_jpeg(path)
}

/// Read JPEG data at a specific file offset and decode it
fn read_jpeg_at_offset(path: &Path, offset: u64, length: usize) -> Option<(DynamicImage, u32, u32)> {
    let mut file = File::open(path).ok()?;
    file.seek(SeekFrom::Start(offset)).ok()?;

    let mut thumb_data = vec![0u8; length];
    file.read_exact(&mut thumb_data).ok()?;

    // Verify JPEG magic bytes
    if thumb_data.len() < 2 || thumb_data[0] != 0xFF || thumb_data[1] != 0xD8 {
        log::debug!(
            target: "exif_thumbnail",
            "raw_exif_thumbnail_invalid_jpeg; path={}; first_bytes={:02X}{:02X}",
            path.display(),
            thumb_data.first().unwrap_or(&0),
            thumb_data.get(1).unwrap_or(&0)
        );
        return None;
    }

    let thumb_image = image::load_from_memory_with_format(&thumb_data, image::ImageFormat::Jpeg).ok()?;
    let (width, height) = (thumb_image.width(), thumb_image.height());

    log::debug!(
        target: "exif_thumbnail",
        "raw_exif_thumbnail_extracted; path={}; size={}x{}",
        path.display(),
        width,
        height
    );

    Some((thumb_image, width, height))
}

/// Scan for embedded JPEG images in RAW files that lack IFD1 thumbnail (e.g. Hasselblad 3FR).
/// Finds JPEG SOI markers (FFD8FF) in the first 5MB, then picks the smallest valid JPEG
/// as a preview/thumbnail.
fn extract_raw_embedded_jpeg(path: &Path) -> Option<(DynamicImage, u32, u32)> {
    let mut file = File::open(path).ok()?;
    let scan_size: usize = 5 * 1024 * 1024; // Scan first 5MB
    let mut buffer = vec![0u8; scan_size];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    // Find all JPEG SOI markers (FF D8 FF)
    let mut jpeg_offsets: Vec<usize> = Vec::new();
    for i in 0..buffer.len().saturating_sub(2) {
        if buffer[i] == 0xFF && buffer[i + 1] == 0xD8 && buffer[i + 2] == 0xFF {
            jpeg_offsets.push(i);
        }
    }

    if jpeg_offsets.is_empty() {
        return None;
    }

    log::debug!(
        target: "exif_thumbnail",
        "raw_embedded_jpeg_scan; path={}; markers_found={}",
        path.display(),
        jpeg_offsets.len()
    );

    // Try each JPEG, prefer a smaller one (likely a preview rather than full-size)
    // Process in reverse order since later JPEGs in 3FR are typically smaller previews
    let mut best_result: Option<(DynamicImage, u32, u32)> = None;

    for &offset in jpeg_offsets.iter().rev() {
        // Find EOI marker (FF D9) to determine JPEG size
        let jpeg_data = &buffer[offset..];
        let mut eoi_pos: Option<usize> = None;
        for i in 2..jpeg_data.len().saturating_sub(1) {
            if jpeg_data[i] == 0xFF && jpeg_data[i + 1] == 0xD9 {
                eoi_pos = Some(i + 2);
                break;
            }
        }

        let eoi = match eoi_pos {
            Some(pos) => pos,
            None => continue,
        };

        if let Ok(img) = image::load_from_memory_with_format(&jpeg_data[..eoi], image::ImageFormat::Jpeg) {
            let (w, h) = (img.width(), img.height());
            log::debug!(
                target: "exif_thumbnail",
                "raw_embedded_jpeg_found; path={}; offset={}; size={}x{}; bytes={}",
                path.display(), offset, w, h, eoi
            );
            best_result = Some((img, w, h));
            break; // Use the first valid one from reverse (smallest preview)
        }
    }

    best_result
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
