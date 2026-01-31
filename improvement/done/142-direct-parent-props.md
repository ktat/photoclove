# Improvement #142: Direct Parent Props Passing

## 目的

親コンポーネント(App.jsx)からのpropsを`...props` spreadではなく、明示的に受け取るように変更する。

## 現状の問題

### 暗黙的なprops受け渡し

```javascript
// PhotosList.jsx:72
function PhotosList(props) {
    const { config: appConfig } = props;  // configだけ明示的に抽出
    // ...

    // compatProps内で残りをspread
    const compatProps = {
        // ...
        ...props  // ← 何が渡されているか不明確
    };
}
```

**App.jsxから渡されているprops:**
- `config`
- `shortCutNavigation`
- `addFooterMessage`

しかし、`...props`によって何が渡されているか不明確。

### 保守性の問題

- 新しい開発者が「どのpropsが渡されているか」を理解しにくい
- IDEの補完が効かない
- 意図しないpropsが渡される可能性

## 解決策

関数シグネチャで明示的にpropsを受け取る。

## 実装詳細

### 1. PhotosList.jsx の修正

**関数シグネチャの変更:**
```javascript
// BEFORE
function PhotosList(props) {
    const { config: appConfig } = props;
    // ...
}

// AFTER
function PhotosList({ config: appConfig, shortCutNavigation, addFooterMessage }) {
    // 直接destructureで受け取る
    // ...
}
```

**compatPropsから...props削除:**
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
    addFooterMessage: addFooterMessage,  // ← これは残す
    ...props  // ← 削除
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
    setCurrentDateNum: setCurrentDateNum,
    addFooterMessage: addFooterMessage
    // ...props 削除
};
```

**shortCutNavigationの使用箇所を確認:**
```javascript
// PhotosList.jsx内でshortCutNavigationが使われているか検索
// もし使われていれば、直接参照に変更
```

### 2. App.jsx での呼び出し確認（変更不要）

**現在の呼び出し:**
```javascript
// App.jsx:359-363, 442-446
<PhotosList
  config={config}
  shortCutNavigation={shortCutNavigation}
  addFooterMessage={addFooterMessage}
/>
```

→ 変更不要（既に明示的に渡されている）

## 影響範囲

### 変更が必要なファイル
1. ✅ `src/App/PhotosList.jsx` - 関数シグネチャ変更、compatProps修正

### 確認が必要なファイル
1. ✅ `src/App.jsx` - 呼び出し箇所の確認（変更不要の見込み）

## 期待される効果

- ✅ **明確性**: どのpropsが渡されているか一目瞭然
- ✅ **保守性**: IDEの補完が効く
- ✅ **型安全性**: JSDocで型定義しやすくなる
- ✅ **意図の明確化**: 必要なpropsのみ受け取る

## 注意点/リスク

### リスク: 低
- 1ファイルのみの修正
- propsの受け取り方を変更するだけ（ロジックは変わらない）

### 検証方法

1. TypeScriptのエラーがないか確認
2. アプリを起動
3. すべてのモードで正常に動作するか確認
4. `shortCutNavigation`が使われている機能（ショートカットキー）が動作するか確認
5. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #139-#141（推奨）
- **次のタスク**: #143-#146
- **ブロックするタスク**: なし

## 実装順序

1. PhotosList.jsx を開く
2. 関数シグネチャを変更
3. compatProps から `...props` を削除
4. `shortCutNavigation` の使用箇所を検索して確認
5. 必要に応じて JSDoc 型定義を追加
6. 保存
7. アプリを起動して動作確認

## 型定義例（オプション）

```javascript
/**
 * PhotosList Component
 *
 * @param {Object} props
 * @param {Object} props.config - Application configuration
 * @param {Object} props.shortCutNavigation - Keyboard shortcut navigation handler
 * @param {Function} props.addFooterMessage - Function to add footer messages
 */
function PhotosList({ config: appConfig, shortCutNavigation, addFooterMessage }) {
    // ...
}
```
