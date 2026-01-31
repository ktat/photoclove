# Phase 4: Frontend Refactoring - DirectoryMenu.jsx

## Overview

`DirectoryMenu.jsx`（899行）を分割し、約450行を削減します。写真操作、アルバム/タグ操作、日付操作の関心事を分離します。

**注**: 2025-01 に bulk insert 機能を追加。アルバム/タグへの一括追加は `add_photos_to_collection_bulk` コマンドを使用しています。

## Target Structure

```
src/App/PhotosList/
  ├── DirectoryMenu.jsx (450 lines - メインコンポーネント)
  └── DirectoryMenu/
      ├── photoOperations.js (200 lines - インポート/削除/復元)
      ├── collectionOperations.js (150 lines - アルバム/タグ)
      ├── dateOperations.js (100 lines - 日付メンテナンス)
      ├── FilterTab.jsx (既存)
      ├── SelectionTab.jsx (既存)
      └── tutorialContent.jsx (既存)
```

## Implementation Details

### photoOperations.js

```javascript
// DirectoryMenu/photoOperations.js
export function usePhotoImport({ onComplete }) {
    const importSelectedPhotos = useCallback(async (selectedPhotos, config) => {
        // Import logic
    }, [onComplete]);

    return { importSelectedPhotos };
}

export function useGooglePhotosUpload({ onComplete }) {
    const uploadToGooglePhotos = useCallback(async (selectedPhotos) => {
        // Upload logic
    }, [onComplete]);

    return { uploadToGooglePhotos };
}

export function useTrashOperations({ onComplete }) {
    const deleteFiles = useCallback(async (selectedPhotos) => {
        // Delete logic
    }, [onComplete]);

    const restoreSelectedFromTrash = useCallback(async (selectedPhotos) => {
        // Restore logic
    }, [onComplete]);

    const permanentDeleteSelected = useCallback(async (selectedPhotos) => {
        // Permanent delete logic
    }, [onComplete]);

    return {
        deleteFiles,
        restoreSelectedFromTrash,
        permanentDeleteSelected,
    };
}
```

### collectionOperations.js

```javascript
// DirectoryMenu/collectionOperations.js
export function useAlbumOperations({ onComplete }) {
    const addPhotosToAlbum = useCallback(async (selectedPhotos, albumId) => {
        await invoke('add_photos_to_album', {
            albumId,
            photoPaths: selectedPhotos.map(p => p.path),
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const removePhotosFromAlbum = useCallback(async (selectedPhotos, albumId) => {
        await invoke('remove_photos_from_album', {
            albumId,
            photoPaths: selectedPhotos.map(p => p.path),
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const createNewAlbum = useCallback(async (name, description) => {
        const result = await invoke('create_album', { name, description });
        return result;
    }, []);

    return {
        addPhotosToAlbum,
        removePhotosFromAlbum,
        createNewAlbum,
    };
}

export function useTagOperations({ onComplete }) {
    const addTagsToPhotos = useCallback(async (selectedPhotos, tagIds) => {
        await invoke('add_tags_to_photos', {
            photoPaths: selectedPhotos.map(p => p.path),
            tagIds,
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const removeTagsFromPhotos = useCallback(async (selectedPhotos, tagIds) => {
        await invoke('remove_tags_from_photos', {
            photoPaths: selectedPhotos.map(p => p.path),
            tagIds,
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const createNewTag = useCallback(async (name, color) => {
        const result = await invoke('create_tag', { name, color });
        return result;
    }, []);

    return {
        addTagsToPhotos,
        removeTagsFromPhotos,
        createNewTag,
    };
}
```

### dateOperations.js

```javascript
// DirectoryMenu/dateOperations.js
export function useDateOperations({ onComplete }) {
    const updatePhotoDate = useCallback(async (photo, newDate) => {
        await invoke('update_photo_date', {
            path: photo.path,
            date: newDate,
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const bulkUpdateDates = useCallback(async (selectedPhotos, dateOffset) => {
        await invoke('bulk_update_photo_dates', {
            photoPaths: selectedPhotos.map(p => p.path),
            dateOffset,
        });
        if (onComplete) onComplete();
    }, [onComplete]);

    const recalculateDateCounts = useCallback(async () => {
        await invoke('recalculate_date_counts');
        if (onComplete) onComplete();
    }, [onComplete]);

    return {
        updatePhotoDate,
        bulkUpdateDates,
        recalculateDateCounts,
    };
}
```

## Implementation Steps

1. `photoOperations.js` を作成し、インポート/削除/復元ロジックを抽出
2. `collectionOperations.js` を作成し、アルバム/タグ操作を抽出
3. `dateOperations.js` を作成し、日付関連操作を抽出
4. `DirectoryMenu.jsx` を新モジュールを使用するように更新
5. 全操作の動作テスト

## Testing Checklist

### Photo Operations
- [ ] 写真インポートが動作する
- [ ] Google Photos へのアップロードが動作する
- [ ] ゴミ箱への移動が動作する
- [ ] ゴミ箱からの復元が動作する
- [ ] 完全削除が動作する

### Collection Operations
- [ ] アルバムへの追加が動作する
- [ ] アルバムからの削除が動作する
- [ ] 新規アルバム作成が動作する
- [ ] タグの追加が動作する
- [ ] タグの削除が動作する
- [ ] 新規タグ作成が動作する

### Date Operations
- [ ] 写真の日付更新が動作する
- [ ] 一括日付更新が動作する
- [ ] 日付カウント再計算が動作する

### Existing Features
- [ ] FilterTab が動作する
- [ ] SelectionTab が動作する
- [ ] チュートリアル表示が動作する

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| DirectoryMenu.jsx | 899行 | 450行 |
| 新規モジュール | 0 | 3ファイル |
| 操作ロジック分離 | なし | 完全分離 |
| コードの再利用性 | 低 | 高 |
