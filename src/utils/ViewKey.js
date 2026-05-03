/**
 * Compute a stable cache key for the current view mode.
 *
 * Maps each view mode + its parameter to a string used as
 * the LRU map key in usePhotosCache. Synchronous so it can be used
 * inside effects and selectors without deferred state.
 *
 * For search the key is `search:<canonical-json>` directly — long but
 * sufficient as a Map key (no need for a hash since we never persist or
 * transmit it).
 */
export function getViewKey(viewModeObj, searchParams = null, importPath = null) {
    if (!viewModeObj) return null;

    if (viewModeObj.isSearchMode?.()) {
        if (!searchParams) return 'search:empty';
        return `search:${JSON.stringify(stableSort(searchParams))}`;
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
    if (viewModeObj.isInBurstGroupMode?.()) {
        const id = viewModeObj.getCurrentBurstGroupId?.();
        return id != null ? `burst:${id}` : 'burst:none';
    }
    return 'home';
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
