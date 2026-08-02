/**
 * trimUtils
 *
 * Range bookkeeping shared by the video editor components.
 *
 * A *source* is one selected file plus the ranges kept from it. Ranges are held
 * sorted by start time and never overlap - `addRange` folds an overlapping mark
 * into the range it runs into, so the output can never emit the same footage
 * twice.
 *
 * An empty `ranges` list means "keep the whole file", which is what makes the
 * plain "merge these videos" case zero-click. Read it through
 * `effectiveRanges` rather than touching `ranges` directly.
 *
 * `id` and `duration_sec` exist only for the UI (React keys, track width,
 * clamping); the payload sent to Tauri is a deliberate subset - see
 * toMergePayload.
 */

/**
 * A job needs at least one source. One source is a trim, several are a merge,
 * and either way a source can contribute several ranges. Mirrors
 * MIN_MERGE_SEGMENTS in src-tauri/src/domain_service/video_edit_service.rs.
 */
export const MIN_MERGE_SEGMENTS = 1;

/** Smallest markable range, so a range can never be zero length. */
export const MIN_SEGMENT_LENGTH_SEC = 0.1;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
/** Cuts are frame accurate, so the readout needs sub-second precision. */
const TIME_DECIMALS = 1;

const pad = (value) => String(value).padStart(2, '0');

/**
 * Format a position as `HH:MM:SS.d`.
 * @param {number} seconds
 * @returns {string}
 */
export function formatClipTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00.0';
    // Round first, then split. Rounding the seconds component on its own would
    // turn 59.96 into "60.0" with nothing carrying into the minutes, which the
    // playhead readout hits every time it passes a minute boundary.
    const scale = 10 ** TIME_DECIMALS;
    const rounded = Math.round(seconds * scale) / scale;
    const hours = Math.floor(rounded / SECONDS_PER_HOUR);
    const minutes = Math.floor((rounded % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const rest = rounded % SECONDS_PER_MINUTE;
    return `${pad(hours)}:${pad(minutes)}:${rest.toFixed(TIME_DECIMALS).padStart(4, '0')}`;
}

/**
 * Build a source covering a whole file. The duration is unknown until the
 * player reports its metadata.
 * @param {string} path - Absolute path to the video file
 * @returns {{id: string, path: string, duration_sec: number, ranges: Array}}
 */
export function createSource(path) {
    return { id: crypto.randomUUID(), path, duration_sec: 0, ranges: [] };
}

/**
 * The ranges a source actually contributes. No marked ranges means the whole
 * file is kept.
 * @param {{duration_sec: number, ranges: Array}} source
 * @returns {Array<{id: string, start_sec: number, end_sec: number}>}
 */
export function effectiveRanges(source) {
    if (source.ranges.length > 0) return source.ranges;
    if (!source.duration_sec) return [];
    return [{ id: `${source.id}-whole`, start_sec: 0, end_sec: source.duration_sec }];
}

/**
 * Whether a position falls inside a range that is already kept. A new range
 * may not start there, because it would only extend what is already covered.
 * @param {Array<{start_sec: number, end_sec: number}>} ranges
 * @param {number} time
 * @returns {boolean}
 */
export function isInsideAnyRange(ranges, time) {
    return ranges.some((range) => time >= range.start_sec && time <= range.end_sec);
}

/**
 * Add a range, folding it together with any range it overlaps or touches.
 *
 * Marking an end past a range that is already kept means the user wants one
 * continuous piece, so the overlapping ranges collapse into a single range
 * spanning all of them rather than emitting the shared footage twice.
 *
 * @param {Array<{id: string, start_sec: number, end_sec: number}>} ranges
 * @param {number} startSec
 * @param {number} endSec
 * @returns {Array<{id: string, start_sec: number, end_sec: number}>} Sorted by start
 */
export function addRange(ranges, startSec, endSec) {
    const start = Math.min(startSec, endSec);
    const end = Math.max(startSec, endSec);
    const overlaps = (range) => range.start_sec <= end && range.end_sec >= start;

    const merged = {
        id: crypto.randomUUID(),
        start_sec: Math.min(start, ...ranges.filter(overlaps).map((r) => r.start_sec)),
        end_sec: Math.max(end, ...ranges.filter(overlaps).map((r) => r.end_sec))
    };

    return [...ranges.filter((range) => !overlaps(range)), merged]
        .sort((a, b) => a.start_sec - b.start_sec);
}

/**
 * The range covering a position, if any.
 * @param {Array<{start_sec: number, end_sec: number}>} ranges
 * @param {number} time
 * @returns {{start_sec: number, end_sec: number}|null}
 */
export function rangeContaining(ranges, time) {
    return ranges.find((range) => time >= range.start_sec && time <= range.end_sec) || null;
}

/**
 * Where playback should jump to when it leaves a range, or null past the last.
 * @param {Array<{start_sec: number, end_sec: number}>} ranges
 * @param {number} time
 * @returns {number|null}
 */
export function nextRangeStart(ranges, time) {
    const next = ranges.find((range) => range.start_sec > time);
    return next ? next.start_sec : null;
}

/**
 * Total length of the output.
 * @param {Array<{duration_sec: number, ranges: Array}>} sources
 * @returns {number} Seconds
 */
export function totalKeptSeconds(sources) {
    return sources.reduce(
        (total, source) => total + effectiveRanges(source).reduce(
            (sum, range) => sum + Math.max(range.end_sec - range.start_sec, 0), 0
        ),
        0
    );
}

/**
 * Flatten the sources into the segment list the merge_videos command reads:
 * sources in the order shown, each source's ranges in time order.
 * @param {Array<{path: string, duration_sec: number, ranges: Array}>} sources
 * @returns {Array<{path: string, start_sec: number, end_sec: number}>}
 */
export function toMergePayload(sources) {
    return sources.flatMap((source) => effectiveRanges(source).map((range) => ({
        path: source.path,
        start_sec: range.start_sec,
        end_sec: range.end_sec
    })));
}
