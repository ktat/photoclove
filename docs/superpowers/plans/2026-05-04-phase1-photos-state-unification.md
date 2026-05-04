# Phase 1: Photos State Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all view modes (album/tag/search/trash) onto `allPhotosForCurrentFetch` as the single source for the grid, with an LRU view cache for instant view-mode switching.

**Architecture:** Drop `albumPhotos` / `tagPhotos` / `trashPhotos` state, route all photo loads to `setAllPhotosForCurrentFetch`. Introduce `usePhotosCache` hook (ref-based LRU map) and wire it into view-mode switch flow. Backend `Config` gets two new fields for cache limits, surfaced in `PerformanceTab`.

**Tech Stack:** React 18, Tauri 2 (Rust), pnpm, react-window, serde

**Spec:** [`docs/superpowers/specs/2026-05-03-photos-state-unification-design.md`](../specs/2026-05-03-photos-state-unification-design.md)

---

## Task 1: Add Config fields for view cache limits (backend)

**Files:**
- Modify: `src-tauri/src/entity/config.rs:383-431` (Config struct + default fns)

- [ ] **Step 1: Add default fns**

Add near other `default_*` fns (around line 80):

```rust
fn default_view_cache_max_keys() -> u32 {
    10
}

fn default_view_cache_max_total_photos() -> u32 {
    50000
}
```

- [ ] **Step 2: Add fields to Config struct**

In `Config` struct, add before the closing brace:

```rust
    #[serde(default = "default_view_cache_max_keys")]
    pub view_cache_max_keys: u32,
    #[serde(default = "default_view_cache_max_total_photos")]
    pub view_cache_max_total_photos: u32,
```

- [ ] **Step 3: Verify compile**

Run: `cd src-tauri && cargo check`
Expected: PASS (warnings OK, no errors)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/entity/config.rs
git commit -m "feat: add view_cache_max_keys/view_cache_max_total_photos to Config"
```

---

## Task 2: Create `usePhotosCache` hook (LRU view cache)

**Files:**
- Create: `src/hooks/usePhotosCache.js`
- Test: skip (covered by integration)

- [ ] **Step 1: Create hook file**

```javascript
import { useRef, useCallback, useState } from 'react';
import { logger } from '../services/LoggerService.js';

/**
 * LRU cache for photos lists keyed by viewKey.
 * Stored in useRef to avoid render churn; trigger setter forces re-render
 * only when the consumer explicitly requests a UI update.
 *
 * Cache shape: Map<viewKey, { photos: PhotoJSON[], updatedAt: number }>
 */
export function usePhotosCache(maxKeys, maxTotalPhotos) {
    const cacheRef = useRef(new Map());
    const [, setVersion] = useState(0);
    const triggerRender = useCallback(() => setVersion(v => v + 1), []);

    const get = useCallback((viewKey) => {
        const entry = cacheRef.current.get(viewKey);
        if (entry) {
            entry.updatedAt = Date.now();
            cacheRef.current.delete(viewKey);
            cacheRef.current.set(viewKey, entry); // move to end (Map preserves insertion order)
        }
        return entry?.photos ?? null;
    }, []);

    const set = useCallback((viewKey, photos, currentViewKey) => {
        cacheRef.current.set(viewKey, {
            photos: [...photos],
            updatedAt: Date.now(),
        });
        evict(cacheRef.current, maxKeys, maxTotalPhotos, currentViewKey);
        logger.debug('usePhotosCache', 'set', 'View cache updated', {
            viewKey,
            size: cacheRef.current.size,
            photosCount: photos.length,
        });
    }, [maxKeys, maxTotalPhotos]);

    const patch = useCallback((viewKey, updater) => {
        const entry = cacheRef.current.get(viewKey);
        if (!entry) return;
        const updated = updater(entry.photos);
        entry.photos = updated;
        entry.updatedAt = Date.now();
    }, []);

    const invalidate = useCallback((viewKey) => {
        cacheRef.current.delete(viewKey);
    }, []);

    const clear = useCallback(() => {
        cacheRef.current.clear();
        triggerRender();
    }, [triggerRender]);

    return { get, set, patch, invalidate, clear };
}

function evict(cache, maxKeys, maxTotalPhotos, currentViewKey) {
    while (cache.size > maxKeys || totalPhotos(cache) > maxTotalPhotos) {
        const oldestKey = findOldestEvictableKey(cache, currentViewKey);
        if (!oldestKey) break;
        cache.delete(oldestKey);
    }
}

function totalPhotos(cache) {
    let total = 0;
    for (const entry of cache.values()) total += entry.photos.length;
    return total;
}

function findOldestEvictableKey(cache, currentViewKey) {
    for (const key of cache.keys()) {
        if (key !== currentViewKey) return key;
    }
    return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePhotosCache.js
git commit -m "feat: add usePhotosCache LRU hook for view-mode photos cache"
```

---

## Task 3: Add `getViewKey` utility

**Files:**
- Create: `src/utils/ViewKey.js`

- [ ] **Step 1: Create util**

```javascript
/**
 * Compute a stable cache key for the current view mode.
 * Maps each view mode + its parameter to a string used as
 * the LRU map key in usePhotosCache.
 */
export async function getViewKey(viewModeObj, searchParams = null, importPath = null) {
    if (!viewModeObj) return null;
    if (viewModeObj.isSearchMode()) {
        if (!searchParams) return 'search:empty';
        const hash = await sha256Short(JSON.stringify(stableSort(searchParams)));
        return `search:${hash}`;
    }
    if (viewModeObj.isAlbumMode()) return `album:${viewModeObj.getCurrentAlbumId()}`;
    if (viewModeObj.isTagMode()) return `tag:${viewModeObj.getCurrentTagId()}`;
    if (viewModeObj.isPersonMode?.()) return `person:${viewModeObj.getCurrentPersonId?.()}`;
    if (viewModeObj.isUnknownFacesMode?.()) return 'unknown_faces';
    if (viewModeObj.isTrashMode()) return 'trash';
    if (viewModeObj.isImportMode()) return `import:${importPath ?? 'default'}`;
    return 'home';
}

async function sha256Short(input) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8);
}

function stableSort(obj) {
    if (Array.isArray(obj)) return obj.map(stableSort);
    if (obj && typeof obj === 'object') {
        const sorted = {};
        for (const k of Object.keys(obj).sort()) sorted[k] = stableSort(obj[k]);
        return sorted;
    }
    return obj;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/ViewKey.js
git commit -m "feat: add getViewKey util for cache key generation"
```

---

## Task 4: Route `loadAlbumPhotos` to `setAllPhotosForCurrentFetch`

**Files:**
- Modify: `src/hooks/usePhotoDataLoader.js:97-132`

- [ ] **Step 1: Update loadAlbumPhotos**

Replace `updateAlbumPhotos(photosAsJSON);` with `setAllPhotosForCurrentFetch(photosAsJSON);` (line ~123). Update deps array accordingly.

The function signature gains `setAllPhotosForCurrentFetch` (already in props), and `updateAlbumPhotos` is removed.

- [ ] **Step 2: Update loadTagPhotos similarly (line 174-211)**

Replace `setTagPhotos(photosAsJSON);` with `setAllPhotosForCurrentFetch(photosAsJSON);`.

- [ ] **Step 3: Update loadTrashPhotos similarly (line 285-)**

Replace `setTrashPhotos(photosAsJSON);` with `setAllPhotosForCurrentFetch(photosAsJSON);`.

- [ ] **Step 4: Update destructured props in usePhotoDataLoader**

Remove `updateAlbumPhotos`, `setTagPhotos`, `setTrashPhotos` from the function args. They become unused.

- [ ] **Step 5: Verify**

Run: `pnpm lint`
Expected: no new errors related to our changes (existing warnings OK)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePhotoDataLoader.js
git commit -m "refactor: route album/tag/trash loads to allPhotosForCurrentFetch"
```

---

## Task 5: Simplify `useFilteredPhotos` source selection

**Files:**
- Modify: `src/hooks/useFilteredPhotos.js:36-100`

- [ ] **Step 1: Replace source branching**

Change lines 39-43:

```javascript
const sourcePhotos = allPhotosForCurrentFetch;
```

Remove the `albumPhotos`, `tagPhotos`, `photoCollection`, `searchResults` parameters from the hook signature (they're no longer needed). Keep `appConfig`, `viewModeObj`, `applyFiltersWithConfig`, `importSortOfPhotos`, `sortOfPhotos`, `allPhotosForCurrentFetch`.

- [ ] **Step 2: Update deps array (line 100)**

```javascript
}, [viewModeObj, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos, sortOfPhotos, appConfig]);
```

- [ ] **Step 3: Update callers**

In `src/App/PhotosList.jsx:239-244`, remove the now-unused params:

```javascript
const filteredPhotos = useFilteredPhotos({
    viewModeObj, allPhotosForCurrentFetch, applyFiltersWithConfig,
    importSortOfPhotos, sortOfPhotos, appConfig,
});
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFilteredPhotos.js src/App/PhotosList.jsx
git commit -m "refactor: useFilteredPhotos uses only allPhotosForCurrentFetch"
```

---

## Task 6: Remove `albumPhotos` / `tagPhotos` / `trashPhotos` state

**Files:**
- Modify: `src/context/PhotoContext.jsx` (remove `albumPhotos`, `updateAlbumPhotos`)
- Modify: `src/hooks/usePhotosState.js` (remove `tagPhotos`, `setTagPhotos`, `trashPhotos`, `setTrashPhotos`)
- Modify: `src/hooks/usePhotosListEffects.js` (remove `usePhotoSyncEffect`)
- Modify: `src/App/PhotosList.jsx` (remove destructure / passing of these)
- Modify: `src/hooks/usePhotoOperations.js` (remove `setTrashPhotos` calls in `permanentlyDeletePhoto`/`restorePhoto`)

- [ ] **Step 1: PhotoContext.jsx — remove albumPhotos**

Delete `albumPhotos` state (line 25), `updateAlbumPhotos` callback (line 66), and the corresponding entries in the context value (line 87).

- [ ] **Step 2: usePhotosState.js — remove tagPhotos and trashPhotos**

Delete the `useState` lines and the export entries.

- [ ] **Step 3: usePhotosListEffects.js — drop `usePhotoSyncEffect`**

Delete the entire `usePhotoSyncEffect` export. Update PhotosList.jsx to remove the import and call.

- [ ] **Step 4: usePhotoOperations.js — replace setTrashPhotos calls**

Lines 379-380 and 434-435. Replace:

```javascript
if (setTrashPhotos) {
    setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== photoPath));
}
```

with — for trash mode `permanentlyDeletePhoto`/`restorePhoto`, the `handlePhotoRemovalNavigation` already updates `allPhotosForCurrentFetch`. Just delete those `setTrashPhotos` blocks. Remove `setTrashPhotos` from props.

- [ ] **Step 5: PhotosList.jsx cleanup**

Remove all references to `albumPhotos`, `tagPhotos`, `trashPhotos`, `updateAlbumPhotos`, `setTagPhotos`, `setTrashPhotos` (destructures, props passing, hooks args).

- [ ] **Step 6: Verify**

Run: `pnpm lint && cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/context/PhotoContext.jsx src/hooks/usePhotosState.js src/hooks/usePhotosListEffects.js src/hooks/usePhotoOperations.js src/App/PhotosList.jsx
git commit -m "refactor: drop albumPhotos/tagPhotos/trashPhotos state"
```

---

## Task 7: Remove skip logic in `useViewModeSync`

**Files:**
- Modify: `src/hooks/useViewModeSync.js:56-59`

- [ ] **Step 1: Remove skip block**

Delete lines 56-59:

```javascript
// Skip photo loading if in album or tag mode - these photos are managed separately
if (viewModeObj.isAlbumMode() || viewModeObj.isTagMode()) {
    return;
}
```

So `loadPhotosWithCollection(viewModeObj)` runs for all view modes uniformly.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useViewModeSync.js
git commit -m "refactor: useViewModeSync no longer skips album/tag modes"
```

---

## Task 8: Connect search results to `allPhotosForCurrentFetch`

**Files:**
- Modify: `src/App/PhotosList.jsx` (add effect)

- [ ] **Step 1: Add commit effect**

After existing search-related hooks in `PhotosList.jsx`, add:

```javascript
useEffect(() => {
    if (viewModeObj?.isSearchMode() && searchResults) {
        setAllPhotosForCurrentFetch(searchResults);
    }
}, [searchResults, viewModeObj]);
```

- [ ] **Step 2: Commit**

```bash
git add src/App/PhotosList.jsx
git commit -m "feat: commit search results to allPhotosForCurrentFetch on change"
```

---

## Task 9: Wire `usePhotosCache` into PhotosList

**Files:**
- Modify: `src/App/PhotosList.jsx` (instantiate cache, save/restore on view-mode change)
- Modify: `src/hooks/useViewModeSync.js` (consult cache before backend load)

- [ ] **Step 1: Instantiate the cache in PhotosList.jsx**

```javascript
import { usePhotosCache } from '../hooks/usePhotosCache.js';
import { getViewKey } from '../utils/ViewKey.js';

// inside component:
const photosCache = usePhotosCache(
    appConfig?.view_cache_max_keys ?? 10,
    appConfig?.view_cache_max_total_photos ?? 50000,
);
```

- [ ] **Step 2: Save snapshot when load completes**

In load functions (or as a follow-up effect), after `setAllPhotosForCurrentFetch(photosAsJSON)`, save to cache:

```javascript
const viewKey = await getViewKey(viewModeObj, currentSearchParams);
if (viewKey) photosCache.set(viewKey, photosAsJSON, viewKey);
```

- [ ] **Step 3: Restore from cache in `useViewModeSync` before backend load**

Pass `photosCache` and `getViewKey` into `useViewModeSync`. Inside the effect:

```javascript
const viewKey = await getViewKey(viewModeObj, currentSearchParams);
const cached = viewKey ? photosCache.get(viewKey) : null;
if (cached) {
    setAllPhotosForCurrentFetch(cached);
    return; // skip backend load
}
loadPhotosWithCollection(viewModeObj);
```

- [ ] **Step 4: Commit**

```bash
git add src/App/PhotosList.jsx src/hooks/useViewModeSync.js
git commit -m "feat: wire usePhotosCache for view-mode switch instant restore"
```

---

## Task 10: Add View Cache UI to PerformanceTab

**Files:**
- Modify: `src/App/Preferences/tabs/PerformanceTab.jsx`

- [ ] **Step 1: Add inputs for the two limits**

The file is currently untracked (per git status). It either exists or needs to be created. Read it first:

Run: `cat src/App/Preferences/tabs/PerformanceTab.jsx | head -50`

Add fields for `view_cache_max_keys` (number input, default 10) and `view_cache_max_total_photos` (number input, default 50000), wired to `onConfigChange` like other settings in the tab.

- [ ] **Step 2: Commit**

```bash
git add src/App/Preferences/tabs/PerformanceTab.jsx
git commit -m "feat: surface view cache limits in PerformanceTab"
```

---

## Task 11: Cleanup `photoCollection` photos branch in `useFilteredPhotos`

This is already covered in Task 5 since the source branching was removed there. Verify no stragglers.

- [ ] **Step 1: Verify no leftover `photoCollection?.photos` references in grid path**

Run: `grep -rn "photoCollection?.photos" src --include="*.js" --include="*.jsx"`
Expected: No matches in `useFilteredPhotos.js`. Other matches (if any) are for metadata use only.

- [ ] **Step 2: Commit any cleanup if needed (likely no-op)**

---

## Task 12: Smoke test all view modes

**Files:** none (manual)

- [ ] **Step 1: Build + run dev**

Run: `pnpm tauri dev` (or `pnpm dev` for the web part)

- [ ] **Step 2: Verify**

For each view mode, verify the grid loads correctly:
- Home (date list)
- Album (open one)
- Tag (open one)
- Search (perform a search)
- Trash
- Person, Unknown faces
- Import

Check that:
- Switching between two views and back uses the cache (no "Loading your photos..." flash second time)
- Editing star/comment in grid (existing in-place updates) reflects immediately
- Filter (★ count, has comment) works in all modes (was previously broken in album/tag/search per spec)

- [ ] **Step 3: If issues found, fix in follow-up commits**

---

## Notes

- This plan assumes Phase 2 (instant PhotoDisplay close) follows immediately and will add the in-memory edit helpers for tags/albums/cssStyle/Save-as-Copy. Phase 1 alone is functional but tag/album edits during PhotoDisplay still require a refresh on close — that gap is closed in Phase 2.
- Keep an eye on `usePhotoLoader.js`'s `setPhotoCollection` path — it stays for `has_next` metadata; the filtered photos no longer flow through it.
