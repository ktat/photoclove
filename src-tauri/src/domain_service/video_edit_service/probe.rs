//! Deciding when a video was recorded.
//!
//! The mechanics of running ffprobe live in [`crate::utils::video_probe`];
//! this module owns the policy of what to do with what it reports. The
//! re-export keeps `super::probe::{probe_video, VideoProbe}` working for the
//! merge code.

pub use crate::utils::video_probe::{probe_video, VideoProbe};

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

#[cfg(test)]
mod tests {
    use super::*;

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
