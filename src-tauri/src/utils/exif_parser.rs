//! Unified EXIF parse backend
//!
//! Provides a backend-agnostic interface for EXIF parsing.
//! Tries rexif first (fast, JPEG-optimized), falls back to kexif (TIFF/RAW support).

use crate::utils::raw_file;

/// Unified EXIF tag kind (maps to rexif::ExifTag equivalents)
#[derive(Debug, Clone, PartialEq)]
pub enum ExifTagKind {
    FNumber,
    ISOSpeedRatings,
    DateTime,
    DateTimeOriginal,
    LensModel,
    LensMake,
    Make,
    Model,
    Orientation,
    XResolution,
    YResolution,
    ResolutionUnit,
    Copyright,
    ExposureTime,
    ShutterSpeedValue,
    FocalLength,
    FocalLengthIn35mmFilm,
    DigitalZoomRatio,
    ExposureMode,
    WhiteBalanceMode,
    MakerNote,
    Unknown(String),
}

/// A single EXIF entry with tag, value, and human-readable value
#[derive(Debug, Clone)]
pub struct ExifEntry {
    pub tag: ExifTagKind,
    pub value: String,
    pub value_readable: String,
    /// Raw ext_data for MakerNote (empty for other tags)
    pub ext_data: Vec<u8>,
}

/// Unified EXIF parse result
pub struct ExifParseResult {
    pub entries: Vec<ExifEntry>,
}

/// Parse EXIF from any supported file (JPEG, RAW, etc.)
/// Tries rexif first (fast, JPEG-optimized), falls back to kexif (TIFF/RAW support)
pub fn parse_exif(path: &str) -> Result<ExifParseResult, String> {
    // For RAW files, go directly to kexif (rexif doesn't support TIFF-based RAW)
    if raw_file::is_raw_file(path) {
        return parse_with_kexif(path);
    }

    // Try rexif first (fast path for JPEG)
    match rexif::parse_file(path) {
        Ok(exif_data) => {
            let entries = exif_data
                .entries
                .into_iter()
                .map(|e| ExifEntry {
                    tag: map_rexif_tag(&e.tag),
                    value: e.value.to_string(),
                    value_readable: e.value_more_readable.to_string(),
                    ext_data: e.ifd.ext_data,
                })
                .collect();
            Ok(ExifParseResult { entries })
        }
        Err(_) => {
            // Fallback to kexif
            parse_with_kexif(path)
        }
    }
}

/// Parse EXIF using kamadak-exif (supports TIFF-based RAW files)
fn parse_with_kexif(path: &str) -> Result<ExifParseResult, String> {
    use std::fs::File;
    use std::io::BufReader;

    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut bufreader = BufReader::new(file);

    let exif_reader = kexif::Reader::new();
    let exif = exif_reader
        .read_from_container(&mut bufreader)
        .map_err(|e| format!("Failed to read EXIF: {}", e))?;

    let mut entries = Vec::new();

    for field in exif.fields() {
        // Only process PRIMARY IFD fields (not THUMBNAIL)
        if field.ifd_num != kexif::In::PRIMARY && field.ifd_num != kexif::In(1) {
            // Also accept IFD 1 for some tags
        }

        let tag = map_kexif_tag(field.tag);
        let value = field.display_value().to_string();
        let value_readable = field.display_value().with_unit(&exif).to_string();

        entries.push(ExifEntry {
            tag,
            value,
            value_readable,
            ext_data: Vec::new(),
        });
    }

    if entries.is_empty() {
        return Err("No EXIF entries found".to_string());
    }

    Ok(ExifParseResult { entries })
}

/// Map rexif tag to our unified tag kind
fn map_rexif_tag(tag: &rexif::ExifTag) -> ExifTagKind {
    match tag {
        rexif::ExifTag::FNumber => ExifTagKind::FNumber,
        rexif::ExifTag::ISOSpeedRatings => ExifTagKind::ISOSpeedRatings,
        rexif::ExifTag::DateTime => ExifTagKind::DateTime,
        rexif::ExifTag::DateTimeOriginal => ExifTagKind::DateTimeOriginal,
        rexif::ExifTag::LensModel => ExifTagKind::LensModel,
        rexif::ExifTag::LensMake => ExifTagKind::LensMake,
        rexif::ExifTag::Make => ExifTagKind::Make,
        rexif::ExifTag::Model => ExifTagKind::Model,
        rexif::ExifTag::Orientation => ExifTagKind::Orientation,
        rexif::ExifTag::XResolution => ExifTagKind::XResolution,
        rexif::ExifTag::YResolution => ExifTagKind::YResolution,
        rexif::ExifTag::ResolutionUnit => ExifTagKind::ResolutionUnit,
        rexif::ExifTag::Copyright => ExifTagKind::Copyright,
        rexif::ExifTag::ExposureTime => ExifTagKind::ExposureTime,
        rexif::ExifTag::ShutterSpeedValue => ExifTagKind::ShutterSpeedValue,
        rexif::ExifTag::FocalLength => ExifTagKind::FocalLength,
        rexif::ExifTag::FocalLengthIn35mmFilm => ExifTagKind::FocalLengthIn35mmFilm,
        rexif::ExifTag::DigitalZoomRatio => ExifTagKind::DigitalZoomRatio,
        rexif::ExifTag::ExposureMode => ExifTagKind::ExposureMode,
        rexif::ExifTag::WhiteBalanceMode => ExifTagKind::WhiteBalanceMode,
        rexif::ExifTag::MakerNote => ExifTagKind::MakerNote,
        _ => ExifTagKind::Unknown(format!("{:?}", tag)),
    }
}

/// Map kexif tag to our unified tag kind
fn map_kexif_tag(tag: kexif::Tag) -> ExifTagKind {
    match tag {
        kexif::Tag::FNumber => ExifTagKind::FNumber,
        kexif::Tag::PhotographicSensitivity => ExifTagKind::ISOSpeedRatings,
        kexif::Tag::DateTime => ExifTagKind::DateTime,
        kexif::Tag::DateTimeOriginal => ExifTagKind::DateTimeOriginal,
        kexif::Tag::LensModel => ExifTagKind::LensModel,
        kexif::Tag::LensMake => ExifTagKind::LensMake,
        kexif::Tag::Make => ExifTagKind::Make,
        kexif::Tag::Model => ExifTagKind::Model,
        kexif::Tag::Orientation => ExifTagKind::Orientation,
        kexif::Tag::XResolution => ExifTagKind::XResolution,
        kexif::Tag::YResolution => ExifTagKind::YResolution,
        kexif::Tag::ResolutionUnit => ExifTagKind::ResolutionUnit,
        kexif::Tag::Copyright => ExifTagKind::Copyright,
        kexif::Tag::ExposureTime => ExifTagKind::ExposureTime,
        kexif::Tag::ShutterSpeedValue => ExifTagKind::ShutterSpeedValue,
        kexif::Tag::FocalLength => ExifTagKind::FocalLength,
        kexif::Tag::FocalLengthIn35mmFilm => ExifTagKind::FocalLengthIn35mmFilm,
        kexif::Tag::DigitalZoomRatio => ExifTagKind::DigitalZoomRatio,
        kexif::Tag::ExposureMode => ExifTagKind::ExposureMode,
        kexif::Tag::WhiteBalance => ExifTagKind::WhiteBalanceMode,
        _ => ExifTagKind::Unknown(format!("{:?}", tag)),
    }
}
