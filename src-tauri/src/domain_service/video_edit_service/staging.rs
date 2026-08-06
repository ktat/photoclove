//! The directory merged videos are written to before they are imported.

use std::path::{Path, PathBuf};
use std::time::Duration;

/// Staged outputs older than this are removed at the start of the next merge.
const STAGING_RETENTION: Duration = Duration::from_secs(24 * 60 * 60);

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

/// Give the merged file the modification time of its first source.
///
/// Video containers carry no EXIF, so the import pipeline dates a video from
/// its file modification time. Without this the result would be filed under the
/// day it was produced instead of the day the footage was shot.
pub(super) fn inherit_source_timestamp(source_path: &str, output_path: &Path) {
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
