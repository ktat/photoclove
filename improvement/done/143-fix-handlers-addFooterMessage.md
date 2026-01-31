# Improvement #143: Fix handlers addFooterMessage Reference

## 目的

`handlers`オブジェクト内の`addFooterMessage`が`compatProps.addFooterMessage`を参照している問題を修正し、直接親propsから受け取った値を使用する。

## 現状の問題

### 間接的な参照

```javascript
// PhotosList.jsx:1270
const handlers = useMemo(() => ({
    // ...

    // Utilities
    addFooterMessage: compatProps.addFooterMessage,  // ← compatProps経由
    handleTauriError
}), [
    // ...
    compatProps.addFooterMessage,  // ← 依存配列でもcompatProps参照
    handleTauriError
]);
```

`addFooterMessage`は親コンポーネント(App.jsx)から直接渡されているのに、`compatProps`を経由している。

### 依存配列の問題

`compatProps.addFooterMessage`はオブジェクトのプロパティなので、参照が不安定。

## 解決策

#142で関数シグネチャから直接受け取った`addFooterMessage`を使用する。

## 実装詳細

### PhotosList.jsx の修正

**handlersの修正:**
```javascript
// BEFORE
const handlers = useMemo(() => ({
    // Photo display
    closePhotoDisplay,
    displayPhoto,

    // Selection
    toggleSelection,
    isSelected: isPhotoSelected,
    addSelection,
    clearPhotoSelection,
    selectAllPhotoToSelection,

    // Data loading
    getPhotos,
    loadMorePhotos: handleInfiniteScroll,
    reloadCurrentModeData,

    // Trash operations
    moveToTrashCan,
    updatePhotosAfterTrashOperation,
    deletePhotos: deletePhotosHandler,
    restorePhotos: restorePhotosHandler,

    // Photo updates
    setStarWithUpdate,
    updatePhotoComment,
    removePhotoFromList,

    // Albums
    handleAlbumClick,
    handleAlbumSelection,
    handleNewAlbumClick,
    handleAlbumUpdate,
    handleAlbumDelete,
    clearAlbumSelection,
    deleteSelectedAlbums,

    // Tags
    handleTagClick,
    handleTagSelection,
    handleNewTagClick,
    clearTagSelection,
    deleteSelectedTags,

    // Search
    handleSearch,
    clearSearch,
    handleFiltersChange,
    handleSavedSearchSelect,

    // Filters
    clearAllFilters,

    // UI
    setShowSideMenu,
    setIconSize,
    setSort,
    setImportSort,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    setShowFilterPopover,
    setAlbumSearchTerm,
    setTagSearchTerm,
    changeTab,
    closeRightColumn,
    toggleAlbumListMode,
    openTagsList,
    toggleHome,

    // Utilities
    addFooterMessage: compatProps.addFooterMessage,  // ← 修正
    handleTauriError
}), [
    closePhotoDisplay, displayPhoto,
    toggleSelection, isPhotoSelected, addSelection, clearPhotoSelection, selectAllPhotoToSelection,
    getPhotos, handleInfiniteScroll, reloadCurrentModeData,
    moveToTrashCan, updatePhotosAfterTrashOperation, deletePhotosHandler, restorePhotosHandler,
    setStarWithUpdate, updatePhotoComment, removePhotoFromList,
    handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate, handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
    handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
    handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect,
    clearAllFilters,
    setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhotoPath, setCurrentPhotoIndex, setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
    changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
    compatProps.addFooterMessage,  // ← 修正
    handleTauriError
]);

// AFTER
const handlers = useMemo(() => ({
    // Photo display
    closePhotoDisplay,
    displayPhoto,

    // Selection
    toggleSelection,
    isSelected: isPhotoSelected,
    addSelection,
    clearPhotoSelection,
    selectAllPhotoToSelection,

    // Data loading
    getPhotos,
    loadMorePhotos: handleInfiniteScroll,
    reloadCurrentModeData,

    // Trash operations
    moveToTrashCan,
    updatePhotosAfterTrashOperation,
    deletePhotos: deletePhotosHandler,
    restorePhotos: restorePhotosHandler,

    // Photo updates
    setStarWithUpdate,
    updatePhotoComment,
    removePhotoFromList,

    // Albums
    handleAlbumClick,
    handleAlbumSelection,
    handleNewAlbumClick,
    handleAlbumUpdate,
    handleAlbumDelete,
    clearAlbumSelection,
    deleteSelectedAlbums,

    // Tags
    handleTagClick,
    handleTagSelection,
    handleNewTagClick,
    clearTagSelection,
    deleteSelectedTags,

    // Search
    handleSearch,
    clearSearch,
    handleFiltersChange,
    handleSavedSearchSelect,

    // Filters
    clearAllFilters,

    // UI
    setShowSideMenu,
    setIconSize,
    setSort,
    setImportSort,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    setShowFilterPopover,
    setAlbumSearchTerm,
    setTagSearchTerm,
    changeTab,
    closeRightColumn,
    toggleAlbumListMode,
    openTagsList,
    toggleHome,

    // Utilities
    addFooterMessage: addFooterMessage,  // ← 直接参照
    handleTauriError
}), [
    closePhotoDisplay, displayPhoto,
    toggleSelection, isPhotoSelected, addSelection, clearPhotoSelection, selectAllPhotoToSelection,
    getPhotos, handleInfiniteScroll, reloadCurrentModeData,
    moveToTrashCan, updatePhotosAfterTrashOperation, deletePhotosHandler, restorePhotosHandler,
    setStarWithUpdate, updatePhotoComment, removePhotoFromList,
    handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate, handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
    handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
    handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect,
    clearAllFilters,
    setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhotoPath, setCurrentPhotoIndex, setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
    changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
    addFooterMessage,  // ← 直接参照
    handleTauriError
]);
```

**compatPropsからも削除:**
```javascript
// BEFORE
const compatProps = {
    dateList: dateList || [],
    currentDate: currentDate || "",
    dateNum: dateNum || {},
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum,
    addFooterMessage: addFooterMessage  // ← 削除
};

// AFTER
const compatProps = {
    dateList: dateList || [],
    currentDate: currentDate || "",
    dateNum: dateNum || {},
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum
    // addFooterMessage削除（handlersに直接入っているため）
};
```

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - handlers修正、compatProps修正

### 影響を受けないファイル
- すべての子コンポーネント - `handlers.addFooterMessage`経由で使用（変更なし）

## 期待される効果

- ✅ **依存配列の安定化**: 直接参照することで安定した依存関係
- ✅ **データフローの明確化**: 親props → handlers の流れが明確
- ✅ **compatPropsの簡素化**: 1プロパティ削減

## 注意点/リスク

### リスク: 低
- 1ファイルのみの修正
- 参照先を変更するだけ（ロジックは変わらない）
- handlers経由で使用している箇所は影響なし

### 検証方法

1. アプリを起動
2. 写真をゴミ箱に移動 → フッターメッセージが表示されるか確認
3. 写真を復元 → フッターメッセージが表示されるか確認
4. エラーが発生する操作（存在しないファイルを開くなど）→ エラーメッセージが表示されるか確認
5. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #142（必須 - addFooterMessageを関数シグネチャで受け取る必要がある）
- **次のタスク**: #144-#146
- **ブロックするタスク**: なし

## 実装順序

1. #142 が完了していることを確認
2. PhotosList.jsx を開く
3. handlers の addFooterMessage 行を修正
4. handlers の依存配列を修正
5. compatProps から addFooterMessage を削除
6. 保存
7. アプリを起動して動作確認
8. フッターメッセージが表示される操作をテスト
