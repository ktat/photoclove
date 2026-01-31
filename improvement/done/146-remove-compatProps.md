# Improvement #146: Remove compatProps Completely

## 目的

#139-#145の結果、compatPropsが空または不要になった場合、完全に削除する。

## 前提条件

#139-#145により、compatPropsの全プロパティが以下のいずれかに移行済み:
- ✅ viewState, displayState, handlers などの適切なstate groupに移動
- ✅ 個別propsとして直接コンポーネントに渡す
- ✅ 不要と判明して削除

## 実装詳細

### 1. PhotosList.jsx の修正

**compatPropsオブジェクトの削除:**
```javascript
// BEFORE
const compatProps = {
    // すべてのプロパティが移行済みで空、または
    // 残っているが実際には使われていない
};

// AFTER
// compatProps 定義を完全削除
```

**compatProps を使用している箇所の修正:**

すべての子コンポーネントから `compatProps` prop を削除:

```javascript
// BEFORE
<PhotoDisplayWrapper
    // ...
    compatProps={compatProps}
    // ...
/>

// AFTER
<PhotoDisplayWrapper
    // ...
    // compatProps 削除
    // ...
/>
```

### 2. 子コンポーネントの修正

**PhotoDisplayWrapper.jsx:**
```javascript
// BEFORE
function PhotoDisplayWrapper({
    photoLoading,
    viewState,
    filterState,
    displayState,
    searchState,
    handlers,
    compatProps,  // ← 削除
    // ...
})

// AFTER
function PhotoDisplayWrapper({
    photoLoading,
    viewState,
    filterState,
    displayState,
    searchState,
    handlers,
    // compatProps 削除
    // ...
})
```

**PhotoListContent.jsx:**
```javascript
// BEFORE
function PhotoListContent({
    photoLoading,
    compatProps,  // ← 削除
    viewState,
    // ...
})

// AFTER
function PhotoListContent({
    photoLoading,
    viewState,
    // ...
})
```

**SideMenuWrapper.jsx:**
```javascript
// BEFORE
function SideMenuWrapper({
    viewState,
    filterState,
    selectionState,
    displayState,
    searchState,
    photoDataState,
    handlers,
    compatProps,  // ← 削除
    // ...
})

// AFTER
function SideMenuWrapper({
    viewState,
    filterState,
    selectionState,
    displayState,
    searchState,
    photoDataState,
    handlers,
    // compatProps 削除
    // ...
})
```

### 3. 最終確認

すべてのファイルで `compatProps` の参照がないことを確認:

```bash
grep -rn "compatProps" src/App/PhotosList/
grep -rn "compatProps" src/App/PhotosList.jsx
```

→ すべて削除されていることを確認

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - compatProps定義削除、子コンポーネントへの受け渡し削除
2. ✅ `src/App/PhotosList/PhotoDisplayWrapper.jsx` - props削除
3. ✅ `src/App/PhotosList/PhotoListContent.jsx` - props削除
4. ✅ `src/App/PhotosList/SideMenuWrapper.jsx` - props削除

### 削除される可能性のあるファイル
- なし（compatPropsは実装の一部であり、独立したファイルではない）

## 期待される効果

- ✅ **完全な移行完了**: 一時的な互換レイヤーの削除
- ✅ **コードの明確化**: データフローが完全に明確に
- ✅ **保守性の向上**: state groupによる適切な責任分離
- ✅ **行数削減**: 約20-30行削減見込み

## 注意点/リスク

### リスク: 低（前提タスクが完了していれば）
- #139-#145がすべて完了していることが前提
- 各タスクで段階的に移行済みなので、このタスク自体のリスクは低い

### 検証方法

**完全な動作確認:**

1. **アプリ起動**
   - エラーなく起動するか

2. **全モードのテスト**
   - Recent Photos モード
   - Date View モード
   - Album モード（一覧・詳細）
   - Tag モード（一覧・詳細）
   - Search モード（通常・詳細検索）
   - Import モード

3. **写真表示**
   - 写真をクリックして詳細表示
   - 写真を閉じてグリッドに戻る
   - キーボードナビゲーション

4. **日付ナビゲーション**
   - サイドメニューの日付一覧
   - 日付ごとの写真数表示
   - 日付切り替え

5. **操作全般**
   - 写真の選択
   - ゴミ箱への移動
   - 復元
   - フィルター
   - ソート
   - アルバム・タグ操作

6. **エラーチェック**
   - コンソールにエラーがないか
   - 警告が出ていないか

## 依存関係

- **前提タスク**: #139-#145（すべて必須）
- **次のタスク**: なし（このシリーズの最終タスク）
- **ブロックするタスク**: なし

## 実装順序

1. #139-#145 がすべて完了していることを確認
2. compatProps の参照を検索して、残っている箇所がないか確認
3. PhotosList.jsx で compatProps オブジェクトの定義を削除
4. PhotosList.jsx で子コンポーネントへの compatProps 受け渡しを削除
5. PhotoDisplayWrapper.jsx から compatProps props を削除
6. PhotoListContent.jsx から compatProps props を削除
7. SideMenuWrapper.jsx から compatProps props を削除
8. 最終確認: `grep -rn "compatProps" src/` で何もヒットしないことを確認
9. アプリを起動
10. 上記の「検証方法」に従って完全な動作確認
11. すべてのモードと機能が正常に動作することを確認
12. コミット

## 成功基準

- [x] compatProps の定義が完全に削除されている
- [x] すべてのファイルで compatProps の参照がない
- [x] アプリが正常に起動する（ビルドが成功: ✓ 580 modules transformed）
- [ ] すべてのモードで写真が表示される（要手動テスト）
- [ ] 写真の詳細表示が動作する（要手動テスト）
- [ ] 日付ナビゲーションが動作する（要手動テスト）
- [ ] すべての操作が正常に動作する（要手動テスト）
- [ ] コンソールにエラーがない（要手動テスト）

## 完了状況

✅ **実装完了** - 2025-12-30

### 実施した変更

1. **PhotosList.jsx**
   - compatProps オブジェクト定義を削除（元 lines 150-157）
   - deletePhotosHandler の依存配列から compatProps を削除
   - restorePhotosHandler の依存配列から compatProps を削除
   - PhotoDisplayWrapper への compatProps prop を削除
   - PhotoListContent への compatProps prop を削除
   - SideMenuWrapper への compatProps prop を削除
   - 重複宣言の修正:
     - `addFooterMessage` を useUI() から削除（親propsから既に受け取っている）
     - 派生した `isAdvancedSearchMode` を削除（親propsから受け取る）

2. **PhotoDisplayWrapper.jsx**
   - JSDoc から compatProps を削除
   - 関数パラメータから compatProps を削除

3. **PhotoListContent.jsx**
   - JSDoc から compatProps を削除
   - 関数パラメータから compatProps を削除

4. **SideMenuWrapper.jsx**
   - JSDoc から compatProps を削除
   - 関数パラメータから compatProps を削除

### ビルド結果
```
✓ 580 modules transformed.
✓ built in 2.69s
```
→ コンパイルエラーなし、正常にビルド完了

## コミットメッセージ例

```
refactor: Remove compatProps compatibility layer

Complete migration of all properties from compatProps to appropriate state groups:
- showPhotoDisplay → removed (use currentPhotoPath)
- datePage → displayState
- addFooterMessage → handlers (direct from parent props)
- dateList/dateNum → individual props to SideMenuWrapper

This completes the PhotosList refactoring series (#139-#146), achieving:
- Cleaner data flow through semantic state groups
- Removal of temporary compatibility layer
- Improved maintainability and code clarity

Related: #139, #140, #141, #142, #143, #144, #145
```

## 備考

このタスクは #139-#145 シリーズの集大成であり:
- 各タスクで段階的に移行を進めた結果
- compatProps が不要になったことを確認
- 完全に削除して移行を完了する

前のタスクが適切に実装されていれば、このタスクは単純な削除作業になるはず。
