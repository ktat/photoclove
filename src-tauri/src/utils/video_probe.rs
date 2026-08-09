//! Reading the properties of a video file with ffprobe.
//!
//! A thin wrapper around the `ffprobe` CLI: it starts the process and turns
//! its JSON into a struct, and holds no policy about what the values mean.
//! Both the video merge editor and the EXIF parser read videos through here.

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// ffprobe only reads headers, so a short timeout is enough to catch a hang.
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
/// How often the run loop polls the child process's state.
const POLL_INTERVAL: Duration = Duration::from_millis(200);
/// Used when ffprobe cannot report a usable frame rate.
const DEFAULT_FPS: f64 = 30.0;

/// The properties of a video file that callers need.
#[derive(Debug, Clone)]
pub struct VideoProbe {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub duration_sec: f64,
    /// The container's `creation_time` tag, when the camera wrote one.
    pub creation_time: Option<String>,
    /// The video stream's codec, e.g. `"hevc"`.
    #[allow(dead_code)] // Read by the info-tab work that follows this task.
    pub video_codec: Option<String>,
    /// The container's `encoder` tag, which is where an action camera writes
    /// its model name, e.g. `"DJI OsmoAction6"`.
    #[allow(dead_code)] // Read by the info-tab work that follows this task.
    pub encoder: Option<String>,
}

/// Reads the stream layout of `path` with ffprobe.
pub fn probe_video(path: &str) -> Result<VideoProbe, String> {
    let mut child = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate",
            "-show_entries",
            "format=duration",
            // Separate calls accumulate per section, so this adds the tags
            // without dropping the stream and format entries above.
            "-show_entries",
            "format_tags=creation_time,encoder",
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
                std::thread::sleep(POLL_INTERVAL);
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

    parse_probe_json(&output.stdout, path)
}

/// Turns ffprobe's JSON into a [`VideoProbe`].
///
/// Split out from [`probe_video`] so the interpretation of ffprobe's output is
/// testable without ffprobe installed.
fn parse_probe_json(stdout: &[u8], path: &str) -> Result<VideoProbe, String> {
    let parsed: serde_json::Value = serde_json::from_slice(stdout)
        .map_err(|e| format!("Cannot parse ffprobe output for {}: {}", path, e))?;

    let empty = Vec::new();
    let streams = parsed["streams"].as_array().unwrap_or(&empty);
    // The first video stream is the recording. A camera may append others -
    // DJI writes an mjpeg thumbnail as a second video stream - and those
    // would report the wrong resolution and codec for the file.
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
        video_codec: video["codec_name"].as_str().map(str::to_string),
        encoder: parsed["format"]["tags"]["encoder"]
            .as_str()
            .map(str::to_string),
    })
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

    /// Trimmed from a real DJI Osmo Action 6 clip. Note the two video streams:
    /// index 0 is the recording, index 5 is an embedded mjpeg thumbnail.
    const DJI_JSON: &[u8] = br#"{
      "streams": [
        {"index": 0, "codec_name": "hevc", "codec_type": "video",
         "width": 1920, "height": 1080, "r_frame_rate": "30000/1001"},
        {"index": 1, "codec_name": "aac", "codec_type": "audio",
         "r_frame_rate": "0/0"},
        {"index": 5, "codec_name": "mjpeg", "codec_type": "video",
         "width": 1280, "height": 720, "r_frame_rate": "90000/1"}
      ],
      "format": {
        "duration": "11.968000",
        "tags": {
          "creation_time": "2026-06-29T04:30:05.000000Z",
          "encoder": "DJI OsmoAction6"
        }
      }
    }"#;

    #[test]
    fn reads_every_field_from_a_real_clip() {
        let probe = parse_probe_json(DJI_JSON, "/x.mp4").expect("parse");

        assert_eq!(probe.width, 1920);
        assert_eq!(probe.height, 1080);
        assert!((probe.fps - 29.97).abs() < 0.01);
        assert!(probe.has_audio);
        assert!((probe.duration_sec - 11.968).abs() < 0.001);
        assert_eq!(
            probe.creation_time.as_deref(),
            Some("2026-06-29T04:30:05.000000Z")
        );
        assert_eq!(probe.video_codec.as_deref(), Some("hevc"));
        assert_eq!(probe.encoder.as_deref(), Some("DJI OsmoAction6"));
    }

    #[test]
    fn takes_the_first_video_stream_not_the_embedded_thumbnail() {
        // The mjpeg stream at index 5 is a 1280x720 thumbnail. Picking it
        // would report the wrong resolution and codec for the whole file.
        let probe = parse_probe_json(DJI_JSON, "/x.mp4").expect("parse");
        assert_eq!((probe.width, probe.height), (1920, 1080));
        assert_eq!(probe.video_codec.as_deref(), Some("hevc"));
    }

    #[test]
    fn optional_tags_are_none_when_the_container_has_none() {
        let json = br#"{
          "streams": [
            {"codec_name": "h264", "codec_type": "video",
             "width": 640, "height": 480, "r_frame_rate": "25"}
          ],
          "format": {"duration": "3.0"}
        }"#;
        let probe = parse_probe_json(json, "/x.mp4").expect("parse");

        assert_eq!(probe.creation_time, None);
        assert_eq!(probe.encoder, None);
        assert!(!probe.has_audio);
        assert!((probe.duration_sec - 3.0).abs() < f64::EPSILON);
    }

    #[test]
    fn rejects_a_file_with_no_usable_video_stream() {
        let no_video = br#"{"streams": [{"codec_type": "audio"}], "format": {}}"#;
        assert!(parse_probe_json(no_video, "/x.mp4").is_err());

        let zero_size = br#"{
          "streams": [{"codec_type": "video", "width": 0, "height": 0}],
          "format": {}
        }"#;
        assert!(parse_probe_json(zero_size, "/x.mp4").is_err());
    }

    #[test]
    fn parses_rational_and_plain_frame_rates() {
        assert!((parse_frame_rate("30000/1001") - 29.97).abs() < 0.01);
        assert!((parse_frame_rate("25") - 25.0).abs() < f64::EPSILON);
        // 0/0 is what ffprobe reports for streams with no usable rate.
        assert!((parse_frame_rate("0/0") - DEFAULT_FPS).abs() < f64::EPSILON);
        assert!((parse_frame_rate("") - DEFAULT_FPS).abs() < f64::EPSILON);
    }
}
