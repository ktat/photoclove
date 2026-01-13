# ViewState リファクタリング計画

## 現状の問題

### ViewState の冗長性
```javascript
const viewState = {
    mode: viewMode,                    // ✓ 必要
    currentDate: currentDate,          // ✓ 必要
    currentAlbumId: currentAlbumId,    // ❌ viewModeObj.getCurrentAlbumId()で取得可能
    currentAlbumName: currentAlbumName,// ❌ viewModeObj._data.albumNameで取得可能
    currentTagId: currentTagId,        // ❌ viewModeObj.getCurrentTagId()で取得可能
    currentTagName: currentTagName,    // ❌ viewModeObj._data.tagNameで取得可能
    recentPhotosMode: recentPhotosMode,// ❌ mode === VIEW_MODES.RECENTで判別可能
    isTagListMode: isTagListMode,      // ❌ viewModeObj.isTagListMode()で判別可能
    viewModeObj: viewModeObj,          // ✓ 必要
    isSearchMode: isSearchMode         // ❌ viewModeObj.isSearchMode()で判別可能
}
```

## リファクタリング案

### ステップ1: ViewModeクラスにCollection抽象化メソッドを追加

`src/domain/ViewMode.js`に以下を追加：

```javascript
/**
 * Get current collection ID (album or tag)
 * Returns the ID of the currently viewed collection (album or tag)
 * @returns {string|null} Collection ID or null if not in collection mode
 */
getCollectionId() {
    if (this.isAlbumMode()) {
        return this._data.albumId || null;
    }
    if (this.isTagMode()) {
        return this._data.tagId || null;
    }
    return null;
}

/**
 * Get current collection name (album or tag)
 * @returns {string|null} Collection name or null if not in collection mode
 */
getCollectionName() {
    if (this.isAlbumMode()) {
        return this._data.albumName || null;
    }
    if (this.isTagMode()) {
        return this._data.tagName || null;
    }
    return null;
}

/**
 * Get collection type
 * @returns {'album'|'tag'|null}
 */
getCollectionType() {
    if (this.isAlbumMode()) return 'album';
    if (this.isTagMode()) return 'tag';
    return null;
}
```

### ステップ2: ViewStateを最小化

**Before**:
```javascript
const viewState = useMemo(() => ({
    mode: viewMode,
    currentDate: currentDate,
    currentAlbumId: currentAlbumId,
    currentAlbumName: currentAlbumName,
    currentTagId: currentTagId,
    currentTagName: currentTagName,
    recentPhotosMode: recentPhotosMode,
    isTagListMode: isTagListMode,
    viewModeObj: viewModeObj,
    isSearchMode: isSearchMode
}), [viewMode, currentDate, currentAlbumId, currentAlbumName, currentTagId, currentTagName, recentPhotosMode, isTagListMode, viewModeObj, isSearchMode]);
```

**After**:
```javascript
const viewState = useMemo(() => ({
    mode: viewMode,
    currentDate: currentDate,
    viewModeObj: viewModeObj
}), [viewMode, currentDate, viewModeObj]);
```

### ステップ3: 型定義の更新

`src/types/PageState.js`を更新：

```javascript
/**
 * @typedef {Object} ViewState
 * @property {string} mode - VIEW_MODES.DATE | ALBUM | TAG | etc
 * @property {string|null} currentDate - 現在表示中の日付 (YYYY-MM-DD)
 * @property {ViewMode} viewModeObj - ViewModeオブジェクト（全ての判別・データ取得に使用）
 */
```

### ステップ4: 子コンポーネントの更新

**Before** (PhotoListContent.jsx):
```javascript
const {
    viewModeObj,
    mode: viewMode,
    currentDate,
    currentAlbumName,
    currentTagName,
    recentPhotosMode,
    isTagListMode,
    isSearchMode
} = viewState;
```

**After**:
```javascript
const { viewModeObj, mode: viewMode, currentDate } = viewState;

// 必要に応じてviewModeObjから取得
const collectionName = viewModeObj.getCollectionName();
const isSearchMode = viewModeObj.isSearchMode();
```

## 削減効果

### ViewState定義
- **Before**: 10プロパティ、10個の依存配列
- **After**: 3プロパティ、3個の依存配列
- **削減**: 7プロパティ削減 (70%削減)

### メモリ効率
- 不要な値のメモ化が減少
- 依存配列が短くなり、無駄な再計算が減少

### コード可読性
- ViewStateがシンプルに
- 「modeから判別できる」という設計が明確に
- ViewModeクラスの責務が明確に（Single Source of Truth）

## 実装順序

1. ✅ **ViewModeクラスにメソッド追加**
   - `getCollectionId()`
   - `getCollectionName()`
   - `getCollectionType()`

2. **ViewState定義を更新**
   - PhotosList.jsx の viewState を最小化

3. **子コンポーネント更新**
   - PhotoListContent.jsx
   - PhotoDisplayWrapper.jsx
   - SideMenuWrapper.jsx

4. **動作確認**
   - 各モードでの表示確認
   - モード遷移の確認

5. **型定義更新**
   - PageState.js の ViewState 型定義

## 注意事項

- **段階的実装**: 一度に全て変更せず、1コンポーネントずつ更新
- **動作確認**: 各ステップで動作確認を実施
- **後方互換性**: 移行期間中は両方の方法をサポート可能

## その他の検討事項

### currentDateについて
`currentDate`も`viewModeObj.getCurrentDate()`で取得できますが、以下の理由で残す：
- 複数コンポーネントで頻繁に使用される
- `viewModeObj.getCurrentDate()`は日付モード以外ではnullを返すため、使いにくい

### recentPhotosModeについて
- これは`mode === VIEW_MODES.RECENT`と同じ
- `viewModeObj.isRecentMode()`で判別可能
- ViewStateから削除可能
