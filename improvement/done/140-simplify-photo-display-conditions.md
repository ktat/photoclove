# Improvement #140: Simplify Photo Display Conditions

## 目的

#139で削除した`showPhotoDisplay`への参照をすべて削除し、`currentPhotoPath`ベースの条件判定に変更する。

## 現状の問題

### 冗長な条件判定

```javascript
// PhotoDisplayWrapper.jsx:89
const shouldDisplay = !photoLoading && compatProps.showPhotoDisplay[displayKey] && currentPhotoPath;

// PhotoListContent.jsx:135
(!compatProps.showPhotoDisplay[mode] || !currentPhotoPath) ? "block" : "none"

// SideMenuWrapper.jsx:101
(!compatProps.showPhotoDisplay[mode] || !currentPhotoPath) ? "block" : "none"
```

すべて `currentPhotoPath` だけで判断できる。

### 不要な関数呼び出し

```javascript
// usePhotoDisplay.js:110
compatProps.togglePhotoDisplay(displayKey, false);  // 不要
setCurrentPhotoPath("");  // これだけで十分

// DateList.jsx:118, 190
updateShowPhotoDisplay({});  // 不要（モード切り替え時に自動的にクリアされる）
```

## 解決策

すべての`showPhotoDisplay`参照を削除し、`currentPhotoPath`のみで判断する。

## 実装詳細

### 1. PhotosList.jsx の修正

**PhotoContextから削除:**
```javascript
// BEFORE
const {
    dateList,
    datePage,
    updateDatePage,
    currentDate,
    updateCurrentDate,
    dateNum,
    updateDateNum,
    updateDateList,
    showPhotoDisplay,        // ← 削除
    updateShowPhotoDisplay,  // ← 削除
    setCurrentDateNum,
    recentPhotosMode,
    // ...
    togglePhotoDisplay       // ← 削除
} = usePhoto();

// AFTER
const {
    dateList,
    datePage,
    updateDatePage,
    currentDate,
    updateCurrentDate,
    dateNum,
    updateDateNum,
    updateDateList,
    setCurrentDateNum,
    recentPhotosMode,
    // ...
} = usePhoto();
```

**compatProps から削除:**
```javascript
// BEFORE
const compatProps = {
    dateList: dateList || [],
    datePage: datePage || {},
    currentDate: currentDate || "",
    dateNum: dateNum || {},
    showPhotoDisplay: showPhotoDisplay || {},    // ← 削除
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setShowPhotoDisplay: updateShowPhotoDisplay, // ← 削除
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    togglePhotoDisplay: togglePhotoDisplay,      // ← 削除
    setCurrentDateNum: setCurrentDateNum,
    addFooterMessage: addFooterMessage,
    ...props
};

// AFTER
const compatProps = {
    dateList: dateList || [],
    datePage: datePage || {},
    currentDate: currentDate || "",
    dateNum: dateNum || {},
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum,
    addFooterMessage: addFooterMessage,
    ...props
};
```

**条件判定の簡素化:**
```javascript
// BEFORE (line 1357)
{(!compatProps.showPhotoDisplay || !currentPhotoPath) && (

// AFTER
{!currentPhotoPath && (

// BEFORE (line 1371)
{(compatProps.showPhotoDisplay && currentPhotoPath) && (

// AFTER
{currentPhotoPath && (
```

### 2. usePhotoDisplay.js の修正

**closePhotoDisplay:**
```javascript
// BEFORE (lines 99-111)
const closePhotoDisplay = useCallback(() => {
    logger.info('usePhotoDisplay', 'close_photo_display', 'Closing full-screen photo display', {
        viewMode: viewModeObj?.currentMode
    });

    setShowSideMenu(false);

    const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();

    compatProps.togglePhotoDisplay(displayKey, false);  // ← 削除
    setCurrentPhotoPath("");

    // Cancel any existing photo loading before starting new request
    if (currentPhotoLoadingController) {
        // ...
    }
}, [/* deps */]);

// AFTER
const closePhotoDisplay = useCallback(() => {
    logger.info('usePhotoDisplay', 'close_photo_display', 'Closing full-screen photo display', {
        viewMode: viewModeObj?.currentMode
    });

    setShowSideMenu(false);
    setCurrentPhotoPath("");

    // Cancel any existing photo loading before starting new request
    if (currentPhotoLoadingController) {
        // ...
    }
}, [/* deps */]);
```

**dependency array も更新:**
```javascript
// compatProps.togglePhotoDisplay を依存配列から削除
```

### 3. DateList.jsx の修正

**PhotoContextから削除:**
```javascript
// BEFORE
const {
    dateList,
    datePage,
    dateNum,
    hideLoading,
    updateCurrentDate,
    updateShowPhotoDisplay,  // ← 削除
    recentPhotosMode,
    updateRecentPhotosMode
} = usePhoto();

// AFTER
const {
    dateList,
    datePage,
    dateNum,
    hideLoading,
    updateCurrentDate,
    recentPhotosMode,
    updateRecentPhotosMode
} = usePhoto();
```

**handleDateClick の修正:**
```javascript
// BEFORE (lines 113-120)
const handleDateClick = (year, month, day) => {
    const date = new Date(year + '/' + month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
    setSelectedStyle({ ["a-" + date]: "#ccc", ["li-" + date]: "square" });
    logger.info('DateList', 'date_click', 'Date clicked - starting navigation', { date });
    updateRecentPhotosMode(false);
    updateCurrentDate(date);
    updateShowPhotoDisplay({});  // ← 削除（不要）
    showDatePhotos(date);
};

// AFTER
const handleDateClick = (year, month, day) => {
    const date = new Date(year + '/' + month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
    setSelectedStyle({ ["a-" + date]: "#ccc", ["li-" + date]: "square" });
    logger.info('DateList', 'date_click', 'Date clicked - starting navigation', { date });
    updateRecentPhotosMode(false);
    updateCurrentDate(date);
    showDatePhotos(date);
};
```

**Recent Photos クリックの修正:**
```javascript
// BEFORE (lines 185-192)
onClick={(e) => {
    e.preventDefault();
    logger.info('DateList', 'recent_photos_click', 'Recent Photos clicked - starting navigation');
    setSelectedStyle({});
    updateRecentPhotosMode(true);
    updateShowPhotoDisplay({});  // ← 削除（不要）
    showRecentPhotos();
}}

// AFTER
onClick={(e) => {
    e.preventDefault();
    logger.info('DateList', 'recent_photos_click', 'Recent Photos clicked - starting navigation');
    setSelectedStyle({});
    updateRecentPhotosMode(true);
    showRecentPhotos();
}}
```

### 4. PhotoDisplayWrapper.jsx の修正

**条件判定の簡素化:**
```javascript
// BEFORE (lines 87-89)
const isTrashMode = viewModeObj.isTrashMode();
const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();
const shouldDisplay = !photoLoading && compatProps.showPhotoDisplay[displayKey] && currentPhotoPath;

// AFTER
const isTrashMode = viewModeObj.isTrashMode();
const shouldDisplay = !photoLoading && currentPhotoPath;
```

**setShowPhotoDisplay prop削除:**
```javascript
// BEFORE (line 105)
<PhotosListMini
    // ...
    setShowPhotoDisplay={compatProps.setShowPhotoDisplay}  // ← 削除
    // ...
/>

// AFTER
<PhotosListMini
    // ...
    // setShowPhotoDisplay prop削除
    // ...
/>
```

### 5. PhotoListContent.jsx の修正

**条件判定の簡素化:**
```javascript
// BEFORE (lines 135-137)
<div className={(showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"}
     id="photoList"
     style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath)) ? "block" : "none" }}
     data-date={viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()}
     data-page={recentPhotosMode ? (datePage["recent"] || 1) : (isSearchMode ? (datePage["search_results"] || 1) : 1)}>

// AFTER
<div className={(showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"}
     id="photoList"
     style={{ display: (!photoLoading && !currentPhotoPath) ? "block" : "none" }}
     data-date={viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()}
     data-page={recentPhotosMode ? (datePage["recent"] || 1) : (isSearchMode ? (datePage["search_results"] || 1) : 1)}>
```

### 6. SideMenuWrapper.jsx の修正

**条件判定の簡素化:**
```javascript
// BEFORE (line 101)
<div style={{ display: (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath) ? "block" : "none" }}>

// AFTER
<div style={{ display: !currentPhotoPath ? "block" : "none" }}>
```

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - compatProps削除、条件簡素化
2. ✅ `src/hooks/usePhotoDisplay.js` - togglePhotoDisplay削除
3. ✅ `src/App/DateList.jsx` - updateShowPhotoDisplay削除
4. ✅ `src/App/PhotosList/PhotoDisplayWrapper.jsx` - 条件簡素化、prop削除
5. ✅ `src/App/PhotosList/PhotoListContent.jsx` - 条件簡素化
6. ✅ `src/App/PhotosList/SideMenuWrapper.jsx` - 条件簡素化

## 期待される効果

- ✅ **条件判定がシンプル**: `currentPhotoPath`のみで判断
- ✅ **コード削減**: 約30-40行削除
- ✅ **保守性向上**: 状態管理が明確
- ✅ **バグリスク削減**: 同期の必要がなくなる

## 注意点/リスク

### リスク: 中
- 6ファイルに影響
- 条件判定ロジックの変更
- 十分なテストが必要

### 検証方法

1. アプリを起動
2. Recent Photos で写真を開く → 正常に表示されるか
3. 写真を閉じる → グリッドに戻るか
4. Date View で写真を開く → 正常に表示されるか
5. Recent Photos ↔ Date View を切り替え → 写真表示が適切に閉じるか
6. Album、Tag、Search モードでも同様にテスト
7. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #139（必須）
- **次のタスク**: #141-#146
- **ブロックするタスク**: なし

## 実装順序

1. #139 が完了していることを確認
2. PhotosList.jsx を修正
3. usePhotoDisplay.js を修正
4. DateList.jsx を修正
5. PhotoDisplayWrapper.jsx を修正
6. PhotoListContent.jsx を修正
7. SideMenuWrapper.jsx を修正
8. アプリを起動して動作確認
9. すべてのモードで写真表示/非表示が正常に動作することを確認
