# Improvement #98: Update Help page for import mode and add selection shortcut

## 問題

PhotosListMini（フルスクリーン表示）のHelpページに以下の問題がある：

1. **`c`キーの説明がない**: 選択/選択解除のショートカットが記載されていない
2. **Import modeの考慮がない**: Import modeで無効なショートカット（s, d, f, Del）が表示されている

## 解決策

1. `c`キーの説明を追加
2. Import modeの場合、無効なショートカットを非表示にする

### 実装方針

**PhotosListMini.jsx** (line 777-792):

```javascript
<div id="help" className={(showHelp ? "" : " hidden")} onClick={() => { setShowHelp(false); document.querySelector("#dummy-for-focus").focus(); }}>
    <h1>Help</h1>
    <table>
        <tr><th>Right/Left Arrow</th><td>navigate photos</td></tr>
        <tr><th>Up Arrow/Down Arrow</th><td>Open/Close mini list</td></tr>
        <tr><th>Ctrl + Mouse Wheel</th><td>zoom photo</td></tr>
        <tr><th>Ctrl + Drag</th><td>drag photo while zooming</td></tr>
        <tr><th>Ctrl + 0</th><td>reset zoom</td></tr>
        <tr><th>C</th><td>toggle photo selection</td></tr>

        {/* Hide DB-related shortcuts in import mode */}
        {!props.isImportMode && (
            <>
                <tr><th>S</th><td>increase star</td></tr>
                <tr><th>D</th><td>decrease star</td></tr>
                <tr><th>F</th><td>favorite (select + 5 stars)</td></tr>
                <tr><th>Del</th><td>{isAlbumMode ? "remove from album" : "move to trash can"}</td></tr>
                {isAlbumMode && <tr><th>Ctrl + Del</th><td>delete file permanently</td></tr>}
            </>
        )}

        <tr><th>I</th><td>toggle photo info</td></tr>
        <tr><th>?</th><td>toggle showing this help</td></tr>
    </table>
</div>
```

### 変更ファイル

- `src/App/PhotosList/PhotosListMini.jsx`: Helpページの条件付きショートカット表示 (line 777-792)

### 期待される効果

- `c`キーの説明が追加され、ユーザーが選択機能を発見しやすくなる
- Import modeで無効なショートカットが非表示になり、ユーザーの混乱を防ぐ
- `f`キーの説明も追加（favorite = select + 5 stars）

### テスト項目

1. 通常モードでHelpを表示し、全てのショートカット（c, s, d, f, Del, i, ?）が表示される
2. Import modeでHelpを表示し、c, i, ?, 矢印キー、ズームのみ表示される（s, d, f, Delは非表示）
3. Album modeでHelpを表示し、Ctrl+Delも表示される
