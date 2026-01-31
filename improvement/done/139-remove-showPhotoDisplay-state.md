# Improvement #139: Remove showPhotoDisplay State from PhotoContext

## 目的

PhotoContextから冗長な`showPhotoDisplay`状態を削除し、`currentPhotoPath`のみで写真表示状態を管理する。

## 現状の問題

### 状態の重複
```javascript
// PhotoContext.jsx
const [showPhotoDisplay, setShowPhotoDisplay] = useState({});  // ← モードごとの表示状態
const [currentPhotoPath, setCurrentPhotoPath] = useState("");  // ← 現在の写真パス
```

両方が同じ情報を管理している:
- `showPhotoDisplay[mode]` が `true` = 写真が表示中
- `currentPhotoPath` が存在 = 写真が表示中

### 同期の問題

`closePhotoDisplay`で両方を更新している:
```javascript
// usePhotoDisplay.js:99-111
const closePhotoDisplay = useCallback(() => {
    const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();

    compatProps.togglePhotoDisplay(displayKey, false);  // showPhotoDisplay更新
    setCurrentPhotoPath("");                            // currentPhotoPath更新
}, []);
```

→ **Single Source of Truth原則に違反**

## 解決策

`showPhotoDisplay`を完全削除し、`currentPhotoPath`のみで判断する。

### 判定ロジック
```javascript
// BEFORE
const shouldDisplay = showPhotoDisplay[mode] && currentPhotoPath;

// AFTER
const shouldDisplay = currentPhotoPath;  // シンプル！
```

## 実装詳細

### 1. PhotoContext.jsx の修正

**削除する状態:**
```javascript
// 削除
const [showPhotoDisplay, setShowPhotoDisplay] = useState({});
```

**削除する関数:**
```javascript
// 削除
updateShowPhotoDisplay: setShowPhotoDisplay,

togglePhotoDisplay: useCallback((dateKey, show) => {
  setShowPhotoDisplay(prev => ({
    ...prev,
    [dateKey]: show
  }));
}, []),
```

**修正する関数:**
```javascript
// BEFORE
resetPhotoState: useCallback(() => {
  setCurrentDate("");
  setShowPhotoDisplay({});  // ← 削除
  setDatePage({});
  setRecentPhotosMode(false);
}, []),

// AFTER
resetPhotoState: useCallback(() => {
  setCurrentDate("");
  setDatePage({});
  setRecentPhotosMode(false);
}, []),
```

```javascript
// BEFORE
updateRecentPhotosMode: useCallback((mode) => {
  setRecentPhotosMode(mode);
  if (mode) {
    setCurrentDate("");
    setShowPhotoDisplay({});  // ← 削除
    setDatePage({});
  }
}, []),

// AFTER
updateRecentPhotosMode: useCallback((mode) => {
  setRecentPhotosMode(mode);
  if (mode) {
    setCurrentDate("");
    setDatePage({});
  }
}, []),
```

**value から削除:**
```javascript
// BEFORE
const value = {
  // State
  dateList,
  datePage,
  currentDate,
  dateNum,
  showPhotoDisplay,  // ← 削除
  hideLoading,
  // ...
};

// AFTER
const value = {
  // State
  dateList,
  datePage,
  currentDate,
  dateNum,
  hideLoading,
  // ...
};
```

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/context/PhotoContext.jsx` - state削除、関数修正

### 次のタスクで修正されるファイル
- `src/App/PhotosList.jsx` - compatPropsから削除 (#140)
- `src/App/DateList.jsx` - updateShowPhotoDisplay削除 (#140)
- `src/hooks/usePhotoDisplay.js` - togglePhotoDisplay削除 (#140)
- `src/App/PhotosList/PhotoDisplayWrapper.jsx` - 条件判定簡素化 (#140)
- `src/App/PhotosList/PhotoListContent.jsx` - 条件判定簡素化 (#140)
- `src/App/PhotosList/SideMenuWrapper.jsx` - 条件判定簡素化 (#140)

## 期待される効果

- ✅ **Single Source of Truth**: `currentPhotoPath`のみで管理
- ✅ **状態同期バグのリスク削減**: 1つの状態のみ
- ✅ **コード削減**: PhotoContextから約20行削除
- ✅ **理解しやすさ**: 状態管理がシンプルに

## 注意点/リスク

### リスク: 低
- PhotoContextの修正のみ
- 他のファイルは次のタスク(#140)で修正するため、一時的にエラーが出る可能性あり
- #139と#140は連続して実施すべき

### 検証方法

1. ファイルを編集後、構文エラーがないことを確認
2. コンソールで未使用変数の警告を確認
3. 次のタスク(#140)で完全な動作確認

## 依存関係

- **前提タスク**: なし
- **次のタスク**: #140（必須 - このタスクだけでは動作しない）
- **ブロックするタスク**: #140-#146（すべてこのタスク完了後に実施）

## 実装順序

1. PhotoContext.jsx を開く
2. `showPhotoDisplay` state を削除
3. `updateShowPhotoDisplay` を value から削除
4. `togglePhotoDisplay` 関数を削除
5. `resetPhotoState` から `setShowPhotoDisplay({})` を削除
6. `updateRecentPhotosMode` から `setShowPhotoDisplay({})` を削除
7. 保存して構文エラーがないことを確認
8. すぐに #140 に進む（このタスクだけでは不完全）
