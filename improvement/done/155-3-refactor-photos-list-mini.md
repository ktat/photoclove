# Phase 3: Frontend Refactoring - PhotosListMini.jsx

## Overview

`PhotosListMini.jsx`（972行）を分割し、約350行を削減します。サムネイル表示、ナビゲーション、削除操作の関心事を分離します。

**注**: 2025-01 の EXIF orientation 修正により行数が増加。orientation処理は `src/utils/orientationUtils.js` に共通化されています。

## Target Structure

```
src/App/PhotosList/
  ├── PhotosListMini.jsx (400 lines - メインコンポーネント)
  └── PhotosListMini/
      ├── ThumbnailItem.jsx (200 lines - 再利用可能なサムネイル)
      ├── useDeletionOperations.js (150 lines - 削除ロジック)
      ├── usePhotoNavigation.js (100 lines - ナビゲーション)
      ├── usePhotoMetadataOperations.js (80 lines - スター/コメント)
      ├── photoUtils.js (既存)
      ├── useKeyboardShortcuts.js (既存)
      └── PhotoDisplay.jsx (既存)
```

## Implementation Details

### ThumbnailItem.jsx

```javascript
// PhotosListMini/ThumbnailItem.jsx
export function ThumbnailItem({
    photo,
    index,
    isSelected,
    isCurrent,
    onSelect,
    onClick,
    onError,
    importMode,
    showMetadata,
}) {
    const [imgSrc, setImgSrc] = useState(photo.thumbnailPath());
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
        setHasError(true);
        if (onError) onError(photo, index);
    };

    return (
        <div
            className={`thumbnail-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
            onClick={() => onClick(photo, index)}
        >
            <img
                src={hasError ? '/img_error.png' : imgSrc}
                alt={photo.name}
                onError={handleError}
            />

            {showMetadata && (
                <div className="thumbnail-metadata">
                    {photo.star > 0 && <span className="star">{photo.star}</span>}
                    {photo.comment && <span className="comment">...</span>}
                    {photo.getTags().length > 0 && <span className="tags">{photo.getTags().length}</span>}
                </div>
            )}

            {importMode && (
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(photo)}
                />
            )}
        </div>
    );
}
```

### useDeletionOperations.js

```javascript
// PhotosListMini/useDeletionOperations.js
export function useDeletionOperations({ viewMode, onComplete }) {
    const [modalState, setModalState] = useState({
        removeFromAlbum: false,
        deleteFile: false,
        permanentDelete: false,
    });
    const [targetPhoto, setTargetPhoto] = useState(null);

    const showRemoveFromAlbumModal = useCallback((photo) => {
        setTargetPhoto(photo);
        setModalState({ ...modalState, removeFromAlbum: true });
    }, [modalState]);

    const handleConfirmRemoveFromAlbum = useCallback(async () => {
        if (!targetPhoto) return;

        await invoke('remove_from_album', {
            albumId: viewMode.albumId,
            photoPath: targetPhoto.path,
        });

        setModalState({ ...modalState, removeFromAlbum: false });
        if (onComplete) onComplete();
    }, [targetPhoto, viewMode, modalState, onComplete]);

    // ... 他の削除操作

    return {
        modalState,
        showRemoveFromAlbumModal,
        showDeleteFileModal,
        showPermanentDeleteModal,
        handleConfirmRemoveFromAlbum,
        handleConfirmDeleteFile,
        handleConfirmPermanentDelete,
        closeModal: () => setModalState({ removeFromAlbum: false, deleteFile: false, permanentDelete: false }),
    };
}
```

### usePhotoNavigation.js

```javascript
// PhotosListMini/usePhotoNavigation.js
export function usePhotoNavigation({ photos, currentIndex, onNavigate }) {
    const goToNext = useCallback(() => {
        if (currentIndex < photos.length - 1) {
            onNavigate(currentIndex + 1);
        }
    }, [currentIndex, photos.length, onNavigate]);

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
        }
    }, [currentIndex, onNavigate]);

    const goToFirst = useCallback(() => {
        onNavigate(0);
    }, [onNavigate]);

    const goToLast = useCallback(() => {
        onNavigate(photos.length - 1);
    }, [photos.length, onNavigate]);

    return {
        goToNext,
        goToPrevious,
        goToFirst,
        goToLast,
        hasNext: currentIndex < photos.length - 1,
        hasPrevious: currentIndex > 0,
    };
}
```

### usePhotoMetadataOperations.js

```javascript
// PhotosListMini/usePhotoMetadataOperations.js
export function usePhotoMetadataOperations({ onUpdate }) {
    const updateStar = useCallback(async (photo, newStar) => {
        await invoke('update_photo_star', {
            path: photo.path,
            star: newStar,
        });
        if (onUpdate) onUpdate(photo, { star: newStar });
    }, [onUpdate]);

    const updateComment = useCallback(async (photo, newComment) => {
        await invoke('update_photo_comment', {
            path: photo.path,
            comment: newComment,
        });
        if (onUpdate) onUpdate(photo, { comment: newComment });
    }, [onUpdate]);

    return {
        updateStar,
        updateComment,
    };
}
```

## Implementation Steps

1. `ThumbnailItem.jsx` コンポーネントを作成
2. `useDeletionOperations.js` フックを作成
3. `usePhotoNavigation.js` フックを作成
4. `usePhotoMetadataOperations.js` フックを作成
5. `PhotosListMini.jsx` を新モジュールを使用するように更新
6. 全機能の動作テスト

## Testing Checklist

- [ ] サムネイル表示が動作する
- [ ] サムネイルクリックで写真選択が動作する
- [ ] メタデータ表示（スター、コメント、タグ）が動作する
- [ ] エラー画像のフォールバックが動作する
- [ ] アルバムから削除が動作する
- [ ] ファイル削除（ゴミ箱移動）が動作する
- [ ] 完全削除が動作する
- [ ] 次/前のナビゲーションが動作する
- [ ] スター更新が動作する
- [ ] コメント更新が動作する
- [ ] インポートモードでのチェックボックスが動作する

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| PhotosListMini.jsx | 972行 | 400行 |
| 新規モジュール | 0 | 4ファイル |
| 再利用可能コンポーネント | 0 | ThumbnailItem |
| 削除ロジック重複 | あり | 0 |
