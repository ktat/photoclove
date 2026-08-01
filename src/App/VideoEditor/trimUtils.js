/**
 * trimUtils
 *
 * Clip bookkeeping shared by VideoMergeEditor and VideoTrimScrubber.
 *
 * A clip carries `duration_sec` for the UI (track width, clamping) on top of
 * the `path`/`start_sec`/`end_sec` triple the backend job expects, so the
 * payload sent to Tauri is a deliberate subset - see toMergePayload.
 */

/**
 * Fewer than this is not a merge. Menu visibility, the operation guard and the
 * editor's submit button all read this, and it mirrors MIN_MERGE_CLIPS in
 * src-tauri/src/domain_service/video_edit_service.rs.
 */
export const MIN_MERGE_CLIPS = 2;

const SECONDS_PER_MINUTE = 60;
/** Cuts are frame accurate, so the readout needs sub-second precision. */
const TIME_DECIMALS = 1;

/**
 * Format a duration for the trim readout as `M:SS.d`.
 * @param {number} seconds
 * @returns {string}
 */
export function formatClipTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return `0:00.0`;
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const rest = seconds - minutes * SECONDS_PER_MINUTE;
    return `${minutes}:${rest.toFixed(TIME_DECIMALS).padStart(4, '0')}`;
}

/**
 * Build an untrimmed clip. The real duration is unknown until the player
 * reports its metadata, so the out point starts at 0 and widens then.
 * @param {string} path - Absolute path to the video file
 * @returns {{path: string, start_sec: number, end_sec: number, duration_sec: number}}
 */
export function createClip(path) {
    return { path, start_sec: 0, end_sec: 0, duration_sec: 0 };
}

/**
 * Total length of the merged output.
 * @param {Array<{start_sec: number, end_sec: number}>} clips
 * @returns {number} Seconds
 */
export function totalKeptSeconds(clips) {
    return clips.reduce((sum, clip) => sum + Math.max(clip.end_sec - clip.start_sec, 0), 0);
}

/**
 * Reduce clips to the fields the merge_videos command reads.
 * @param {Array<{path: string, start_sec: number, end_sec: number}>} clips
 * @returns {Array<{path: string, start_sec: number, end_sec: number}>}
 */
export function toMergePayload(clips) {
    return clips.map(({ path, start_sec, end_sec }) => ({ path, start_sec, end_sec }));
}
