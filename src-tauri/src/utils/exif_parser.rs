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
    // Videos have no JPEG/TIFF EXIF, and rexif::parse_file would read the
    // entire file into memory looking for one - which hangs the app on
    // multi-GB video files. ffprobe reads only the container headers.
    if raw_file::is_video_file(path) {
        return Ok(ExifParseResult {
            entries: video_entries(path),
        });
    }

    // For RAW files, go directly to kexif (rexif doesn't support TIFF-based RAW)
    if raw_file::is_raw_file(path) {
        return parse_with_kexif(path);
    }

    // For HEIC/AVIF files, extract EXIF via libheif then parse with kexif
    if raw_file::is_heic_or_avif(path) {
        return parse_heic_exif(path);
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

/// The EXIF-equivalent fields a video container carries.
///
/// Returns an empty list when ffprobe is missing or fails, which leaves
/// `ExifData::new` on its file-creation-time fallback - the behaviour videos
/// had before this path existed.
fn video_entries(path: &str) -> Vec<ExifEntry> {
    match crate::utils::video_probe::probe_video(path) {
        Ok(probe) => entries_from_probe(&probe),
        Err(e) => {
            log::warn!(target: "exif_parser", "video_probe_failed; path={}; error={}", path, e);
            Vec::new()
        }
    }
}

/// Maps a probe onto EXIF tags.
///
/// Split from [`video_entries`] so the mapping is testable without ffprobe.
fn entries_from_probe(probe: &crate::utils::video_probe::VideoProbe) -> Vec<ExifEntry> {
    let mut entries = Vec::new();

    let entry = |tag: ExifTagKind, value: String| ExifEntry {
        tag,
        value: value.clone(),
        value_readable: value,
        ext_data: Vec::new(),
    };

    // The tag is UTC; the library dates photos in local time.
    let recorded = probe
        .creation_time
        .as_deref()
        .and_then(local_datetime_from_utc);
    if let Some(recorded) = recorded {
        // Both fields, because the photo list sorts by
        // COALESCE(exif_date_time_original, exif_date_time, photo_date) and
        // only writing one of them would leave the other NULL in the DB.
        entries.push(entry(ExifTagKind::DateTime, recorded.clone()));
        entries.push(entry(ExifTagKind::DateTimeOriginal, recorded));
    }

    // An action camera writes its model name into the container's `encoder`
    // tag; there is no separate make/model box in MP4.
    if let Some(encoder) = probe.encoder.as_deref() {
        if !encoder.trim().is_empty() {
            entries.push(entry(ExifTagKind::Model, encoder.trim().to_string()));
        }
    }

    entries
}

/// Turns a container `creation_time` tag into the local `YYYY-MM-DD HH:MM:SS`
/// form the rest of the app dates photos with.
///
/// Returns `None` for anything that is not RFC 3339 - ffprobe passes the tag
/// through verbatim, so a container written by something other than a camera
/// can carry any string at all.
fn local_datetime_from_utc(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw.trim())
        .ok()
        .map(|parsed| {
            parsed
                .with_timezone(&chrono::Local)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        })
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

/// Parse EXIF from HEIC/HEIF/AVIF files using libheif-rs to extract EXIF bytes,
/// then parse with kamadak-exif.
fn parse_heic_exif(path: &str) -> Result<ExifParseResult, String> {
    use libheif_rs::{HeifContext, ItemId};

    let ctx = HeifContext::read_from_file(path)
        .map_err(|e| format!("Failed to read HEIC/AVIF file: {}", e))?;

    let handle = ctx
        .primary_image_handle()
        .map_err(|e| format!("Failed to get primary image handle: {}", e))?;

    // Get EXIF metadata block IDs (v1.1 API: mutable buffer + byte string filter)
    let mut meta_ids: Vec<ItemId> = vec![0; 1];
    let count = handle.metadata_block_ids(&mut meta_ids, b"Exif");
    if count == 0 {
        return Err("No EXIF metadata found in HEIC/AVIF file".to_string());
    }

    let exif_bytes = handle
        .metadata(meta_ids[0])
        .map_err(|e| format!("Failed to read EXIF metadata: {}", e))?;

    // HEIC EXIF data may have a 4-byte offset prefix before the TIFF header
    // Skip it if present (check for "Exif\0\0" or TIFF magic bytes)
    let tiff_start = if exif_bytes.len() > 4 {
        // Look for TIFF magic bytes (II or MM)
        if exif_bytes[0] == b'I' && exif_bytes[1] == b'I'
            || exif_bytes[0] == b'M' && exif_bytes[1] == b'M'
        {
            0
        } else {
            // Skip 4-byte offset prefix commonly found in HEIC EXIF data
            4
        }
    } else {
        0
    };

    let tiff_data = &exif_bytes[tiff_start..];

    // Parse EXIF using kamadak-exif from raw bytes
    let exif_reader = kexif::Reader::new();
    let exif = exif_reader
        .read_raw(tiff_data.to_vec())
        .map_err(|e| format!("Failed to parse HEIC EXIF data: {}", e))?;

    let mut entries = Vec::new();

    for field in exif.fields() {
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
        return Err("No EXIF entries found in HEIC/AVIF file".to_string());
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::video_probe::VideoProbe;

    #[test]
    fn test_parse_exif_skips_video_without_reading_file() {
        // A non-existent video path must still return Ok(empty) because parse_exif
        // short-circuits video files before opening/reading them. This is what keeps
        // multi-GB videos from hanging EXIF extraction.
        let result = parse_exif("/nonexistent/path/DJI_0001.mp4");
        assert!(result.is_ok());
        assert!(result.unwrap().entries.is_empty());
    }

    fn probe(creation_time: Option<&str>, encoder: Option<&str>) -> VideoProbe {
        VideoProbe {
            width: 1920,
            height: 1080,
            fps: 29.97,
            has_audio: true,
            duration_sec: 11.968,
            creation_time: creation_time.map(str::to_string),
            video_codec: Some("hevc".to_string()),
            encoder: encoder.map(str::to_string),
        }
    }

    fn value_of(entries: &[ExifEntry], tag: ExifTagKind) -> Option<String> {
        entries
            .iter()
            .find(|e| e.tag == tag)
            .map(|e| e.value_readable.clone())
    }

    /// The local time a UTC timestamp lands on depends on the machine's zone,
    /// so the tests assert against the same conversion rather than a literal.
    fn expected_local(utc: &str) -> String {
        chrono::DateTime::parse_from_rfc3339(utc)
            .expect("rfc 3339")
            .with_timezone(&chrono::Local)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
    }

    #[test]
    fn a_camera_clip_yields_both_date_fields_and_the_model() {
        let entries = entries_from_probe(&probe(
            Some("2026-06-29T04:30:05.000000Z"),
            Some("DJI OsmoAction6"),
        ));

        let want = expected_local("2026-06-29T04:30:05Z");
        assert_eq!(
            value_of(&entries, ExifTagKind::DateTime).as_ref(),
            Some(&want)
        );
        // DateTimeOriginal matters as much as DateTime: the photo list sorts by
        // COALESCE(exif_date_time_original, exif_date_time, photo_date), so
        // leaving it NULL would keep the list order wrong.
        assert_eq!(
            value_of(&entries, ExifTagKind::DateTimeOriginal).as_ref(),
            Some(&want)
        );
        assert_eq!(
            value_of(&entries, ExifTagKind::Model).as_deref(),
            Some("DJI OsmoAction6")
        );
    }

    #[test]
    fn converts_utc_to_local_across_a_date_boundary() {
        // 20:00 UTC is the next day in JST. Formatting the UTC value verbatim
        // would file the clip under the wrong date.
        let entries = entries_from_probe(&probe(Some("2026-06-29T20:00:00.000000Z"), None));
        assert_eq!(
            value_of(&entries, ExifTagKind::DateTime),
            Some(expected_local("2026-06-29T20:00:00Z"))
        );
    }

    #[test]
    fn omits_the_date_when_the_container_has_no_usable_creation_time() {
        // No entry means ExifData::new falls back to the file creation time,
        // which is the behaviour videos had before ffprobe was wired in.
        for raw in [None, Some("not a date"), Some("2026-06-29 13:30:05")] {
            let entries = entries_from_probe(&probe(raw, Some("DJI OsmoAction6")));
            assert_eq!(
                value_of(&entries, ExifTagKind::DateTime),
                None,
                "raw={:?}",
                raw
            );
            assert_eq!(
                value_of(&entries, ExifTagKind::DateTimeOriginal),
                None,
                "raw={:?}",
                raw
            );
            // The model is independent of the timestamp and still comes through.
            assert_eq!(
                value_of(&entries, ExifTagKind::Model).as_deref(),
                Some("DJI OsmoAction6")
            );
        }
    }

    #[test]
    fn omits_the_model_when_the_container_has_no_encoder_tag() {
        let entries = entries_from_probe(&probe(Some("2026-06-29T04:30:05Z"), None));
        assert_eq!(value_of(&entries, ExifTagKind::Model), None);
    }

    #[test]
    fn a_container_with_nothing_useful_yields_nothing() {
        assert!(entries_from_probe(&probe(None, None)).is_empty());
    }
}
