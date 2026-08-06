/**
 * VideoService - Video streaming and editing operations
 *
 * Wraps the Tauri video commands so components do not have to know about the
 * warp streaming server handshake or the merge job payload shape.
 */
import { invokeWithErrorHandling } from './TauriService.js';
import { logger } from './LoggerService.js';

/**
 * Resolve a playable URL for a local video file.
 *
 * Goes through the warp streaming server because it answers Range requests,
 * which the asset protocol does not - without them the <video> element cannot
 * seek, and seeking is the whole point of the trim editor.
 *
 * @param {string} path - Absolute path to the video file
 * @returns {Promise<string>} URL usable as a <video> src
 */
export async function getVideoStreamUrl(path) {
    // Silent: this runs once per clip in the merge editor, so the per-call
    // success logging would drown out everything else.
    await invokeWithErrorHandling('start_video_server', {}, 'VideoService', { silent: true });
    return invokeWithErrorHandling(
        'register_video_path',
        { videoPath: path },
        'VideoService',
        { silent: true }
    );
}

/**
 * When a video was recorded, as an RFC 3339 timestamp.
 *
 * Comes from the container's creation_time tag, falling back to the file's
 * modification time. The two sources spell the offset differently, so compare
 * these by parsing them rather than as strings.
 *
 * @param {string} path - Absolute path to the video file
 * @returns {Promise<string>} RFC 3339 timestamp
 */
export async function getVideoRecordedAt(path) {
    return invokeWithErrorHandling(
        'get_video_recorded_at',
        { videoPath: path },
        'VideoService',
        { silent: true }
    );
}

/**
 * Queue a merge of the given trimmed clips into a single video.
 *
 * The merged file is imported into the library once the encode finishes, so
 * the caller only needs to surface the returned job unit ID.
 *
 * @param {Array<{path: string, start_sec: number, end_sec: number}>} clips -
 *   Clips in output order, each with its trim range in seconds
 * @returns {Promise<string>} Job unit ID for tracking progress
 */
export async function mergeVideos(clips) {
    logger.info('VideoService', 'merge_videos_submit', 'Submitting video merge job', {
        clipCount: clips.length
    });

    return invokeWithErrorHandling('merge_videos', { clips }, 'VideoService');
}
