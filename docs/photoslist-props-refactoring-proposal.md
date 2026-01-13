# PhotosList.jsx Props 構造化提案

## 現状分析

### ファイル情報
- **ファイルパス**: `src/App/PhotosList.jsx`
- **現在の行数**: 1450行
- **目標**: Props構造化による行数削減とコードの可読性向上

### 既存の構造化Props

PhotosList.jsxでは既に以下のprops構造が導入されています：

1. **viewState** (ViewMode関連の状態)
   - mode, currentDate, currentAlbumId, currentAlbumName, currentTagId, currentTagName, recentPhotosMode, isTagListMode, viewModeObj, isSearchMode

2. **filterState** (フィルター関連の状態)
   - star, comment, tag, extension, importExtension, showPopover, hasActiveFilters

3. **selectionState** (選択状態)
   - photos, count, photoList, albums, tags

4. **displayState** (表示状態)
   - currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sort, importSort, scrollPosition, datePage, numOfPhoto

5. **searchState** (検索状態)
   - isSearchMode, query, filters, results, currentParams, isAdvancedSearchMode

6. **handlers** (イベントハンドラー群)
   - 約40個のハンドラー関数

7. **compatProps** (後方互換性のためのProps)
   - dateList, datePage, currentDate, dateNum, showPhotoDisplay, 各種setter関数, ...props

## 構造化が可能な個別Props

### 1. PhotosListMini State (フルスクリーン表示関連)

**使用箇所**: PhotoDisplayWrapper

**現状の個別Props**:
```javascript
photosListMiniAllPhotos
setPhotosListMiniAllPhotos
photosListMiniReread
photosListMiniCurrentIndex
setPhotosListMiniCurrentIndex
```

**提案構造**:
```javascript
const photosListMiniState = {
  allPhotos: photosListMiniAllPhotos,
  setAllPhotos: setPhotosListMiniAllPhotos,
  reread: photosListMiniReread,
  currentIndex: photosListMiniCurrentIndex,
  setCurrentIndex: setPhotosListMiniCurrentIndex
};
```

**削減見込み**: 約5行 × 使用箇所数

---

### 2. Cache State (キャッシュ関連)

**使用箇所**: PhotoDisplayWrapper, PhotoOption

**現状の個別Props**:
```javascript
imgCacheMap
setImgCacheMap
```

**提案構造**:
```javascript
const cacheState = {
  imgCache: imgCacheMap,
  setImgCache: setImgCacheMap
};
```

**削減見込み**: 約2行 × 使用箇所数

---

### 3. Shortcut State (キーボードショートカット関連)

**使用箇所**: PhotoDisplayWrapper

**現状の個別Props**:
```javascript
shortCutNavigation
setShortCutNavigation
```

**提案構造**:
```javascript
const shortcutState = {
  navigation: shortCutNavigation,
  setNavigation: setShortCutNavigation
};
```

**削減見込み**: 約2行

---

### 4. List Data State (リスト表示用データ)

**使用箇所**: PhotoListContent

**現状の個別Props**:
```javascript
filteredAlbums
filteredTags
albumSearchTerm
tagSearchTerm
```

**提案構造**:
```javascript
const listDataState = {
  filteredAlbums,
  filteredTags,
  albumSearchTerm,
  tagSearchTerm
};
```

**削減見込み**: 約4行

---

### 5. Photo Data State (写真データ関連)

**使用箇所**: PhotoListContent, SideMenuWrapper

**現状の個別Props**:
```javascript
displayedPhotos
filteredPhotos
displayedPhotoCount
allPhotosForCurrentFetch
setAllPhotosForCurrentFetch
```

**提案構造**:
```javascript
const photoDataState = {
  displayed: displayedPhotos,
  filtered: filteredPhotos,
  displayedCount: displayedPhotoCount,
  allForCurrentFetch: allPhotosForCurrentFetch,
  setAllForCurrentFetch: setAllPhotosForCurrentFetch
};
```

**削減見込み**: 約5行 × 使用箇所数

---

### 6. Config State (設定・制限関連)

**使用箇所**: PhotoListContent

**現状の個別Props**:
```javascript
isLimitedByConfig
configLimit
infiniteScrollEnabled
appConfig
```

**提案構造**:
```javascript
const configState = {
  isLimited: isLimitedByConfig,
  limit: configLimit,
  infiniteScrollEnabled,
  app: appConfig
};
```

**削減見込み**: 約4行

---

### 7. Filter Options State (フィルターオプション関連)

**使用箇所**: SideMenuWrapper

**現状の個別Props**:
```javascript
filterOptions
loadFilterOptions
isFilterOptionsLoading
```

**提案構造**:
```javascript
const filterOptionsState = {
  options: filterOptions,
  load: loadFilterOptions,
  isLoading: isFilterOptionsLoading
};
```

**削減見込み**: 約3行

---

### 8. UI Helper State (UI補助要素)

**使用箇所**: PhotoListContent

**現状の個別Props**:
```javascript
debugMessage
renderFilterClearingUI
filterButtonRef
```

**提案構造**:
```javascript
const uiHelperState = {
  debugMessage,
  renderFilterClearingUI,
  filterButtonRef
};
```

**削減見込み**: 約3行

---

## 実装優先順位

### 高優先度（複数コンポーネントで使用）

1. **Photo Data State** - PhotoListContent, SideMenuWrapperで使用
2. **PhotosListMini State** - PhotoDisplayWrapperで多数のprops

### 中優先度（1コンポーネントで複数props）

3. **List Data State** - PhotoListContentで4つのprops
4. **Config State** - PhotoListContentで4つのprops
5. **Filter Options State** - SideMenuWrapperで3つのprops

### 低優先度（2つのprops）

6. **Cache State** - 2コンポーネントで使用だが2つのpropsのみ
7. **Shortcut State** - 1コンポーネントで2つのprops
8. **UI Helper State** - 1コンポーネントで3つのprops

## 削減見込み

### 行数削減の計算

各構造化により：
- Props定義: 構造化により-3〜5行
- コンポーネント呼び出し: 各使用箇所で-2〜4行
- 子コンポーネントでの分解: やや増加（+2〜3行）

**総削減見込み**: 約30-50行

### その他の改善効果

1. **可読性の向上**: 関連するpropsがグループ化される
2. **保守性の向上**: props追加時に関連する箇所が明確
3. **型安全性**: TypeScript型定義がより構造化される
4. **バグの削減**: props渡し忘れが減る

## 実装ステップ

1. `src/types/PageState.js`に新しい型定義を追加
2. PhotosList.jsxで構造化されたstateを作成
3. 子コンポーネント（PhotoDisplayWrapper, PhotoListContent等）を更新
4. 動作確認とテスト
5. 段階的に他のpropsも構造化

## 注意事項

- **後方互換性**: compatPropsは当面維持
- **段階的移行**: 一度に全て変更せず、優先順位順に実装
- **テスト**: 各ステップで動作確認を実施
- **ドキュメント**: 型定義とJSDocを適切に更新

## 参考

- 既存の型定義: `src/types/PageState.js`
- 関連コンポーネント:
  - `src/App/PhotosList/PhotoDisplayWrapper.jsx`
  - `src/App/PhotosList/PhotoListContent.jsx`
  - `src/App/PhotosList/SideMenuWrapper.jsx`
