# Improvement #144: Pass Navigation Props Individually

## 目的

`dateList`と`dateNum`を新しいstate groupにまとめるのではなく、必要なコンポーネント(SideMenuWrapper)に個別propsとして直接渡す。

## 現状の問題

### compatProps経由の受け渡し

```javascript
// PhotosList.jsx
const compatProps = {
    dateList: dateList || [],
    dateNum: dateNum || {},
    // ...
};

// SideMenuWrapper.jxsに渡す
<SideMenuWrapper
    // ...
    compatProps={compatProps}  // 全体を渡している
/>

// SideMenuWrapper.jsx内では使わない
// DirectoryMenuに渡すだけ
```

### 使用箇所の限定性

`dateList`と`dateNum`は以下でしか使われない:
- PhotosList.jsx → SideMenuWrapper.jsx → DirectoryMenu.jsx

他のコンポーネントは使用していない。

## 解決策

`dateList`、`dateNum`と関連する更新関数を、SideMenuWrapperに個別propsとして渡す。新しいstate groupは作成しない。

## 実装詳細

### 1. PhotosList.jsx の修正

**SideMenuWrapper呼び出しの修正:**
```javascript
// BEFORE
<SideMenuWrapper
    viewState={viewState}
    filterState={filterState}
    selectionState={selectionState}
    displayState={displayState}
    searchState={searchState}
    photoDataState={photoDataState}
    handlers={handlers}
    compatProps={compatProps}  // ← この中にdateList/dateNumがある
    tabClass={tabClass}
    setTabClass={setTabClass}
    dateNum={compatProps.dateNum}     // ← 重複
    updateDateNum={updateDateNum}
    dateList={compatProps.dateList}   // ← 重複
    updateDateList={updateDateList}
    setShowJobQueueModal={setShowJobQueueModal}
    filterOptions={filterOptions}
    loadFilterOptions={loadFilterOptions}
    isFilterOptionsLoading={isFilterOptionsLoading}
    importState={importState}
    albumsList={albumsList}
    tagsList={tagsList}
/>

// AFTER
<SideMenuWrapper
    viewState={viewState}
    filterState={filterState}
    selectionState={selectionState}
    displayState={displayState}
    searchState={searchState}
    photoDataState={photoDataState}
    handlers={handlers}
    compatProps={compatProps}
    tabClass={tabClass}
    setTabClass={setTabClass}
    dateNum={dateNum || {}}           // ← 直接渡す
    updateDateNum={updateDateNum}
    dateList={dateList || []}         // ← 直接渡す
    updateDateList={updateDateList}
    setShowJobQueueModal={setShowJobQueueModal}
    filterOptions={filterOptions}
    loadFilterOptions={loadFilterOptions}
    isFilterOptionsLoading={isFilterOptionsLoading}
    importState={importState}
    albumsList={albumsList}
    tagsList={tagsList}
/>
```

**compatPropsから削除:**
```javascript
// BEFORE
const compatProps = {
    dateList: dateList || [],    // ← 削除
    currentDate: currentDate || "",
    dateNum: dateNum || {},      // ← 削除
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum
};

// AFTER
const compatProps = {
    currentDate: currentDate || "",
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum
};
```

### 2. SideMenuWrapper.jsx の修正（確認のみ）

既に個別propsとして受け取っているので、変更不要:

```javascript
// SideMenuWrapper.jsx:39-61
function SideMenuWrapper({
    viewState,
    filterState,
    selectionState,
    displayState,
    searchState,
    photoDataState,
    handlers,
    compatProps,
    tabClass,
    setTabClass,
    dateNum,        // ← 既に個別propsとして受け取っている
    updateDateNum,
    dateList,       // ← 既に個別propsとして受け取っている
    updateDateList,
    setShowJobQueueModal,
    filterOptions,
    loadFilterOptions,
    isFilterOptionsLoading,
    importState,
    albumsList,
    tagsList,
})
```

→ **変更不要**（既に正しく実装されている）

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - SideMenuWrapper呼び出し修正、compatProps修正

### 確認が必要（変更不要）なファイル
1. ✅ `src/App/PhotosList/SideMenuWrapper.jsx` - 既に個別propsで受け取っている

## 期待される効果

- ✅ **YAGNI原則に従う**: 不要なstate groupを作らない
- ✅ **シンプル**: 必要な場所に必要なpropsだけ渡す
- ✅ **compatPropsの簡素化**: 2プロパティ削減
- ✅ **明確性**: SideMenuWrapperが何を必要としているか明確

## 注意点/リスク

### リスク: 低
- 1ファイルのみの修正
- SideMenuWrapperは既に正しく実装されている
- compatPropsから削除するだけ

### 検証方法

1. アプリを起動
2. サイドメニューを表示
3. DirectoryMenuで日付一覧が正しく表示されるか確認
4. 日付ごとの写真数が正しく表示されるか確認
5. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #139-#143（推奨）
- **次のタスク**: #145-#146
- **ブロックするタスク**: なし

## 実装順序

1. PhotosList.jsx を開く
2. SideMenuWrapper呼び出しで dateNum/dateList を直接渡すように確認（既にそうなっているはず）
3. compatProps から dateList と dateNum を削除
4. 保存
5. アプリを起動してサイドメニューを確認
6. 日付一覧と写真数が正しく表示されることを確認

## 代替案との比較

### 案1: NavigationState グループを作成
```javascript
const navigationState = useMemo(() => ({
    dateList: dateList || [],
    dateNum: dateNum || {},
    updateDateList,
    updateDateNum,
    setCurrentDateNum
}), [dateList, dateNum, updateDateList, updateDateNum, setCurrentDateNum]);
```

**デメリット:**
- 1箇所でしか使わないのに新しいstate groupが増える
- state groupの数が増えると全体の複雑性が上がる

### 案2: DisplayState に統合
```javascript
const displayState = useMemo(() => ({
    // ...
    dateList: dateList || [],
    dateNum: dateNum || {},
}), [/* ... */]);
```

**デメリット:**
- DisplayStateの責任が広がる（表示設定 + ナビゲーション状態）
- DisplayStateを使う他のコンポーネントに不要なpropsが渡る

### 採用案: 個別props（保守性が最も高い）
- ✅ 使う場所でしか渡さない
- ✅ state groupの数を増やさない
- ✅ シンプルで理解しやすい
