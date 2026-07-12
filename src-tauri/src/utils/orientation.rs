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
        // 5 = transpose (mirror across the main diagonal). rotate90().fliph()
        // yields the transpose; rotate270().fliph() would give transverse
        // (the EXIF 7 result), so these two must not be swapped.
        "Mirror horizontal and rotate 270 CW" | "Rotate 90 CCW and flip horizontal" => {
            image.rotate90().fliph()
        }
        // 6 = Rotate 90 CW (camera rotated CCW)
        // "Rotated to left" means the image appears rotated to the left, fix by rotating 90 CW
        "Rotate 90 CW" | "Rotate 90°" | "Rotate 90° CW" | "Rotated to left" => image.rotate90(),
        // 7 = transverse (mirror across the anti-diagonal)
        "Mirror horizontal and rotate 90 CW" | "Rotate 90 CW and flip horizontal" => {
            image.rotate270().fliph()
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

    /// Build a 2x3 (w=2, h=3) RGBA image where each pixel's red channel encodes
    /// its row-major index, so transforms can be checked pixel-exactly.
    fn indexed_image() -> DynamicImage {
        let mut img = RgbaImage::new(2, 3);
        for y in 0..3u32 {
            for x in 0..2u32 {
                let idx = (y * 2 + x) as u8;
                img.put_pixel(x, y, image::Rgba([idx, 0, 0, 255]));
            }
        }
        DynamicImage::ImageRgba8(img)
    }

    fn red_grid(img: &DynamicImage) -> Vec<Vec<u8>> {
        use image::GenericImageView;
        let (w, h) = img.dimensions();
        (0..h)
            .map(|y| (0..w).map(|x| img.get_pixel(x, y)[0]).collect())
            .collect()
    }

    #[test]
    fn test_exif_5_is_transpose_and_7_is_transverse() {
        // EXIF 5 = transpose (main diagonal): result[y][x] = orig[x][y]
        let transposed = red_grid(&apply_exif_orientation(
            indexed_image(),
            "Mirror horizontal and rotate 270 CW",
        ));
        assert_eq!(transposed, vec![vec![0, 2, 4], vec![1, 3, 5]]);

        // EXIF 7 = transverse (anti-diagonal)
        let transversed = red_grid(&apply_exif_orientation(
            indexed_image(),
            "Mirror horizontal and rotate 90 CW",
        ));
        assert_eq!(transversed, vec![vec![5, 3, 1], vec![4, 2, 0]]);
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
