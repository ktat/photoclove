/**
 * videoFormats
 *
 * Single source of truth for which files are treated as videos. Previously the
 * check was duplicated with inconsistent extension lists (some only mp4|webm),
 * which made .mov/.avi files fall through to the image code paths — e.g. the
 * grid would load the whole video file into an <img>. Keep every video check
 * pointed here.
 */
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'avi', 'mov'];

const VIDEO_EXT_REGEX = new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i');

/**
 * Whether a file path/name points to a video.
 * @param {string} [path]
 * @returns {boolean}
 */
export function isVideoPath(path) {
    return !!path && VIDEO_EXT_REGEX.test(path);
}
