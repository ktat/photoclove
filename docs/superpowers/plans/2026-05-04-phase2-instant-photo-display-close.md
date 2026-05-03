# Phase 2: Instant Photo Display Close — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PhotoDisplay (個別写真ビュー) から PhotosList に戻る時の "Loading your photos..." を排除し、すべての編集 (★/コメント/タグ/アルバム/cssStyle/Save as Copy/削除) を in-memory list 操作で完結させる。

**Architecture:** `useFilteredPhotosSync` を `currentPhoto` で凍結し、各編集経路を「両配列 (`allPhotosForCurrentFetch` + `photosListMiniAllPhotos`) + View Cache を atomically patch する helper」に統一する。`closePhotoDisplay` は backend refetch を完全廃止し、必要なら `sortDirty` フラグ経由でローカル再ソートのみ行う。

**Tech Stack:** React 18 hooks, Tauri 2 IPC, Rust commands, pnpm, Vitest (frontend), cargo (backend)

**Spec:** `docs/superpowers/specs/2026-05-03-instant-photo-display-close-design.md`
**Phase 1 Plan (predecessor):** `docs/superpowers/plans/2026-05-04-phase1-photos-state-unification.md`

---

## File Structure (Created / Modified)

**Created:**
- `src/utils/PhotoSort.js` — sort comparator 共通 util。`getPhotoSortComparator(sortValue)` を export し import mode 用 / general mode 用を統合
- `src/utils/PhotoSort.test.js` — comparator のユニットテスト

**Modified:**
- `src/hooks/usePhotosState.js` — `sortDirty` state 追加
- `src/hooks/usePhotoDataSync.js` — `useFilteredPhotosSync` に `currentPhotoPath` gate
- `src/hooks/usePhotoListHelpers.js` — 新編集 helper 追加 (`updatePhotoTags`, `updatePhotoAlbums`, `updatePhotoCssStyle`, `addPhotoToList`, `handlePhotoRemovalNavigationBulk`)
- `src/hooks/usePhotoDisplay.js` — `closePhotoDisplay` から `refreshPhotos` 削除、`sortDirty` ローカル再ソート挿入
- `src/hooks/usePhotoOperations.js` — `handleAlbumDelete` をローカル除去版に変更
- `src/hooks/useTrashOperations.js` — `deletePhotos` 内で `photosListMiniAllPhotos` と navigation index も更新
- `src/hooks/useFilteredPhotos.js` — import mode の sort を `PhotoSort.js` に委譲 (DRY)
- `src/App/PhotosList.jsx` — 新 helper を作成して `PhotoOption` / `PhotosListMini` 等に props で配布
- `src/App/PhotosList/PhotoOption/PhotoTags.jsx` — `onPhotosRefresh` → `onTagsChanged(path, tags)` 置換、新規タグ作成時 cache クリア
- `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` — `Apply style` を `updatePhotoCssStyle` 経由、`Save as Copy` を `addPhotoToList` 経由に
- `src/App/PhotosList/PhotoOption/PhotoEditor/photoExportUtils.js` — `saveStyledCopy` の戻り値を JSON object 化対応、`onAddPhotoToList` callback を受ける
- `src/App/PhotosList/AlbumTab.jsx` — 既存 `onAlbumDelete` callback の挙動を変える呼び出し側のみ
- `src-tauri/src/commands/style_commands.rs` — `save_styled_copy_from_frontend` を JSON object 戻り値に変更

---

## Sort Comparator 仕様基準

`PhotoSort.js` の comparator はバックエンド DB クエリの sort 順序と一致する必要がある。基準は `src/utils/UIStateUtils.js:38-49` の `getSortConfig()`:

| sortValue | field | order | comparator |
|-----------|-------|-------|------------|
| 0 | `exif_date_time_original` | desc | `b.exif_date_time_original.localeCompare(a.exif_date_time_original)` (null は最後) |
| 1 | `exif_date_time_original` | asc | `a.exif_date_time_original.localeCompare(b.exif_date_time_original)` |
| 2 | `photo_date` (= `created_at` in JSON) | desc | `b.created_at.localeCompare(a.created_at)` |
| 3 | `photo_date` | asc | `a.created_at.localeCompare(b.created_at)` |
| 4 | `star` | desc | `b.star - a.star`、tie は `created_at` desc |
| 5 | `star` | asc | `a.star - b.star`、tie は `created_at` asc |
| 6 | `path` (= `originalPath`) | desc | `b.originalPath.localeCompare(a.originalPath)` |
| 7 | `path` | asc | `a.originalPath.localeCompare(b.originalPath)` |

`isStarSort(sortValue)` helper も提供する (= `sortValue === 4 || sortValue === 5`)。

---

## Task 1: PhotoSort util を作成 (テスト先行)

**Files:**
- Create: `src/utils/PhotoSort.js`
- Create: `src/utils/PhotoSort.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/PhotoSort.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getPhotoSortComparator, isStarSort, findInsertIndex } from './PhotoSort.js';

describe('getPhotoSortComparator', () => {
    const photos = [
        { originalPath: 'a/1.jpg', star: 3, created_at: '2024-01-03T00:00:00Z', exif_date_time_original: '2023-12-03T00:00:00Z', name: '1.jpg' },
        { originalPath: 'a/2.jpg', star: 5, created_at: '2024-01-01T00:00:00Z', exif_date_time_original: '2023-12-01T00:00:00Z', name: '2.jpg' },
        { originalPath: 'a/3.jpg', star: 0, created_at: '2024-01-02T00:00:00Z', exif_date_time_original: '2023-12-02T00:00:00Z', name: '3.jpg' },
    ];

    it('sortValue=0 sorts by exif_date_time_original desc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(0));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/3.jpg', 'a/2.jpg']);
    });

    it('sortValue=1 sorts by exif_date_time_original asc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(1));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/3.jpg', 'a/1.jpg']);
    });

    it('sortValue=2 sorts by created_at desc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(2));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/3.jpg', 'a/2.jpg']);
    });

    it('sortValue=4 sorts by star desc, tie by created_at desc', () => {
        const tied = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: 5, created_at: '2024-01-02T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 3, created_at: '2024-01-05T00:00:00Z' },
        ];
        const sorted = [...tied].sort(getPhotoSortComparator(4));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/1.jpg', 'a/3.jpg']);
    });

    it('sortValue=7 sorts by originalPath asc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(7));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/2.jpg', 'a/3.jpg']);
    });

    it('returns null for unknown sortValue', () => {
        expect(getPhotoSortComparator(999)).toBeNull();
    });
});

describe('isStarSort', () => {
    it('returns true for sortValue 4 and 5', () => {
        expect(isStarSort(4)).toBe(true);
        expect(isStarSort(5)).toBe(true);
    });

    it('returns false for non-star sort values', () => {
        expect(isStarSort(0)).toBe(false);
        expect(isStarSort(2)).toBe(false);
        expect(isStarSort(7)).toBe(false);
    });
});

describe('findInsertIndex', () => {
    it('inserts at correct position for star desc', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-05T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: 3, created_at: '2024-01-03T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 1, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 4, created_at: '2024-01-04T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(1);
    });

    it('returns 0 when inserting at start', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 3, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 5, created_at: '2024-01-02T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(0);
    });

    it('returns sorted.length when inserting at end', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 1, created_at: '2024-01-02T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(1);
    });

    it('falls back to length when comparator is null', () => {
        const sorted = [{ originalPath: 'a/1.jpg' }];
        const newPhoto = { originalPath: 'a/new.jpg' };
        const idx = findInsertIndex(sorted, newPhoto, null);
        expect(idx).toBe(1);
    });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm vitest run src/utils/PhotoSort.test.js
```

Expected: FAIL — `Cannot find module './PhotoSort.js'`

- [ ] **Step 3: PhotoSort.js を実装**

`src/utils/PhotoSort.js`:

```js
/**
 * Sort comparator helpers for photo arrays.
 *
 * Comparator basis matches backend DB query order in src/utils/UIStateUtils.js
 * getSortConfig(). Used both by useFilteredPhotos (import mode) and by
 * Phase 2 in-memory edit helpers (Save as Copy insert position + close-time
 * local re-sort when sortDirty).
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
 */
export function findInsertIndex(sortedPhotos, newPhoto, comparator) {
    if (!comparator) return sortedPhotos.length;
    let lo = 0;
    let hi = sortedPhotos.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (comparator(sortedPhotos[mid], newPhoto) <= 0) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}
```

- [ ] **Step 4: テストを通す**

```bash
pnpm vitest run src/utils/PhotoSort.test.js
```

Expected: PASS (全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/utils/PhotoSort.js src/utils/PhotoSort.test.js
git commit -m "feat(phase2): add PhotoSort util for shared sort comparator + insert position"
```

---

## Task 2: useFilteredPhotos の import sort を PhotoSort に委譲 (DRY)

**Files:**
- Modify: `src/hooks/useFilteredPhotos.js:65-95` (内部の `getImportSortComparator` を削除)

- [ ] **Step 1: 既存 useFilteredPhotos の sort logic を確認**

`useFilteredPhotos.js:67-94` の `getImportSortComparator` (sortValue 2/3/6/7) を `PhotoSort.js` の `getPhotoSortComparator` で置き換える。挙動は等価:
- 旧: `bTime.localeCompare(aTime)` (空文字 fallback) → 新: `cmpStr(b.created_at, a.created_at)` (`?? ''` fallback)
- 旧: `(b.name || '').localeCompare(a.name || '')` (sortValue=6/7) → 新: `cmpStr(b.originalPath, a.originalPath)`

**注意**: 旧コードは `name` フィールドで sort していたが、UIStateUtils の sortConfig は `path` (= `originalPath`) で sort する仕様。本タスクで `originalPath` に統一する (バックエンド一致)。

- [ ] **Step 2: useFilteredPhotos.js を編集**

```js
// src/hooks/useFilteredPhotos.js
import { useMemo } from 'react';
import { convertJSONToPhotoEntities } from '../utils/PhotoProcessingUtils.js';
import { getPhotoSortComparator } from '../utils/PhotoSort.js';
import { logger } from '../services/LoggerService.js';

export function useFilteredPhotos({
    viewModeObj,
    allPhotosForCurrentFetch,
    applyFiltersWithConfig,
    importSortOfPhotos,
    sortOfPhotos,
    appConfig
}) {
    return useMemo(() => {
        const sourcePhotos = allPhotosForCurrentFetch;

        logger.debug('useFilteredPhotos', 'source_selection', 'Using photo source for filtering', {
            mode: viewModeObj?.mode,
            sourceCount: sourcePhotos.length,
        });

        const photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);
        let result = applyFiltersWithConfig(photosWithMethods);

        if (viewModeObj?.isImportMode?.()) {
            const sortComparator = getPhotoSortComparator(importSortOfPhotos);
            if (sortComparator) {
                result = [...result].sort(sortComparator);
                logger.debug('useFilteredPhotos', 'import_sorted', 'Applied frontend sort to import photos', {
                    sortValue: importSortOfPhotos,
                    photoCount: result.length
                });
            }
        }

        logger.debug('useFilteredPhotos', 'filtering_complete', 'Filtering completed', {
            inputCount: sourcePhotos.length,
            outputCount: result.length
        });

        return result;
    }, [viewModeObj, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos, sortOfPhotos, appConfig]);
}

export default useFilteredPhotos;
```

(下部の `getImportSortComparator` 関数を削除)

- [ ] **Step 3: 動作確認 (lint + 型 check + テスト)**

```bash
pnpm lint && pnpm test
```

Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useFilteredPhotos.js
git commit -m "refactor(phase2): consolidate sort comparators into PhotoSort util"
```

---

## Task 3: usePhotosState に sortDirty state を追加

**Files:**
- Modify: `src/hooks/usePhotosState.js`

- [ ] **Step 1: state 追加**

`usePhotosState.js` の sorting state ブロック (line 84-86) に追加:

```js
// Sorting state
const [sortOfPhotos, setSort] = useState(0);
const sortInitialized = useRef(false);
// True when star edits have made the on-screen order stale relative to
// the current sort criterion. closePhotoDisplay reads this to decide
// whether to apply a local re-sort. Set by setStarWithUpdate when
// sortOfPhotos is star-based.
const [sortDirty, setSortDirty] = useState(false);
```

`return` ブロックの "Sorting" セクション (line 209-212) に追加:

```js
// Sorting
sortOfPhotos,
setSort,
sortInitialized,
sortDirty,
setSortDirty,
```

- [ ] **Step 2: lint 確認**

```bash
pnpm lint
```

Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/hooks/usePhotosState.js
git commit -m "feat(phase2): add sortDirty state for deferred local re-sort on close"
```

---

## Task 4: useFilteredPhotosSync を currentPhotoPath で凍結

**Files:**
- Modify: `src/hooks/usePhotoDataSync.js`

- [ ] **Step 1: useFilteredPhotosSync を更新**

`src/hooks/usePhotoDataSync.js` を全置換:

```js
/**
 * usePhotoDataSync Hook
 *
 * Manages synchronization between photo data and display state.
 * Extracted from PhotosList.jsx to reduce component complexity.
 *
 * Responsibilities:
 * - Convert filtered photos to JSON format for PhotosListMini
 * - Sync filtered photos with displayed photos
 * - Handle infinite scroll photo count updates
 * - Update photos list when displayed photos change
 *
 * Phase 2: While PhotoDisplay is open (currentPhotoPath != null) the
 * filtered-to-mini sync is FROZEN. Edit helpers (setStarWithUpdate,
 * updatePhotoTags, etc.) write photosListMiniAllPhotos directly so
 * navigation indices stay stable. The effect re-runs on close
 * (currentPhotoPath -> null), which reconciles the mini list with the
 * latest filter/sort result.
 */

import { useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

export function useFilteredPhotosSync({
    filteredPhotos,
    allPhotosForCurrentFetch,
    infiniteScrollEnabled,
    setPhotosListMiniAllPhotos,
    setDisplayedPhotoCount,
    currentPhotoPath
}) {
    useEffect(() => {
        if (currentPhotoPath) return; // freeze during PhotoDisplay
        if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
            const photosAsJSON = filteredPhotos
                .filter(photo => photo && typeof photo.toJSON === 'function')
                .map(photo => photo.toJSON());

            logger.debug('usePhotoDataSync', 'photos_json_conversion', 'Converting photos to JSON', {
                totalPhotos: filteredPhotos.length,
                validPhotos: photosAsJSON.length,
                skippedPhotos: filteredPhotos.length - photosAsJSON.length,
                firstPhotoType: filteredPhotos.length > 0 ? filteredPhotos[0].constructor.name : 'none',
                hasToJSONMethod: filteredPhotos.length > 0 ? typeof filteredPhotos[0].toJSON : 'none'
            });

            setPhotosListMiniAllPhotos(photosAsJSON);

            if (infiniteScrollEnabled) {
                setDisplayedPhotoCount(Math.min(50, filteredPhotos.length));
            }
        }
    }, [
        filteredPhotos,
        infiniteScrollEnabled,
        allPhotosForCurrentFetch,
        currentPhotoPath
    ]);
}

export function useDisplayedPhotosSync({
    displayedPhotos,
    setPhotosList
}) {
    useEffect(() => {
        if (displayedPhotos.length > 0) {
            setPhotosList({ photos: displayedPhotos, has_next: false, has_prev: false });
        }
    }, [displayedPhotos]);
}

export function usePhotoDataSync({
    filteredPhotos,
    displayedPhotos,
    allPhotosForCurrentFetch,
    infiniteScrollEnabled,
    setPhotosListMiniAllPhotos,
    setDisplayedPhotoCount,
    setPhotosList,
    currentPhotoPath
}) {
    useFilteredPhotosSync({
        filteredPhotos,
        allPhotosForCurrentFetch,
        infiniteScrollEnabled,
        setPhotosListMiniAllPhotos,
        setDisplayedPhotoCount,
        currentPhotoPath
    });

    useDisplayedPhotosSync({
        displayedPhotos,
        setPhotosList
    });
}

export default usePhotoDataSync;
```

- [ ] **Step 2: PhotosList.jsx の呼び出し側に currentPhotoPath を渡す**

`src/App/PhotosList.jsx` で `usePhotoDataSync` を呼んでいる箇所を grep:

```bash
grep -n "usePhotoDataSync\|useFilteredPhotosSync" src/App/PhotosList.jsx
```

呼び出し側に `currentPhotoPath: currentPhoto?.originalPath` を追加 (currentPhoto は既に scope にある)。

- [ ] **Step 3: 動作確認**

```bash
pnpm lint && pnpm test
```

Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/hooks/usePhotoDataSync.js src/App/PhotosList.jsx
git commit -m "feat(phase2): freeze filtered-to-mini sync while PhotoDisplay is open"
```

---

## Task 5: バックエンドの save_styled_copy_from_frontend を JSON object 戻り値に変更

**Files:**
- Modify: `src-tauri/src/commands/style_commands.rs:78-193`

- [ ] **Step 1: 戻り値を JSON object 化**

`src-tauri/src/commands/style_commands.rs` の `save_styled_copy_from_frontend` の末尾 `Ok(new_rel_path_str)` (line 192) と早期 return (line 113-115) を JSON 文字列を返すよう変更。

新しい戻り値構造:
```json
{
  "newPhotoPath": "<relative path>",
  "createdAt": "<ISO8601>",
  "hasThumbnail": false,
  "metaData": null,
  "star": <int>,
  "comment": "<string>",
  "tags": []
}
```

実装:

```rust
// (file 上部に追加)
use serde_json::json;
use chrono::Utc;

// ... 既存コード ...

#[tauri::command]
pub async fn save_styled_copy_from_frontend(
    original_photo_path: &str,
    css_style: &str,
    image_data: &str,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // ... 既存の hash 計算、path 生成 ... (変更なし)

    // 4. Check if styled copy already exists
    if new_abs_path.exists() {
        // 既存ファイルでも JSON 形式で返す
        let original_photo = photo::Photo::new(
            file::File::from_relative(original_photo_path.to_string()),
            None,
        );
        let original_meta = state.meta_db.get_photo_meta(original_photo);
        let now_iso = Utc::now().to_rfc3339();
        return Ok(json!({
            "newPhotoPath": new_rel_path_str,
            "createdAt": now_iso,
            "hasThumbnail": false,
            "metaData": null,
            "star": original_meta.star.star(),
            "comment": original_meta.comment.comment(),
            "tags": [],
            "cssStyle": css_style,
        }).to_string());
    }

    // ... 既存の image write、record_photos_meta_data、star/comment コピー ... (変更なし)

    // 9. Generate thumbnail asynchronously (変更なし)

    // Check first_edit achievement (変更なし)

    // 10. JSON object を返す (元の Ok(new_rel_path_str) を置換)
    let now_iso = Utc::now().to_rfc3339();
    Ok(json!({
        "newPhotoPath": new_rel_path_str,
        "createdAt": now_iso,
        "hasThumbnail": false,
        "metaData": null,
        "star": original_meta.star.star(),
        "comment": original_meta.comment.comment(),
        "tags": [],
        "cssStyle": css_style,
    }).to_string())
}
```

**注**: `original_meta` は line 136 で取得済 (consumed されない、`get_photo_meta` の signature 確認後 borrow なら問題なし。consumed していたら early return 用に再 fetch、または Result<>パターンで分岐)。

- [ ] **Step 2: Cargo.toml に chrono が無ければ追加 (既にある可能性高)**

```bash
grep -n "chrono\|serde_json" src-tauri/Cargo.toml
```

`chrono` と `serde_json` がなければ追加:
```toml
chrono = { version = "0.4", features = ["serde"] }
serde_json = "1.0"
```

- [ ] **Step 3: cargo check**

```bash
cd src-tauri && cargo check
```

Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src-tauri/src/commands/style_commands.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(phase2): return JSON metadata from save_styled_copy_from_frontend"
```

---

## Task 6: usePhotoListHelpers に updatePhotoTags helper を追加

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js`

- [ ] **Step 1: updatePhotoTags helper を追加**

`usePhotoListHelpers.js` の `updatePhotoComment` の直後 (line 146 あたり) に追加:

```js
/**
 * Update tags for a photo in both the grid (allPhotosForCurrentFetch),
 * the navigation strip (photosListMiniAllPhotos), and the View Cache.
 *
 * Tag arrays don't change array length or sort order, so navigation
 * indices stay valid. The hasTagFilter filter (in useFilteredPhotos)
 * will exclude/include the photo automatically post-close.
 *
 * @param {string} photoPath
 * @param {Array<{id, name, color}>} tagsArray
 */
const updatePhotoTags = useCallback((photoPath, tagsArray) => {
    setPhotosListMiniAllPhotos(prev => prev.map(photoJSON =>
        photoJSON.originalPath === photoPath
            ? { ...photoJSON, tags: tagsArray }
            : photoJSON
    ));
    setAllPhotosForCurrentFetch(prev => prev.map(photo =>
        photo.originalPath === photoPath
            ? { ...photo, tags: tagsArray }
            : photo
    ));
    patchCacheCurrentView(prev => prev.map(photo =>
        photo.originalPath === photoPath
            ? { ...photo, tags: tagsArray }
            : photo
    ));
}, [setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, patchCacheCurrentView]);
```

`return` 文に `updatePhotoTags` を追加:

```js
return {
    setStarWithUpdate,
    updatePhotoComment,
    updatePhotoTags,
    handleAlbumUpdate,
    addSelection,
    toggleSelection,
    selectAllPhotoToSelection
};
```

- [ ] **Step 2: lint**

```bash
pnpm lint
```

Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/hooks/usePhotoListHelpers.js
git commit -m "feat(phase2): add updatePhotoTags helper for in-memory tag updates"
```

---

## Task 7: PhotoTags を onTagsChanged callback で配線、新規タグ作成時 cache クリア

**Files:**
- Modify: `src/App/PhotosList/PhotoOption/PhotoTags.jsx`
- Modify: `src/App/PhotosList.jsx` (PhotoOption への props 追加)
- Modify: `src/App/PhotosList/PhotoOption.jsx` (props 中継)

- [ ] **Step 1: PhotoTags の signature を変更**

`src/App/PhotosList/PhotoOption/PhotoTags.jsx`:

```js
import { unifiedCollectionService } from '../../../services/UnifiedCollectionService.js';

function PhotoTags({ currentPhoto, addFooterMessage, onTagsChanged }) {
    // ...既存の state, useEffect, loadPhotoTags はそのまま

    const handleTagsChange = async (newTags) => {
        setPhotoTags(newTags);
        addFooterMessage?.(t('photoTags.tagsUpdated', { count: newTags.length }));

        // Propagate to grid/mini state so close returns instantly with
        // the change visible (Phase 2: replaces onPhotosRefresh refetch).
        if (currentPhotoPath && onTagsChanged) {
            // newTags is the TagSelector format [{id,name,color,...}]; the
            // grid Photo entity expects the same shape (Photo.tags).
            onTagsChanged(currentPhotoPath, newTags);
        }

        // If a brand-new tag was created via TagSelector, the unified
        // collection service cache is now stale. Clearing it forces a
        // refetch on next access (30s TTL anyway). New-tag creation is
        // rare so a full clear is the simplest correct option.
        const hasNewTag = newTags.some(t => !!t.justCreated);
        if (hasNewTag) {
            unifiedCollectionService.clearCache();
        }

        logger.info('PhotoTags', 'tags_updated', 'Photo tags updated in viewer', {
            photoPath: currentPhotoPath,
            tagCount: newTags.length,
            hasNewTag
        });
    };

    // ...残り変更なし
}
```

(`onPhotosRefresh` プロップ参照は削除)

- [ ] **Step 2: TagSelector が新規作成タグに `justCreated: true` を付けるか確認**

```bash
grep -n "justCreated\|create.*tag\|createTag" src/components/TagSelector.jsx | head -10
```

存在しなければ TagSelector 側で「新規作成された tag に `justCreated: true` を付けて返す」修正が必要。TagSelector の `onTagsChange` payload を patch:

```js
// TagSelector.jsx 内、新規 tag 作成して selectedTags に追加する箇所
const handleCreateNewTag = async (name) => {
    const newTagId = await invoke('create_collection', { name, kind: 'Tag' });
    const newTag = { id: newTagId, name, color: null, justCreated: true };
    onTagsChange([...selectedTags, newTag]);
};
```

(実装の詳細は TagSelector.jsx を確認して合わせる。`justCreated` flag が立つ条件は「コンポーネントの create flow を通った場合のみ」)

- [ ] **Step 3: PhotoOption.jsx で onTagsChanged を中継**

`src/App/PhotosList/PhotoOption.jsx` で `<PhotoTags>` を呼んでいる箇所を grep:

```bash
grep -n "PhotoTags\b" src/App/PhotosList/PhotoOption.jsx
```

`onPhotosRefresh={...}` を `onTagsChanged={onTagsChanged}` に置換。`PhotoOption` の props にも `onTagsChanged` を追加。

- [ ] **Step 4: PhotosList.jsx で onTagsChanged を渡す**

`src/App/PhotosList.jsx:608-630` の `<PhotoOption>` 呼び出しで:
- `onPhotosRefresh={refreshPhotosOnly}` を削除
- `onTagsChanged={updatePhotoTags}` を追加

`usePhotoListHelpers` の return から `updatePhotoTags` を分割代入で受け取る (line 230 あたり、`setStarWithUpdate, updatePhotoComment, ...` のところ)。

- [ ] **Step 5: 動作確認**

```bash
pnpm lint && pnpm test
```

Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/App/PhotosList/PhotoOption/PhotoTags.jsx src/App/PhotosList/PhotoOption.jsx src/App/PhotosList.jsx src/components/TagSelector.jsx
git commit -m "feat(phase2): wire PhotoTags through updatePhotoTags + cache clear on new-tag"
```

---

## Task 8: updatePhotoAlbums helper + AlbumTab 配線

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js`
- Modify: `src/App/PhotosList/AlbumTab.jsx`
- Modify: `src/App/PhotosList/PhotoOption.jsx`
- Modify: `src/App/PhotosList.jsx`

- [ ] **Step 1: updatePhotoAlbums helper 追加**

`usePhotoListHelpers.js` の `updatePhotoTags` の直後に追加:

```js
/**
 * Update album membership for a photo. albumIds is the FULL new list
 * of album IDs the photo belongs to (helper is non-additive — caller
 * computes the new array). inAlbum is a derived "membership in any
 * album" boolean used by some filters / UI badges.
 *
 * @param {string} photoPath
 * @param {string[]} albumIds
 */
const updatePhotoAlbums = useCallback((photoPath, albumIds) => {
    const inAlbum = albumIds.length > 0;
    const apply = (photo) => photo.originalPath === photoPath
        ? { ...photo, albumId: albumIds[0] ?? null, inAlbum }
        : photo;

    setPhotosListMiniAllPhotos(prev => prev.map(apply));
    setAllPhotosForCurrentFetch(prev => prev.map(apply));
    patchCacheCurrentView(prev => prev.map(apply));
}, [setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, patchCacheCurrentView]);
```

return に追加:

```js
return {
    setStarWithUpdate,
    updatePhotoComment,
    updatePhotoTags,
    updatePhotoAlbums,
    handleAlbumUpdate,
    // ...
};
```

- [ ] **Step 2: AlbumTab の add/remove に callback 渡す**

`src/App/PhotosList/AlbumTab.jsx` の signature を:

```jsx
const AlbumTab = ({ albumId, currentPhoto, onAlbumUpdate, onAlbumDelete, onAlbumMembershipChanged }) => {
```

album add/remove 操作の完了後 (現状はどこで呼ばれているか確認):

```bash
grep -n "add_photo_to_album\|remove_photo_from_album" src/App/PhotosList/AlbumTab.jsx
```

該当しなければ AlbumTab は読み取り専用の可能性 — その場合は **Step 2 はスキップ**。実際に photo の album add/remove を行うコンポーネント (`useDeletionOperations.js`、`usePhotoOperations.js` の `handleAddToAlbum`/`removePhotoFromAlbum`) の完了 callback として `onAlbumMembershipChanged?.(photoPath, newAlbumIds)` を呼ぶ:

```js
// usePhotoOperations.js handleAddToAlbum/removePhotoFromAlbum
const handleAddToAlbum = useCallback(async (photoPath, albumId) => {
    try {
        await invoke("add_photo_to_album", { albumId, photoPath });
        addFooterMessage('album_op', 'Photo added to album');
        if (updatePhotoAlbums) {
            // get current albumIds for the photo and append
            const currentPhotoData = photosListMiniAllPhotos.find(p => p.originalPath === photoPath);
            const currentIds = currentPhotoData?.albumId ? [currentPhotoData.albumId] : [];
            updatePhotoAlbums(photoPath, [...new Set([...currentIds, albumId])]);
        }
        return true;
    } catch (error) {
        handleError(error, 'Add photo to album', { photoPath, albumId });
        return false;
    }
}, [handleError, addFooterMessage, updatePhotoAlbums, photosListMiniAllPhotos]);
```

`usePhotoOperations.js` の deps に `updatePhotoAlbums` と `photosListMiniAllPhotos` を追加。

**注**: 現状 `Photo.albumId` は単一 ID (Photo.js:29) なので、複数アルバム所属はサポートされていない可能性。データモデル確認:

```bash
grep -n "albumId" src/domain/Photo.js
```

→ `albumId` は単一 string、`inAlbum` は bool。実用上「最後に入れた / そのとき表示している album の ID」を持つ。Phase 2 では現状の単一フィールドの意味を保って、`updatePhotoAlbums(path, [albumId])` で `albumId = albumId, inAlbum = true`、`updatePhotoAlbums(path, [])` で `albumId = null, inAlbum = false` の挙動とする (helper 実装は上の通り)。

- [ ] **Step 3: PhotoOption で props 中継**

`src/App/PhotosList/PhotoOption.jsx` の `<AlbumTab>` 呼び出しに props を追加:

```bash
grep -n "AlbumTab\b" src/App/PhotosList/PhotoOption.jsx
```

(AlbumTab が単独で album add/remove していないなら本ステップはスキップ)

- [ ] **Step 4: PhotosList.jsx で updatePhotoAlbums を usePhotoOperations に渡す**

`src/App/PhotosList.jsx` で `usePhotoOperations({ ... })` の引数に `updatePhotoAlbums` を追加し、`usePhotoListHelpers` の return から取得する。

- [ ] **Step 5: 動作確認**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 6: コミット**

```bash
git add src/hooks/usePhotoListHelpers.js src/hooks/usePhotoOperations.js src/App/PhotosList.jsx src/App/PhotosList/PhotoOption.jsx
git commit -m "feat(phase2): add updatePhotoAlbums helper for in-memory album updates"
```

---

## Task 9: handleAlbumDelete をローカル除去版に変更

**Files:**
- Modify: `src/hooks/usePhotoOperations.js:306-311`
- Modify: `src/App/PhotosList.jsx` (album list state を渡す)

- [ ] **Step 1: handleAlbumDelete を書き換え**

`src/hooks/usePhotoOperations.js`:

```js
// existing usePhotoOperations params に albumsList, updateAlbumsList, setFilteredAlbums を追加
const handleAlbumDelete = useCallback((deletedAlbumId) => {
    if (deletedAlbumId === currentAlbumId) {
        // currentAlbumId だった場合は album-list view に戻す。
        // useAutoClosePhotoDisplayEffect が viewMode 変化を検知して
        // PhotoDisplay も auto-close する。
        toggleAlbumListMode();
    }
    if (updateAlbumsList) {
        updateAlbumsList(prev => prev.filter(a => a.id !== deletedAlbumId));
    }
    if (setFilteredAlbums) {
        setFilteredAlbums(prev => prev.filter(a => a.id !== deletedAlbumId));
    }
    // Trigger refetch on next getAlbums() call (30s TTL applies anyway).
    unifiedCollectionService.clearCache();
}, [currentAlbumId, toggleAlbumListMode, updateAlbumsList, setFilteredAlbums]);
```

(`loadAlbums()` 呼び出しを削除)

- [ ] **Step 2: 必要な setter を usePhotoOperations の引数に追加**

`usePhotoOperations` の destructured props と JSDoc に `albumsList`/`updateAlbumsList`/`setFilteredAlbums` を追加。

- [ ] **Step 3: PhotosList.jsx 呼び出し側を更新**

`src/App/PhotosList.jsx` で `usePhotoOperations({...})` に `albumsList`, `updateAlbumsList: setAlbumsList`, `setFilteredAlbums` を渡す (それぞれ既に scope にあるはず — `useAlbumsManagement` 等から)。

```bash
grep -n "albumsList\|setAlbumsList\|setFilteredAlbums" src/App/PhotosList.jsx | head -10
```

- [ ] **Step 4: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePhotoOperations.js src/App/PhotosList.jsx
git commit -m "feat(phase2): handleAlbumDelete uses local removal + cache clear (no refetch)"
```

---

## Task 10: updatePhotoCssStyle helper + PhotoEditor "Apply style" 配線

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js`
- Modify: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- Modify: `src/App/PhotosList/PhotoOption.jsx`
- Modify: `src/App/PhotosList.jsx`

- [ ] **Step 1: updatePhotoCssStyle helper 追加**

`usePhotoListHelpers.js` の `updatePhotoAlbums` の直後:

```js
/**
 * Update cssStyle (saved CSS transform/filter/clip-path) for a photo.
 * Persists to backend separately (save_css_style); this helper only
 * updates in-memory state.
 *
 * Backend regenerates the thumbnail asynchronously. Grid display reads
 * cssStyle live from in-memory photo data, so the visual update lands
 * immediately on close. Thumbnail refresh requires a separate event
 * subscription (out of scope for Phase 2 — see spec section 8 risk note).
 *
 * @param {string} photoPath
 * @param {string} css
 */
const updatePhotoCssStyle = useCallback((photoPath, css) => {
    const apply = (photo) => photo.originalPath === photoPath
        ? { ...photo, css_style: css, cssStyle: css }
        : photo;

    setPhotosListMiniAllPhotos(prev => prev.map(apply));
    setAllPhotosForCurrentFetch(prev => prev.map(apply));
    patchCacheCurrentView(prev => prev.map(apply));
}, [setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, patchCacheCurrentView]);
```

return 文に `updatePhotoCssStyle` 追加。

**注**: Photo.js は内部 `cssStyle` (camelCase, line 19) と JSON 形式 `css_style` (snake_case) を持つ。両配列は JSON 形式 (snake_case) で持っているはずだが、念のため両方 set する。

- [ ] **Step 2: PhotoEditor.jsx の applyStyle で helper を呼ぶ**

`src/App/PhotosList/PhotoOption/PhotoEditor.jsx:197-222`:

```js
async function applyStyle() {
    if (!currentPhotoPath) {
        props.addFooterMessage('editor', t('photoEditor.selectPhotoFirst'), false, 3000);
        return;
    }

    const css = generateCSS();
    if (!css) {
        props.addFooterMessage('editor', t('photoEditor.noStylesToApply'), false, 3000);
        return;
    }

    try {
        await invoke('save_css_style', {
            photoPath: currentPhotoPath,
            cssStyle: css
        });
        setSavedCssStyle(css);
        // Reflect cssStyle change in grid/mini/cache so close returns
        // instantly without a refetch.
        props.onCssStyleUpdate?.(currentPhotoPath, css);
        props.setEditorHasUnsavedChanges?.(false);
        props.addFooterMessage('editor', t('photoEditor.styleApplied'), false, 3000);
    } catch (error) {
        logger.error('PhotoEditor', 'style_apply_failed', 'Failed to apply style', { error: error.message });
        props.addFooterMessage('editor', t('photoEditor.styleFailed'), false, 3000);
    }
}
```

- [ ] **Step 3: PhotoOption.jsx で onCssStyleUpdate を中継**

`<PhotoEditor>` の props に `onCssStyleUpdate={onCssStyleUpdate}` を追加。`PhotoOption` の props にも `onCssStyleUpdate` を追加して受け取り。

- [ ] **Step 4: PhotosList.jsx で updatePhotoCssStyle を渡す**

`<PhotoOption>` の props に `onCssStyleUpdate={updatePhotoCssStyle}` 追加。`usePhotoListHelpers` の destructured return から取得。

- [ ] **Step 5: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 6: コミット**

```bash
git add src/hooks/usePhotoListHelpers.js src/App/PhotosList/PhotoOption/PhotoEditor.jsx src/App/PhotosList/PhotoOption.jsx src/App/PhotosList.jsx
git commit -m "feat(phase2): wire PhotoEditor 'Apply style' through updatePhotoCssStyle"
```

---

## Task 11: setStarWithUpdate に sortDirty 連動を追加

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js`
- Modify: `src/App/PhotosList.jsx`

- [ ] **Step 1: usePhotoListHelpers の signature に sortOfPhotos / setSortDirty を追加**

`usePhotoListHelpers` の destructured props 末尾に追加:

```js
// 既存 ...
photosCache,
currentViewKey,
sortOfPhotos,
setSortDirty
```

- [ ] **Step 2: setStarWithUpdate を更新**

```js
import { isStarSort } from '../utils/PhotoSort.js';

const setStarWithUpdate = useCallback((newStar) => {
    setStar(newStar);

    let starValue = 0;
    for (let i = 0; i < 5; i++) {
        if (newStar[i]) {
            starValue = i + 1;
        } else {
            break;
        }
    }

    setPhotosListMiniAllPhotos(prev => prev.map(photoJSON => {
        if (photoJSON.originalPath === currentPhoto?.originalPath) {
            return { ...photoJSON, star: starValue };
        }
        return photoJSON;
    }));

    setAllPhotosForCurrentFetch(prev => prev.map(photo => {
        if (photo.originalPath === currentPhoto?.originalPath) {
            return { ...photo, star: starValue };
        }
        return photo;
    }));

    patchCacheCurrentView(prev => prev.map(photo => {
        if (photo.originalPath === currentPhoto?.originalPath) {
            return { ...photo, star: starValue };
        }
        return photo;
    }));

    // If current sort is star-based, the on-screen order is now stale.
    // closePhotoDisplay will apply a local re-sort (Task 14).
    if (isStarSort(sortOfPhotos)) {
        setSortDirty(true);
    }
}, [setStar, setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, currentPhoto, patchCacheCurrentView, sortOfPhotos, setSortDirty]);
```

(既存の `photosListMiniAllPhotos` / `allPhotosForCurrentFetch` の deps を `setX` 経由の functional update に変えたので除去)

- [ ] **Step 3: PhotosList.jsx で sortOfPhotos / setSortDirty を渡す**

`usePhotoListHelpers({...})` 呼び出し箇所に:

```js
const { setStarWithUpdate, updatePhotoComment, updatePhotoTags, updatePhotoAlbums, updatePhotoCssStyle, ... } = usePhotoListHelpers({
    // ...既存
    sortOfPhotos,
    setSortDirty,
});
```

`usePhotosState` の return から `sortDirty`, `setSortDirty` を分割代入で受け取る (line 130 あたりの `usePhotosState()` destructure に追加)。

- [ ] **Step 4: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePhotoListHelpers.js src/App/PhotosList.jsx
git commit -m "feat(phase2): mark sortDirty when star edits would invalidate star sort"
```

---

## Task 12: addPhotoToList helper (Save as Copy 経路)

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js`
- Modify: `src/App/PhotosList/PhotoOption/PhotoEditor/photoExportUtils.js`
- Modify: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- Modify: `src/App/PhotosList/PhotoOption.jsx`
- Modify: `src/App/PhotosList.jsx`

- [ ] **Step 1: 必要な追加 props を usePhotoListHelpers に**

```js
// usePhotoListHelpers destructured props:
// - currentPhotoIndex, setCurrentPhotoIndex
// - photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex
// - displayedPhotoCount, setDisplayedPhotoCount
// - sortDirty, setSortDirty (既に Task 11 で追加済)
// - infiniteScrollEnabled
```

- [ ] **Step 2: addPhotoToList を usePhotoListHelpers に追加**

```js
import { getPhotoSortComparator, findInsertIndex } from '../utils/PhotoSort.js';

/**
 * Insert a newly created photo (Save as Copy result) into both the grid
 * (allPhotosForCurrentFetch) and the navigation strip
 * (photosListMiniAllPhotos) at the position dictated by current sort.
 *
 * - Backend `save_styled_copy_from_frontend` returns metadata as JSON;
 *   newPhotoData should include originalPath, created_at, star,
 *   comment, tags, css_style.
 * - currentPhoto entity stays unchanged (Photo identity preserved).
 * - If sortDirty is true (star edits made order stale) we apply a
 *   local re-sort first so binary-search runs against a sorted array.
 *
 * @param {object} newPhotoData JSON-shape photo (matches Photo.toJSON())
 */
const addPhotoToList = useCallback((newPhotoData) => {
    const comparator = getPhotoSortComparator(sortOfPhotos);

    // If sortDirty, re-sort first so insert position calculation is accurate.
    let workingAll = allPhotosForCurrentFetch;
    let workingMini = photosListMiniAllPhotos;
    if (sortDirty && comparator) {
        workingAll = [...allPhotosForCurrentFetch].sort(comparator);
        workingMini = [...photosListMiniAllPhotos].sort(comparator);
        setAllPhotosForCurrentFetch(workingAll);
        setPhotosListMiniAllPhotos(workingMini);
        setSortDirty(false);
    }

    const insertIdxAll = findInsertIndex(workingAll, newPhotoData, comparator);
    const insertIdxMini = findInsertIndex(workingMini, newPhotoData, comparator);

    setAllPhotosForCurrentFetch(prev => {
        const next = [...prev];
        next.splice(insertIdxAll, 0, newPhotoData);
        return next;
    });
    setPhotosListMiniAllPhotos(prev => {
        const next = [...prev];
        next.splice(insertIdxMini, 0, newPhotoData);
        return next;
    });

    // View Cache patch: insert into the cached array using the same idx.
    patchCacheCurrentView(prev => {
        const next = [...prev];
        const cacheIdx = findInsertIndex(next, newPhotoData, comparator);
        next.splice(cacheIdx, 0, newPhotoData);
        return next;
    });

    // Adjust navigation indices: any insert at or before the current
    // index pushes the current photo right by 1.
    if (insertIdxMini <= (photosListMiniCurrentIndex ?? 0)) {
        setPhotosListMiniCurrentIndex(prev => (prev ?? 0) + 1);
    }
    if (insertIdxAll <= (currentPhotoIndex ?? 0)) {
        setCurrentPhotoIndex(prev => (prev ?? 0) + 1);
    }

    // Infinite scroll: if the insertion landed within the visible window,
    // bump displayedPhotoCount so the new photo isn't silently hidden.
    if (infiniteScrollEnabled && insertIdxMini < displayedPhotoCount) {
        setDisplayedPhotoCount(prev => prev + 1);
    }
}, [
    sortOfPhotos,
    sortDirty,
    setSortDirty,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    patchCacheCurrentView,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    displayedPhotoCount,
    setDisplayedPhotoCount,
    infiniteScrollEnabled
]);
```

return に `addPhotoToList` 追加。

- [ ] **Step 3: photoExportUtils.js の saveStyledCopy を JSON 戻り値対応**

`src/App/PhotosList/PhotoOption/PhotoEditor/photoExportUtils.js:226-258`:

```js
export async function saveStyledCopy({ mainImage, editorStyles, photoPath, cssStyle, addFooterMessage, onAddPhotoToList }) {
    try {
        const canvas = await createStyledCanvas(mainImage, editorStyles);
        const base64Data = await canvasToBase64(canvas, 'image/jpeg', 0.95);

        const resultJson = await invoke('save_styled_copy_from_frontend', {
            originalPhotoPath: photoPath,
            cssStyle: cssStyle,
            imageData: base64Data
        });

        // Backend now returns a JSON object with full metadata (Phase 2).
        const result = JSON.parse(resultJson);
        const newPhotoPath = result.newPhotoPath;
        const newFilename = newPhotoPath.split('/').pop();
        addFooterMessage('editor', `Styled copy created: ${newFilename}`, false, 5000);

        // Insert into the in-memory grid + mini list (Phase 2: replaces
        // the old onPhotosRefresh refetch).
        if (onAddPhotoToList) {
            const newPhotoData = {
                originalPath: newPhotoPath,
                name: newFilename,
                created_at: result.createdAt,
                exif_date_time_original: null,
                star: result.star ?? 0,
                comment: result.comment ?? '',
                tags: result.tags ?? [],
                css_style: result.cssStyle ?? cssStyle,
                metaData: result.metaData ?? null,
                hasThumbnail: result.hasThumbnail ?? false,
                inAlbum: false,
                albumId: null,
            };
            onAddPhotoToList(newPhotoData);
        }

        // Refresh date sidebar count.
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('refreshDates'));
        }

        return newPhotoPath;
    } catch (error) {
        logger.error('PhotoExport', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
        throw error;
    }
}
```

- [ ] **Step 4: PhotoEditor.jsx の saveAsCopy が onAddPhotoToList を渡す**

`src/App/PhotosList/PhotoOption/PhotoEditor.jsx:245-252`:

```js
await saveStyledCopy({
    mainImage,
    editorStyles,
    photoPath: currentPhotoPath,
    cssStyle: css,
    addFooterMessage: props.addFooterMessage,
    onAddPhotoToList: props.onAddPhotoToList
});
```

(`onPhotosRefresh: props.onPhotosRefresh` を削除)

- [ ] **Step 5: PhotoOption.jsx で onAddPhotoToList を中継**

`<PhotoEditor>` の props に `onAddPhotoToList={onAddPhotoToList}` を追加。`PhotoOption` の signature にも追加。

- [ ] **Step 6: PhotosList.jsx で addPhotoToList を渡す**

`<PhotoOption>` の props に `onAddPhotoToList={addPhotoToList}` を追加。`usePhotoListHelpers` の destructure に `addPhotoToList` を追加。

- [ ] **Step 7: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 8: コミット**

```bash
git add src/hooks/usePhotoListHelpers.js src/App/PhotosList/PhotoOption/PhotoEditor/photoExportUtils.js src/App/PhotosList/PhotoOption/PhotoEditor.jsx src/App/PhotosList/PhotoOption.jsx src/App/PhotosList.jsx
git commit -m "feat(phase2): wire Save as Copy through addPhotoToList helper (no refetch)"
```

---

## Task 13: 一括削除 helper (handlePhotoRemovalNavigationBulk)

**Files:**
- Modify: `src/hooks/usePhotoListHelpers.js` (or `usePhotoOperations.js` — see step 1)
- Modify: `src/hooks/useTrashOperations.js`

- [ ] **Step 1: 配置先の決定**

bulk navigation 調整は `usePhotoOperations` 内の `handlePhotoRemovalNavigation` (line 79-131) と密結合する。同じファイル (`usePhotoOperations.js`) に追加する方が一貫性が高い。

- [ ] **Step 2: usePhotoOperations に追加**

`src/hooks/usePhotoOperations.js` の `handlePhotoRemovalNavigation` の直後 (line 132 後) に追加:

```js
/**
 * Bulk version of handlePhotoRemovalNavigation: removes multiple
 * photos by path, recomputes navigation index in O(N+M).
 *
 * @param {string[]} paths
 * @returns {{newAllPhotos: object[], newCurrentIndex: number} | null}
 *          state for rollback (null if nothing removed)
 */
const handlePhotoRemovalNavigationBulk = useCallback((paths) => {
    if (!paths || paths.length === 0) return null;
    if (!photosListMiniAllPhotos || photosListMiniAllPhotos.length === 0) return null;

    const pathSet = new Set(paths);
    const indexBeforeCurrent = []; // count of removed photos before currentPhotoIndex
    let currentIsRemoved = false;

    for (let i = 0; i < photosListMiniAllPhotos.length; i++) {
        const path = getPhotoPath(photosListMiniAllPhotos[i]);
        if (pathSet.has(path)) {
            if (i < currentPhotoIndex) indexBeforeCurrent.push(i);
            else if (i === currentPhotoIndex) currentIsRemoved = true;
        }
    }

    const newAllPhotos = photosListMiniAllPhotos.filter(p => !pathSet.has(getPhotoPath(p)));
    setPhotosListMiniAllPhotos(newAllPhotos);

    if (allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
        const updatedAllPhotos = allPhotosForCurrentFetch.filter(
            photo => !pathSet.has(getPhotoPath(photo))
        );
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    }

    if (newAllPhotos.length === 0) {
        if (closePhotoDisplay) closePhotoDisplay();
        return { newAllPhotos: [], newCurrentIndex: -1 };
    }

    let newIndex;
    if (currentIsRemoved) {
        // Same logic as single-removal: stay at index (= next photo) or
        // step back if we were at the end.
        const proposed = currentPhotoIndex - indexBeforeCurrent.length;
        newIndex = proposed >= newAllPhotos.length ? newAllPhotos.length - 1 : proposed;
    } else {
        newIndex = currentPhotoIndex - indexBeforeCurrent.length;
    }

    const newPhoto = newAllPhotos[newIndex];
    if (newPhoto) {
        const newPhotoEntity = newPhoto instanceof Photo ? newPhoto : Photo.fromJSON(newPhoto);
        if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(newIndex);
        if (setCurrentPhoto) setCurrentPhoto(newPhotoEntity);
        if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
    }

    return { newAllPhotos, newCurrentIndex: newIndex };
}, [
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    currentPhotoIndex,
    closePhotoDisplay
]);
```

return に `handlePhotoRemovalNavigationBulk` 追加。

- [ ] **Step 3: useTrashOperations.deletePhotos でこの helper を使う**

`src/hooks/useTrashOperations.js` の `deletePhotos` の signature と挙動を拡張:

```js
export function useTrashOperations({
    // ...既存 props
    handlePhotoRemovalNavigationBulk,  // 新規 (optional)
    photosListMiniAllPhotos,             // 新規 (rollback 用)
    setPhotosListMiniAllPhotos,         // 新規 (rollback 用)
    photosListMiniCurrentIndex,         // 新規 (rollback 用)
    setPhotosListMiniCurrentIndex,      // 新規 (rollback 用)
    currentPhotoIndex,                  // 新規 (rollback 用)
    setCurrentPhotoIndex,               // 新規 (rollback 用)
    currentPhoto,                       // 新規 (rollback 用 — restore photo entity)
    setCurrentPhoto,                    // 新規 (rollback 用)
}) {
    const deletePhotos = useCallback(async (paths, { skipConfirmation = false, clearSelection = true } = {}) => {
        // ...既存 confirm/log

        if (!paths || paths.length === 0) {
            addFooterMessage('trash', 'No photos to delete');
            return false;
        }

        const count = paths.length;

        try {
            const deletedPaths = [...paths];
            const photosBackup = allPhotosForCurrentFetch ? [...allPhotosForCurrentFetch] : null;

            // Phase 2: also back up mini list + navigation indices for
            // rollback symmetry when PhotoDisplay is open.
            const miniPhotosBackup = photosListMiniAllPhotos ? [...photosListMiniAllPhotos] : null;
            const miniIndexBackup = photosListMiniCurrentIndex;
            const currentIndexBackup = currentPhotoIndex;
            const currentPhotoBackup = currentPhoto;

            // Optimistic update: use bulk helper if available (PhotoDisplay
            // mode), else fall back to plain filter on allPhotos.
            if (currentPhoto && handlePhotoRemovalNavigationBulk) {
                handlePhotoRemovalNavigationBulk(deletedPaths);
            } else if (allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
                const updatedPhotos = allPhotosForCurrentFetch.filter(
                    photo => !deletedPaths.includes(photo.originalPath)
                );
                setAllPhotosForCurrentFetch(updatedPhotos);
            }

            if (clearSelection && photoSelection && clearPhotoSelection) {
                clearPhotoSelection();
            }

            try {
                const resultStr = await invoke("move_to_trash_batch", { paths: deletedPaths });
                const result = JSON.parse(resultStr);

                // ...既存 date_changes 処理 (変更なし)

                // ...既存 result.failed メッセージ (変更なし)

                return true;
            } catch (backendError) {
                // Rollback both lists + navigation
                if (photosBackup && setAllPhotosForCurrentFetch) {
                    setAllPhotosForCurrentFetch(photosBackup);
                }
                if (miniPhotosBackup && setPhotosListMiniAllPhotos) {
                    setPhotosListMiniAllPhotos(miniPhotosBackup);
                }
                if (setPhotosListMiniCurrentIndex && miniIndexBackup !== undefined) {
                    setPhotosListMiniCurrentIndex(miniIndexBackup);
                }
                if (setCurrentPhotoIndex && currentIndexBackup !== undefined) {
                    setCurrentPhotoIndex(currentIndexBackup);
                }
                if (setCurrentPhoto && currentPhotoBackup) {
                    setCurrentPhoto(currentPhotoBackup);
                }

                addFooterMessage('trash', 'Delete operation failed. Reloading...');
                if (reloadCurrentModeData) {
                    await reloadCurrentModeData();
                }
                throw backendError;
            }
        } catch (error) {
            // ...既存
        }
    }, [
        // ...既存 deps
        currentPhoto,
        handlePhotoRemovalNavigationBulk,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        currentPhotoIndex,
        setCurrentPhotoIndex,
        setCurrentPhoto
    ]);

    // ...restorePhotos は変更なし
}
```

- [ ] **Step 4: PhotosList.jsx で useTrashOperations と usePhotoOperations を配線**

`src/App/PhotosList.jsx`:
- `usePhotoOperations` の return から `handlePhotoRemovalNavigationBulk` を取り出す
- `useTrashOperations({...})` の引数に `handlePhotoRemovalNavigationBulk`, `photosListMiniAllPhotos`, `setPhotosListMiniAllPhotos`, `photosListMiniCurrentIndex`, `setPhotosListMiniCurrentIndex`, `currentPhotoIndex`, `setCurrentPhotoIndex`, `currentPhoto`, `setCurrentPhoto` を渡す

- [ ] **Step 5: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 6: コミット**

```bash
git add src/hooks/usePhotoOperations.js src/hooks/useTrashOperations.js src/App/PhotosList.jsx
git commit -m "feat(phase2): bulk delete updates mini list + navigation index in PhotoDisplay"
```

---

## Task 14: closePhotoDisplay の refreshPhotos 廃止 + sortDirty 経路

**Files:**
- Modify: `src/hooks/usePhotoDisplay.js`
- Modify: `src/App/PhotosList.jsx`

- [ ] **Step 1: usePhotoDisplay の signature に sortDirty / setSortDirty / sortOfPhotos / setAllPhotosForCurrentFetch / setPhotosListMiniAllPhotos / patchCacheCurrentView を追加**

```js
export function usePhotoDisplay({
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    viewModeObj,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setPhotosListMiniReread,
    setShowSideMenu,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    handleError,
    photosListMiniReread,
    sortDirty,
    setSortDirty,
    sortOfPhotos,
    patchCacheCurrentView
}) {
```

(`refreshPhotos` パラメータを削除)

- [ ] **Step 2: closePhotoDisplay を書き換え**

```js
import { getPhotoSortComparator } from '../utils/PhotoSort.js';

const closePhotoDisplay = useCallback(() => {
    logger.info('usePhotoDisplay', 'close_photo_display', 'Closing full-screen photo display', {
        viewMode: viewModeObj?.currentMode,
        sortDirty
    });

    setShowSideMenu(false);
    setCurrentPhoto(null);

    if (currentPhotoLoadingController) {
        currentPhotoLoadingController.abort();
        setCurrentPhotoLoadingController(null);
    }

    // Phase 2: no backend refetch. The freeze on useFilteredPhotosSync
    // (currentPhotoPath gate) lifts as currentPhoto becomes null and the
    // effect reconciles photosListMiniAllPhotos with the latest filter.
    //
    // If star edits made the on-screen order stale relative to the
    // current sort, apply a local re-sort here so the grid lands in
    // the correct order on close.
    if (sortDirty) {
        const comparator = getPhotoSortComparator(sortOfPhotos);
        if (comparator) {
            setAllPhotosForCurrentFetch(prev => [...prev].sort(comparator));
            setPhotosListMiniAllPhotos(prev => [...prev].sort(comparator));
            patchCacheCurrentView(prev => [...prev].sort(comparator));
        }
        setSortDirty(false);
    }
}, [
    setShowSideMenu,
    viewModeObj,
    setCurrentPhoto,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    sortDirty,
    setSortDirty,
    sortOfPhotos,
    setAllPhotosForCurrentFetch,
    setPhotosListMiniAllPhotos,
    patchCacheCurrentView
]);
```

`displayPhoto` と `closeRightColumn` は変更なし。

- [ ] **Step 3: PhotosList.jsx で usePhotoDisplay の引数を更新**

`src/App/PhotosList.jsx` の `usePhotoDisplay({...})` 呼び出し箇所を grep:

```bash
grep -n "usePhotoDisplay" src/App/PhotosList.jsx
```

`refreshPhotos: refreshPhotosOnly` (or similar) を削除し、新規 props を追加:

```js
const { displayPhoto, closePhotoDisplay, closeRightColumn } = usePhotoDisplay({
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    viewModeObj,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setPhotosListMiniReread,
    setShowSideMenu,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    handleError,
    photosListMiniReread,
    sortDirty,
    setSortDirty,
    sortOfPhotos,
    patchCacheCurrentView: photosCache?.patch
        ? (updater) => photosCache.patch(currentViewKey, updater)
        : undefined
});
```

(`patchCacheCurrentView` は `usePhotoListHelpers` 内の同名 helper を再利用してもよい。重複を避けるなら `usePhotoListHelpers` の return から取り出す手もある — その場合 helper 内で declared した `patchCacheCurrentView` を return する一行を追加)

- [ ] **Step 4: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 5: 動作確認 (手動)**

```bash
pnpm tauri dev
```

ユーザに動作確認を依頼:
- ★を変更してから close → grid に新しい★が反映される (loading 画面なし)
- sort=★ desc に変えて、★を 0 → 5 に変更してから close → 写真が grid の上位に再配置される
- 何も編集せず close → 瞬時に grid に戻る

- [ ] **Step 6: コミット**

```bash
git add src/hooks/usePhotoDisplay.js src/App/PhotosList.jsx
git commit -m "feat(phase2): closePhotoDisplay drops refreshPhotos, applies sortDirty re-sort"
```

---

## Task 15: PhotoTags の onPhotosRefresh prop 完全削除

**Files:**
- Modify: `src/App/PhotosList/PhotoOption/PhotoTags.jsx`
- Modify: `src/App/PhotosList/PhotoOption.jsx`
- Modify: `src/App/PhotosList.jsx`
- Modify: `src/hooks/usePhotoOptionOperations.js`

- [ ] **Step 1: 残存する onPhotosRefresh の参照を削除**

```bash
grep -rn "onPhotosRefresh" src/
```

確認結果から (Task 7 で大半は置換済):
- `src/hooks/usePhotoOptionOperations.js:80` の `onPhotosRefresh: refreshPhotosOnly` がまだ残っている可能性

`usePhotoOptionOperations.js` の `onPhotosRefresh` 参照と関連 prop を削除。`PhotosList.jsx` の `<PhotoOption ... onPhotosRefresh={refreshPhotosOnly}>` 行 (line 616) も削除。

- [ ] **Step 2: refreshPhotosOnly がまだ必要か確認**

```bash
grep -rn "refreshPhotosOnly" src/
```

view切替時の cache miss 経路 (`useViewModeSync`) で使われていれば残す。close 経路でのみ参照されていたなら、参照は無くなったがフックは残す (再利用のため)。

- [ ] **Step 3: lint + test**

```bash
pnpm lint && pnpm test
```

- [ ] **Step 4: コミット**

```bash
git add src/App/PhotosList/PhotoOption/PhotoTags.jsx src/App/PhotosList/PhotoOption.jsx src/App/PhotosList.jsx src/hooks/usePhotoOptionOperations.js
git commit -m "chore(phase2): remove dead onPhotosRefresh prop chain"
```

---

## Task 16: 統合動作確認 + バグ fix

**Files:**
- 各種 (手動テストで発見次第)

- [ ] **Step 1: 全自動テスト pass 確認**

```bash
pnpm lint && pnpm test && cd src-tauri && cargo check && cd ..
```

Expected: 全 PASS

- [ ] **Step 2: 手動テストシナリオ (spec の検証セクション)**

`pnpm tauri dev` を起動して以下を確認 (順不同):

1. PhotoDisplay 開いて編集せず close → 瞬時に grid に戻る (loading 画面なし)
2. ★変更 → close → grid の星が更新される
3. コメント編集 → close → grid のコメントマーカーが更新される
4. タグ追加 → close → grid のタグ表示が更新される
5. アルバム追加 → close → grid のアルバムバッジが更新される
6. ★ filter active で ★ を 0 にして close → grid から除外される (loading 画面なし)
7. タグ filter active でタグを外して close → grid から除外される
8. sort=★ desc で ★ を 0 → 5 に変更 → close → grid の上位に再配置される
9. 連続編集 (★→タグ→★) → close で全変更が反映
10. PhotoDisplay 中の前後 navigation で写真が突然消えない (filter フリーズ確認)
11. Save as Copy → close 後に新写真が grid に同じ日付グループ内で表示
12. Save as Copy → PhotoDisplay 中の thumb strip にも新写真が表示
13. Selection tab で 3 枚選択して bulk delete → PhotoDisplay 中なら next photo に遷移、close 時に grid からも除外
14. 検索モードで写真を編集 → close で検索結果 grid に反映 (Phase 1 の恩恵 + Phase 2 で refresh 廃止)
15. PhotoEditor "Apply style" → close 後に grid サムネイルが (一時的にでも) cssStyle 反映 (live cssStyle ベースなら即時)
16. アルバム削除 (current album viewing 中) → album-list view に遷移、PhotoDisplay も auto-close

- [ ] **Step 3: 発見したバグを fix**

各バグごとに 1-3 step ずつ修正 → コミット (個別コミット推奨)。

- [ ] **Step 4: HANDOFF.md / spec の更新**

Phase 2 が完了したら:

```bash
# HANDOFF.md の "完了したこと" に Phase 2 セクションを追加
# 現在の "次にやること: Phase 2" を削除
# spec の Status: Design → Implemented に更新
```

(具体的な編集は実装完了時に判断)

- [ ] **Step 5: 最終コミット**

```bash
git add docs/superpowers/HANDOFF.md docs/superpowers/specs/2026-05-03-instant-photo-display-close-design.md
git commit -m "docs(phase2): mark Phase 2 complete in HANDOFF + spec status"
```

---

## Self-Review Checklist (実装中に通すこと)

- [ ] **配列長変化操作の対称性**: `addPhotoToList` の `displayedPhotoCount` 加算 と `handlePhotoRemovalNavigationBulk` の減算 (Step 13 ではまだ未実装) — bulk delete 時に `displayedPhotoCount` の縮小が必要なら Task 13 に追加
- [ ] **sortDirty の伝播**: setStarWithUpdate, addPhotoToList (内部で実行), closePhotoDisplay の 3 箇所で正しくハンドル
- [ ] **navigation index 整合**: `addPhotoToList` の挿入時 / `handlePhotoRemovalNavigationBulk` の削除時の両方で `currentPhotoIndex` と `photosListMiniCurrentIndex` を同方向にずらす
- [ ] **View Cache の sortDirty 反映**: closePhotoDisplay の re-sort で cache も sort する (Task 14 Step 2 内で `patchCacheCurrentView(prev => [...prev].sort(comparator))` 済)
- [ ] **PhotoTags の `useEffect` deps**: `onTagsChanged` を deps に含めない場合は ESLint 警告に注意。callback はメモ化されている前提
- [ ] **rollback の対称性**: bulk delete 失敗時に mini/all/navigation 全て restore 済か (Task 13 Step 3)
- [ ] **`updatePhotoCssStyle` のフィールド**: `cssStyle` (camelCase) と `css_style` (snake_case) の両方に書く必要があるか — Photo.toJSON() の出力を再確認

## Phase 2 Done 条件

- 全自動テスト (vitest + cargo check + lint) が pass
- spec の検証セクション全シナリオが手動で OK
- `pnpm tauri dev` で 5 分使って regression なし
- `closePhotoDisplay` から `refreshPhotos` 呼び出しが完全に消えている (`grep -n refreshPhotos src/hooks/usePhotoDisplay.js` で no match)
- `onPhotosRefresh` prop が PhotoTags / PhotoEditor / photoExportUtils から消えている
