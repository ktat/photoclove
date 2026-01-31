# 126: Fix Sort Not Working in Photo List Views

## 問題

写真一覧でSortのドロップダウンを変更しても、並び順が変わらない。

## 原因

`useViewModeSync` hook（`src/hooks/useViewModeSync.js`）のuseEffect依存配列に`sortOfPhotos`が含まれていない。

### 現在の実装

**ファイル**: `src/hooks/useViewModeSync.js` (line 87-97)

```javascript
}, [
    viewMode,
    currentDate,
    currentAlbumId,
    currentTagId,
    searchQuery,
    currentSearchParams,
    appConfig
    // Note: Intentionally excluding setter functions and callbacks to prevent infinite loops
    // These functions are stable and don't need to trigger re-runs
]);
```

**問題点**:
- `sortOfPhotos`が依存配列に含まれていない
- ソートが変更されても`loadPhotosWithCollection`が再実行されない
- PhotoCollectionは作成時にsortOfPhotosを受け取るが、作成されない

### 影響範囲

- ✅ **Date Mode**: ソートが効かない
- ✅ **Recent Mode**: ソートが効かない
- ✅ **Trash Mode**: ソートが効かない
- ❌ **Search Mode**: 別のuseEffect (PhotosList.jsx:839) で処理されているため正常動作
- ❌ **Import Mode**: `importSortOfPhotos`を使用し、別のロジック (PhotosList.jsx:735) で処理
- ❌ **Album Mode**: `useViewModeSync`でスキップされる (line 62-65)
- ❌ **Tag Mode**: `useViewModeSync`でスキップされる (line 66-69)

### PhotoCollectionでのソート使用箇所

`src/App/PhotosList.jsx`でPhotoCollection作成時にsortOfPhotosを渡している：

- Line 1177: `PhotoCollection.createDateCollection(..., parseInt(sortOfPhotos))`
- Line 1182: `PhotoCollection.createRecentCollection(..., parseInt(sortOfPhotos))`
- Line 1185: `PhotoCollection.createSearchCollection(..., parseInt(sortOfPhotos))`
- Line 1210: `PhotoCollection.createTrashCollection(..., parseInt(sortOfPhotos))`

しかし、sortOfPhotosが変更されてもPhotoCollectionが再作成されない。

## 解決方法

### Option A: useViewModeSyncの依存配列に追加（推奨）

**ファイル**: `src/hooks/useViewModeSync.js`

```javascript
}, [
    viewMode,
    currentDate,
    currentAlbumId,
    currentTagId,
    searchQuery,
    currentSearchParams,
    appConfig,
    sortOfPhotos  // 追加
]);
```

**メリット**:
- シンプルで直感的
- Date/Recent/Trashモードで一貫した動作
- コード変更が最小限

**デメリット**:
- なし

### Option B: 別のuseEffectで処理

Search Modeと同様に、sortOfPhotos専用のuseEffectを作成。

**デメリット**:
- コードの重複
- 複雑性が増す

## 実装手順

### Phase 1: 修正
1. `src/hooks/useViewModeSync.js` の依存配列に`sortOfPhotos`を追加
2. propsに`sortOfPhotos`を追加

### Phase 2: PhotosList.jsxの修正
1. `useViewModeSync`に`sortOfPhotos`を渡す

### Phase 3: テスト
1. Date Modeでソート変更 → 並び順が変わることを確認
2. Recent Modeでソート変更 → 並び順が変わることを確認
3. Trash Modeでソート変更 → 並び順が変わることを確認
4. Search Modeで既存動作が維持されることを確認

## 参考コード

### Search Modeでの既存実装 (PhotosList.jsx:838-877)

```javascript
// Re-execute search when sort changes (only if we have active search)
useEffect(() => {
    // Skip initial render to avoid infinite loop
    if (!sortInitialized.current) {
        sortInitialized.current = true;
        return;
    }

    // Only re-execute if we're in search mode, have search params, and there are search results
    if (isSearchMode && currentSearchParams && searchResults.length > 0) {
        logger.info('PhotosList', 'sort_changed_reexecute', 'Re-executing search due to sort change', {
            sortOfPhotos,
            currentSearchParams
        });

        // Call performSearch directly to avoid dependency cycle
        const sortConfig = {
            0: { field: 'exif_date_time_original', order: 'desc' },
            1: { field: 'exif_date_time_original', order: 'asc' },
            2: { field: 'photo_date', order: 'desc' },
            3: { field: 'photo_date', order: 'asc' },
            4: { field: 'star', order: 'desc' },
            5: { field: 'star', order: 'asc' },
            6: { field: 'path', order: 'desc' },
            7: { field: 'path', order: 'asc' }
        };
        const config = sortConfig[sortOfPhotos] || sortConfig[0];

        performSearch(
            currentSearchParams.query,
            currentSearchParams.searchType,
            currentSearchParams.filters,
            config.field,
            config.order
        );
    }
}, [sortOfPhotos, isSearchMode, currentSearchParams, searchResults.length]);
```

この実装は、Search Modeでは正しく動作している。同様のロジックを他のモードにも適用する必要がある。

## まとめ

`useViewModeSync`の依存配列に`sortOfPhotos`を追加することで、Date/Recent/TrashモードでもSort機能が正常に動作するようになります。
