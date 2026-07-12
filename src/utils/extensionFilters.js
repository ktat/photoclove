/**
 * extensionFilters
 *
 * Single source of truth for the extension filter shown in FilterTab and
 * FilterPopover and applied in applyFrontendFilters. Previously the option
 * lists were hardcoded (and duplicated) in each UI, so RAW/HEIC/mov/avi were
 * missing and there was no way to match "everything else".
 *
 * The filter value is a comma-separated list of extension tokens (e.g.
 * "jpg,jpeg,cr2") or the string "all". The special token OTHER_VALUE matches
 * any file whose extension is not part of a known group.
 */

// Groups mirror Photo.isRawFormat() / isHeicOrAvif() / videoFormats so the
// filter stays in sync with how the app classifies formats elsewhere.
export const EXTENSION_GROUPS = [
    {
        key: 'image',
        label: 'Image',
        labelKey: 'directoryMenu:filter.image',
        items: [
            { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
            { value: 'png', label: 'png', extensions: ['png'] },
            { value: 'gif', label: 'gif', extensions: ['gif'] },
            { value: 'webp', label: 'webp', extensions: ['webp'] },
            { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
            { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
        ]
    },
    {
        key: 'raw',
        label: 'RAW',
        items: [
            { value: 'cr2', label: 'cr2', extensions: ['cr2'] },
            { value: 'cr3', label: 'cr3', extensions: ['cr3'] },
            { value: 'nef', label: 'nef', extensions: ['nef'] },
            { value: 'arw', label: 'arw', extensions: ['arw'] },
            { value: 'dng', label: 'dng', extensions: ['dng'] },
            { value: 'raf', label: 'raf', extensions: ['raf'] },
            { value: 'orf', label: 'orf', extensions: ['orf'] },
            { value: 'rw2', label: 'rw2', extensions: ['rw2'] },
            { value: '3fr', label: '3fr', extensions: ['3fr'] }
        ]
    },
    {
        key: 'heic',
        label: 'HEIC',
        items: [
            { value: 'heic', label: 'heic', extensions: ['heic'] },
            { value: 'heif', label: 'heif', extensions: ['heif'] },
            { value: 'avif', label: 'avif', extensions: ['avif'] }
        ]
    },
    {
        key: 'movie',
        label: 'Movie',
        labelKey: 'directoryMenu:filter.movie',
        items: [
            { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
            { value: 'webm', label: 'webm', extensions: ['webm'] },
            { value: 'mov', label: 'mov', extensions: ['mov'] },
            { value: 'avi', label: 'avi', extensions: ['avi'] }
        ]
    }
];

// Token used to select "everything not in a known group".
export const OTHER_VALUE = 'other';

// All extensions that belong to a group — the complement is what OTHER matches.
export const KNOWN_FILTER_EXTENSIONS = new Set(
    EXTENSION_GROUPS.flatMap(g => g.items.flatMap(i => i.extensions))
);

/** All extensions in a group, flattened. */
export function groupExtensions(group) {
    return group.items.flatMap(i => i.extensions);
}

/** Parse a filter value into a list of lowercase tokens ([] for "all"). */
export function parseFilter(extensionFilter) {
    if (!extensionFilter || extensionFilter === 'all') return [];
    return extensionFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

function toFilterString(tokens) {
    const uniq = [...new Set(tokens)];
    return uniq.length === 0 ? 'all' : uniq.join(',');
}

/** Add/remove a set of extensions, returning the new filter string. */
export function setExtensions(extensionFilter, extensions, checked) {
    const lower = extensions.map(e => e.toLowerCase());
    const tokens = parseFilter(extensionFilter).filter(t => !lower.includes(t));
    return toFilterString(checked ? [...tokens, ...lower] : tokens);
}

/** Add/remove the OTHER token, returning the new filter string. */
export function setOther(extensionFilter, checked) {
    const tokens = parseFilter(extensionFilter).filter(t => t !== OTHER_VALUE);
    return toFilterString(checked ? [...tokens, OTHER_VALUE] : tokens);
}

/** Whether any of the given extensions is currently selected. */
export function extensionsChecked(extensionFilter, extensions) {
    const tokens = parseFilter(extensionFilter);
    return extensions.some(e => tokens.includes(e.toLowerCase()));
}

/** Whether the OTHER token is selected. */
export function otherChecked(extensionFilter) {
    return parseFilter(extensionFilter).includes(OTHER_VALUE);
}

/**
 * Whether a file name passes the extension filter.
 * "all" passes everything; OTHER passes anything not in a known group.
 */
export function matchesExtensionFilter(name, extensionFilter) {
    if (!extensionFilter || extensionFilter === 'all') return true;
    const ext = (name || '').split('.').pop().toLowerCase();
    const tokens = parseFilter(extensionFilter);
    if (tokens.includes(ext)) return true;
    if (tokens.includes(OTHER_VALUE) && !KNOWN_FILTER_EXTENSIONS.has(ext)) return true;
    return false;
}
