# Improvement #96: Hide Editor/Tags tabs for import mode in PhotoOption

## 問題

Import modeのPhotoOption（写真表示時のタブ）で、EditorとTagsタブが表示されているが、import modeの写真はDB管理されていないため、これらのタブは不要。

- **Editorタブ**: 編集した画像を保存してもDBに登録されない
- **Tagsタブ**: タグを設定してもDBに保存されない

## 解決策

Import modeの場合、Editor/Tagsタブを非表示にする。Infoタブのみ表示（EXIF情報は有用）。

### 実装方針

**PhotoOption.jsx** (line 41-54):

```javascript
{/* Hide Editor tab in import mode */}
{!props.isImportMode && (
    <button 
        className={activeTab === "editor" ? "vertical-tab-button active" : "vertical-tab-button"}
        onClick={() => handleTabClick("editor")}
        title="Photo Editor"
    >
        <span className="vertical-text">Editor</span>
    </button>
)}

{/* Hide Tags tab in import mode */}
{!props.isImportMode && (
    <button 
        className={activeTab === "tags" ? "vertical-tab-button active" : "vertical-tab-button"}
        onClick={() => handleTabClick("tags")}
        title="Photo Tags"
    >
        <span className="vertical-text">Tags</span>
    </button>
)}
```

### 変更ファイル

- `src/App/PhotosList/PhotoOption.jsx`: 条件付きタブ表示 (line 41-54)

### 期待される効果

- Import modeで不要なタブが非表示
- ユーザーの混乱を防ぐ
- Infoタブで必要なEXIF情報は確認可能

### テスト項目

1. 通常モードでPhotoOptionを開き、Info/Editor/Tagsタブが表示される
2. Import modeでPhotoOptionを開き、Infoタブのみ表示される
3. Album modeでAlbumタブも正しく表示される
