//! Face Thumbnail Service
//!
//! Generates and caches face thumbnails from detected faces.
//! Thumbnails are stored in {thumbnail_store}/faces/{face_id}.jpg

use crate::domain_service::face_detection::BoundingBox;
use image::{DynamicImage, GenericImageView};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

/// JPEG quality for face thumbnails (0-100)
pub const FACE_THUMBNAIL_QUALITY: u8 = 85;

/// Padding ratio around the face bounding box (20%)
pub const FACE_PADDING_RATIO: f32 = 0.2;

/// Get the path for a face thumbnail
pub fn get_face_thumbnail_path(thumbnail_store: &str, face_id: i64) -> PathBuf {
    Path::new(thumbnail_store)
        .join("faces")
        .join(format!("{}.jpg", face_id))
}

/// Check if a face thumbnail exists
pub fn face_thumbnail_exists(thumbnail_store: &str, face_id: i64) -> bool {
    get_face_thumbnail_path(thumbnail_store, face_id).exists()
}

/// Generate a face thumbnail from an image and bbox
///
/// # Arguments
/// * `image` - The source image (already EXIF-orientation corrected)
/// * `bbox` - Normalized bounding box (0-1 coordinates)
/// * `thumbnail_store` - Base thumbnail store directory
/// * `face_id` - The face ID for naming the output file
/// * `size` - Output thumbnail size in pixels (square)
///
/// # Returns
/// The path to the saved thumbnail, or an error
pub fn generate_face_thumbnail(
    image: &DynamicImage,
    bbox: &BoundingBox,
    thumbnail_store: &str,
    face_id: i64,
    size: u32,
) -> Result<PathBuf, String> {
    let (img_width, img_height) = image.dimensions();

    // Convert normalized bbox to pixel coordinates
    let x = (bbox.x * img_width as f32) as i32;
    let y = (bbox.y * img_height as f32) as i32;
    let width = (bbox.width * img_width as f32) as i32;
    let height = (bbox.height * img_height as f32) as i32;

    // Add padding (20% on each side)
    let padding_x = (width as f32 * FACE_PADDING_RATIO) as i32;
    let padding_y = (height as f32 * FACE_PADDING_RATIO) as i32;

    let mut crop_x = (x - padding_x).max(0);
    let mut crop_y = (y - padding_y).max(0);
    let mut crop_width = width + 2 * padding_x;
    let mut crop_height = height + 2 * padding_y;

    // Make it square by extending the shorter side
    if crop_width > crop_height {
        let diff = (crop_width - crop_height) / 2;
        crop_y = (crop_y - diff).max(0);
        crop_height = crop_width;
    } else if crop_height > crop_width {
        let diff = (crop_height - crop_width) / 2;
        crop_x = (crop_x - diff).max(0);
        crop_width = crop_height;
    }

    // Clamp to image bounds
    let crop_x = crop_x.max(0) as u32;
    let crop_y = crop_y.max(0) as u32;
    let crop_width = crop_width
        .min((img_width as i32 - crop_x as i32).max(1))
        .max(1) as u32;
    let crop_height = crop_height
        .min((img_height as i32 - crop_y as i32).max(1))
        .max(1) as u32;

    // Crop the face region
    let cropped = image.crop_imm(crop_x, crop_y, crop_width, crop_height);

    // Resize to target size (square)
    let resized = cropped.resize_exact(size, size, image::imageops::FilterType::Triangle);

    // Ensure faces directory exists
    let faces_dir = Path::new(thumbnail_store).join("faces");
    fs::create_dir_all(&faces_dir)
        .map_err(|e| format!("Failed to create faces directory: {}", e))?;

    // Save as JPEG
    let output_path = get_face_thumbnail_path(thumbnail_store, face_id);

    // Use JpegEncoder for quality control
    let file = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create thumbnail file: {}", e))?;

    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
        std::io::BufWriter::new(file),
        FACE_THUMBNAIL_QUALITY,
    );

    resized
        .write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode face thumbnail: {}", e))?;

    log::info!(
        target: "face_thumbnail",
        "thumbnail_generated; face_id={}; path={}; size={}",
        face_id,
        output_path.display(),
        size
    );

    Ok(output_path)
}

/// Apply EXIF orientation to an image
fn apply_exif_orientation(image: DynamicImage, orientation: &str) -> DynamicImage {
    match orientation {
        "Normal" | "Horizontal (normal)" => image,
        "Mirror horizontal" | "Flip horizontal" => image.fliph(),
        "Rotate 180" | "Rotate 180°" => image.rotate180(),
        "Mirror vertical" | "Flip vertical" => image.flipv(),
        "Mirror horizontal and rotate 270 CW" | "Rotate 90 CCW and flip horizontal" => {
            image.rotate270().fliph()
        }
        "Rotate 90 CW" | "Rotate 90°" | "Rotate 90° CW" | "Rotated to left" => image.rotate90(),
        "Mirror horizontal and rotate 90 CW" | "Rotate 90 CW and flip horizontal" => {
            image.rotate90().fliph()
        }
        "Rotate 270 CW" | "Rotate 90 CCW" | "Rotate 270° CW" | "Rotated to right" => {
            image.rotate270()
        }
        _ => image,
    }
}

/// Read EXIF orientation from file
fn read_exif_orientation(path: &str) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; 65536];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    let (exif_result, _) = rexif::parse_buffer_quiet(&buffer);
    let exif = exif_result.ok()?;

    for entry in exif.entries {
        if matches!(entry.tag, rexif::ExifTag::Orientation) {
            return Some(entry.value_more_readable.to_string());
        }
    }
    None
}

/// Generate face thumbnail from a file path (loads image with EXIF orientation)
pub fn generate_face_thumbnail_from_file(
    photo_path: &str,
    bbox: &BoundingBox,
    thumbnail_store: &str,
    face_id: i64,
    size: u32,
) -> Result<PathBuf, String> {
    // Load image: for HEIC/AVIF, try persistent cache first, then decode
    let mut used_persistent_cache = false;
    let mut image = if crate::utils::raw_file::is_heic_or_avif(photo_path) {
        let persistent_path = format!(
            "{}.jpg",
            crate::utils::generate_persistent_cache_path(photo_path, thumbnail_store)?
        );
        if Path::new(&persistent_path).exists() {
            log::debug!(
                target: "face_thumbnail",
                "using_persistent_cache; photo_path={}; cache_path={}",
                photo_path,
                persistent_path
            );
            used_persistent_cache = true;
            image::open(&persistent_path)
                .map_err(|e| format!("Failed to load cached image {}: {}", persistent_path, e))?
        } else {
            crate::utils::heic_decode::decode_heic_to_image(photo_path, 1600)
                .map(|(img, _, _)| img)
                .ok_or_else(|| format!("Failed to decode HEIC/AVIF image: {}", photo_path))?
        }
    } else {
        image::open(photo_path)
            .map_err(|e| format!("Failed to load image {}: {}", photo_path, e))?
    };

    // Apply EXIF orientation (skip for cached images which are already orientation-corrected)
    if !used_persistent_cache {
        if let Some(orientation) = read_exif_orientation(photo_path) {
            image = apply_exif_orientation(image, &orientation);
        }
    }

    generate_face_thumbnail(&image, bbox, thumbnail_store, face_id, size)
}

/// Delete a face thumbnail
#[allow(dead_code)]
pub fn delete_face_thumbnail(thumbnail_store: &str, face_id: i64) -> Result<(), String> {
    let path = get_face_thumbnail_path(thumbnail_store, face_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete face thumbnail: {}", e))?;
        log::info!(
            target: "face_thumbnail",
            "thumbnail_deleted; face_id={}; path={}",
            face_id,
            path.display()
        );
    }
    Ok(())
}
