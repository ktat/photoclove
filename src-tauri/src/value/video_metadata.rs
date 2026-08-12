//! Metadata extracted from a video file via `ffprobe`, for the fields the
//! rest of the app cares about (recording date, camera model, resolution,
//! duration, codec, GPS). Mirrors `value::exif::ExifData`'s role for photos.

use crate::value::exif;
use crate::value::file;

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize)]
pub struct VideoMetadata {
    /// "YYYY-MM-DD HH:MM:SS" in local time, converted from ffprobe's UTC
    /// `creation_time` tag. Empty if the tag is absent or unparseable.
    pub creation_time: String,
    pub make: String,
    pub model: String,
    /// Pixel width/height as decimal strings (matches ExifData's string typing).
    pub width: String,
    pub height: String,
    pub duration_secs: Option<f64>,
    pub codec: String,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
}

use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

static RE_ISO6709: OnceLock<Regex> = OnceLock::new();

fn iso6709_regex() -> &'static Regex {
    RE_ISO6709.get_or_init(|| Regex::new(r"^([+-]\d+\.?\d*)([+-]\d+\.?\d*)").unwrap())
}

impl VideoMetadata {
    pub fn empty() -> VideoMetadata {
        VideoMetadata::default()
    }

    /// Parse `ffprobe -print_format json -show_format -show_streams` output.
    /// Returns `None` only if `raw_json` isn't valid JSON at all; a JSON
    /// document missing every field this app cares about still yields
    /// `Some(VideoMetadata::empty())`, since ffprobe ran successfully and
    /// simply found nothing usable (different encoders expose different
    /// tag subsets).
    pub fn from_ffprobe_json(raw_json: &str) -> Option<VideoMetadata> {
        let root: Value = serde_json::from_str(raw_json).ok()?;

        let format = root.get("format");
        let tags = format.and_then(|f| f.get("tags"));

        let creation_time = tags
            .and_then(|t| t.get("creation_time"))
            .and_then(|v| v.as_str())
            .and_then(parse_utc_to_local)
            .unwrap_or_default();

        let make = tags
            .and_then(|t| t.get("make").or_else(|| t.get("com.apple.quicktime.make")))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        // `encoder` is the last resort: DJI action cameras write no make/model
        // box and put the model name there instead. It is checked last because
        // on a file some tool rewrote it holds a muxer name ("Lavf60.16.100"),
        // which a real model box should outrank.
        let model = tags
            .and_then(|t| {
                t.get("model")
                    .or_else(|| t.get("com.apple.quicktime.model"))
            })
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| {
                tags.and_then(|t| t.get("encoder"))
                    .and_then(|v| v.as_str())
                    .filter(|e| !is_muxer_signature(e))
                    .map(str::to_string)
            })
            .unwrap_or_default();

        let (gps_latitude, gps_longitude) = tags
            .and_then(|t| {
                t.get("com.apple.quicktime.location.ISO6709")
                    .or_else(|| t.get("location"))
                    .or_else(|| t.get("location-eng"))
            })
            .and_then(|v| v.as_str())
            .and_then(parse_iso6709)
            .map(|(lat, lon)| (Some(lat), Some(lon)))
            .unwrap_or((None, None));

        let video_stream = root
            .get("streams")
            .and_then(|s| s.as_array())
            .and_then(|streams| {
                streams
                    .iter()
                    .find(|s| s.get("codec_type").and_then(|c| c.as_str()) == Some("video"))
            });

        let codec = video_stream
            .and_then(|s| s.get("codec_name"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let width = video_stream
            .and_then(|s| s.get("width"))
            .and_then(|v| v.as_u64())
            .map(|w| w.to_string())
            .unwrap_or_default();

        let height = video_stream
            .and_then(|s| s.get("height"))
            .and_then(|v| v.as_u64())
            .map(|h| h.to_string())
            .unwrap_or_default();

        let duration_secs = format
            .and_then(|f| f.get("duration"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .or_else(|| {
                video_stream
                    .and_then(|s| s.get("duration"))
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok())
            });

        Some(VideoMetadata {
            creation_time,
            make,
            model,
            width,
            height,
            duration_secs,
            codec,
            gps_latitude,
            gps_longitude,
        })
    }

    /// Convert to an `ExifData` for the existing `embed_exif`/
    /// `update_exif_if_changed` pipeline. Only date/make/model/resolution
    /// are mapped (the fields bulk search/stats/burst-grouping actually
    /// read); every photo-only field stays empty, exactly like
    /// `ExifData::empty()`.
    ///
    /// `fallback_date_time` is used verbatim as `date_time` when this
    /// `VideoMetadata` has no `creation_time` (ffprobe failed, or the tag
    /// was absent) — callers pass `file.created_datetime()`, mirroring the
    /// ctime fallback `ExifData::new()` already performs for photos.
    pub fn to_exif_data(&self, fallback_date_time: &str) -> exif::ExifData {
        let mut data = exif::ExifData::empty();

        if self.creation_time.is_empty() {
            // No real capture time available: fall back to ctime, exactly
            // like ExifData::new() does today. date_time_original stays
            // empty in this case (ctime is not a real EXIF-equivalent date).
            data.date_time = fallback_date_time.to_string();
        } else {
            data.date_time = self.creation_time.clone();
            data.date_time_original = self.creation_time.clone();
        }

        if !self.make.is_empty() {
            data.make = self.make.clone();
        }
        if !self.model.is_empty() {
            data.model = self.model.clone();
        }
        if !self.width.is_empty() {
            data.xresolution = self.width.clone();
        }
        if !self.height.is_empty() {
            data.yresolution = self.height.clone();
        }

        data
    }
}

/// The exif-shaped data that is safe to write back to the database.
///
/// For a photo this is the input unchanged. For a video it drops the two date
/// fields, because a container's `creation_time` does not say which clock it
/// was read from: a Panasonic DMC-GX8 writes local time labelled UTC, while a
/// DJI Osmo Action and a Panasonic DC-G9M2 write true UTC, and no tag
/// distinguishes them. Converting is therefore a guess, and a guess must not
/// overwrite what the database already holds - opening the info tab would
/// silently move every GX8-era clip nine hours forward, onto the wrong day.
///
/// The date the probe found is still shown in the info tab; this only governs
/// what is persisted.
pub fn exif_for_db_sync(is_video: bool, data: &exif::ExifData) -> exif::ExifData {
    let mut synced = data.clone();
    if is_video {
        synced.date_time.clear();
        synced.date_time_original.clear();
    }
    synced
}

/// Muxing tools that stamp their own name into the container's `encoder` tag.
///
/// The tag is the only place a DJI-style action camera records its model, so it
/// is worth reading - but a file this app merged itself, or that any transcoder
/// touched, carries the tool's signature there instead. Showing "Lavf62.3.100"
/// as the camera model is worse than showing nothing.
fn is_muxer_signature(encoder: &str) -> bool {
    const MUXERS: &[&str] = &[
        "lavf",
        "libav",
        "handbrake",
        "gpac",
        "mp4v2",
        "x264",
        "x265",
    ];
    let lower = encoder.trim().to_lowercase();
    MUXERS.iter().any(|m| lower.starts_with(m))
}

/// Load `ExifData` for a file, using `ffprobe` for video containers (which
/// `rexif` cannot parse) or the existing EXIF parser for photos. Returns the
/// raw `VideoMetadata` too, for callers that also need duration/codec/GPS
/// (e.g. the info panel) — `None` for photos, and `None` for a video whose
/// probe failed. This is the single source of truth for the is-video branch;
/// previously it was copy-pasted at three call sites, risking drift back into
/// the ctime-fallback bug this module fixes.
pub fn load_exif_for_file(
    is_video: bool,
    file: file::File,
) -> (exif::ExifData, Option<VideoMetadata>) {
    if is_video {
        let fallback_date_time = file.created_datetime();
        // A failed probe still needs exif-shaped data, so the empty metadata
        // supplies the created-datetime fallback. It must not be handed back as
        // the video payload though: `Some(empty())` serializes to a video object
        // of blank strings and nulls, which the frontend cannot tell apart from
        // a container that genuinely carries no tags. `None` makes "we know
        // nothing about this video" explicit.
        match crate::utils::ffprobe::probe(&file.path) {
            Some(vm) => {
                let exif_data = vm.to_exif_data(&fallback_date_time);
                (exif_data, Some(vm))
            }
            None => (
                VideoMetadata::empty().to_exif_data(&fallback_date_time),
                None,
            ),
        }
    } else {
        (exif::ExifData::new(file), None)
    }
}

/// Parse an RFC3339 UTC timestamp (ffprobe's `creation_time` tag format,
/// e.g. "2026-06-29T09:48:43.000000Z") and format it in the given
/// timezone as "YYYY-MM-DD HH:MM:SS", matching `ExifData`'s date format.
/// Generic over the timezone so tests can supply a fixed offset instead of
/// depending on the test machine's local timezone.
fn parse_utc_to_tz<Tz: chrono::TimeZone>(raw: &str, tz: &Tz) -> Option<String>
where
    Tz::Offset: std::fmt::Display,
{
    chrono::DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|dt| dt.with_timezone(tz).format("%Y-%m-%d %H:%M:%S").to_string())
}

fn parse_utc_to_local(raw: &str) -> Option<String> {
    parse_utc_to_tz(raw, &chrono::Local)
}

/// Parse an ISO 6709 location string (e.g. "+35.1234-139.1234+012.345/")
/// into (latitude, longitude). Returns `None` if the string doesn't start
/// with two signed decimal numbers. The optional altitude/trailing slash
/// are ignored.
fn parse_iso6709(raw: &str) -> Option<(f64, f64)> {
    let caps = iso6709_regex().captures(raw)?;
    let lat: f64 = caps.get(1)?.as_str().parse().ok()?;
    let lon: f64 = caps.get(2)?.as_str().parse().ok()?;
    Some((lat, lon))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    const SAMPLE_JSON: &str = r#"{
        "streams": [
            {"codec_type": "audio", "codec_name": "aac"},
            {"codec_type": "video", "codec_name": "hevc", "width": 3840, "height": 2160, "duration": "12.100000"}
        ],
        "format": {
            "duration": "12.345000",
            "tags": {
                "creation_time": "2026-06-29T09:48:43.000000Z",
                "com.apple.quicktime.make": "DJI",
                "com.apple.quicktime.model": "FC7303",
                "com.apple.quicktime.location.ISO6709": "+35.1234-139.1234+012.345/"
            }
        }
    }"#;

    #[test]
    fn test_from_ffprobe_json_extracts_all_fields() {
        let vm = VideoMetadata::from_ffprobe_json(SAMPLE_JSON).unwrap();
        let expected_time = parse_utc_to_tz(
            "2026-06-29T09:48:43.000000Z",
            &FixedOffset::east_opt(0).unwrap(),
        )
        .unwrap();
        // Sanity: the raw UTC instant round-trips through UTC (offset 0)
        // unchanged, proving the timestamp itself parsed correctly.
        assert_eq!(expected_time, "2026-06-29 09:48:43");

        assert_eq!(vm.make, "DJI");
        assert_eq!(vm.model, "FC7303");
        assert_eq!(vm.codec, "hevc");
        assert_eq!(vm.width, "3840");
        assert_eq!(vm.height, "2160");
        assert_eq!(vm.duration_secs, Some(12.345));
        assert_eq!(vm.gps_latitude, Some(35.1234));
        assert_eq!(vm.gps_longitude, Some(-139.1234));
        assert!(!vm.creation_time.is_empty());
    }

    #[test]
    fn test_from_ffprobe_json_picks_video_stream_not_audio() {
        let json = r#"{
            "streams": [
                {"codec_type": "audio", "codec_name": "aac", "width": 999, "height": 999},
                {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080}
            ],
            "format": {}
        }"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.codec, "h264");
        assert_eq!(vm.width, "1920");
        assert_eq!(vm.height, "1080");
    }

    #[test]
    fn test_from_ffprobe_json_falls_back_to_stream_duration() {
        let json = r#"{
            "streams": [{"codec_type": "video", "codec_name": "h264", "duration": "5.500000"}],
            "format": {}
        }"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.duration_secs, Some(5.5));
    }

    #[test]
    fn test_from_ffprobe_json_handles_missing_creation_time() {
        let json = r#"{"streams": [], "format": {"tags": {}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.creation_time, "");
        assert_eq!(vm.duration_secs, None);
    }

    #[test]
    fn test_from_ffprobe_json_handles_missing_gps_tag() {
        let json = r#"{"streams": [], "format": {"tags": {}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.gps_latitude, None);
        assert_eq!(vm.gps_longitude, None);
    }

    #[test]
    fn test_from_ffprobe_json_handles_malformed_gps_tag() {
        let json = r#"{"streams": [], "format": {"tags": {"com.apple.quicktime.location.ISO6709": "not a location"}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.gps_latitude, None);
        assert_eq!(vm.gps_longitude, None);
    }

    #[test]
    fn test_from_ffprobe_json_falls_back_to_bare_location_tag() {
        // Non-Apple encoders (e.g. Android-recorded MP4s) expose GPS under a
        // plain "location" tag rather than the QuickTime-specific key.
        let json = r#"{"streams": [], "format": {"tags": {"location": "+35.1234-139.1234/"}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.gps_latitude, Some(35.1234));
        assert_eq!(vm.gps_longitude, Some(-139.1234));
    }

    #[test]
    fn test_from_ffprobe_json_prefers_apple_location_tag_over_bare_one() {
        let json = r#"{"streams": [], "format": {"tags": {
            "com.apple.quicktime.location.ISO6709": "+10.0000+020.0000/",
            "location": "+35.1234-139.1234/"
        }}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.gps_latitude, Some(10.0));
        assert_eq!(vm.gps_longitude, Some(20.0));
    }

    #[test]
    fn test_from_ffprobe_json_falls_back_to_bare_make_model_tags() {
        let json = r#"{"streams": [], "format": {"tags": {"make": "Canon", "model": "EOS R5"}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.make, "Canon");
        assert_eq!(vm.model, "EOS R5");
    }

    #[test]
    fn test_from_ffprobe_json_falls_back_to_encoder_tag_for_model() {
        // DJI action cameras write no make/model box at all; the model name
        // only appears in the container's `encoder` tag. Without this
        // fallback the info tab shows an empty 機種 for every DJI clip.
        let json = r#"{"streams": [], "format": {"tags": {
            "creation_time": "2026-06-29T04:30:05.000000Z",
            "encoder": "DJI OsmoAction6"
        }}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.model, "DJI OsmoAction6");
    }

    #[test]
    fn test_from_ffprobe_json_prefers_model_tag_over_encoder() {
        // `encoder` also carries muxer names ("Lavf60.16.100") on files a
        // tool rewrote, so a real model box must win when both are present.
        let json = r#"{"streams": [], "format": {"tags": {
            "model": "EOS R5",
            "encoder": "Lavf60.16.100"
        }}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.model, "EOS R5");
    }

    #[test]
    fn test_from_ffprobe_json_ignores_muxer_names_in_encoder() {
        // Files this app merged itself carry ffmpeg's muxer signature. Showing
        // "Lavf62.3.100" as the camera model is worse than showing nothing.
        for muxer in [
            "Lavf62.3.100",
            "lavf58.76.100",
            "libavformat 58.76.100",
            "HandBrake 1.7.3 2024022300",
            "GPAC/vlc 1.0.0",
            "Mp4v2 2.0.0",
        ] {
            let json = format!(
                r#"{{"streams": [], "format": {{"tags": {{"encoder": "{}"}}}}}}"#,
                muxer
            );
            let vm = VideoMetadata::from_ffprobe_json(&json).unwrap();
            assert_eq!(vm.model, "", "muxer={}", muxer);
        }
    }

    #[test]
    fn test_from_ffprobe_json_keeps_camera_names_that_are_not_muxers() {
        for camera in ["DJI OsmoAction6", "GoPro HERO12 Black", "Insta360 X4"] {
            let json = format!(
                r#"{{"streams": [], "format": {{"tags": {{"encoder": "{}"}}}}}}"#,
                camera
            );
            let vm = VideoMetadata::from_ffprobe_json(&json).unwrap();
            assert_eq!(vm.model, camera);
        }
    }

    #[test]
    fn test_exif_for_db_sync_drops_the_dates_for_a_video() {
        // ffprobe reports `creation_time` verbatim, and cameras disagree about
        // what it means: a Panasonic DMC-GX8 writes local time labelled UTC
        // while a DJI Osmo Action and a Panasonic DC-G9M2 write true UTC, with
        // no tag telling them apart. Persisting a converted guess would move a
        // 2016 GX8 clip nine hours forward - onto the wrong day - every time
        // its info tab is opened.
        let vm = VideoMetadata {
            creation_time: "2016-02-29 01:09:10".to_string(),
            model: "DJI OsmoAction6".to_string(),
            width: "1920".to_string(),
            height: "1080".to_string(),
            ..VideoMetadata::empty()
        };
        let synced = exif_for_db_sync(true, &vm.to_exif_data("2022-12-21 02:09:57"));

        assert_eq!(synced.date_time, "");
        assert_eq!(synced.date_time_original, "");
        // Everything the container states unambiguously still syncs.
        assert_eq!(synced.model, "DJI OsmoAction6");
        assert_eq!(synced.xresolution, "1920");
        assert_eq!(synced.yresolution, "1080");
    }

    #[test]
    fn test_exif_for_db_sync_leaves_a_photo_untouched() {
        let mut data = exif::ExifData::empty();
        data.date_time = "2024-05-13 05:43:43".to_string();
        data.date_time_original = "2024-05-13 05:43:43".to_string();
        data.model = "DC-G9M2".to_string();

        let synced = exif_for_db_sync(false, &data);

        assert_eq!(synced.date_time, "2024-05-13 05:43:43");
        assert_eq!(synced.date_time_original, "2024-05-13 05:43:43");
        assert_eq!(synced.model, "DC-G9M2");
    }

    #[test]
    fn test_from_ffprobe_json_returns_none_for_invalid_json() {
        assert_eq!(VideoMetadata::from_ffprobe_json("not json"), None);
    }

    #[test]
    fn test_from_ffprobe_json_returns_empty_metadata_for_empty_object() {
        let vm = VideoMetadata::from_ffprobe_json("{}").unwrap();
        assert_eq!(vm, VideoMetadata::empty());
    }

    #[test]
    fn test_parse_utc_to_tz_converts_offset() {
        let jst = FixedOffset::east_opt(9 * 3600).unwrap();
        let result = parse_utc_to_tz("2026-06-29T09:48:43.000000Z", &jst);
        assert_eq!(result, Some("2026-06-29 18:48:43".to_string()));
    }

    #[test]
    fn test_parse_utc_to_tz_rejects_invalid_input() {
        let jst = FixedOffset::east_opt(9 * 3600).unwrap();
        assert_eq!(parse_utc_to_tz("not a date", &jst), None);
    }

    #[test]
    fn test_parse_iso6709_well_formed() {
        assert_eq!(
            parse_iso6709("+35.1234-139.1234+012.345/"),
            Some((35.1234, -139.1234))
        );
    }

    #[test]
    fn test_parse_iso6709_without_altitude() {
        assert_eq!(
            parse_iso6709("+35.1234-139.1234/"),
            Some((35.1234, -139.1234))
        );
    }

    #[test]
    fn test_parse_iso6709_negative_latitude() {
        assert_eq!(
            parse_iso6709("-35.1234+139.1234/"),
            Some((-35.1234, 139.1234))
        );
    }

    #[test]
    fn test_parse_iso6709_rejects_malformed_input() {
        assert_eq!(parse_iso6709("not a location"), None);
        assert_eq!(parse_iso6709(""), None);
    }

    #[test]
    fn test_to_exif_data_with_creation_time_fills_original_too() {
        let vm = VideoMetadata {
            creation_time: "2026-06-29 18:48:43".to_string(),
            make: "DJI".to_string(),
            model: "FC7303".to_string(),
            width: "3840".to_string(),
            height: "2160".to_string(),
            ..VideoMetadata::empty()
        };
        let exif = vm.to_exif_data("2020-01-01 00:00:00");
        assert_eq!(exif.date_time, "2026-06-29 18:48:43");
        assert_eq!(exif.date_time_original, "2026-06-29 18:48:43");
        assert_eq!(exif.make, "DJI");
        assert_eq!(exif.model, "FC7303");
        assert_eq!(exif.xresolution, "3840");
        assert_eq!(exif.yresolution, "2160");
        // Every photo-only field stays empty, exactly like ExifData::empty()
        assert_eq!(exif.iso, "");
        assert_eq!(exif.fnumber, "");
        assert_eq!(exif.orientation, "");
    }

    #[test]
    fn test_to_exif_data_without_creation_time_uses_fallback_and_skips_original() {
        let vm = VideoMetadata::empty();
        let exif = vm.to_exif_data("2020-01-01 00:00:00");
        assert_eq!(exif.date_time, "2020-01-01 00:00:00");
        // date_time_original stays empty, matching today's total-failure
        // ctime fallback for photos (ExifData::new()'s Err(_) branch).
        assert_eq!(exif.date_time_original, "");
        assert_eq!(exif.make, "");
        assert_eq!(exif.model, "");
    }

    #[test]
    fn test_load_exif_for_file_reports_no_video_metadata_when_the_probe_fails() {
        // ffprobe cannot read this file, so probe() returns None whether or not
        // ffprobe is installed on the machine running the tests.
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("not-a-video.mp4");
        std::fs::write(&path, b"not a container").expect("write file");
        let f = file::File {
            path: path.display().to_string(),
            name: "not-a-video.mp4".to_string(),
            dir: dir.path().display().to_string(),
            created_at: String::new(),
            is_link: false,
        };
        let fallback_date_time = f.created_datetime();

        let (exif, vm) = load_exif_for_file(true, f);

        // No metadata at all, rather than an object of blank fields the
        // frontend cannot tell apart from a tagless container.
        assert!(vm.is_none());
        // The exif-shaped created-datetime fallback is still preserved.
        assert_eq!(exif.date_time, fallback_date_time);
        assert_eq!(exif.date_time_original, "");
    }
}
