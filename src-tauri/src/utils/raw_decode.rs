//! RAW file decode utility
//!
//! Decodes RAW camera files (CR2, NEF, ARW, DNG, etc.) using rawloader
//! and converts sensor data to displayable RGB images.

use image::{imageops::FilterType, DynamicImage, ImageBuffer, Rgb};

/// Decode a RAW file and produce a resized thumbnail image.
///
/// Uses rawloader to decode sensor data, applies basic demosaicing
/// and white balance, then resizes to fit within max_size.
///
/// # Arguments
/// * `path` - Path to the RAW file
/// * `max_size` - Maximum dimension (width or height) for the output
///
/// # Returns
/// * `Some((image, width, height))` if decoding succeeds
/// * `None` if decoding fails
pub fn decode_raw_to_thumbnail(path: &str, max_size: u32) -> Option<(DynamicImage, u32, u32)> {
    let raw_image = rawloader::decode_file(path).ok()?;

    let width = raw_image.width;
    let height = raw_image.height;

    if width == 0 || height == 0 {
        log::warn!(target: "raw_decode", "invalid_dimensions; path={}; width={}; height={}", path, width, height);
        return None;
    }

    // Get white balance coefficients
    let wb = &raw_image.wb_coeffs;
    let wb_r = if wb[0].is_finite() && wb[0] > 0.0 {
        wb[0]
    } else {
        1.0
    };
    let wb_g = if wb[1].is_finite() && wb[1] > 0.0 {
        wb[1]
    } else {
        1.0
    };
    let wb_b = if wb[2].is_finite() && wb[2] > 0.0 {
        wb[2]
    } else {
        1.0
    };

    // Normalize WB so green = 1.0
    let wb_min = wb_r.min(wb_g).min(wb_b);
    let wb_r = wb_r / wb_min;
    let wb_g = wb_g / wb_min;
    let wb_b = wb_b / wb_min;

    // Extract raw pixel data
    let data = match raw_image.data {
        rawloader::RawImageData::Integer(ref data) => {
            data.iter().map(|&v| v as f32).collect::<Vec<f32>>()
        }
        rawloader::RawImageData::Float(ref data) => data.clone(),
    };

    // Simple bilinear demosaicing for Bayer pattern
    let cpp = raw_image.cpp; // components per pixel

    let rgb_image = if cpp >= 3 {
        // Already has 3+ components per pixel (some formats store as RGB)
        demosaic_multi_component(&data, width, height, cpp, wb_r, wb_g, wb_b, &raw_image)
    } else {
        // Single component (Bayer pattern) - need demosaicing
        demosaic_bayer(&data, width, height, wb_r, wb_g, wb_b, &raw_image)
    };

    let rgb_image = rgb_image?;
    let img = DynamicImage::ImageRgb8(rgb_image);

    // Resize to max_size
    let (w, h) = (img.width(), img.height());
    let resized = if w > max_size || h > max_size {
        img.resize(max_size, max_size, FilterType::Triangle)
    } else {
        img
    };

    let (out_w, out_h) = (resized.width(), resized.height());

    log::info!(
        target: "raw_decode",
        "raw_decoded; path={}; raw_size={}x{}; output_size={}x{}",
        path, width, height, out_w, out_h
    );

    Some((resized, out_w, out_h))
}

/// Decode a RAW file with memory limit check.
///
/// Estimates memory usage from file size and skips decode if it would exceed the limit.
pub fn decode_raw_to_thumbnail_with_limit(
    path: &str,
    max_size: u32,
    memory_limit_mb: u32,
) -> Option<(DynamicImage, u32, u32)> {
    // Estimate memory: RAW files expand ~4x for processing
    if let Ok(metadata) = std::fs::metadata(path) {
        let file_size_mb = metadata.len() / (1024 * 1024);
        let estimated_mb = file_size_mb * 4;
        if estimated_mb > memory_limit_mb as u64 {
            log::warn!(
                target: "raw_decode",
                "memory_limit_exceeded; path={}; file_size_mb={}; estimated_mb={}; limit_mb={}",
                path, file_size_mb, estimated_mb, memory_limit_mb
            );
            return None;
        }
    }

    decode_raw_to_thumbnail(path, max_size)
}

/// Demosaic multi-component data (3+ channels already available)
#[allow(clippy::too_many_arguments)]
fn demosaic_multi_component(
    data: &[f32],
    width: usize,
    height: usize,
    cpp: usize,
    wb_r: f32,
    wb_g: f32,
    wb_b: f32,
    raw: &rawloader::RawImage,
) -> Option<ImageBuffer<Rgb<u8>, Vec<u8>>> {
    let black = raw.blacklevels[0] as f32;
    let white = raw.whitelevels[0] as f32;
    let range = (white - black).max(1.0);

    let mut img_buf = ImageBuffer::new(width as u32, height as u32);

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * cpp;
            if idx + 2 >= data.len() {
                continue;
            }

            let r = ((data[idx] - black) / range * wb_r).clamp(0.0, 1.0);
            let g = ((data[idx + 1] - black) / range * wb_g).clamp(0.0, 1.0);
            let b = ((data[idx + 2] - black) / range * wb_b).clamp(0.0, 1.0);

            // Apply sRGB gamma
            let r = gamma_srgb(r);
            let g = gamma_srgb(g);
            let b = gamma_srgb(b);

            img_buf.put_pixel(
                x as u32,
                y as u32,
                Rgb([(r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8]),
            );
        }
    }

    Some(img_buf)
}

/// Simple bilinear demosaicing for Bayer CFA pattern
fn demosaic_bayer(
    data: &[f32],
    width: usize,
    height: usize,
    wb_r: f32,
    wb_g: f32,
    wb_b: f32,
    raw: &rawloader::RawImage,
) -> Option<ImageBuffer<Rgb<u8>, Vec<u8>>> {
    if data.len() < width * height {
        log::warn!(target: "raw_decode", "insufficient_data; expected={}; got={}", width * height, data.len());
        return None;
    }

    let black = raw.blacklevels[0] as f32;
    let white = raw.whitelevels[0] as f32;
    let range = (white - black).max(1.0);

    // Determine CFA pattern
    let cfa = &raw.cfa;

    let mut img_buf = ImageBuffer::new(width as u32, height as u32);

    // Simple nearest-neighbor demosaicing (fast, good enough for thumbnails)
    for y in 1..height.saturating_sub(1) {
        for x in 1..width.saturating_sub(1) {
            let (r, g, b) = demosaic_pixel(data, x, y, width, cfa, black, range);

            // Apply white balance
            let r = (r * wb_r).clamp(0.0, 1.0);
            let g = (g * wb_g).clamp(0.0, 1.0);
            let b = (b * wb_b).clamp(0.0, 1.0);

            // Apply sRGB gamma
            let r = gamma_srgb(r);
            let g = gamma_srgb(g);
            let b = gamma_srgb(b);

            img_buf.put_pixel(
                x as u32,
                y as u32,
                Rgb([(r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8]),
            );
        }
    }

    Some(img_buf)
}

/// Demosaic a single pixel using bilinear interpolation
fn demosaic_pixel(
    data: &[f32],
    x: usize,
    y: usize,
    width: usize,
    cfa: &rawloader::CFA,
    black: f32,
    range: f32,
) -> (f32, f32, f32) {
    let color = cfa.color_at(y, x);

    let val =
        |px: usize, py: usize| -> f32 { ((data[py * width + px] - black) / range).clamp(0.0, 1.0) };

    match color {
        // Red pixel
        0 => {
            let r = val(x, y);
            let g = (val(x - 1, y) + val(x + 1, y) + val(x, y - 1) + val(x, y + 1)) / 4.0;
            let b = (val(x - 1, y - 1) + val(x + 1, y - 1) + val(x - 1, y + 1) + val(x + 1, y + 1))
                / 4.0;
            (r, g, b)
        }
        // Green pixel (on red row or blue row)
        1 => {
            let g = val(x, y);
            // Determine if on red row or blue row by checking neighbors
            let left_color = cfa.color_at(y, x.saturating_sub(1));
            if left_color == 0 {
                // Green on red row
                let r = (val(x - 1, y) + val(x + 1, y)) / 2.0;
                let b = (val(x, y - 1) + val(x, y + 1)) / 2.0;
                (r, g, b)
            } else {
                // Green on blue row
                let b = (val(x - 1, y) + val(x + 1, y)) / 2.0;
                let r = (val(x, y - 1) + val(x, y + 1)) / 2.0;
                (r, g, b)
            }
        }
        // Blue pixel
        2 => {
            let b = val(x, y);
            let g = (val(x - 1, y) + val(x + 1, y) + val(x, y - 1) + val(x, y + 1)) / 4.0;
            let r = (val(x - 1, y - 1) + val(x + 1, y - 1) + val(x - 1, y + 1) + val(x + 1, y + 1))
                / 4.0;
            (r, g, b)
        }
        // Fallback (shouldn't happen with standard Bayer patterns)
        _ => {
            let v = val(x, y);
            (v, v, v)
        }
    }
}

/// Generate a persistent JPEG preview for a RAW file.
///
/// Decodes the source file, resizes it, and saves as JPEG to the preview path.
pub fn generate_persistent_preview(
    source_path: &str,
    preview_path: &str,
    max_size: u32,
    quality: u8,
) -> Result<(), String> {
    let (img, _w, _h) = decode_raw_to_thumbnail(source_path, max_size)
        .ok_or_else(|| format!("Failed to decode RAW: {}", source_path))?;

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
        target: "raw_decode",
        "persistent_preview_generated; source={}; preview={}; bytes={}",
        source_path,
        preview_path,
        jpeg_data.len()
    );

    Ok(())
}

/// Apply sRGB gamma correction
fn gamma_srgb(linear: f32) -> f32 {
    if linear <= 0.0031308 {
        linear * 12.92
    } else {
        1.055 * linear.powf(1.0 / 2.4) - 0.055
    }
}
