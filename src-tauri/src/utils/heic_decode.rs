//! HEIC/HEIF/AVIF file decode utility
//!
//! Decodes HEIC, HEIF, and AVIF files using libheif-rs
//! and converts them to displayable RGB images.

use image::{imageops::FilterType, DynamicImage, ImageBuffer, Rgb};
use libheif_rs::{ColorSpace, HeifContext, LibHeif, RgbChroma};

/// Decode a HEIC/HEIF/AVIF file and produce a resized thumbnail image.
///
/// # Arguments
/// * `path` - Path to the HEIC/HEIF/AVIF file
/// * `max_size` - Maximum dimension (width or height) for the output
///
/// # Returns
/// * `Some((image, width, height))` if decoding succeeds
/// * `None` if decoding fails
pub fn decode_heic_to_image(path: &str, max_size: u32) -> Option<(DynamicImage, u32, u32)> {
    let lib_heif = LibHeif::new();

    let ctx = HeifContext::read_from_file(path)
        .map_err(|e| {
            log::warn!(target: "heic_decode", "context_read_failed; path={}; error={}", path, e);
        })
        .ok()?;

    let handle = ctx
        .primary_image_handle()
        .map_err(|e| {
            log::warn!(target: "heic_decode", "primary_handle_failed; path={}; error={}", path, e);
        })
        .ok()?;

    let width = handle.width();
    let height = handle.height();

    if width == 0 || height == 0 {
        log::warn!(target: "heic_decode", "invalid_dimensions; path={}; width={}; height={}", path, width, height);
        return None;
    }

    let decoded = lib_heif
        .decode(&handle, ColorSpace::Rgb(RgbChroma::Rgb), None)
        .map_err(|e| {
            log::warn!(target: "heic_decode", "decode_failed; path={}; error={}", path, e);
        })
        .ok()?;

    let planes = decoded.planes();
    let plane = planes.interleaved.as_ref().map_or_else(
        || {
            log::warn!(target: "heic_decode", "no_interleaved_plane; path={}", path);
            None
        },
        Some,
    )?;

    let stride = plane.stride;
    let data = &plane.data;

    let img_buf: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(width, height, |x, y| {
        let offset = y as usize * stride + x as usize * 3;
        if offset + 2 < data.len() {
            Rgb([data[offset], data[offset + 1], data[offset + 2]])
        } else {
            Rgb([0, 0, 0])
        }
    });

    let img = DynamicImage::ImageRgb8(img_buf);

    let resized = if width > max_size || height > max_size {
        img.resize(max_size, max_size, FilterType::Triangle)
    } else {
        img
    };

    let (out_w, out_h) = (resized.width(), resized.height());

    log::info!(
        target: "heic_decode",
        "heic_decoded; path={}; raw_size={}x{}; output_size={}x{}",
        path, width, height, out_w, out_h
    );

    Some((resized, out_w, out_h))
}

/// Generate a persistent JPEG preview for a HEIC/HEIF/AVIF file.
///
/// Decodes the source file, resizes it, and saves as JPEG to the preview path.
pub fn generate_persistent_preview(
    source_path: &str,
    preview_path: &str,
    max_size: u32,
    quality: u8,
) -> Result<(), String> {
    let (img, _w, _h) = decode_heic_to_image(source_path, max_size)
        .ok_or_else(|| format!("Failed to decode HEIC/AVIF: {}", source_path))?;

    if let Some(parent) = std::path::Path::new(preview_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preview directory: {}", e))?;
    }

    let mut jpeg_data = Vec::new();
    use image::codecs::jpeg::JpegEncoder;
    {
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_data, quality);
        img.write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode JPEG preview: {}", e))?;
    }

    std::fs::write(preview_path, &jpeg_data)
        .map_err(|e| format!("Failed to write preview file: {}", e))?;

    log::info!(
        target: "heic_decode",
        "persistent_preview_generated; source={}; preview={}; bytes={}",
        source_path, preview_path, jpeg_data.len()
    );

    Ok(())
}
