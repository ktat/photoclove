/**
 * trimUtils
 *
 * Segment bookkeeping shared by VideoMergeEditor and VideoTrimScrubber.
 *
 * A segment is one kept range of one file. Several segments may name the same
 * file - that is how a single video gets cut down to its good parts - so a
 * segment is identified by its own `id`, never by `path`.
 *
 * `id` and `duration_sec` exist only for the UI (React keys, track width,
 * clamping); the payload sent to Tauri is a deliberate subset - see
 * toMergePayload.
 */

/**
 * A job needs at least one segment: one is a plain trim, several stitch pieces
 * together. Menu visibility, the operation guard and the editor's submit button
 * all read this, and it mirrors MIN_MERGE_SEGMENTS in
 * src-tauri/src/domain_service/video_edit_service.rs.
 */
export const MIN_MERGE_SEGMENTS = 1;

/** Smallest keepable range, so a trim handle can never cross or meet the other. */
export const MIN_SEGMENT_LENGTH_SEC = 0.1;

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
 * Build an untrimmed segment covering a whole file. The real duration is
 * unknown until the player reports its metadata, so the out point starts at 0
 * and widens then.
 * @param {string} path - Absolute path to the video file
 * @returns {{id: string, path: string, start_sec: number, end_sec: number, duration_sec: number}}
 */
export function createClip(path) {
    return { id: crypto.randomUUID(), path, start_sec: 0, end_sec: 0, duration_sec: 0 };
}

/**
 * Copy a segment as a new one over the same file, so the user can keep a second
 * range of the same video.
 *
 * The copy defaults to the rest of the file after the original's out point,
 * which is usually the next thing the user wants to trim down. When nothing is
 * left there - the original already runs to the end - it copies the same range
 * instead, so the new segment is never zero length.
 *
 * @param {{path: string, start_sec: number, end_sec: number, duration_sec: number}} clip
 * @returns {{id: string, path: string, start_sec: number, end_sec: number, duration_sec: number}}
 */
export function duplicateClip(clip) {
    const hasRoomAfter = clip.duration_sec - clip.end_sec >= MIN_SEGMENT_LENGTH_SEC;
    return {
        id: crypto.randomUUID(),
        path: clip.path,
        start_sec: hasRoomAfter ? clip.end_sec : clip.start_sec,
        end_sec: hasRoomAfter ? clip.duration_sec : clip.end_sec,
        duration_sec: clip.duration_sec
    };
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
 * Reduce segments to the fields the merge_videos command reads.
 * @param {Array<{path: string, start_sec: number, end_sec: number}>} clips
 * @returns {Array<{path: string, start_sec: number, end_sec: number}>}
 */
export function toMergePayload(clips) {
    return clips.map(({ path, start_sec, end_sec }) => ({ path, start_sec, end_sec }));
}
