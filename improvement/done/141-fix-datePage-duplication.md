# Improvement #141: Fix datePage Duplication

## 目的

`displayState`内の`datePage`が`compatProps.datePage`を参照している循環参照を修正する。

## 現状の問題

### 循環参照

```javascript
// PhotosList.jsx:1177
const displayState = useMemo(() => ({
    currentPhotoPath: currentPhotoPath,
    currentPhotoIndex: currentPhotoIndex,
    showSideMenu: showSideMenu,
    iconSize: iconSize,
    sort: sortOfPhotos,
    importSort: importSortOfPhotos,
    scrollPosition: 0,
    datePage: compatProps.datePage,  // ← compatPropsを参照
    numOfPhoto: numOfPhoto
}), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, compatProps.datePage, numOfPhoto]);
```

`compatProps`は`displayState`の後に定義されるべきなのに、`displayState`が`compatProps`を参照している。

### 依存配列の問題

```javascript
// dependency array
}), [/* ... */, compatProps.datePage, /* ... */]);
```

`compatProps.datePage`はオブジェクトの一部なので、不安定な参照になる。

## 解決策

`displayState`が直接`datePage`を参照するように修正する。

## 実装詳細

### PhotosList.jsx の修正

**displayState定義の修正:**
```javascript
// BEFORE
const displayState = useMemo(() => ({
    currentPhotoPath: currentPhotoPath,
    currentPhotoIndex: currentPhotoIndex,
    showSideMenu: showSideMenu,
    iconSize: iconSize,
    sort: sortOfPhotos,
    importSort: importSortOfPhotos,
    scrollPosition: 0,
    datePage: compatProps.datePage,  // ← 修正
    numOfPhoto: numOfPhoto
}), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, compatProps.datePage, numOfPhoto]);

// AFTER
const displayState = useMemo(() => ({
    currentPhotoPath: currentPhotoPath,
    currentPhotoIndex: currentPhotoIndex,
    showSideMenu: showSideMenu,
    iconSize: iconSize,
    sort: sortOfPhotos,
    importSort: importSortOfPhotos,
    scrollPosition: 0,
    datePage: datePage || {},  // ← 直接参照
    numOfPhoto: numOfPhoto
}), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, datePage, numOfPhoto]);
```

**compatPropsから削除:**
```javascript
// BEFORE
const compatProps = {
    dateList: dateList || [],
    datePage: datePage || {},  // ← 削除（displayStateにあるため）
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

// AFTER
const compatProps = {
    dateList: dateList || [],
    // datePage削除
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

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - displayState修正、compatProps修正

### 影響を受けるが修正不要なファイル
- `src/App/PhotosList/PhotoDisplayWrapper.jsx` - displayState.datePageを使用（変更なし）
- その他のコンポーネント - displayState経由で使用（変更なし）

## 期待される効果

- ✅ **循環参照の解消**: displayState → compatProps → displayState の循環がなくなる
- ✅ **依存配列の安定化**: `datePage`を直接参照することで安定した依存関係
- ✅ **コードの明確化**: データの流れが明確になる

## 注意点/リスク

### リスク: 低
- 1ファイルのみの修正
- 参照先を変更するだけ（ロジックは変わらない）
- displayState経由で使用している箇所は影響なし

### 検証方法

1. アプリを起動
2. Recent Photos で写真を表示
3. 別の日付に移動
4. Recent Photos に戻る
5. ページ番号が正しく保持されているか確認
6. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #139, #140（完了推奨だが必須ではない）
- **次のタスク**: #142-#146
- **ブロックするタスク**: なし

## 実装順序

1. PhotosList.jsx を開く
2. displayState の datePage 行を修正
3. displayState の依存配列を修正
4. compatProps から datePage を削除
5. 保存
6. アプリを起動して動作確認
