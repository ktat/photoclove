# Improvement #129: Split PhotosList.jsx (1995 lines → under 1000 lines)

## 目的
PhotosList.jsx が 1995 行あり、保守性が低下している。
1000 行以下に分割して、コードの可読性・保守性を向上させる。

## 現状分析

### ファイルサイズ
- `src/App/PhotosList.jsx`: 1995 行
- 関数数: 130個
- 最大関数: `getPhotos` (238行), `loadAllPhotosBasedOnViewMode` (176行)

### 既に抽出済みの hooks
- ✅ usePhotoSelection.js
- ✅ usePhotosState.js
- ✅ usePhotoOperations.js
- ✅ usePhotoDataLoader.js
- ✅ useViewModeSync.js
- ✅ useImportLifecycle.js
- ✅ useInfiniteScroll.js

## 実装プラン

### Phase 1: Photo Loading Logic の抽出 (~450 lines)

**新規ファイル**: `src/hooks/usePhotoLoader.js`

**抽出対象** (PhotosList.jsx lines 1291-1782):
- `getPhotos()` - 238 lines
- `loadAllPhotosBasedOnViewMode()` - 176 lines
- `loadPhotosWithCollection()` - wrapper function
- Photo loading 関連の state:
  - `photoLoading`
  - `currentPhotoLoadingController`
- 関連する helper functions

**Hook API**:
```javascript
const {
  getPhotos,
  loadAllPhotosBasedOnViewMode,
  loadPhotosWithCollection,
  photoLoading,
  currentPhotoLoadingController,
  setCurrentPhotoLoadingController
} = usePhotoLoader({
  viewModeObj,
  appConfig,
  sortOfPhotos,
  starFilter,
  hasCommentFilter,
  extensionFilter,
  setPhotosList,
  setAllPhotosForCurrentFetch,
  // ... other dependencies
});
```

**削減**: 1995 - 450 = **1545 lines**

---

### Phase 2: Collection Management の抽出 (~250 lines)

**新規ファイル**: `src/hooks/useCollectionManagement.js`

**抽出対象** (PhotosList.jsx lines 469-660):
- Album 関連:
  - `loadAlbums()`
  - `loadAlbumPhotos()`
  - `createEmptyAlbum()`
  - `handleNewAlbumClick()`
  - `deleteSelectedAlbums()`
- Tag 関連:
  - `loadTags()`
  - `loadTagPhotos()`
  - `handleTagClick()`
  - `handleNewTagClick()`
  - `deleteSelectedTags()`
- State:
  - `albumsList`
  - `tagsList`
  - `showCreateAlbumModal`

**Hook API**:
```javascript
const {
  // Album
  albumsList,
  loadAlbums,
  loadAlbumPhotos,
  createEmptyAlbum,
  handleNewAlbumClick,
  deleteSelectedAlbums,
  showCreateAlbumModal,
  setShowCreateAlbumModal,
  // Tag
  tagsList,
  loadTags,
  loadTagPhotos,
  handleTagClick,
  handleNewTagClick,
  deleteSelectedTags
} = useCollectionManagement({
  appConfig,
  viewModeObj,
  changeMode,
  setPhotosList,
  clearAlbumSelection,
  clearTagSelection
});
```

**削減**: 1545 - 250 = **1295 lines**

---

### Phase 3: Search & Filter Management の抽出 (~200 lines)

**新規ファイル**: `src/hooks/useSearchAndFilterManagement.js`

**抽出対象** (PhotosList.jsx lines 133-890):
- Search handlers:
  - `handleSearch()`
  - `clearSearch()`
  - `handleSavedSearchSelect()`
  - `handleFiltersChange()`
- Filter handlers:
  - `clearAllFilters()`
  - `applyFiltersWithConfig()`
  - `renderFilterClearingUI()`
- Filter options loading:
  - `loadFilterOptions()`
  - `filterOptions` state
  - `isFilterOptionsLoading` state
- Effects:
  - Sort change re-execution (lines 850-885)
  - Filter options loading (lines 1022-1029)

**Hook API**:
```javascript
const {
  // Search
  handleSearch,
  clearSearch,
  handleSavedSearchSelect,
  handleFiltersChange,
  // Filters
  clearAllFilters,
  applyFiltersWithConfig,
  renderFilterClearingUI,
  // Filter options
  filterOptions,
  isFilterOptionsLoading,
  loadFilterOptions
} = useSearchAndFilterManagement({
  isSearchMode,
  currentSearchParams,
  searchResults,
  sortOfPhotos,
  performSearch,
  setStarFilter,
  setHasCommentFilter,
  setHasTagFilter,
  setExtensionFilter,
  setSearchQuery,
  changeMode
});
```

**削減**: 1295 - 200 = **1095 lines**

---

### Phase 4: UI Components の抽出 (~200 lines)

#### 4-1. PhotosListHeader Component

**新規ファイル**: `src/App/PhotosList/PhotosListHeader.jsx`

**抽出対象**:
- Header section (title, breadcrumbs, mode indicators)
- Album/Tag info display
- Photo count display

**Props**:
```javascript
<PhotosListHeader
  viewState={viewState}
  displayState={displayState}
  albumInfo={albumInfo}
  tagInfo={tagInfo}
  photoCount={totalPhotos}
/>
```

**サイズ**: ~80 lines

---

#### 4-2. PhotosListToolbar Component

**新規ファイル**: `src/App/PhotosList/PhotosListToolbar.jsx`

**抽出対象**:
- Sort dropdown
- Filter buttons
- View mode toggles
- Selection actions

**Props**:
```javascript
<PhotosListToolbar
  viewState={viewState}
  filterState={filterState}
  selectionState={selectionState}
  handlers={handlers}
  sortOfPhotos={sortOfPhotos}
  setSort={setSort}
/>
```

**サイズ**: ~100 lines

---

#### 4-3. PhotosListModals Component

**新規ファイル**: `src/App/PhotosList/PhotosListModals.jsx`

**抽出対象**:
- CreateAlbumModal
- JobQueueModal
- Other modals

**Props**:
```javascript
<PhotosListModals
  showCreateAlbumModal={showCreateAlbumModal}
  setShowCreateAlbumModal={setShowCreateAlbumModal}
  showJobQueueModal={showJobQueueModal}
  setShowJobQueueModal={setShowJobQueueModal}
  createEmptyAlbum={createEmptyAlbum}
/>
```

**サイズ**: ~50 lines

**削減**: 1095 - 230 = **865 lines**

---

## 実装順序

### Step 1: Phase 1 実装
1. `src/hooks/usePhotoLoader.js` を作成
2. PhotosList.jsx から関数を移動
3. テスト実行
4. Commit: "refactor: Extract photo loading logic to usePhotoLoader hook (Phase 1/4)"

### Step 2: Phase 2 実装
1. `src/hooks/useCollectionManagement.js` を作成
2. PhotosList.jsx から関数を移動
3. テスト実行
4. Commit: "refactor: Extract collection management to useCollectionManagement hook (Phase 2/4)"

### Step 3: Phase 3 実装
1. `src/hooks/useSearchAndFilterManagement.js` を作成
2. PhotosList.jsx から関数を移動
3. テスト実行
4. Commit: "refactor: Extract search and filter management (Phase 3/4)"

### Step 4: Phase 4 実装
1. Header, Toolbar, Modals の各 Component を作成
2. PhotosList.jsx から JSX を移動
3. テスト実行
4. Commit: "refactor: Extract UI components (Phase 4/4)"

### Step 5: 最終確認
1. 全機能テスト
2. 行数確認: `wc -l src/App/PhotosList.jsx` → 目標 1000 行以下
3. Commit: "refactor: Complete PhotosList.jsx split (1995 → <1000 lines)"

---

## テスト計画

各 Phase 後に以下をテスト:

### 基本機能
- [ ] Date View でのフォト表示
- [ ] Album View でのフォト表示
- [ ] Tag View でのフォト表示
- [ ] Import Mode でのフォト表示
- [ ] Search 機能

### フィルタ・ソート
- [ ] Star filter
- [ ] Comment filter
- [ ] Extension filter
- [ ] Sort dropdown

### Collection 操作
- [ ] Album 作成・削除
- [ ] Tag 作成・削除
- [ ] Album に写真追加
- [ ] Tag に写真追加

### Photo 操作
- [ ] Star 変更
- [ ] Comment 追加
- [ ] Trash に移動
- [ ] 複数選択・削除

---

## 注意事項

### DRY 原則
- 共通ロジックは util 関数に抽出
- 重複コードは統合

### 依存関係
- Hook の循環参照を避ける
- 必要最小限の props のみ渡す

### Logging
- 各 hook に適切な logger 呼び出しを配置
- エラーハンドリングを維持

### Backward Compatibility
- 既存の機能を壊さない
- API の変更は最小限に

---

## 成功基準

- [x] PhotosList.jsx が 1000 行以下
- [x] すべてのテストが pass
- [x] 既存機能が正常動作
- [x] コードの可読性向上
- [x] 各ファイルが単一責任原則に従っている

---

## 見積もり

- Phase 1: 2-3 時間
- Phase 2: 2-3 時間
- Phase 3: 2-3 時間
- Phase 4: 1-2 時間
- Testing: 1-2 時間
- **Total**: 8-13 時間

---

keep context
