/**
 * Compute a stable cache key for the current view mode.
 *
 * Maps each view mode + its parameter to a string used as
 * the LRU map key in usePhotosCache.
 */
export async function getViewKey(viewModeObj, searchParams = null, importPath = null) {
    if (!viewModeObj) return null;

    if (viewModeObj.isSearchMode?.()) {
        if (!searchParams) return 'search:empty';
        const hash = await sha256Short(JSON.stringify(stableSort(searchParams)));
        return `search:${hash}`;
    }
    if (viewModeObj.isAlbumMode?.()) {
        const id = viewModeObj.getCurrentAlbumId?.();
        return id != null ? `album:${id}` : 'album:none';
    }
    if (viewModeObj.isTagMode?.()) {
        const id = viewModeObj.getCurrentTagId?.();
        return id != null ? `tag:${id}` : 'tag:none';
    }
    if (viewModeObj.isPersonMode?.()) {
        const id = viewModeObj.getCurrentPersonId?.();
        return id != null ? `person:${id}` : 'person:none';
    }
    if (viewModeObj.isUnknownFacesMode?.()) {
        return 'unknown_faces';
    }
    if (viewModeObj.isTrashMode?.()) {
        return 'trash';
    }
    if (viewModeObj.isImportMode?.()) {
        return `import:${importPath ?? 'default'}`;
    }
    if (viewModeObj.isBurstGroupMode?.()) {
        const id = viewModeObj.getCurrentBurstGroupId?.();
        return id != null ? `burst:${id}` : 'burst:none';
    }
    return 'home';
}

async function sha256Short(input) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return hex.slice(0, 8);
}

function stableSort(obj) {
    if (Array.isArray(obj)) return obj.map(stableSort);
    if (obj && typeof obj === 'object') {
        const sorted = {};
        for (const k of Object.keys(obj).sort()) {
            sorted[k] = stableSort(obj[k]);
        }
        return sorted;
    }
    return obj;
}
