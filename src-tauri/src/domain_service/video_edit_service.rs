//! Video editing domain service.
//!
//! Owns the ffmpeg/ffprobe knowledge needed to merge several trimmed clips
//! into a single video. The job handler stays thin and only wires progress and
//! cancellation through to `merge_videos`.

use crate::entity::job_queue::VideoMergeClip;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// A job needs at least one segment. One segment is a plain trim, several from
/// the same file cut a video down to its good parts, and several across files
/// merge them - all one code path.
pub const MIN_MERGE_SEGMENTS: usize = 1;
/// ffmpeg is killed if it reports no progress for this long. Encoding a long
/// video is legitimately slow, so this is a stall watchdog rather than a budget
/// for the whole run.
const FFMPEG_STALL_TIMEOUT: Duration = Duration::from_secs(600);
/// How often the run loop polls ffmpeg's state and the stop flag.
const FFMPEG_POLL_INTERVAL: Duration = Duration::from_millis(200);
/// ffprobe only reads headers, so a short timeout is enough to catch a hang.
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
/// Constant Rate Factor of the merged output. 18 is visually lossless for x264,
/// which matters because trimming forces a re-encode of otherwise pristine
/// source footage.
const OUTPUT_CRF: &str = "18";
const OUTPUT_PRESET: &str = "medium";
const OUTPUT_AUDIO_BITRATE: &str = "192k";
/// Every clip is resampled to this rate so `concat` sees uniform audio.
const OUTPUT_AUDIO_SAMPLE_RATE: u32 = 48_000;
/// Used when ffprobe cannot report a usable frame rate for the first clip.
const DEFAULT_FPS: f64 = 30.0;
/// How many trailing stderr lines are kept to explain an ffmpeg failure.
const FFMPEG_STDERR_TAIL_LINES: usize = 20;
/// Staged outputs older than this are removed at the start of the next merge.
const STAGING_RETENTION: Duration = Duration::from_secs(24 * 60 * 60);

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

/// Directory merged videos are written to before the follow-up import job
/// copies them into the library.
pub fn staging_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("photoclove")
        .join("video_merge")
}

/// Removes staged outputs older than [`STAGING_RETENTION`]. The import job
/// copies rather than moves, so without this the staging directory would grow
/// by one full-size video per merge.
pub fn cleanup_stale_staging_files() {
    let dir = staging_dir();
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return;
    };
    let mut removed = 0;
    for entry in entries.flatten() {
        let stale = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|modified| {
                modified
                    .elapsed()
                    .map(|age| age >= STAGING_RETENTION)
                    .unwrap_or(false)
            })
            .unwrap_or(false);
        if stale {
            match std::fs::remove_file(entry.path()) {
                Ok(_) => removed += 1,
                Err(e) => {
                    log::warn!(target: "video_edit_service", "staging_cleanup_failed; path={:?}; error={}", entry.path(), e)
                }
            }
        }
    }
    if removed > 0 {
        log::info!(target: "video_edit_service", "staging_cleanup; removed={}", removed);
    }
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
        Ok(probe) => {
            if let Some(created) = probe.creation_time {
                return Ok(created);
            }
            log::debug!(target: "video_edit_service", "no_creation_time; path={}", path);
        }
        Err(e) => {
            log::warn!(target: "video_edit_service", "recorded_at_probe_failed; path={}; error={}", path, e);
        }
    }

    let modified = std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map_err(|e| format!("Cannot read the modification time of {}: {}", path, e))?;
    Ok(chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339())
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

/// Builds the ffmpeg argument list that merges `clips` into `output_path`.
///
/// The first clip defines the output geometry and frame rate; the others are
/// letterboxed and resampled to match, because `concat` rejects segments whose
/// dimensions, SAR or stream layout differ.
fn build_merge_args(
    clips: &[VideoMergeClip],
    probes: &[VideoProbe],
    output_path: &Path,
) -> Vec<String> {
    let target = &probes[0];
    let mut args: Vec<String> = ["-nostdin", "-y", "-progress", "pipe:1", "-nostats"]
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Several segments can come from the same file, so give ffmpeg one input
    // per distinct path rather than one per segment - otherwise a long source
    // is opened and decoded once for every piece taken out of it.
    let mut input_paths: Vec<&str> = Vec::new();
    let mut input_index_for_clip = Vec::with_capacity(clips.len());
    for clip in clips {
        let index = match input_paths.iter().position(|p| *p == clip.path.as_str()) {
            Some(existing) => existing,
            None => {
                input_paths.push(clip.path.as_str());
                input_paths.len() - 1
            }
        };
        input_index_for_clip.push(index);
    }
    for path in &input_paths {
        args.push("-i".to_string());
        args.push(path.to_string());
    }

    // Clips with no audio track get a generated silent one appended after the
    // real inputs, since `concat` requires every segment to expose both streams.
    let mut silent_index_for_clip = vec![None; clips.len()];
    let mut next_input_index = input_paths.len();
    for (i, probe) in probes.iter().enumerate() {
        if probe.has_audio {
            continue;
        }
        args.push("-f".to_string());
        args.push("lavfi".to_string());
        args.push("-t".to_string());
        args.push(format!("{:.3}", clips[i].duration_sec()));
        args.push("-i".to_string());
        args.push(format!(
            "anullsrc=channel_layout=stereo:sample_rate={}",
            OUTPUT_AUDIO_SAMPLE_RATE
        ));
        silent_index_for_clip[i] = Some(next_input_index);
        next_input_index += 1;
    }

    let mut filters: Vec<String> = Vec::new();
    let mut concat_inputs = String::new();
    for (i, clip) in clips.iter().enumerate() {
        // `trim` cuts the decoded stream, so the cut lands on the exact frame
        // the user scrubbed to instead of the nearest keyframe.
        filters.push(format!(
            "[{input}:v]trim=start={start:.3}:end={end:.3},setpts=PTS-STARTPTS,\
             scale={w}:{h}:force_original_aspect_ratio=decrease,\
             pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps:.5}[v{i}]",
            input = input_index_for_clip[i],
            i = i,
            start = clip.start_sec,
            end = clip.end_sec,
            w = target.width,
            h = target.height,
            fps = target.fps,
        ));

        filters.push(match silent_index_for_clip[i] {
            // The silent source was already created at the trimmed length, so
            // it only needs its timestamps rebased.
            Some(silent) => format!(
                "[{silent}:a]asetpts=PTS-STARTPTS,\
                 aformat=sample_rates={rate}:channel_layouts=stereo[a{i}]",
                silent = silent,
                i = i,
                rate = OUTPUT_AUDIO_SAMPLE_RATE,
            ),
            None => format!(
                "[{input}:a]atrim=start={start:.3}:end={end:.3},asetpts=PTS-STARTPTS,\
                 aformat=sample_rates={rate}:channel_layouts=stereo[a{i}]",
                input = input_index_for_clip[i],
                i = i,
                start = clip.start_sec,
                end = clip.end_sec,
                rate = OUTPUT_AUDIO_SAMPLE_RATE,
            ),
        });

        concat_inputs.push_str(&format!("[v{}][a{}]", i, i));
    }
    filters.push(format!(
        "{}concat=n={}:v=1:a=1[outv][outa]",
        concat_inputs,
        clips.len()
    ));

    args.push("-filter_complex".to_string());
    args.push(filters.join(";"));
    for arg in [
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        // Carry the first source's container metadata - creation time, camera
        // make/model, GPS - into the result. filter_complex output otherwise
        // starts with no metadata at all.
        "-map_metadata",
        "0",
        "-c:v",
        "libx264",
        "-crf",
        OUTPUT_CRF,
        "-preset",
        OUTPUT_PRESET,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        OUTPUT_AUDIO_BITRATE,
        // Puts the moov atom up front so the merged file starts playing in the
        // in-app streaming player without downloading the whole file first.
        "-movflags",
        "+faststart",
    ] {
        args.push(arg.to_string());
    }
    args.push(output_path.display().to_string());
    args
}

/// Give the merged file the modification time of its first source.
///
/// Video containers carry no EXIF, so the import pipeline dates a video from
/// its file modification time. Without this the result would be filed under the
/// day it was produced instead of the day the footage was shot.
fn inherit_source_timestamp(source_path: &str, output_path: &Path) {
    let modified = match std::fs::metadata(source_path).and_then(|m| m.modified()) {
        Ok(modified) => modified,
        Err(e) => {
            log::warn!(
                target: "video_edit_service",
                "source_mtime_unavailable; source={}; error={}",
                source_path, e
            );
            return;
        }
    };
    let timestamp = filetime::FileTime::from_system_time(modified);
    if let Err(e) = filetime::set_file_mtime(output_path, timestamp) {
        log::warn!(
            target: "video_edit_service",
            "set_output_mtime_failed; output={}; error={}",
            output_path.display(), e
        );
    }
}

/// Rejects trim ranges the editor should never have produced, so ffmpeg fails
/// fast with a readable message instead of writing a broken file, and clamps
/// the ones that are merely optimistic.
///
/// The editor derives `end_sec` from the HTML video element's duration, which
/// can read slightly longer than the container duration ffprobe reports. Left
/// alone that overshoot desyncs the output: `trim` stops the video at end of
/// stream while the `anullsrc` filler for a silent clip is sized from the
/// requested range, so the audio runs long and `concat` carries the drift into
/// every following segment.
fn normalize_clips(
    clips: &[VideoMergeClip],
    probes: &[VideoProbe],
) -> Result<Vec<VideoMergeClip>, String> {
    let mut normalized = Vec::with_capacity(clips.len());
    for (clip, probe) in clips.iter().zip(probes.iter()) {
        if clip.start_sec < 0.0 || clip.end_sec <= clip.start_sec {
            return Err(format!(
                "Invalid trim range for {}: start={:.3}s end={:.3}s",
                clip.path, clip.start_sec, clip.end_sec
            ));
        }
        // A zero duration means ffprobe could not report one; trust the editor
        // in that case rather than rejecting a playable file.
        if probe.duration_sec > 0.0 && clip.start_sec >= probe.duration_sec {
            return Err(format!(
                "Trim start {:.3}s is past the end of {} ({:.3}s)",
                clip.start_sec, clip.path, probe.duration_sec
            ));
        }

        let mut clip = clip.clone();
        if probe.duration_sec > 0.0 && clip.end_sec > probe.duration_sec {
            log::debug!(
                target: "video_edit_service",
                "clamped_trim_end; path={}; requested={:.3}; duration={:.3}",
                clip.path, clip.end_sec, probe.duration_sec
            );
            clip.end_sec = probe.duration_sec;
        }
        normalized.push(clip);
    }
    Ok(normalized)
}

/// Merges `clips` into `output_path`, re-encoding so cuts are frame accurate.
///
/// `on_progress` receives a 0.0..1.0 ratio derived from ffmpeg's own progress
/// stream, and `should_stop` is polled so a queued job can be cancelled.
pub fn merge_videos<P, S>(
    clips: &[VideoMergeClip],
    output_path: &Path,
    mut on_progress: P,
    should_stop: S,
) -> Result<(), String>
where
    P: FnMut(f64),
    S: Fn() -> bool,
{
    if clips.len() < MIN_MERGE_SEGMENTS {
        return Err(format!(
            "At least {} segment is required",
            MIN_MERGE_SEGMENTS
        ));
    }

    let probes = clips
        .iter()
        .map(|c| probe_video(&c.path))
        .collect::<Result<Vec<_>, String>>()?;
    // Everything below works off the clamped ranges, so the ffmpeg arguments,
    // the silent-audio lengths and the progress total all agree.
    let clips = normalize_clips(clips, &probes)?;
    let clips = clips.as_slice();

    let total_sec: f64 = clips.iter().map(|c| c.duration_sec()).sum();

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create {}: {}", parent.display(), e))?;
    }

    let args = build_merge_args(clips, &probes, output_path);
    log::info!(
        target: "video_edit_service",
        "merge_start; clips={}; total_sec={:.3}; width={}; height={}; output={}",
        clips.len(), total_sec, probes[0].width, probes[0].height, output_path.display()
    );

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    // Both pipes are drained on worker threads: a full pipe buffer would block
    // ffmpeg forever while this loop waits for it to exit.
    let (progress_tx, progress_rx) = mpsc::channel::<f64>();
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let Some(raw) = line.strip_prefix("out_time_us=") else {
                    continue;
                };
                let Ok(micros) = raw.trim().parse::<f64>() else {
                    continue;
                };
                if progress_tx.send(micros / 1_000_000.0).is_err() {
                    break;
                }
            }
        });
    }
    let stderr_handle = child.stderr.take().map(|stderr| {
        std::thread::spawn(move || {
            // Keep only the tail: ffmpeg's reason for failing is always last.
            let mut tail: Vec<String> = Vec::new();
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if tail.len() == FFMPEG_STDERR_TAIL_LINES {
                    tail.remove(0);
                }
                tail.push(line);
            }
            tail.join("\n")
        })
    });

    let mut last_activity = Instant::now();
    let exit_status = loop {
        // Drain everything that arrived since the last tick and report the
        // newest position only.
        let mut latest = None;
        while let Ok(sec) = progress_rx.try_recv() {
            latest = Some(sec);
        }
        if let Some(sec) = latest {
            last_activity = Instant::now();
            if total_sec > 0.0 {
                on_progress((sec / total_sec).clamp(0.0, 1.0));
            }
        }

        if should_stop() {
            log::info!(target: "video_edit_service", "merge_stopped; output={}", output_path.display());
            let _ = child.kill();
            let _ = child.wait();
            let _ = std::fs::remove_file(output_path);
            return Err("Job stopped by user".to_string());
        }

        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if last_activity.elapsed() >= FFMPEG_STALL_TIMEOUT {
                    log::error!(
                        target: "video_edit_service",
                        "merge_stalled; timeout_secs={}; output={}",
                        FFMPEG_STALL_TIMEOUT.as_secs(), output_path.display()
                    );
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = std::fs::remove_file(output_path);
                    return Err(format!(
                        "ffmpeg made no progress for {}s and was stopped",
                        FFMPEG_STALL_TIMEOUT.as_secs()
                    ));
                }
                std::thread::sleep(FFMPEG_POLL_INTERVAL);
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = std::fs::remove_file(output_path);
                return Err(format!("Cannot wait for ffmpeg: {}", e));
            }
        }
    };

    let stderr_tail = stderr_handle
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();

    if !exit_status.success() {
        // Drop the partial file so a retry starts clean.
        let _ = std::fs::remove_file(output_path);
        log::error!(
            target: "video_edit_service",
            "merge_failed; exit={:?}; stderr={}",
            exit_status.code(), stderr_tail
        );
        return Err(format!(
            "ffmpeg exited with {:?}: {}",
            exit_status.code(),
            stderr_tail
        ));
    }

    inherit_source_timestamp(&clips[0].path, output_path);

    on_progress(1.0);
    log::info!(target: "video_edit_service", "merge_complete; output={}", output_path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe(width: u32, height: u32, has_audio: bool) -> VideoProbe {
        VideoProbe {
            width,
            height,
            fps: 30.0,
            has_audio,
            duration_sec: 60.0,
            creation_time: None,
        }
    }

    fn clip(path: &str, start_sec: f64, end_sec: f64) -> VideoMergeClip {
        VideoMergeClip {
            path: path.to_string(),
            start_sec,
            end_sec,
        }
    }

    #[test]
    fn parses_rational_and_plain_frame_rates() {
        assert!((parse_frame_rate("30000/1001") - 29.97).abs() < 0.01);
        assert!((parse_frame_rate("25") - 25.0).abs() < f64::EPSILON);
        // 0/0 is what ffprobe reports for streams with no usable rate.
        assert!((parse_frame_rate("0/0") - DEFAULT_FPS).abs() < f64::EPSILON);
        assert!((parse_frame_rate("") - DEFAULT_FPS).abs() < f64::EPSILON);
    }

    #[test]
    fn merge_args_trim_each_clip_and_concat_them() {
        let clips = vec![clip("/a.mp4", 1.5, 4.0), clip("/b.mp4", 0.0, 2.0)];
        let probes = vec![probe(1920, 1080, true), probe(1280, 720, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .expect("filter_complex is present");
        assert!(filter.contains("[0:v]trim=start=1.500:end=4.000"));
        assert!(filter.contains("[1:v]trim=start=0.000:end=2.000"));
        // The second clip is normalized to the first clip's geometry.
        assert!(filter.contains("scale=1920:1080"));
        assert!(filter.contains("[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]"));
        assert_eq!(args.last().unwrap(), "/out.mp4");
    }

    #[test]
    fn silent_source_is_added_for_clips_without_audio() {
        let clips = vec![clip("/a.mp4", 0.0, 3.0), clip("/b.mp4", 0.0, 2.0)];
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, false)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        assert!(args.iter().any(|a| a.starts_with("anullsrc=")));
        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        // The silent input follows the two real inputs, so it is index 2.
        assert!(filter.contains("[2:a]asetpts=PTS-STARTPTS"));
        assert!(!filter.contains("[1:a]atrim"));
    }

    #[test]
    fn rejects_inverted_and_out_of_range_trims() {
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, true)];
        let inverted = vec![clip("/a.mp4", 5.0, 5.0), clip("/b.mp4", 0.0, 2.0)];
        assert!(normalize_clips(&inverted, &probes).is_err());

        let past_end = vec![clip("/a.mp4", 90.0, 95.0), clip("/b.mp4", 0.0, 2.0)];
        assert!(normalize_clips(&past_end, &probes).is_err());

        let valid = vec![clip("/a.mp4", 0.0, 2.0), clip("/b.mp4", 1.0, 2.0)];
        assert!(normalize_clips(&valid, &probes).is_ok());
    }

    #[test]
    fn clamps_trim_end_to_the_probed_duration() {
        // probe() reports 60s; the editor asks for 65s off the player's
        // slightly longer idea of the duration.
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, false)];
        let clips = vec![clip("/a.mp4", 0.0, 65.0), clip("/b.mp4", 10.0, 20.0)];

        let normalized = normalize_clips(&clips, &probes).expect("ranges are valid");
        assert!((normalized[0].end_sec - 60.0).abs() < f64::EPSILON);
        // A range inside the media is left exactly as the user set it.
        assert!((normalized[1].end_sec - 20.0).abs() < f64::EPSILON);

        // The silent filler for the audio-less clip must match its video length.
        let args = build_merge_args(&normalized, &probes, Path::new("/out.mp4"));
        let silent_len = args
            .iter()
            .position(|a| a.starts_with("anullsrc="))
            .map(|i| args[i - 2].clone())
            .expect("silent input is sized with -t");
        assert_eq!(silent_len, "10.000");
    }

    #[test]
    fn keeps_trim_end_when_the_probe_reports_no_duration() {
        let mut unknown = probe(1920, 1080, true);
        unknown.duration_sec = 0.0;
        let probes = vec![unknown.clone(), unknown];
        let clips = vec![clip("/a.mp4", 0.0, 65.0), clip("/b.mp4", 0.0, 2.0)];

        let normalized = normalize_clips(&clips, &probes).expect("ranges are valid");
        assert!((normalized[0].end_sec - 65.0).abs() < f64::EPSILON);
    }

    #[test]
    fn merge_requires_at_least_one_segment() {
        let result = merge_videos(&[], Path::new("/out.mp4"), |_| {}, || false);
        assert!(result.unwrap_err().contains("At least"));
    }

    #[test]
    fn several_segments_of_one_file_share_a_single_input() {
        // Two cuts taken out of the same source, plus a second file.
        let clips = vec![
            clip("/a.mp4", 0.0, 2.0),
            clip("/b.mp4", 0.0, 1.0),
            clip("/a.mp4", 10.0, 12.0),
        ];
        let probes = vec![
            probe(1920, 1080, true),
            probe(1920, 1080, true),
            probe(1920, 1080, true),
        ];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        // /a.mp4 is opened once even though it supplies two segments.
        assert_eq!(args.iter().filter(|a| *a == "/a.mp4").count(), 1);
        assert_eq!(args.iter().filter(|a| *a == "-i").count(), 2);

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        // Segments 0 and 2 both read input 0; segment 1 reads input 1.
        assert!(filter.contains("[0:v]trim=start=0.000:end=2.000"));
        assert!(filter.contains("[1:v]trim=start=0.000:end=1.000"));
        assert!(filter.contains("[0:v]trim=start=10.000:end=12.000"));
        assert!(filter.contains("[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[outv][outa]"));
    }

    #[test]
    fn a_single_segment_is_a_plain_trim() {
        let clips = vec![clip("/a.mp4", 3.0, 9.0)];
        let probes = vec![probe(1920, 1080, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        assert!(filter.contains("[0:v]trim=start=3.000:end=9.000"));
        assert!(filter.contains("[v0][a0]concat=n=1:v=1:a=1[outv][outa]"));
    }

    #[test]
    fn output_inherits_the_first_source_metadata() {
        let clips = vec![clip("/a.mp4", 0.0, 2.0), clip("/b.mp4", 0.0, 1.0)];
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let index = args
            .iter()
            .position(|a| a == "-map_metadata")
            .expect("metadata is mapped");
        assert_eq!(args[index + 1], "0");
    }
}
