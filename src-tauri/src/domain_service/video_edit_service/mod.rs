//! Video editing domain service.
//!
//! Owns the ffmpeg/ffprobe knowledge needed to merge several trimmed clips
//! into a single video. The job handler stays thin and only wires progress and
//! cancellation through to `merge_videos`.
//!
//! Split by concern: [`probe`] reads what a source file contains,
//! [`merge_args`] turns trimmed clips into an ffmpeg filter graph, [`merge`]
//! runs and supervises ffmpeg, and [`staging`] owns the directory merged files
//! land in before the import pipeline picks them up.

mod merge;
mod merge_args;
mod probe;
mod staging;

pub use merge::merge_videos;
pub use probe::recorded_at;
pub use staging::{cleanup_stale_staging_files, staging_dir};

use std::time::Duration;

/// A job needs at least one segment. One segment is a plain trim, several from
/// the same file cut a video down to its good parts, and several across files
/// merge them - all one code path.
pub const MIN_MERGE_SEGMENTS: usize = 1;
/// How often the run loops poll a child process's state and the stop flag.
const FFMPEG_POLL_INTERVAL: Duration = Duration::from_millis(200);
