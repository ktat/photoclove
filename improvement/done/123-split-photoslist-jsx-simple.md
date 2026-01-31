# Improvement 123: PhotosList.jsx の単純な分割

## 概要

`src/App/PhotosList.jsx` (1923行) を**単純で実践的な方法**で分割し、可読性と保守性を向上させる。

## 背景

現在の `PhotosList.jsx` は以下の問題を抱えている：

1. **ファイルサイズが大きすぎる**: 1923行の単一コンポーネント
2. **JSXブロックが長大**: return文内のJSXが1200行以上
3. **イベントハンドラーが多数**: 30個以上のハンドラー関数が定義されている
4. **useEffectフックが多い**: 18個のuseEffectが混在

## 目的

- **単純で確実な分割**: 複雑なリファクタリングを避け、機能単位で分離
- **JSXの分離**: 長大なJSX returを独立したコンポーネントに分割
- **段階的な実施**: 一度にすべてを変更せず、確実に動作する部分から分離

## 実装方針

### Phase 1: JSX表示コンポーネントの分離 (優先度: 高)

最もシンプルで効果的な分割。**JSXの表示ロジックを独立したコンポーネント**に切り出す。

#### 1-1. PhotoDisplayWrapper コンポーネント (約80行)

**目的**: PhotosListMini表示部分を分離

**場所**: `src/App/PhotosList/PhotoDisplayWrapper.jsx`

**抽出範囲**: PhotosList.jsx 行1585-1651

```jsx
/**
 * PhotosListMini (フルスクリーン写真表示) のラッパーコンポーネント
 */
function PhotoDisplayWrapper({
    photoLoading,
    viewModeObj,
    compatProps,
    currentPhotoPath,
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    imgCacheMap,
    setImgCacheMap,
    // ... 他のprops
}) {
    const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();
    const shouldDisplay = !photoLoading && compatProps.showPhotoDisplay[displayKey] && currentPhotoPath;

    if (!shouldDisplay) return null;

    return (
        <div id="photos-display-wrapper">
            <AllPhotosContext.Provider value={{ photosListMiniAllPhotos, setPhotosListMiniAllPhotos }}>
                <ImgCacheContext.Provider value={{ imgCacheMap, setImgCacheMap }}>
                    <div className="photo-display">
                        <PhotosListMini
                            // ... すべてのprops
                        />
                    </div>
                </ImgCacheContext.Provider>
            </AllPhotosContext.Provider>
        </div>
    );
}

export default PhotoDisplayWrapper;
```

**削減効果**: PhotosList.jsx から約70行削減

#### 1-2. PhotoListContent コンポーネント (約250行)

**目的**: 写真グリッド表示部分を分離

**場所**: `src/App/PhotosList/PhotoListContent.jsx`

**抽出範囲**: PhotosList.jsx 行1652-1781

```jsx
/**
 * 写真リストのメインコンテンツ表示コンポーネント
 * - アルバム/タグリストモード
 * - 通常の写真グリッド表示
 */
function PhotoListContent({
    photoLoading,
    showSideMenu,
    currentPhotoPath,
    compatProps,
    viewModeObj,
    viewMode,
    // List mode props
    filteredAlbums,
    filteredTags,
    selectedAlbums,
    selectedTags,
    handleAlbumSelection,
    handleTagSelection,
    handleAlbumClick,
    handleTagClick,
    handleNewAlbumClick,
    handleNewTagClick,
    albumSearchTerm,
    setAlbumSearchTerm,
    tagSearchTerm,
    setTagSearchTerm,
    deleteSelectedAlbums,
    deleteSelectedTags,
    clearAlbumSelection,
    clearTagSelection,
    // Photo grid props
    displayedPhotos,
    filteredPhotos,
    iconSize,
    setIconSize,
    sortOfPhotos,
    setSort,
    importSortOfPhotos,
    setImportSort,
    photoSelectionDict,
    addSelection,
    displayPhoto,
    handleInfiniteScroll,
    isLimitedByConfig,
    configLimit,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    importExtensionFilter,
    clearAllFilters,
    showFilterPopover,
    setShowFilterPopover,
    filterButtonRef,
    hasActiveFiltersState,
    importState,
    setShowSideMenu,
    debugMessage,
    // Other props
    clearSearch,
    toggleAlbumListMode,
    openTagsList,
    toggleHome,
    currentDate,
    currentAlbumName,
    currentTagName,
    searchQuery,
    isSearchMode,
    infiniteScrollEnabled,
    displayedPhotoCount,
    renderFilterClearingUI,
    recentPhotosMode,
    datePage,
}) {
    return (
        <div className={(showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"}
             id="photoList"
             style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath)) ? "block" : "none" }}
             data-date={viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()}
             data-page={recentPhotosMode ? (datePage["recent"] || 1) : (isSearchMode ? (datePage["search_results"] || 1) : 1)}>
            <div>
                {/* List Mode (Albums or Tags) */}
                {(viewMode === VIEW_MODES.ALBUM_LIST || viewMode === VIEW_MODES.TAG_LIST) && (
                    <ListModeView
                        viewMode={viewMode}
                        filteredAlbums={filteredAlbums}
                        filteredTags={filteredTags}
                        selectedAlbums={selectedAlbums}
                        selectedTags={selectedTags}
                        handleAlbumSelection={handleAlbumSelection}
                        handleTagSelection={handleTagSelection}
                        handleAlbumClick={handleAlbumClick}
                        handleTagClick={handleTagClick}
                        handleNewAlbumClick={handleNewAlbumClick}
                        handleNewTagClick={handleNewTagClick}
                        albumSearchTerm={albumSearchTerm}
                        setAlbumSearchTerm={setAlbumSearchTerm}
                        tagSearchTerm={tagSearchTerm}
                        setTagSearchTerm={setTagSearchTerm}
                        deleteSelectedAlbums={deleteSelectedAlbums}
                        deleteSelectedTags={deleteSelectedTags}
                        clearAlbumSelection={clearAlbumSelection}
                        clearTagSelection={clearTagSelection}
                    />
                )}

                {/* Regular Photo Display Mode */}
                {viewMode !== VIEW_MODES.ALBUM_LIST && viewMode !== VIEW_MODES.TAG_LIST && (
                    <PhotoGridView
                        displayedPhotos={displayedPhotos}
                        filteredPhotos={filteredPhotos}
                        iconSize={iconSize}
                        setIconSize={setIconSize}
                        sortOfPhotos={viewModeObj.isImportMode() ? importSortOfPhotos : sortOfPhotos}
                        setSort={viewModeObj.isImportMode() ? setImportSort : setSort}
                        photoSelectionDict={photoSelectionDict}
                        onAddSelection={addSelection}
                        onDisplayPhoto={displayPhoto}
                        onInfiniteScroll={handleInfiniteScroll}
                        isLimitedByConfig={isLimitedByConfig}
                        configLimit={configLimit}
                        starFilter={viewModeObj.isImportMode() ? 0 : starFilter}
                        hasCommentFilter={viewModeObj.isImportMode() ? false : hasCommentFilter}
                        hasTagFilter={viewModeObj.isImportMode() ? false : hasTagFilter}
                        extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                        onClearFilters={clearAllFilters}
                        showFilterPopover={showFilterPopover}
                        setShowFilterPopover={setShowFilterPopover}
                        filterButtonRef={filterButtonRef}
                        hasActiveFiltersState={hasActiveFiltersState}
                        showSideMenu={showSideMenu}
                        importState={importState}
                        setShowSideMenu={setShowSideMenu}
                        isLoading={photoLoading}
                        viewModeObj={viewModeObj}
                        clearSearch={clearSearch}
                        toggleAlbumListMode={toggleAlbumListMode}
                        openTagsList={openTagsList}
                        toggleHome={toggleHome}
                        currentDate={currentDate}
                        currentAlbumName={currentAlbumName}
                        currentTagName={currentTagName}
                        searchQuery={searchQuery}
                        isSearchMode={isSearchMode}
                        infiniteScrollEnabled={infiniteScrollEnabled}
                        displayedPhotoCount={displayedPhotoCount}
                        renderFilterClearingUI={renderFilterClearingUI}
                        debugMessage={debugMessage}
                    />
                )}
            </div>
        </div>
    );
}

export default PhotoListContent;
```

**削減効果**: PhotosList.jsx から約130行削減

**さらに細分化**: PhotoListContent内で`ListModeView`と`PhotoGridView`を別コンポーネントに

#### 1-3. SideMenuWrapper コンポーネント (約60行)

**目的**: DirectoryMenuの表示条件とラッピングを分離

**場所**: `src/App/PhotosList/SideMenuWrapper.jsx`

**抽出範囲**: PhotosList.jsx 行1827-1920

```jsx
/**
 * サイドメニュー (DirectoryMenu) のラッパーコンポーネント
 */
function SideMenuWrapper({
    showSideMenu,
    compatProps,
    viewModeObj,
    currentPhotoPath,
    tabClass,
    setTabClass,
    changeTab,
    currentDate,
    closeRightColumn,
    photoSelection,
    clearPhotoSelection,
    selectAllPhotoToSelection,
    selectAllPhotosInDirectory,
    setCurrentDateNum,
    starFilter,
    setStarFilter,
    hasCommentFilter,
    setHasCommentFilter,
    extensionFilter,
    setExtensionFilter,
    importState,
    dateNum,
    albumsList,
    selectedAlbums,
    deleteSelectedAlbums,
    clearAlbumSelection,
    tagsList,
    selectedTags,
    deleteSelectedTags,
    clearTagSelection,
    setShowJobQueue,
    searchMode,
    searchTools,
}) {
    if (!showSideMenu) return null;

    return (
        <div className="rightMenu">
            <div style={{ display: (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath) ? "block" : "none" }}>
                <DirectoryMenu
                    viewModeObj={viewModeObj}
                    addFooterMessage={compatProps.addFooterMessage}
                    tabClass={tabClass}
                    setTabClass={setTabClass}
                    changeTab={changeTab}
                    currentDate={currentDate}
                    closeRightColumn={closeRightColumn}
                    photoSelection={photoSelection}
                    clearPhotoSelection={clearPhotoSelection}
                    selectAllPhotoToSelection={selectAllPhotoToSelection}
                    selectAllPhotosInDirectory={selectAllPhotosInDirectory}
                    setCurrentDateNum={setCurrentDateNum}
                    starFilter={starFilter}
                    setStarFilter={setStarFilter}
                    hasCommentFilter={hasCommentFilter}
                    setHasCommentFilter={setHasCommentFilter}
                    extensionFilter={extensionFilter}
                    setExtensionFilter={setExtensionFilter}
                    importState={importState}
                    dateNum={dateNum}
                    albumsList={albumsList}
                    selectedAlbums={selectedAlbums}
                    deleteSelectedAlbums={deleteSelectedAlbums}
                    clearAlbumSelection={clearAlbumSelection}
                    tagsList={tagsList}
                    selectedTags={selectedTags}
                    deleteSelectedTags={deleteSelectedTags}
                    clearTagSelection={clearTagSelection}
                    setShowJobQueue={setShowJobQueue}
                    searchMode={searchMode}
                    searchTools={searchTools}
                />
            </div>
        </div>
    );
}

export default SideMenuWrapper;
```

**削減効果**: PhotosList.jsx から約50行削減

### Phase 1 の成果

| ファイル | 変更前 | 変更後 | 削減量 |
|---------|------|--------|--------|
| PhotosList.jsx | 1923行 | 約1670行 | 約250行削減 |

**新規作成**:
- PhotoDisplayWrapper.jsx (約80行)
- PhotoListContent.jsx (約250行)
- SideMenuWrapper.jsx (約60行)

---

### Phase 2: イベントハンドラーのフック化 (優先度: 中)

**Phase 1完了後**に実施。イベントハンドラーを機能別カスタムフックに抽出。

#### 2-1. useAlbumHandlers フック

**場所**: `src/hooks/handlers/useAlbumHandlers.js`

**抽出対象**:
- `handleAlbumSelection`
- `handleAlbumClick`
- `handleNewAlbumClick`
- `createEmptyAlbum`
- `handleAlbumUpdate`
- `handleAlbumDelete`
- `deleteSelectedAlbums`
- `clearAlbumSelection`

**行数**: 約150行

#### 2-2. useTagHandlers フック

**場所**: `src/hooks/handlers/useTagHandlers.js`

**抽出対象**:
- `handleTagSelection`
- `handleTagClick`
- `handleNewTagClick`
- `deleteSelectedTags`
- `clearTagSelection`

**行数**: 約100行

#### 2-3. usePhotoDisplayHandlers フック

**場所**: `src/hooks/handlers/usePhotoDisplayHandlers.js`

**抽出対象**:
- `displayPhoto`
- `closePhotoDisplay`
- `addSelection`
- `toggleSelection`
- `isSelected`
- `selectAllPhotoToSelection`
- `clearPhotoSelection`
- `moveToTrashCan`

**行数**: 約100行

#### 2-4. useSearchHandlers フック

**場所**: `src/hooks/handlers/useSearchHandlers.js`

**抽出対象**:
- `handleSearch`
- `handleSavedSearchSelect`
- `clearSearch`

**行数**: 約80行

### Phase 2 の成果

| ファイル | Phase 1後 | Phase 2後 | 削減量 |
|---------|----------|----------|--------|
| PhotosList.jsx | 1670行 | 約1240行 | 約430行削減 |

**新規作成**:
- useAlbumHandlers.js (約150行)
- useTagHandlers.js (約100行)
- usePhotoDisplayHandlers.js (約100行)
- useSearchHandlers.js (約80行)

---

### Phase 3: useEffectの整理 (優先度: 低)

**Phase 2完了後**に実施。複数のuseEffectを機能別に整理。

#### 3-1. usePhotoDataEffects フック

**目的**: 写真データロード関連のuseEffectを統合

**抽出対象**:
- 検索モード時のデータロード
- アルバムモード時のデータロード
- タグモード時のデータロード
- 日付変更時のデータロード

**行数**: 約150行

#### 3-2. useFilterEffects フック

**目的**: フィルター変更時のuseEffectを統合

**抽出対象**:
- フィルター変更時の再フィルタリング
- ソート変更時の並び替え

**行数**: 約80行

### Phase 3 の成果

| ファイル | Phase 2後 | Phase 3後 | 削減量 |
|---------|----------|----------|--------|
| PhotosList.jsx | 1240行 | 約1010行 | 約230行削減 |

**新規作成**:
- usePhotoDataEffects.js (約150行)
- useFilterEffects.js (約80行)

---

## 最終目標

| ファイル | 現在 | Phase 3後 | 削減率 |
|---------|------|-----------|-------|
| PhotosList.jsx | 1923行 | 約1010行 | 47.5% |

**新規ファイル**: 10個 (約1140行)

## 実装手順

### Step 1: Phase 1 - JSX分離 (最優先)

1. PhotoDisplayWrapper.jsx を作成
2. PhotoListContent.jsx を作成
3. SideMenuWrapper.jsx を作成
4. PhotosList.jsx でこれらを使用
5. 動作確認 (`npm run dev`)

### Step 2: Phase 2 - ハンドラーフック化

1. useAlbumHandlers.js を作成
2. useTagHandlers.js を作成
3. usePhotoDisplayHandlers.js を作成
4. useSearchHandlers.js を作成
5. PhotosList.jsx でこれらを使用
6. 動作確認

### Step 3: Phase 3 - useEffect整理

1. usePhotoDataEffects.js を作成
2. useFilterEffects.js を作成
3. PhotosList.jsx でこれらを使用
4. 動作確認

## 利点

1. **段階的な実施**: 各Phaseごとに動作確認可能
2. **シンプルな分割**: JSXコンポーネント分離から開始
3. **後方互換性**: 既存の動作を100%維持
4. **テスタビリティ**: 分離後のコンポーネント・フックを個別テスト可能
5. **保守性向上**: 各ファイルが1000行以下になる

## 注意事項

1. **Phase単位で実施**: 一度にすべてを変更しない
2. **各Phase後にテスト**: 動作確認を必ず実施
3. **propsの受け渡し**: 過度なprop drillingに注意
4. **パフォーマンス**: 不要な再レンダリングが発生しないよう注意

## 成功基準

- [ ] Phase 1完了: PhotosList.jsx が1700行以下
- [ ] Phase 2完了: PhotosList.jsx が1300行以下
- [ ] Phase 3完了: PhotosList.jsx が1100行以下
- [ ] すべてのPhase: 既存機能が100%動作
- [ ] コンパイルエラーなし
- [ ] テスト実行成功
