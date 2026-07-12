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
    let mut stdout = child.stdout.take()?;
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
