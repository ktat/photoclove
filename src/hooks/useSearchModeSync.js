import { useEffect, useRef } from 'react';

/**
 * Search-mode glue between useSearch (results buffer) and the unified
 * allPhotosForCurrentFetch state used by the grid.
 *
 * Why this is its own hook:
 * - useViewModeSync skips search mode because ViewMode.getUnifiedPhotoParams
 *   uses factory-time params and can't reflect live searchParams changes.
 *   Search loads are user-triggered via performSearch; we just need to
 *   commit the resulting photos to the grid state.
 *
 * Responsibilities:
 *   1. When `searchResults` changes (fresh query), convert raw backend data
 *      to Photo entities and write to allPhotosForCurrentFetch.
 *   2. When `isSearching` flips to true, clear allPhotosForCurrentFetch so
 *      the empty-state UI shows "Searching..." (it only triggers when
 *      displayedPhotos.length === 0).
 *   3. On search-mode entry: clear stale photos.
 *   4. On search-mode exit: clear search state so re-entering shows a fresh
 *      form.
 */
export function useSearchModeSync({
    viewModeObj,
    searchResults,
    isSearching,
    setAllPhotosForCurrentFetch,
    convertPhotosWithConfig,
    clearSearchHook,
    updateSearchParams,
}) {
    const lastSearchResultsRef = useRef(null);

    // 1. Commit search results to the grid.
    useEffect(() => {
        if (!viewModeObj?.isSearchMode?.()) return;
        if (!searchResults) return;
        if (lastSearchResultsRef.current === searchResults) return;
        lastSearchResultsRef.current = searchResults;
        const entities = convertPhotosWithConfig(searchResults, false, false);
        setAllPhotosForCurrentFetch(entities);
    }, [searchResults, viewModeObj, setAllPhotosForCurrentFetch, convertPhotosWithConfig]);

    // 2. Clear when a new search starts so "Searching..." overlay can appear.
    useEffect(() => {
        if (isSearching && viewModeObj?.isSearchMode?.()) {
            setAllPhotosForCurrentFetch([]);
            lastSearchResultsRef.current = null;
        }
    }, [isSearching, viewModeObj, setAllPhotosForCurrentFetch]);

    // 3 + 4. Mode entry/exit handling.
    const prevSearchModeRef = useRef(false);
    useEffect(() => {
        const isSearch = !!viewModeObj?.isSearchMode?.();
        if (isSearch && !prevSearchModeRef.current) {
            // Just entered search mode — clear stale photos until a query runs
            setAllPhotosForCurrentFetch([]);
            lastSearchResultsRef.current = null;
        } else if (!isSearch && prevSearchModeRef.current) {
            // Just left search mode — reset state so re-entering is fresh
            clearSearchHook();
            updateSearchParams(null);
            lastSearchResultsRef.current = null;
        }
        prevSearchModeRef.current = isSearch;
    }, [viewModeObj, setAllPhotosForCurrentFetch, clearSearchHook, updateSearchParams]);
}
