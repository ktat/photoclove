# Phase 6: PhotosList.jsx Refactoring (Optional)

## Overview

`PhotosList.jsx`（1,072行）はすでに十分にリファクタリングされていますが、さらなる改善の余地があります。このフェーズはオプションで、他のフェーズ完了後に検討します。

## Current State

PhotosList.jsx は15以上のカスタムフックを統合するオーケストレーションコンポーネントです。主な課題:
- プロップドリリング（多くのプロップを子コンポーネントに渡す）
- ハンドラー関数の集中管理
- 複雑な状態管理

## Target Structure

```
src/App/
  ├── PhotosList.jsx (800 lines - オーケストレーション)
  └── PhotosList/
      ├── PhotoListContext.jsx (50 lines - Context Provider)
      ├── usePhotoListHandlers.js (150 lines - ハンドラー管理)
      ├── useViewModeHelpers.js (80 lines - ViewModeヘルパー)
      └── ... (既存のフォルダ構造)
```

## Implementation Details

### PhotoListContext.jsx

Context API を使用してプロップドリリングを解消:

```javascript
// PhotosList/PhotoListContext.jsx
import { createContext, useContext, useMemo } from 'react';

const PhotoListContext = createContext(null);

export function PhotoListProvider({ children, value }) {
    return (
        <PhotoListContext.Provider value={value}>
            {children}
        </PhotoListContext.Provider>
    );
}

export function usePhotoListContext() {
    const context = useContext(PhotoListContext);
    if (!context) {
        throw new Error('usePhotoListContext must be used within PhotoListProvider');
    }
    return context;
}

// 個別のセレクタフック
export function useViewState() {
    const { viewState } = usePhotoListContext();
    return viewState;
}

export function useFilterState() {
    const { filterState } = usePhotoListContext();
    return filterState;
}

export function useSelectionState() {
    const { selectionState } = usePhotoListContext();
    return selectionState;
}

export function usePhotoHandlers() {
    const { handlers } = usePhotoListContext();
    return handlers;
}
```

### PhotosList.jsx での使用

```javascript
// PhotosList.jsx
import { PhotoListProvider } from './PhotosList/PhotoListContext';

function PhotosList({ /* props */ }) {
    // ... 既存のフック使用

    const photoListContext = useMemo(() => ({
        viewState: {
            viewModeObj,
            currentDate,
            currentAlbum,
            currentTag,
            // ...
        },
        filterState: {
            starFilter,
            hasCommentFilter,
            // ...
        },
        selectionState: {
            photoSelection,
            selectAllPhotos,
            clearSelection,
            // ...
        },
        displayState: {
            currentPhotoPath,
            showSideMenu,
            // ...
        },
        searchState: {
            searchQuery,
            searchResults,
            // ...
        },
        handlers,
    }), [/* dependencies */]);

    return (
        <PhotoListProvider value={photoListContext}>
            <PhotoDisplayWrapper />
            <PhotoListContent />
            <SideMenuWrapper />
        </PhotoListProvider>
    );
}
```

### usePhotoListHandlers.js

ハンドラー関数を1つのフックにまとめる:

```javascript
// PhotosList/usePhotoListHandlers.js
export function usePhotoListHandlers({
    viewModeObj,
    photoSelection,
    refreshPhotos,
    // ... 必要な依存関係
}) {
    const handlePhotoClick = useCallback((photo) => {
        // クリックハンドラー
    }, [/* deps */]);

    const handleDelete = useCallback(async (photos) => {
        // 削除ハンドラー
    }, [/* deps */]);

    const handleAddToAlbum = useCallback(async (albumId) => {
        // アルバム追加ハンドラー
    }, [/* deps */]);

    // ... 他のハンドラー

    return useMemo(() => ({
        handlePhotoClick,
        handleDelete,
        handleAddToAlbum,
        // ...
    }), [handlePhotoClick, handleDelete, handleAddToAlbum]);
}
```

### useViewModeHelpers.js

ViewMode関連のヘルパー関数:

```javascript
// PhotosList/useViewModeHelpers.js
export function useViewModeHelpers(viewModeObj) {
    const isReadOnlyMode = useMemo(() => {
        return viewModeObj.isTrashMode() || viewModeObj.isSearchMode();
    }, [viewModeObj]);

    const canAddToAlbum = useMemo(() => {
        return !viewModeObj.isTrashMode();
    }, [viewModeObj]);

    const canDelete = useMemo(() => {
        return !viewModeObj.isTrashMode();
    }, [viewModeObj]);

    const getEmptyMessage = useCallback(() => {
        if (viewModeObj.isSearchMode()) return '検索結果がありません';
        if (viewModeObj.isTrashMode()) return 'ゴミ箱は空です';
        if (viewModeObj.isAlbumMode()) return 'このアルバムには写真がありません';
        if (viewModeObj.isTagMode()) return 'このタグの写真はありません';
        return '写真がありません';
    }, [viewModeObj]);

    return {
        isReadOnlyMode,
        canAddToAlbum,
        canDelete,
        getEmptyMessage,
    };
}
```

## Considerations

### Context vs Props の選択

**Context のメリット**:
- プロップドリリングを解消
- 深い階層のコンポーネントでも簡単にアクセス
- コードが簡潔になる

**Context のデメリット**:
- デバッグが難しくなる可能性
- 過度な再レンダリングの可能性
- 依存関係が暗黙的になる

**推奨アプローチ**:
- 段階的にContext導入
- まずは深い階層のコンポーネントから
- パフォーマンスを監視

## Implementation Steps

1. `PhotoListContext.jsx` を作成
2. `usePhotoListHandlers.js` を作成
3. `useViewModeHelpers.js` を作成
4. PhotosList.jsx を Context Provider でラップ
5. 子コンポーネントを段階的に Context 使用に移行
6. パフォーマンステスト

## Testing Checklist

- [ ] すべての既存機能が動作する
- [ ] 写真表示・選択が動作する
- [ ] ナビゲーションが動作する
- [ ] フィルタリングが動作する
- [ ] 検索が動作する
- [ ] アルバム/タグ操作が動作する
- [ ] 削除/復元操作が動作する
- [ ] パフォーマンスが維持されている
- [ ] 再レンダリングが過度でない

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| PhotosList.jsx | 1,072行 | 800行 |
| プロップドリリング | 多い | 最小限 |
| 子コンポーネントのプロップ数 | 10-15 | 3-5 |
| ハンドラー定義の重複 | あり | 0 |

## Open Questions

1. **いつ実施するか?**
   - Phase 1-5 完了後に評価
   - 必要性が高い場合のみ実施

2. **どこまで Context 化するか?**
   - すべてを Context にするとデバッグが困難
   - バランスを取る必要あり

3. **パフォーマンスへの影響は?**
   - useMemo でコンテキスト値をメモ化
   - セレクタフックで必要な値のみ取得
   - React DevTools で再レンダリングを監視
