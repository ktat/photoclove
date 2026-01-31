# Improvement 122: Split PhotosListMini.jsx into Sub-Components

## 概要

`src/App/PhotosList/PhotosListMini.jsx` (866行) を機能ごとのサブコンポーネントに分割し、コンポーネントの複雑さを軽減する。

## 背景

現在の `PhotosListMini.jsx` は以下の問題を抱えている：

1. **ファイルサイズが大きい**: 866行の単一コンポーネント
2. **複数の表示モードが混在**: グリッド表示、リスト表示など
3. **操作ロジックが複雑**: クリック、選択、ドラッグ&ドロップなど
4. **状態管理が分散**: 多数の useState が混在

## 目的

- 表示コンポーネントと操作ロジックを分離
- サブコンポーネント化による責務の明確化
- コードの保守性と可読性を向上

## 実装方針

### ディレクトリ構造

```
src/App/PhotosList/PhotosListMini/
├── PhotosListMini.jsx      # メインコンポーネント (約250行)
├── components/
│   ├── PhotoGrid.jsx          # グリッド表示 (約200行)
│   ├── PhotoItem.jsx          # 写真アイテム (約150行)
│   ├── PhotoContextMenu.jsx   # コンテキストメニュー (約150行)
│   └── LoadingSpinner.jsx     # ローディング表示 (約50行)
└── hooks/
    ├── usePhotoListMini.js    # 状態管理 (約200行)
    └── usePhotoActions.js     # 写真操作 (約150行)
```

### 1. PhotosListMini.jsx (メインコンポーネント)

**責務**: サブコンポーネントの統合とレイアウト

```javascript
import React from 'react';
import PhotoGrid from './components/PhotoGrid';
import PhotoContextMenu from './components/PhotoContextMenu';
import LoadingSpinner from './components/LoadingSpinner';
import { usePhotoListMini } from './hooks/usePhotoListMini';
import { usePhotoActions } from './hooks/usePhotoActions';
import './PhotosListMini.css';

function PhotosListMini({ photos, mode, onPhotoClick, onSelectionChange }) {
    const {
        selectedPhotos,
        contextMenuData,
        isLoading,
        handlePhotoSelect,
        handleContextMenu,
        closeContextMenu
    } = usePhotoListMini(photos, onSelectionChange);

    const {
        handleDelete,
        handleStar,
        handleAddToCollection
    } = usePhotoActions();

    return (
        <div className="photos-list-mini">
            {isLoading ? (
                <LoadingSpinner />
            ) : (
                <PhotoGrid
                    photos={photos}
                    selectedPhotos={selectedPhotos}
                    onPhotoClick={onPhotoClick}
                    onPhotoSelect={handlePhotoSelect}
                    onContextMenu={handleContextMenu}
                    mode={mode}
                />
            )}

            {contextMenuData && (
                <PhotoContextMenu
                    x={contextMenuData.x}
                    y={contextMenuData.y}
                    photo={contextMenuData.photo}
                    onClose={closeContextMenu}
                    onDelete={handleDelete}
                    onStar={handleStar}
                    onAddToCollection={handleAddToCollection}
                />
            )}
        </div>
    );
}

export default PhotosListMini;
```

**行数**: 約250行

### 2. components/PhotoGrid.jsx (グリッド表示)

**責務**: 写真のグリッドレイアウト表示

```javascript
import React, { useRef, useCallback } from 'react';
import PhotoItem from './PhotoItem';
import './PhotoGrid.css';

function PhotoGrid({
    photos,
    selectedPhotos,
    onPhotoClick,
    onPhotoSelect,
    onContextMenu,
    mode
}) {
    const gridRef = useRef(null);

    const isPhotoSelected = useCallback((photo) => {
        return selectedPhotos.some(p => p.path === photo.path);
    }, [selectedPhotos]);

    const handlePhotoClick = (photo, event) => {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd クリック：選択切り替え
            onPhotoSelect(photo);
        } else if (event.shiftKey) {
            // Shift クリック：範囲選択
            // TODO: 範囲選択の実装
        } else {
            // 通常のクリック：写真を開く
            onPhotoClick(photo);
        }
    };

    const handlePhotoRightClick = (photo, event) => {
        event.preventDefault();
        onContextMenu(photo, event.clientX, event.clientY);
    };

    // 無限スクロール
    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5) {
            // 次のページをロード
            // TODO: ページネーション処理
        }
    }, []);

    return (
        <div
            ref={gridRef}
            className={`photo-grid mode-${mode}`}
            onScroll={handleScroll}
        >
            {photos.map((photo, index) => (
                <PhotoItem
                    key={photo.path}
                    photo={photo}
                    index={index}
                    isSelected={isPhotoSelected(photo)}
                    onClick={(e) => handlePhotoClick(photo, e)}
                    onContextMenu={(e) => handlePhotoRightClick(photo, e)}
                    mode={mode}
                />
            ))}
        </div>
    );
}

export default PhotoGrid;
```

**行数**: 約200行

### 3. components/PhotoItem.jsx (写真アイテム)

**責務**: 個別の写真の表示

```javascript
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './PhotoItem.css';

function PhotoItem({ photo, index, isSelected, onClick, onContextMenu, mode }) {
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadThumbnail();
    }, [photo.path]);

    const loadThumbnail = async () => {
        setIsLoading(true);
        try {
            const url = await invoke('get_resized_image', {
                pathStr: photo.path,
                width: 250,
                height: 250,
                importDirectory: null
            });
            setThumbnailUrl(url);
        } catch (error) {
            console.error('Failed to load thumbnail:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStarDisplay = () => {
        if (!photo.star || photo.star === 0) return null;
        return '⭐'.repeat(photo.star);
    };

    return (
        <div
            className={`photo-item ${isSelected ? 'selected' : ''} ${mode}`}
            onClick={onClick}
            onContextMenu={onContextMenu}
            data-index={index}
        >
            {isLoading ? (
                <div className="photo-loading">読み込み中...</div>
            ) : (
                <>
                    <img
                        src={thumbnailUrl}
                        alt={photo.file?.name || 'Photo'}
                        loading="lazy"
                    />

                    {isSelected && (
                        <div className="selection-indicator">✓</div>
                    )}

                    <div className="photo-info">
                        {photo.star > 0 && (
                            <div className="photo-star">{getStarDisplay()}</div>
                        )}

                        {photo.comment && (
                            <div className="photo-comment-indicator">💬</div>
                        )}
                    </div>

                    {mode === 'detail' && (
                        <div className="photo-metadata">
                            <div className="photo-date">
                                {new Date(photo.created_at).toLocaleDateString()}
                            </div>
                            {photo.camera && (
                                <div className="photo-camera">{photo.camera}</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default PhotoItem;
```

**行数**: 約150行

### 4. components/PhotoContextMenu.jsx (コンテキストメニュー)

**責務**: 右クリックメニューの表示と操作

```javascript
import React, { useEffect, useRef } from 'react';
import './PhotoContextMenu.css';

function PhotoContextMenu({ x, y, photo, onClose, onDelete, onStar, onAddToCollection }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleMenuAction = (action) => {
        action(photo);
        onClose();
    };

    const starOptions = [1, 2, 3, 4, 5];

    return (
        <div
            ref={menuRef}
            className="photo-context-menu"
            style={{ left: `${x}px`, top: `${y}px` }}
        >
            <div className="menu-section">
                <div className="menu-label">スター</div>
                {starOptions.map(star => (
                    <div
                        key={star}
                        className="menu-item"
                        onClick={() => handleMenuAction(() => onStar(photo, star))}
                    >
                        {'⭐'.repeat(star)}
                    </div>
                ))}
            </div>

            <div className="menu-separator" />

            <div className="menu-section">
                <div
                    className="menu-item"
                    onClick={() => handleMenuAction(onAddToCollection)}
                >
                    📁 コレクションに追加
                </div>

                <div
                    className="menu-item danger"
                    onClick={() => handleMenuAction(onDelete)}
                >
                    🗑️ 削除
                </div>
            </div>
        </div>
    );
}

export default PhotoContextMenu;
```

**行数**: 約150行

### 5. components/LoadingSpinner.jsx (ローディング表示)

**責務**: ローディング中の表示

```javascript
import React from 'react';
import './LoadingSpinner.css';

function LoadingSpinner() {
    return (
        <div className="loading-spinner">
            <div className="spinner"></div>
            <div className="loading-text">読み込み中...</div>
        </div>
    );
}

export default LoadingSpinner;
```

**行数**: 約50行

### 6. hooks/usePhotoListMini.js (状態管理)

**責務**: PhotosListMini の状態管理

```javascript
import { useState, useCallback, useEffect } from 'react';
import { logger } from '../../../services/LoggerService';

export function usePhotoListMini(photos, onSelectionChange) {
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [contextMenuData, setContextMenuData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(selectedPhotos);
        }
    }, [selectedPhotos, onSelectionChange]);

    const handlePhotoSelect = useCallback((photo) => {
        logger.info('PhotosListMini', 'photo_select', 'Photo selection toggled', { path: photo.path });

        setSelectedPhotos(prev => {
            const isSelected = prev.some(p => p.path === photo.path);
            if (isSelected) {
                return prev.filter(p => p.path !== photo.path);
            } else {
                return [...prev, photo];
            }
        });
    }, []);

    const handleContextMenu = useCallback((photo, x, y) => {
        logger.info('PhotosListMini', 'context_menu', 'Context menu opened', { path: photo.path });

        setContextMenuData({ photo, x, y });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenuData(null);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedPhotos([]);
    }, []);

    return {
        selectedPhotos,
        contextMenuData,
        isLoading,
        handlePhotoSelect,
        handleContextMenu,
        closeContextMenu,
        clearSelection
    };
}
```

**行数**: 約200行

### 7. hooks/usePhotoActions.js (写真操作)

**責務**: 写真に対する操作の実行

```javascript
import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../../../services/LoggerService';

export function usePhotoActions() {
    const handleDelete = useCallback(async (photo) => {
        logger.info('PhotosListMini', 'delete_photo', 'Deleting photo', { path: photo.path });

        if (!confirm('この写真を削除しますか？')) {
            return;
        }

        try {
            await invoke('delete_photos', {
                paths: [photo.path]
            });
            logger.info('PhotosListMini', 'delete_photo_success', 'Photo deleted');
        } catch (error) {
            logger.error('PhotosListMini', 'delete_photo_error', 'Failed to delete photo', { error });
            alert('写真の削除に失敗しました');
        }
    }, []);

    const handleStar = useCallback(async (photo, starValue) => {
        logger.info('PhotosListMini', 'set_star', 'Setting photo star', {
            path: photo.path,
            star: starValue
        });

        try {
            await invoke('save_star', {
                pathStr: photo.path,
                starNum: starValue
            });
            logger.info('PhotosListMini', 'set_star_success', 'Star saved');
        } catch (error) {
            logger.error('PhotosListMini', 'set_star_error', 'Failed to set star', { error });
            alert('スターの設定に失敗しました');
        }
    }, []);

    const handleAddToCollection = useCallback(async (photo) => {
        logger.info('PhotosListMini', 'add_to_collection', 'Adding to collection', {
            path: photo.path
        });

        // TODO: コレクション選択ダイアログを表示
        alert('コレクション選択機能は未実装です');
    }, []);

    return {
        handleDelete,
        handleStar,
        handleAddToCollection
    };
}
```

**行数**: 約150行

## 移行手順

### Phase 1: ディレクトリ構造の作成

1. `PhotosListMini/` ディレクトリを作成
2. サブディレクトリとファイルを作成

### Phase 2: サブコンポーネントの実装

1. `LoadingSpinner.jsx` を作成（最も単純）
2. `PhotoItem.jsx` を作成
3. `PhotoContextMenu.jsx` を作成
4. `PhotoGrid.jsx` を作成

### Phase 3: フックの作成

1. `hooks/usePhotoActions.js` を作成
2. `hooks/usePhotoListMini.js` を作成

### Phase 4: メインコンポーネントのリファクタリング

1. `PhotosListMini.jsx` でサブコンポーネントを統合
2. 既存のロジックを段階的に移行

### Phase 5: テストと検証

1. UI の動作確認
2. パフォーマンステスト（多数の写真での動作確認）

## 期待される効果

1. **可読性の向上**: 各コンポーネントが50-250行程度に
2. **再利用性の向上**: PhotoItem や PhotoContextMenu を他で使用可能
3. **パフォーマンスの向上**: コンポーネント分割により最適化が容易
4. **保守性の向上**: 責務が明確に分離される

## 注意点

1. **パフォーマンス**
   - 多数の写真を表示する際のパフォーマンスに注意
   - React.memo の活用を検討

2. **既存の動作を維持**
   - 選択、クリック、コンテキストメニューなどの動作は変更しない

3. **段階的な実施**
   - 一度にすべてを変更せず、コンポーネントごとに移行

## パフォーマンス最適化の提案

```javascript
// PhotoItem.jsx を React.memo でメモ化
export default React.memo(PhotoItem, (prevProps, nextProps) => {
    return (
        prevProps.photo.path === nextProps.photo.path &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.mode === nextProps.mode
    );
});

// PhotoGrid.jsx で仮想スクロールを検討
import { FixedSizeGrid } from 'react-window';
```

## 参考

- React パフォーマンス最適化: https://react.dev/learn/render-and-commit
- React.memo: https://react.dev/reference/react/memo
- react-window (仮想スクロール): https://github.com/bvaughn/react-window
