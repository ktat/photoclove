//! Reading the properties of a source clip with ffprobe.

use super::FFMPEG_POLL_INTERVAL;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// ffprobe only reads headers, so a short timeout is enough to catch a hang.
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
/// Used when ffprobe cannot report a usable frame rate for the first clip.
const DEFAULT_FPS: f64 = 30.0;

/// The stream properties of a source clip that the merge needs to normalize.
#[derive(Debug, Clone)]
pub struct VideoProbe {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub duration_sec: f64,
    /// The container's `creation_time` tag, when the camera wrote one.
    pub creation_time: Option<String>,
}

/// Reads the stream layout of `path` with ffprobe.
pub fn probe_video(path: &str) -> Result<VideoProbe, String> {
    let mut child = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,width,height,r_frame_rate",
            "-show_entries",
            "format=duration",
            // Separate calls accumulate per section, so this adds the tag
            // without dropping the stream and format entries above.
            "-show_entries",
            "format_tags=creation_time",
            "-of",
            "json",
        ])
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffprobe for {}: {}", path, e))?;

    let deadline = Instant::now() + PROBE_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "ffprobe timed out after {}s for {}",
                        PROBE_TIMEOUT.as_secs(),
                        path
                    ));
                }
                std::thread::sleep(FFMPEG_POLL_INTERVAL);
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("ffprobe failed for {}: {}", path, e));
            }
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Cannot read ffprobe output for {}: {}", path, e))?;
    if !output.status.success() {
        return Err(format!(
            "ffprobe failed for {}: {}",
            path,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Cannot parse ffprobe output for {}: {}", path, e))?;

    let empty = Vec::new();
    let streams = parsed["streams"].as_array().unwrap_or(&empty);
    let video = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("video"))
        .ok_or_else(|| format!("No video stream found in {}", path))?;
    let has_audio = streams
        .iter()
        .any(|s| s["codec_type"].as_str() == Some("audio"));

    let width = video["width"].as_u64().unwrap_or(0) as u32;
    let height = video["height"].as_u64().unwrap_or(0) as u32;
    if width == 0 || height == 0 {
        return Err(format!("Video stream in {} has no usable dimensions", path));
    }

    Ok(VideoProbe {
        width,
        height,
        fps: parse_frame_rate(video["r_frame_rate"].as_str().unwrap_or("")),
        has_audio,
        duration_sec: parsed["format"]["duration"]
            .as_str()
            .and_then(|d| d.parse::<f64>().ok())
            .unwrap_or(0.0),
        creation_time: parsed["format"]["tags"]["creation_time"]
            .as_str()
            .map(str::to_string),
    })
}

/// When a video was recorded, as an RFC 3339 timestamp.
///
/// Prefers the container's `creation_time` tag, which is what a camera writes,
/// and falls back to the file's modification time - the same thing the import
/// pipeline dates videos by, since video containers carry no EXIF.
pub fn recorded_at(path: &str) -> Result<String, String> {
    match probe_video(path) {
        Ok(probe) => match probe.creation_time {
            Some(created) => match normalize_creation_time(&created) {
                Some(normalized) => return Ok(normalized),
                None => log::warn!(
                    target: "video_edit_service",
                    "creation_time_unparsable; path={}; value={}",
                    path, created
                ),
            },
            None => log::debug!(target: "video_edit_service", "no_creation_time; path={}", path),
        },
        Err(e) => {
            log::warn!(target: "video_edit_service", "recorded_at_probe_failed; path={}; error={}", path, e);
        }
    }

    let modified = std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map_err(|e| format!("Cannot read the modification time of {}: {}", path, e))?;
    Ok(chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339())
}

/// Turns a container `creation_time` tag into the RFC 3339 form [`recorded_at`]
/// promises its callers.
///
/// ffprobe passes the tag through verbatim, so a container written by something
/// other than a camera can carry anything at all. Returns `None` for a value
/// that is not a timestamp, which sends [`recorded_at`] to its
/// modification-time fallback rather than leaking an unparsable string.
fn normalize_creation_time(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw.trim())
        .ok()
        .map(|parsed| parsed.with_timezone(&chrono::Utc).to_rfc3339())
}

/// ffprobe reports frame rates as a rational string such as `"30000/1001"`.
/// Falls back to [`DEFAULT_FPS`] when the field is missing or degenerate.
fn parse_frame_rate(raw: &str) -> f64 {
    let (num, den) = match raw.split_once('/') {
        Some((n, d)) => (n.parse::<f64>().ok(), d.parse::<f64>().ok()),
        None => (raw.parse::<f64>().ok(), Some(1.0)),
    };
    match (num, den) {
        (Some(n), Some(d)) if n > 0.0 && d > 0.0 => n / d,
        _ => DEFAULT_FPS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rational_and_plain_frame_rates() {
        assert!((parse_frame_rate("30000/1001") - 29.97).abs() < 0.01);
        assert!((parse_frame_rate("25") - 25.0).abs() < f64::EPSILON);
        // 0/0 is what ffprobe reports for streams with no usable rate.
        assert!((parse_frame_rate("0/0") - DEFAULT_FPS).abs() < f64::EPSILON);
        assert!((parse_frame_rate("") - DEFAULT_FPS).abs() < f64::EPSILON);
    }

    #[test]
    fn normalizes_only_parsable_creation_times() {
        // The form a camera writes.
        assert_eq!(
            normalize_creation_time("2024-05-06T07:08:09.000000Z").as_deref(),
            Some("2024-05-06T07:08:09+00:00")
        );
        // An offset is normalized to UTC so callers get one comparable form.
        assert_eq!(
            normalize_creation_time("2024-05-06T16:08:09+09:00").as_deref(),
            Some("2024-05-06T07:08:09+00:00")
        );
        // Anything that is not RFC 3339 is rejected rather than passed on.
        assert_eq!(normalize_creation_time("2024-05-06 07:08:09"), None);
        assert_eq!(normalize_creation_time("not a date"), None);
        assert_eq!(normalize_creation_time(""), None);
    }

    #[test]
    fn recorded_at_falls_back_to_the_modification_time() {
        // A text file cannot be probed, so this reaches the fallback whether or
        // not ffprobe is installed on the machine running the tests.
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("not-a-video.txt");
        std::fs::write(&path, b"x").expect("write file");
        let modified = std::fs::metadata(&path)
            .and_then(|meta| meta.modified())
            .expect("modification time");

        let recorded = recorded_at(path.to_str().expect("utf-8 path")).expect("recorded_at");

        assert_eq!(
            recorded,
            chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339()
        );
    }
}
