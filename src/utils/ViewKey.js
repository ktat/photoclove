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
 *
 * `sortOfPhotos` is appended as `|sort:<n>` so cache entries are
 * partitioned per sort order. Backend returns photos sorted server-side,
 * so changing sort must produce a fresh fetch (= different cache key).
 * Without this, switching sort would silently restore the previously-
 * cached order. Import mode does its own frontend sort via
 * importSortOfPhotos and ignores sortOfPhotos, but adding the suffix
 * uniformly is harmless (just splits import cache between the rarely-
 * used non-import sort dimension).
 */
export function getViewKey(viewModeObj, searchParams = null, importPath = null, sortOfPhotos = null) {
    const baseKey = computeBaseKey(viewModeObj, searchParams, importPath);
    if (baseKey == null) return null;
    return sortOfPhotos != null ? `${baseKey}|sort:${sortOfPhotos}` : baseKey;
}

function computeBaseKey(viewModeObj, searchParams, importPath) {
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
        // Without an import path the view is uninitialised — uncacheable.
        return importPath ? `import:${importPath}` : null;
    }
    if (viewModeObj.isInBurstGroupMode?.()) {
        const id = viewModeObj.getCurrentBurstGroupId?.();
        return id != null ? `burst:${id}` : 'burst:none';
    }
    if (viewModeObj.isDateMode?.()) {
        const date = viewModeObj.getCurrentDate?.();
        return date ? `date:${date}` : null;
    }
    if (viewModeObj.isRecentMode?.()) {
        return 'recent';
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
