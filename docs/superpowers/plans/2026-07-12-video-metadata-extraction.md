# Video Metadata Extraction (ffprobe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix videos always sorting/grouping by filesystem ctime instead of
real recording time, and show duration/codec/resolution/GPS in the photo
info panel, by extracting metadata via `ffprobe` at the three sites that
currently call `ExifData::new()` unconditionally on every file (which
silently falls back to ctime for video, since `rexif` can't parse video
containers).

**Architecture:** New `value::video_metadata::VideoMetadata` (parsed from
`ffprobe`'s JSON output by a new `utils::ffprobe::probe()`) converts to a
regular `exif::ExifData` via `VideoMetadata::to_exif_data()`, filling only
`date_time`/`date_time_original`/`make`/`model`/`xresolution`/`yresolution`
— the fields bulk search/stats/burst-grouping actually read. This
`ExifData` then flows through the **existing, unmodified**
`Photo::embed_exif` / `update_exif_if_changed` machinery, so photos and
videos share one code path from that point on. Duration/codec/GPS have no
DB column (confirmed unused by any bulk feature) and are supplied live,
only in the info-panel response.

**Tech Stack:** Rust (rusqlite, chrono, regex, serde_json — all already
dependencies, no `Cargo.toml` changes), React/JSX frontend, `ffprobe`
external binary (ships with `ffmpeg`, already a documented system
prerequisite in `README.md`, already invoked directly via
`std::process::Command` for video thumbnails).

## Global Constraints

- No new Cargo or npm dependencies.
- No new database migration / columns (verified: no search/filter/stats
  feature reads resolution, duration, codec, or GPS; `exif_model`/
  `exif_make` are read by 3 existing features and must still be written).
- `ffprobe` must never run on the GTK main thread — every call site in this
  plan already executes inside a `spawn_blocking` context or a background
  job thread; do not add a new synchronous Tauri command.
- Match existing code style: fully-qualified `crate::...` paths in
  `repository/meta_db/sqlite/photo_metadata.rs` (it doesn't `use` its
  `value`/`utils` types), proper `use` imports in `commands/photo_commands.rs`
  (it already imports `crate::value::exif` etc. directly).
- All new Rust code goes through `cargo fmt` and must pass `cargo clippy`
  with zero warnings before each commit (matches this session's established
  practice).

---

### Task 1: `VideoMetadata` value object — ffprobe JSON parsing (pure, unit-tested)

**Files:**
- Create: `src-tauri/src/value/video_metadata.rs`
- Modify: `src-tauri/src/value.rs:6-10` (add `pub mod video_metadata;`)

**Interfaces:**
- Produces:
  - `pub struct VideoMetadata { pub creation_time: String, pub make: String, pub model: String, pub width: String, pub height: String, pub duration_secs: Option<f64>, pub codec: String, pub gps_latitude: Option<f64>, pub gps_longitude: Option<f64> }`
    (derives `Debug, Clone, PartialEq, Default, serde::Serialize`)
  - `VideoMetadata::empty() -> VideoMetadata`
  - `VideoMetadata::from_ffprobe_json(raw_json: &str) -> Option<VideoMetadata>`
  - `VideoMetadata::to_exif_data(&self, fallback_date_time: &str) -> crate::value::exif::ExifData`

This is the only task with no dependency on the other tasks; everything
else calls into it.

- [ ] **Step 1: Write the failing tests**

Create `src-tauri/src/value/video_metadata.rs` with the test module only
(no implementation yet), so `cargo test` fails to compile against a
not-yet-existing `VideoMetadata`:

```rust
//! Metadata extracted from a video file via `ffprobe`, for the fields the
//! rest of the app cares about (recording date, camera model, resolution,
//! duration, codec, GPS). Mirrors `value::exif::ExifData`'s role for photos.

use crate::value::exif;

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
    fn test_from_ffprobe_json_falls_back_to_bare_make_model_tags() {
        let json = r#"{"streams": [], "format": {"tags": {"make": "Canon", "model": "EOS R5"}}}"#;
        let vm = VideoMetadata::from_ffprobe_json(json).unwrap();
        assert_eq!(vm.make, "Canon");
        assert_eq!(vm.model, "EOS R5");
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
}
```

- [ ] **Step 2: Run the tests to verify they fail to compile**

Run: `cd src-tauri && cargo test --lib video_metadata 2>&1 | head -30`
Expected: compile errors — `VideoMetadata::empty`, `from_ffprobe_json`,
`to_exif_data`, `parse_utc_to_tz`, and `parse_iso6709` are all undefined.

- [ ] **Step 3: Implement `VideoMetadata`**

Append to `src-tauri/src/value/video_metadata.rs` (before the `#[cfg(test)]`
module, i.e. insert this block right after the struct definition written in
Step 1):

```rust
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

        let model = tags
            .and_then(|t| t.get("model").or_else(|| t.get("com.apple.quicktime.model")))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let (gps_latitude, gps_longitude) = tags
            .and_then(|t| t.get("com.apple.quicktime.location.ISO6709"))
            .and_then(|v| v.as_str())
            .and_then(parse_iso6709)
            .map(|(lat, lon)| (Some(lat), Some(lon)))
            .unwrap_or((None, None));

        let video_stream = root.get("streams").and_then(|s| s.as_array()).and_then(|streams| {
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
```

- [ ] **Step 4: Register the module**

Edit `src-tauri/src/value.rs`:

```rust
//! Value object module aggregator.
//!
//! This module serves as a routing layer that re-exports all value object submodules.
//! Actual implementations are in the respective submodules.

pub mod comment;
pub mod date;
pub mod exif;
pub mod file;
pub mod star;
pub mod video_metadata;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test --lib video_metadata 2>&1 | tail -30`
Expected: all 17 tests in `value::video_metadata::tests` pass, e.g.
`test result: ok. 17 passed; 0 failed; ...` (filtered count — the full
suite has more tests total).

- [ ] **Step 6: Format, lint, commit**

Run:
```bash
cd src-tauri && cargo fmt && cargo clippy --bin photoclove 2>&1 | tail -20
```
Expected: zero warnings.

```bash
cd /home/ktat/git/github/photoclove
git add src-tauri/src/value/video_metadata.rs src-tauri/src/value.rs
git commit -m "feat(video): add VideoMetadata value object (ffprobe JSON -> ExifData)

Pure, unit-tested parser for ffprobe's -show_format -show_streams JSON
output, plus to_exif_data() which maps creation_time/make/model/
width/height into ExifData's date_time/date_time_original/make/model/
xresolution/yresolution fields — the ones bulk search/stats/burst-
grouping actually read (verified by grep; resolution/duration/GPS have
no consumer, so they aren't persisted to the DB and stay on
VideoMetadata for live display only).

No wiring yet: nothing calls this outside its own tests."
```

---

### Task 2: `ffprobe` process wrapper

**Files:**
- Create: `src-tauri/src/utils/ffprobe.rs`
- Modify: `src-tauri/src/utils/mod.rs:1-8` (add `pub mod ffprobe;`)

**Interfaces:**
- Consumes: `value::video_metadata::VideoMetadata::from_ffprobe_json` (Task 1)
- Produces: `pub fn probe(path: &str) -> Option<VideoMetadata>`

This task has no automated test for `probe()` itself (spawning a real
`ffprobe` binary — CI has neither `ffmpeg` nor `ffprobe` installed, and no
existing test in this codebase depends on the real `ffmpeg` binary either).
It's verified manually in Task 3's manual-verification step. The step
sequence below is "write, verify compiles, commit" rather than TDD, since
there is no failing-test step possible without a real binary.

- [ ] **Step 1: Implement the wrapper**

Create `src-tauri/src/utils/ffprobe.rs`:

```rust
//! Wrapper for extracting video metadata via the `ffprobe` binary — part of
//! the same ffmpeg suite already used for video thumbnail generation in
//! `domain_service/photo_service.rs` (`README.md` documents `ffmpeg` as a
//! required system package; this adds no new runtime dependency).

use crate::value::video_metadata::VideoMetadata;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Wall-clock limit for a single `ffprobe` call. `ffprobe` only reads
/// container headers (no frame decode), so this is far shorter than the
/// `ffmpeg` thumbnail-extraction timeout
/// (`photo_service::VIDEO_THUMBNAIL_TIMEOUT`, 120s) — a stuck/corrupt file
/// should fail fast here.
const FFPROBE_TIMEOUT: Duration = Duration::from_secs(10);

/// Run `ffprobe` on `path` and parse its metadata. Returns `None` if the
/// binary is missing, the process times out or exits non-zero, or the
/// output isn't parseable JSON — callers treat this exactly like a failed
/// EXIF read (fall back to file ctime for the date).
pub fn probe(path: &str) -> Option<VideoMetadata> {
    let mut child = match Command::new("ffprobe")
        .arg("-v")
        .arg("quiet")
        .arg("-print_format")
        .arg("json")
        .arg("-show_format")
        .arg("-show_streams")
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            log::warn!(target: "ffprobe", "spawn_failed; path={}; error={:?}", path, e);
            return None;
        }
    };

    // Drain stdout on a background thread while polling try_wait() below, so
    // a large JSON payload can't fill the OS pipe buffer and deadlock the
    // wait loop (the ffmpeg poll loop in photo_service.rs doesn't need this
    // since it writes its output to a file, not stdout).
    let mut stdout = match child.stdout.take() {
        Some(s) => s,
        None => return None,
    };
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buf = String::new();
        let _ = stdout.read_to_string(&mut buf);
        let _ = tx.send(buf);
    });

    let deadline = Instant::now() + FFPROBE_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    log::warn!(target: "ffprobe", "exit_failed; path={}; exit={:?}", path, status.code());
                    return None;
                }
                let json = rx.recv_timeout(Duration::from_secs(2)).ok()?;
                return VideoMetadata::from_ffprobe_json(&json);
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    log::warn!(target: "ffprobe", "timeout; path={}; timeout_secs={}", path, FFPROBE_TIMEOUT.as_secs());
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                log::warn!(target: "ffprobe", "wait_failed; path={}; error={:?}", path, e);
                return None;
            }
        }
    }
}
```

- [ ] **Step 2: Register the module**

Edit `src-tauri/src/utils/mod.rs`, changing:

```rust
pub mod cache;
pub mod exif_parser;
pub mod exif_thumbnail;
pub mod heic_decode;
pub mod orientation;
pub mod raw_decode;
pub mod raw_file;
```

to:

```rust
pub mod cache;
pub mod exif_parser;
pub mod exif_thumbnail;
pub mod ffprobe;
pub mod heic_decode;
pub mod orientation;
pub mod raw_decode;
pub mod raw_file;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo build --bin photoclove 2>&1 | tail -20`
Expected: builds successfully (this module isn't called from anywhere yet,
so `cargo clippy` may warn `never used` on `probe` — that's expected and
will resolve once Task 3 wires it in; do not add `#[allow(dead_code)]`,
just proceed to Task 3 immediately after this).

- [ ] **Step 4: Format, commit**

```bash
cd src-tauri && cargo fmt
cd /home/ktat/git/github/photoclove
git add src-tauri/src/utils/ffprobe.rs src-tauri/src/utils/mod.rs
git commit -m "feat(video): add ffprobe process wrapper

Spawns ffprobe with a 10s wall-clock timeout (headers-only read, far
shorter than the 120s ffmpeg thumbnail-extraction budget), draining
stdout on a background thread to avoid pipe deadlock. Mirrors the
poll-loop pattern already used for ffmpeg thumbnail generation in
photo_service.rs. Not wired into any call site yet."
```

---

### Task 3: Wire into import (`record_photos_meta_data`) — the actual bug fix

**Files:**
- Modify: `src-tauri/src/repository/meta_db/sqlite/photo_metadata.rs:146-151`
- Test: same file, new `#[cfg(test)]` additions

**Interfaces:**
- Consumes: `crate::utils::ffprobe::probe` (Task 2),
  `crate::value::video_metadata::VideoMetadata::empty`/`to_exif_data` (Task 1),
  `crate::entity::photo::Photo::is_video` (existing),
  `crate::entity::photo::Photo::embed_exif` (existing, unchanged)

This is the fix for the actual reported bug: without it, imported videos
still get `exif_date_time_original` derived from ctime.

- [ ] **Step 1: Write the failing test**

`src-tauri/src/repository/meta_db/sqlite/photo_metadata.rs` already ends
with a `#[cfg(test)] mod tests { use super::*; ... }` block (from earlier
work, containing `fn setup_db(name: &str) -> SQLite` and
`test_get_photo_meta_data_in_date_filters_by_date_and_hydrates_tags`).
**Add the function below inside that existing module**, immediately before
its closing `}` — do not redeclare `setup_db`, reuse the one already there
(same `fn setup_db(name: &str) -> SQLite` signature):

```rust
    #[test]
    fn test_record_photos_meta_data_video_without_ffprobe_falls_back_to_ctime() {
        // No real video file on disk (ffprobe will fail to find it, or
        // isn't installed in this test environment either way) — this test
        // only asserts the row gets written at all with a non-empty date,
        // covering the fallback path without depending on ffprobe being
        // installed.
        let db = setup_db("video_no_ffprobe");
        let dir = std::env::temp_dir()
            .join("photoclove_photo_metadata_video_tests")
            .join("video_no_ffprobe_files")
            .join("2024-05-13");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("clip.mp4"), b"not a real video").unwrap();

        let f = file::File::from_relative("2024-05-13/clip.mp4".to_string());
        let photo = photo::Photo::new(f, None);

        let inserted = record_photos_meta_data(&db, vec![photo]).unwrap();
        assert_eq!(inserted, 1);

        let conn = db.get_connection().unwrap();
        let date: String = conn
            .query_row(
                "SELECT photo_date FROM photo_metadata WHERE path = ?1",
                params!["2024-05-13/clip.mp4"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(date, "2024-05-13 00:00:00");
    }
```

(Note: no closing `}` in the snippet above — it's inserted before the
existing module's own closing brace, not as a standalone module.)

- [ ] **Step 2: Run the test to verify it currently passes (baseline)**

Run:
```bash
cd src-tauri && cargo test --bin photoclove test_record_photos_meta_data_video_without_ffprobe 2>&1 | tail -15
```
Expected: PASS — this test doesn't yet exercise the `is_video()` branch
(it doesn't exist), so it's really testing that the existing insert path
still works with a `.mp4` path. This confirms the test harness/fixture is
correct before Step 3 changes behavior. (There is no meaningful "RED" state
to observe here since the change is an internal code-path swap, not new
externally-observable behavior for this particular assertion — the video
JSON-parsing behavior was already fully tested in Task 1's RED/GREEN
cycle.)

- [ ] **Step 3: Wire the `is_video()` branch**

In `src-tauri/src/repository/meta_db/sqlite/photo_metadata.rs`, change:

```rust
        // Load EXIF from absolute path on disk
        let abs_path = file::to_absolute_path(&photo.file.path, &import_to);
        if let Some(abs_file) = file::File::new_if_exists(abs_path) {
            let meta = crate::value::exif::ExifData::new(abs_file);
            photo.embed_exif(meta);
        }
```

to:

```rust
        // Load EXIF (photos) or probe metadata (videos) from absolute path on disk
        let abs_path = file::to_absolute_path(&photo.file.path, &import_to);
        if let Some(abs_file) = file::File::new_if_exists(abs_path) {
            let meta = if photo.is_video() {
                crate::utils::ffprobe::probe(&abs_file.path)
                    .unwrap_or_else(crate::value::video_metadata::VideoMetadata::empty)
                    .to_exif_data(&abs_file.created_datetime())
            } else {
                crate::value::exif::ExifData::new(abs_file)
            };
            photo.embed_exif(meta);
        }
```

- [ ] **Step 4: Run the test to verify it still passes**

Run:
```bash
cd src-tauri && cargo test --bin photoclove test_record_photos_meta_data_video_without_ffprobe 2>&1 | tail -15
```
Expected: PASS. `clip.mp4` contains garbage bytes, so `ffprobe` (if
installed) exits non-zero or times out reading it — `probe()` returns
`None`, `unwrap_or_else` gives `VideoMetadata::empty()`, and
`to_exif_data(&abs_file.created_datetime())` falls back to ctime, so
`photo_date` is still written as `"2024-05-13 00:00:00"` (from the
directory-name date-extraction logic later in the function, independent of
EXIF/video metadata).

- [ ] **Step 5: Run the full backend test suite**

Run: `cd src-tauri && cargo test --bin photoclove 2>&1 | tail -15`
Expected: `test result: ok.` — all tests pass, including the video ones
from Task 1.

- [ ] **Step 6: Manual verification with a real video**

If `ffmpeg`/`ffprobe` is installed locally (check with `which ffprobe`),
manually verify against a real video file:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams /path/to/some/video.mp4 | head -40
```

Confirm the JSON contains a `format.tags.creation_time` (or equivalent)
field with a real, non-ctime timestamp, so `probe()` will actually pick it
up. This step has no pass/fail assertion beyond eyeballing the JSON shape —
record what you saw in the task's PR description or commit message if
different from the shape assumed in Task 1's tests (e.g. a make/model tag
under a different key), and file it as a follow-up if so.

- [ ] **Step 7: Format, lint, commit**

```bash
cd src-tauri && cargo fmt && cargo clippy --bin photoclove 2>&1 | tail -20
```
Expected: zero warnings.

```bash
cd /home/ktat/git/github/photoclove
git add src-tauri/src/repository/meta_db/sqlite/photo_metadata.rs
git commit -m "fix(video): use ffprobe metadata at import instead of ctime fallback

record_photos_meta_data called ExifData::new() unconditionally, which
rexif can never parse for a video container, so every imported video's
exif_date_time_original stayed unset and bulk date-sort/grouping fell
back to filesystem ctime — wrong whenever a file's ctime doesn't match
its actual recording time (copy, restore, etc).

Videos now probe via ffprobe and convert the result to an ExifData via
VideoMetadata::to_exif_data(), reusing the existing embed_exif/INSERT
path unchanged. exif_model/exif_make get written too (read by the
camera search filter, camera stats, and burst grouping)."
```

---

### Task 4: Wire into `Photo::new_with_exif` (fixes "move to EXIF date" for free)

**Files:**
- Modify: `src-tauri/src/entity/photo.rs:111-116`

**Interfaces:**
- Consumes: same as Task 3.

`repository/db/directory.rs::move_photos_to_exif_date` is the only caller
of `new_with_exif` in the codebase (confirmed by
`grep -rn "new_with_exif" src-tauri/src`) — fixing this function fixes that
directory-menu action automatically; `directory.rs` itself doesn't change.

- [ ] **Step 1: Write the failing test**

`src-tauri/src/entity/photo.rs` already has a `#[cfg(test)] mod tests`
block (with `test_constructor`, `test_photos`, `test_type_predicates`, plus
the thumbnail/date tests added earlier this session). Add this test inside
that existing module:

```rust
    #[test]
    fn test_new_with_exif_video_falls_back_to_ctime_without_ffprobe() {
        let dir = std::env::temp_dir().join("photoclove_new_with_exif_video_test");
        std::fs::create_dir_all(&dir).unwrap();
        let video_path = dir.join("clip.mp4");
        std::fs::write(&video_path, b"not a real video").unwrap();

        let f = file::File::new(video_path.to_str().unwrap().to_string());
        let p = photo::Photo::new_with_exif(f);

        // No real video metadata available (garbage file), so this must not
        // panic and must produce a non-empty ctime-derived time, exactly
        // like a photo whose EXIF parse fails.
        assert!(!p.time().is_empty());
    }
```

Note this test goes inside `mod tests` which already has
`use crate::entity::photo;` and `use crate::value::file;` — reuse those,
don't re-import.

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd src-tauri && cargo test --bin photoclove test_new_with_exif_video_falls_back_to_ctime 2>&1 | tail -20
```
Expected: this actually PASSES today too (the existing `ExifData::new`
already falls back to ctime for video, just via the slower/wrong path) —
so, like Task 3, there's no visible RED state for THIS specific assertion.
Confirm instead that it fails to *compile* if you temporarily comment out
Step 3's change and re-run — skip this if short on time, the meaningful
regression protection is Step 4 below.

- [ ] **Step 3: Wire the `is_video()` branch**

In `src-tauri/src/entity/photo.rs`, change:

```rust
    pub fn new_with_exif(file: file::File) -> Photo {
        let mut photo = Photo::new(file.clone(), Option::None);
        let meta = exif::ExifData::new(file);
        photo.embed_exif(meta);
        photo.is_exif_not_loaded = false;
        photo
    }
```

to:

```rust
    pub fn new_with_exif(file: file::File) -> Photo {
        let mut photo = Photo::new(file.clone(), Option::None);
        let meta = if photo.is_video() {
            crate::utils::ffprobe::probe(&file.path)
                .unwrap_or_else(crate::value::video_metadata::VideoMetadata::empty)
                .to_exif_data(&file.created_datetime())
        } else {
            exif::ExifData::new(file)
        };
        photo.embed_exif(meta);
        photo.is_exif_not_loaded = false;
        photo
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd src-tauri && cargo test --bin photoclove test_new_with_exif_video_falls_back_to_ctime 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd src-tauri && cargo test --bin photoclove 2>&1 | tail -15`
Expected: `test result: ok.`

- [ ] **Step 6: Format, lint, commit**

```bash
cd src-tauri && cargo fmt && cargo clippy --bin photoclove 2>&1 | tail -20
```
Expected: zero warnings.

```bash
cd /home/ktat/git/github/photoclove
git add src-tauri/src/entity/photo.rs
git commit -m "fix(video): use ffprobe metadata in Photo::new_with_exif

Same bug as record_photos_meta_data, one level down: new_with_exif
also called ExifData::new() unconditionally. Its only caller,
move_photos_to_exif_date (the 'move to EXIF date' directory-menu
action), silently no-ops or misfiles videos today since it moves them
based on ctime, not real recording time. Fixed by the same
VideoMetadata::to_exif_data() conversion Task 3 uses; directory.rs
itself needs no changes since it only calls this function."
```

---

### Task 5: Wire into `get_photo_info` (info panel — live display, self-healing DB sync)

**Files:**
- Modify: `src-tauri/src/commands/photo_commands.rs:9-17` (imports),
  `:26-44` (`PhotoInfoResponse` struct), `:276-326` (`photo_info_blocking`)

**Interfaces:**
- Consumes: same as Task 3/4, plus existing
  `meta_db.update_exif_if_changed(path: &str, exif: &ExifData) -> Result<bool, String>`
  (`repository/meta_db/sqlite/exif.rs`, unchanged).
- Produces: `PhotoInfoResponse.video: Option<serde_json::Value>` (new field
  in an existing, already-`Serialize`d struct — the frontend, Task 6,
  reads `data.video.duration_secs` / `.codec` / `.gps_latitude` /
  `.gps_longitude`).

This does **not** persist duration/codec/GPS to the database — nothing
else reads them, so they're serialized directly from the live `ffprobe`
call. `exif_date_time_original`/`exif_model`/`exif_make` DO get
opportunistically re-synced here via the existing, unmodified
`update_exif_if_changed`, exactly like it already happens for photo EXIF.

- [ ] **Step 1: Update imports**

In `src-tauri/src/commands/photo_commands.rs`, change:

```rust
use crate::app_state::{AppState, PhotoRequest};
use crate::domain_service::{achievements, photo_service};
use crate::entity::photo;
use crate::entity::photo_meta;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::value::comment;
use crate::value::date;
use crate::value::exif;
use crate::value::file;
use crate::value::star;
```

to:

```rust
use crate::app_state::{AppState, PhotoRequest};
use crate::domain_service::{achievements, photo_service};
use crate::entity::photo;
use crate::entity::photo_meta;
use crate::repository::{MetaInfoDB, RepositoryDB};
use crate::utils::ffprobe;
use crate::value::comment;
use crate::value::date;
use crate::value::exif;
use crate::value::file;
use crate::value::star;
use crate::value::video_metadata::VideoMetadata;
```

- [ ] **Step 2: Add the `video` field to `PhotoInfoResponse`**

Change:

```rust
#[derive(serde::Serialize)]
pub struct PhotoInfoResponse {
    /// Original photo path from database
    pub original_path: String,

    /// Current physical path (may be in trash)
    pub current_path: String,

    /// Whether the photo is in trash
    pub is_trashed: bool,

    /// File size in bytes
    pub file_size: Option<u64>,

    /// Photo metadata from database
    pub meta: Option<serde_json::Value>,

    /// EXIF data from photo file
    pub exif: Option<serde_json::Value>,
}
```

to:

```rust
#[derive(serde::Serialize)]
pub struct PhotoInfoResponse {
    /// Original photo path from database
    pub original_path: String,

    /// Current physical path (may be in trash)
    pub current_path: String,

    /// Whether the photo is in trash
    pub is_trashed: bool,

    /// File size in bytes
    pub file_size: Option<u64>,

    /// Photo metadata from database
    pub meta: Option<serde_json::Value>,

    /// EXIF data from photo file (also used, partially filled, for video —
    /// see VideoMetadata::to_exif_data)
    pub exif: Option<serde_json::Value>,

    /// Video-only metadata (duration/codec/GPS) for the currently-viewed
    /// file, live from `ffprobe`. `None` for photos and for videos whose
    /// probe failed.
    pub video: Option<serde_json::Value>,
}
```

- [ ] **Step 3: Wire `photo_info_blocking`'s `Some(f)` branch**

Change:

```rust
        Some(f) => {
            // File exists, read EXIF from file
            let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
            let exif_data = exif::ExifData::new(f);

            // Sync EXIF data to database if there are differences
            if let Err(e) = meta_db.update_exif_if_changed(path_str, &exif_data) {
                log::warn!(target: "photo_info", "exif_sync_failed; path={}; error={}", path_str, e);
            }

            let photo_meta = photo_meta::PhotoMeta::new_with_data(p, meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);

            // Serialize to get JSON values
            let full_json = serde_json::to_value(&photo_meta_with_exif).unwrap();
            let meta_value = full_json.get("meta").cloned();
            let exif_value = full_json.get("exif").cloned();

            let file_size = std::fs::metadata(&actual_path).ok().map(|m| m.len());

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size,
                meta: meta_value,
                exif: exif_value,
            };

            serde_json::to_string(&response).unwrap()
        }
```

to:

```rust
        Some(f) => {
            let p = photo::Photo::new(file::File::from_relative(path_str.to_string()), None);
            let is_video = p.is_video();

            // File exists: read EXIF (photos) or probe metadata (videos).
            // The video branch never calls ExifData::new (which would
            // silently fall back to ctime for a video container, same bug
            // as Tasks 3/4) — it builds the exif-shaped value from the live
            // ffprobe call instead.
            let (exif_data, video_value) = if is_video {
                let vm = ffprobe::probe(&f.path).unwrap_or_else(VideoMetadata::empty);
                let exif_data = vm.to_exif_data(&f.created_datetime());
                let video_value = serde_json::to_value(&vm).ok();
                (exif_data, video_value)
            } else {
                (exif::ExifData::new(f), None)
            };

            // Sync EXIF-shaped data to database if there are differences.
            // For video this self-heals exif_date_time_original/exif_model/
            // exif_make exactly like it already does for photo EXIF —
            // duration/codec/GPS are never written here since nothing reads
            // them back from the DB.
            if let Err(e) = meta_db.update_exif_if_changed(path_str, &exif_data) {
                log::warn!(target: "photo_info", "exif_sync_failed; path={}; error={}", path_str, e);
            }

            let photo_meta = photo_meta::PhotoMeta::new_with_data(p, meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);

            // Serialize to get JSON values
            let full_json = serde_json::to_value(&photo_meta_with_exif).unwrap();
            let meta_value = full_json.get("meta").cloned();
            let exif_value = full_json.get("exif").cloned();

            let file_size = std::fs::metadata(&actual_path).ok().map(|m| m.len());

            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size,
                meta: meta_value,
                exif: exif_value,
                video: video_value,
            };

            serde_json::to_string(&response).unwrap()
        }
```

- [ ] **Step 4: Add `video: None` to the file-not-found branch**

Change:

```rust
            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size: None,
                meta: meta_json,
                exif: None,
            };
```

to:

```rust
            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size: None,
                meta: meta_json,
                exif: None,
                video: None,
            };
```

- [ ] **Step 5: Verify it compiles**

Run: `cd src-tauri && cargo build --bin photoclove 2>&1 | tail -30`
Expected: builds successfully. (There's no unit test for
`photo_info_blocking` — it's a `tauri::State`-taking function integration
tested by the existing `get_photo_info` E2E coverage, if any, and by manual
verification below; adding a DB/State-mocking test here would be more
machinery than the change warrants.)

- [ ] **Step 6: Run the full backend test suite**

Run: `cd src-tauri && cargo test --bin photoclove 2>&1 | tail -15`
Expected: `test result: ok.`

- [ ] **Step 7: Format, lint, commit**

```bash
cd src-tauri && cargo fmt && cargo clippy --bin photoclove 2>&1 | tail -20
```
Expected: zero warnings.

```bash
cd /home/ktat/git/github/photoclove
git add src-tauri/src/commands/photo_commands.rs
git commit -m "fix(video): get_photo_info uses live ffprobe, adds video field

Mirrors the existing photo architecture exactly: live-read the file
(ffprobe instead of rexif for video), sync the result into
exif_date_time_original/exif_model/exif_make via the unmodified
update_exif_if_changed (self-healing cache, same as photo EXIF), and
return the display value directly rather than trusting a DB read.

Adds PhotoInfoResponse.video (duration_secs/codec/gps_latitude/
gps_longitude) for the frontend info panel — not persisted, since
nothing else reads these back; supplied live from the same ffprobe
call every time the panel opens."
```

---

### Task 6: Frontend — `PhotoInfo.jsx` video-aware rendering

**Files:**
- Modify: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx:18-26` (component
  top), `:243-259` (table rows)
- Modify: `src/i18n/locales/en/common.json`, `src/i18n/locales/ja/common.json`

**Interfaces:**
- Consumes: `props.currentPhoto.isVideo()` (existing, `src/domain/Photo.js`),
  `photoInfo.exif.{date_time,make,model,xresolution,yresolution}` (existing
  shape, now populated for video too — Task 5), `photoInfo.video.
  {duration_secs,codec,gps_latitude,gps_longitude}` (new — Task 5).

- [ ] **Step 1: Add the new i18n keys**

In `src/i18n/locales/en/common.json`, inside the `"photoInfo": { ... }`
object, add these 4 keys right after `"dateTime": "Date & Time",`:

```json
    "dateTime": "Date & Time",
    "resolution": "Resolution",
    "duration": "Duration",
    "codec": "Codec",
    "gps": "GPS",
```

In `src/i18n/locales/ja/common.json`, inside the same object, add right
after `"dateTime": "撮影日時",`:

```json
    "dateTime": "撮影日時",
    "resolution": "解像度",
    "duration": "長さ",
    "codec": "コーデック",
    "gps": "GPS",
```

- [ ] **Step 2: Write a failing test for the row-visibility logic**

Create `src/test/PhotoInfo.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import PhotoInfo from '../App/PhotosList/PhotoOption/PhotoInfo.jsx';

const baseProps = {
    imgCacheMap: {},
    showSideMenu: true,
    star: [false, false, false, false, false],
    setStar: vi.fn(),
    isImportMode: false,
    isTrashMode: false,
    addFooterMessage: vi.fn()
};

function makePhoto({ isVideo }) {
    return {
        originalPath: isVideo ? '2024-05-13/clip.mp4' : '2024-05-13/photo.jpg',
        name: isVideo ? 'clip.mp4' : 'photo.jpg',
        displayPath: () => (isVideo ? '2024-05-13/clip.mp4' : '2024-05-13/photo.jpg'),
        isVideo: () => isVideo
    };
}

function renderWithI18n(ui) {
    return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('PhotoInfo video vs photo rows', () => {
    beforeEach(() => {
        global.mockTauriInvoke.mockReset();
    });

    it('hides photo-only EXIF rows and shows video rows for a video', async () => {
        global.mockTauriInvoke.mockResolvedValue(JSON.stringify({
            original_path: '2024-05-13/clip.mp4',
            current_path: '/library/2024-05-13/clip.mp4',
            is_trashed: false,
            file_size: 12345,
            meta: null,
            exif: { date_time: '2026-06-29 18:48:43', make: 'DJI', model: 'FC7303', xresolution: '3840', yresolution: '2160' },
            video: { duration_secs: 12.3, codec: 'hevc', gps_latitude: 35.1234, gps_longitude: -139.1234 }
        }));

        renderWithI18n(<PhotoInfo {...baseProps} currentPhoto={makePhoto({ isVideo: true })} />);

        await waitFor(() => {
            expect(screen.queryByText('ISO')).not.toBeInTheDocument();
        });
        expect(screen.queryByText('FNumber')).not.toBeInTheDocument();
        expect(screen.getByText('Resolution')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('Codec')).toBeInTheDocument();
        expect(screen.getByText('GPS')).toBeInTheDocument();
    });

    it('shows the full EXIF table and no video rows for a photo', async () => {
        global.mockTauriInvoke.mockResolvedValue(JSON.stringify({
            original_path: '2024-05-13/photo.jpg',
            current_path: '/library/2024-05-13/photo.jpg',
            is_trashed: false,
            file_size: 54321,
            meta: null,
            exif: { iso: '200', fnumber: '2.8' },
            video: null
        }));

        renderWithI18n(<PhotoInfo {...baseProps} currentPhoto={makePhoto({ isVideo: false })} />);

        await waitFor(() => {
            expect(screen.getByText('ISO')).toBeInTheDocument();
        });
        expect(screen.getByText('FNumber')).toBeInTheDocument();
        expect(screen.queryByText('Duration')).not.toBeInTheDocument();
        expect(screen.queryByText('Codec')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/test/PhotoInfo.test.jsx 2>&1 | tail -40`
Expected: the video test fails — `Resolution`/`Duration`/`Codec`/`GPS`
text isn't in the document yet (rows don't exist). The photo test may
already pass (no behavior change needed there yet) or fail on import
issues — if `../i18n/index.js` isn't the correct i18n bootstrap path,
check `src/i18n/` for the actual entry file name and adjust the import
before proceeding; do not change the component to work around a wrong
import path.

- [ ] **Step 4: Implement the JSX changes**

In `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`, add `isVideo` next to
the other derived values:

```jsx
    // Derive paths from Photo entity
    const currentPhotoPath = props.currentPhoto?.originalPath;
    const currentDisplayPath = props.currentPhoto?.displayPath();
    const currentPhotoName = props.currentPhoto?.name;
    const isVideo = props.currentPhoto?.isVideo?.() ?? false;
```

Replace the table body (from the `iso` row through the `orientation` row,
inclusive — i.e. everything between the `fileSize` row and the
`googlePhotosUrl` row) with:

```jsx
                        {!isVideo && (
                            <>
                                <tr><th>{t('photoInfo.iso')}</th><td>{photoInfo.exif ? photoInfo.exif.iso : ""}</td></tr>
                                <tr><th>{t('photoInfo.fNumber')}</th><td>{photoInfo.exif ? photoInfo.exif.fnumber : ""}</td></tr>
                                <tr><th>{t('photoInfo.shutterSpeed')}</th><td>{photoInfo.exif ? photoInfo.exif.exposure_time : ""}</td></tr>
                                <tr><th>{t('photoInfo.lensModel')}</th><td>{photoInfo.exif ? photoInfo.exif.lens_model : ""}</td></tr>
                                <tr><th>{t('photoInfo.lensMake')}</th><td>{photoInfo.exif ? photoInfo.exif.lens_make : ""}</td></tr>
                            </>
                        )}
                        <tr><th>{t('photoInfo.make')}</th><td>{photoInfo.exif ? photoInfo.exif.make : ""}</td></tr>
                        <tr><th>{t('photoInfo.model')}</th><td>{photoInfo.exif ? photoInfo.exif.model : ""}</td></tr>
                        <tr><th>{t('photoInfo.dateTime')}</th><td>{photoInfo.exif ? photoInfo.exif.date_time : ""}</td></tr>
                        {isVideo && (
                            <>
                                <tr><th>{t('photoInfo.resolution')}</th><td>{photoInfo.exif && photoInfo.exif.xresolution ? `${photoInfo.exif.xresolution} x ${photoInfo.exif.yresolution}` : ""}</td></tr>
                                <tr><th>{t('photoInfo.duration')}</th><td>{photoInfo.video && photoInfo.video.duration_secs != null ? `${Math.floor(photoInfo.video.duration_secs / 60)}:${String(Math.round(photoInfo.video.duration_secs % 60)).padStart(2, '0')}` : ""}</td></tr>
                                <tr><th>{t('photoInfo.codec')}</th><td>{photoInfo.video ? photoInfo.video.codec : ""}</td></tr>
                                {photoInfo.video && photoInfo.video.gps_latitude != null && photoInfo.video.gps_longitude != null && (
                                    <tr><th>{t('photoInfo.gps')}</th><td>{photoInfo.video.gps_latitude}, {photoInfo.video.gps_longitude}</td></tr>
                                )}
                            </>
                        )}
                        {!isVideo && (
                            <>
                                <tr><th>{t('photoInfo.focalLength')}</th><td>{photoInfo.exif ?
                                    photoInfo.exif.focal_length == photoInfo.exif.focal_length_in35mm_film
                                        ? photoInfo.exif.focal_length
                                        : photoInfo.exif.focal_length + "(" + photoInfo.exif.focal_length_in35mm_film + ")" : ""}
                                </td></tr>
                                <tr><th>{t('photoInfo.digitalZoomRatio')}</th><td>{photoInfo.exif ? photoInfo.exif.digital_zoom_ratio : ""}</td></tr>
                                <tr><th>{t('photoInfo.exposureMode')}</th><td>{photoInfo.exif ? photoInfo.exif.exposure_mode : ""}</td></tr>
                                <tr><th>{t('photoInfo.whiteBalanceMode')}</th><td>{photoInfo.exif ? photoInfo.exif.white_balance_mode : ""}</td></tr>
                                <tr><th>{t('photoInfo.orientation')}</th><td>{photoInfo.exif ? photoInfo.exif.orientation : ""}</td></tr>
                            </>
                        )}
```

(The `googlePhotosUrl` row immediately after stays exactly as-is, untouched.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/test/PhotoInfo.test.jsx 2>&1 | tail -40`
Expected: both tests pass.

- [ ] **Step 6: Run the full frontend test suite**

Run: `pnpm vitest run 2>&1 | tail -10`
Expected: all tests pass (no regressions in unrelated suites).

- [ ] **Step 7: Commit**

```bash
cd /home/ktat/git/github/photoclove
git add src/App/PhotosList/PhotoOption/PhotoInfo.jsx \
        src/i18n/locales/en/common.json \
        src/i18n/locales/ja/common.json \
        src/test/PhotoInfo.test.jsx
git commit -m "feat(video): show video metadata in the PhotoInfo panel

Hides the EXIF rows that are always blank for video (ISO, f-number,
shutter speed, lens model/make, focal length, digital zoom, exposure
mode, white balance, orientation — none of these are set by
VideoMetadata::to_exif_data) and adds Resolution/Duration/Codec/GPS
rows fed from the new video-only response field. Make/Model/Date&Time
rows are unchanged and now populated for video too, via the backend
change in the previous commit."
```

---

## Self-Review

**Spec coverage:**
- Fix wrong video dates at import → Task 3. ✅
- Fix the same bug in `move_photos_to_exif_date` → Task 4. ✅
- Show duration/codec/resolution/GPS in the info panel, self-heal
  date/model/make via the existing mechanism → Task 5 (backend) + Task 6
  (frontend). ✅
- No new migration/columns → confirmed, no `ALTER TABLE` anywhere in this
  plan. ✅
- No new dependencies → confirmed (`chrono`/`regex`/`serde_json` already in
  `Cargo.toml`). ✅
- Unit tests with canned JSON, no real `ffprobe` in CI → Task 1's tests are
  pure/offline; Task 2/3/4/5 explicitly call out manual verification
  instead of a CI-dependent integration test. ✅

**Placeholder scan:** No TBD/TODO. Every step has complete, runnable code
or an exact command with a stated expected result.

**Type consistency:**
- `VideoMetadata::to_exif_data(&self, fallback_date_time: &str) -> exif::ExifData`
  — same signature used identically in Tasks 3, 4, and 5.
- `ffprobe::probe(path: &str) -> Option<VideoMetadata>` — same signature
  and `unwrap_or_else(VideoMetadata::empty)` pattern used identically in
  Tasks 3, 4, and 5.
- `PhotoInfoResponse.video: Option<serde_json::Value>` (Task 5) matches
  exactly what Task 6's frontend test fixtures and JSX assume
  (`photoInfo.video.duration_secs` / `.codec` / `.gps_latitude` /
  `.gps_longitude`).
