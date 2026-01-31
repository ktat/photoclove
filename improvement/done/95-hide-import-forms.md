# Improvement #95: Hide star/comment forms for import mode photos in PhotoInfo

## 問題

Import modeのPhotoInfo（infoタブ）で、starsとcommentの編集フォームが表示されているが、import modeの写真はDB管理されていないため、これらのフォームは不要で、保存しても意味がない。

### 現状の動作

`src/App/PhotosList/PhotoOption/PhotoInfo.jsx` line 144-161:

```javascript
<div>
    Stars:
    <span className="star">
        {[0, 1, 2, 3, 4].map((v, i) => {
            return <a key={i} href="#" value={v} onClick={(e) => { e.preventDefault(); toggleStar(v) }}>{props.star[i] ? "★" : "☆"}</a>
        })}
    </span>
</div>
<div className="comment">
    Comment:<br />
    <textarea
        onChange={(e) => setComment(e.target.value)}
        value={comment}>
    </textarea>
    <button onClick={() => saveComment()}>SAVE</button>
</div>
```

- Import modeの写真でもstars/commentフォームが表示される
- `save_star`/`save_comment`を実行してもDBに保存されない（DB未登録のため）
- ユーザーを混乱させる

## 解決策

Import modeの写真の場合、stars/commentフォームを非表示にする。

### 実装方針

#### Phase 1: import_sourceフラグの伝播

**PhotosList.jsx → PhotoOption.jsx**:
```javascript
<PhotoOption
    // ... existing props
    isImportMode={viewMode === VIEW_MODES.IMPORT}
    // or
    currentPhoto={currentPhoto}  // Photo entity with import_source flag
/>
```

**PhotoOption.jsx → PhotoInfo.jsx**:
```javascript
<PhotoInfo
    // ... existing props
    isImportMode={props.isImportMode}
/>
```

#### Phase 2: 条件付きレンダリング

**PhotoInfo.jsx** (line 144-161):
```javascript
{/* Only show stars/comment forms for non-import photos */}
{!props.isImportMode && (
    <>
        <div>
            Stars:
            <span className="star">
                {[0, 1, 2, 3, 4].map((v, i) => {
                    return <a key={i} href="#" value={v} onClick={(e) => { e.preventDefault(); toggleStar(v) }}>{props.star[i] ? "★" : "☆"}</a>
                })}
            </span>
        </div>
        <div className="comment">
            Comment:<br />
            <textarea
                onChange={(e) => setComment(e.target.value)}
                value={comment}>
            </textarea>
            <button onClick={() => saveComment()}>SAVE</button>
        </div>
    </>
)}

{/* Optional: Show informational message for import mode */}
{props.isImportMode && (
    <div style={{ padding: "10px", color: "#999", fontSize: "12px" }}>
        Note: Stars and comments are not available for photos in import mode.
        Import photos to your library to add metadata.
    </div>
)}
```

### 変更ファイル

1. `src/App/PhotosList.jsx`: `isImportMode`フラグをPhotoOptionに渡す
2. `src/App/PhotosList/PhotoOption.jsx`: `isImportMode`フラグをPhotoInfoに渡す
3. `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`: 条件付きレンダリング

### 期待される効果

- Import modeで不要なフォームが非表示
- ユーザーの混乱を防ぐ
- UI/UXの改善

### テスト項目

1. 通常モードでPhotoInfoを開き、stars/commentフォームが表示される
2. Import modeでPhotoInfoを開き、stars/commentフォームが非表示
3. Import modeでEXIF情報は正しく表示される
4. 通常モードでstars/commentの保存が正常に動作する
