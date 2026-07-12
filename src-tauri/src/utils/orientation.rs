//! EXIF orientation helpers.
//!
//! The orientation strings come from rexif's human-readable values; the match
//! arms are fragile knowledge, so keep this the single implementation
//! (previously copied into face_detection/service.rs and
//! face_thumbnail_service.rs).

use image::DynamicImage;
use std::io::Read;

/// Apply EXIF orientation to an image
pub fn apply_exif_orientation(image: DynamicImage, orientation: &str) -> DynamicImage {
    match orientation {
        // 1 = Normal
        "Normal" | "Horizontal (normal)" => image,
        // 2 = Horizontal flip
        "Mirror horizontal" | "Flip horizontal" => image.fliph(),
        // 3 = Rotate 180
        "Rotate 180" | "Rotate 180°" => image.rotate180(),
        // 4 = Vertical flip
        "Mirror vertical" | "Flip vertical" => image.flipv(),
        // 5 = Rotate 90 CCW + horizontal flip
        "Mirror horizontal and rotate 270 CW" | "Rotate 90 CCW and flip horizontal" => {
            image.rotate270().fliph()
        }
        // 6 = Rotate 90 CW (camera rotated CCW)
        // "Rotated to left" means the image appears rotated to the left, fix by rotating 90 CW
        "Rotate 90 CW" | "Rotate 90°" | "Rotate 90° CW" | "Rotated to left" => image.rotate90(),
        // 7 = Rotate 90 CW + horizontal flip
        "Mirror horizontal and rotate 90 CW" | "Rotate 90 CW and flip horizontal" => {
            image.rotate90().fliph()
        }
        // 8 = Rotate 90 CCW (or 270 CW, camera rotated CW)
        // "Rotated to right" means the image appears rotated to the right, fix by rotating 90 CCW
        "Rotate 270 CW" | "Rotate 90 CCW" | "Rotate 270° CW" | "Rotated to right" => {
            image.rotate270()
        }
        // Unknown or empty - no rotation
        _ => {
            log::debug!(
                target: "orientation",
                "unknown_orientation; value={}",
                orientation
            );
            image
        }
    }
}

/// Read EXIF orientation from a file
pub fn read_exif_orientation(path: &str) -> Option<String> {
    // Read only first 64KB for EXIF data (sufficient for header)
    let mut file = std::fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; 65536];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    let (exif_result, _warnings) = rexif::parse_buffer_quiet(&buffer);
    let exif = exif_result.ok()?;

    for entry in exif.entries {
        if matches!(entry.tag, rexif::ExifTag::Orientation) {
            return Some(entry.value_more_readable.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, RgbaImage};

    fn wide_image() -> DynamicImage {
        DynamicImage::ImageRgba8(RgbaImage::new(2, 1))
    }

    #[test]
    fn test_rotations_change_dimensions() {
        assert_eq!(
            apply_exif_orientation(wide_image(), "Rotate 90 CW").dimensions_tuple(),
            (1, 2)
        );
        assert_eq!(
            apply_exif_orientation(wide_image(), "Rotated to right").dimensions_tuple(),
            (1, 2)
        );
        assert_eq!(
            apply_exif_orientation(wide_image(), "Rotate 180").dimensions_tuple(),
            (2, 1)
        );
    }

    #[test]
    fn test_unknown_orientation_is_noop() {
        assert_eq!(
            apply_exif_orientation(wide_image(), "??").dimensions_tuple(),
            (2, 1)
        );
        assert_eq!(
            apply_exif_orientation(wide_image(), "Normal").dimensions_tuple(),
            (2, 1)
        );
    }

    trait DimensionsTuple {
        fn dimensions_tuple(&self) -> (u32, u32);
    }

    impl DimensionsTuple for DynamicImage {
        fn dimensions_tuple(&self) -> (u32, u32) {
            use image::GenericImageView;
            self.dimensions()
        }
    }
}
