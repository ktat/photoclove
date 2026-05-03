/**
 * Sort comparator helpers for photo arrays.
 *
 * Comparator basis matches backend DB query order in src/utils/UIStateUtils.js
 * getSortConfig(). Used both by useFilteredPhotos (import mode) and by
 * Phase 2 in-memory edit helpers (Save as Copy insert position + close-time
 * local re-sort when sortDirty).
 */

/**
 * String comparator with null/undefined coalesced to ''.
 *
 * Null/undefined coalesce to '' or 0. This means nulls sort to the start
 * for asc and end for desc — which matches our backend's typical NULLS-
 * LAST-on-DESC behavior but diverges on ASC. In Phase 2 use cases (re-
 * sort after star edit, Save as Copy insert) the relevant fields are
 * always populated, so this is acceptable.
 */
const cmpStr = (a, b) => {
    const av = a ?? '';
    const bv = b ?? '';
    return av < bv ? -1 : av > bv ? 1 : 0;
};

/**
 * @param {number} sortValue
 * @returns {((a: object, b: object) => number) | null}
 */
export function getPhotoSortComparator(sortValue) {
    switch (sortValue) {
        case 0: return (a, b) => cmpStr(b.exif_date_time_original, a.exif_date_time_original);
        case 1: return (a, b) => cmpStr(a.exif_date_time_original, b.exif_date_time_original);
        case 2: return (a, b) => cmpStr(b.created_at, a.created_at);
        case 3: return (a, b) => cmpStr(a.created_at, b.created_at);
        case 4: return (a, b) => {
            const d = (b.star ?? 0) - (a.star ?? 0);
            return d !== 0 ? d : cmpStr(b.created_at, a.created_at);
        };
        case 5: return (a, b) => {
            const d = (a.star ?? 0) - (b.star ?? 0);
            return d !== 0 ? d : cmpStr(a.created_at, b.created_at);
        };
        case 6: return (a, b) => cmpStr(b.originalPath, a.originalPath);
        case 7: return (a, b) => cmpStr(a.originalPath, b.originalPath);
        default: return null;
    }
}

/**
 * True if sortValue corresponds to a star-based sort (changes when star is edited).
 */
export function isStarSort(sortValue) {
    return sortValue === 4 || sortValue === 5;
}

/**
 * Binary search to find the insertion index for `newPhoto` in `sortedPhotos`.
 * Returns sortedPhotos.length when comparator is null (= unknown sort).
 *
 * `sortedPhotos` must already be sorted by the same comparator.
 * Uses upper-bound semantics: when an existing element compares equal to
 * `newPhoto`, the new photo is inserted *after* it.
 */
export function findInsertIndex(sortedPhotos, newPhoto, comparator) {
    if (!comparator) return sortedPhotos.length;
    let lo = 0;
    let hi = sortedPhotos.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        // <= 0: equal elements push search right → upper-bound insert (after ties)
        if (comparator(sortedPhotos[mid], newPhoto) <= 0) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}
