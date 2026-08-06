//! Running ffmpeg and supervising it until the merged file exists.

use super::merge_args::{build_merge_args, normalize_clips};
use super::probe::probe_video;
use super::staging::inherit_source_timestamp;
use super::{FFMPEG_POLL_INTERVAL, MIN_MERGE_SEGMENTS};
use crate::entity::job_queue::VideoMergeClip;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// ffmpeg is killed if it reports no progress for this long. Encoding a long
/// video is legitimately slow, so this is a stall watchdog rather than a budget
/// for the whole run.
const FFMPEG_STALL_TIMEOUT: Duration = Duration::from_secs(600);
/// How many trailing stderr lines are kept to explain an ffmpeg failure.
const FFMPEG_STDERR_TAIL_LINES: usize = 20;

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

    #[test]
    fn merge_requires_at_least_one_segment() {
        let result = merge_videos(&[], Path::new("/out.mp4"), |_| {}, || false);
        assert!(result.unwrap_err().contains("At least"));
    }
}
