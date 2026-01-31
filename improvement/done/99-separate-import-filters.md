# Improvement #99: Separate import mode filters and sort options from normal mode

## 問題

Import modeと通常モードでフィルター・ソート設定が共有されているため、以下の問題が発生する：

### フィルターの問題

1. **通常モードのフィルターがimport modeに影響する**:
   - 通常モードでstar=5のフィルターを設定した状態でimport modeに切り替えると、import modeの写真もstar=5でフィルターされてしまう
   - Import modeの写真にはstarメタデータがないため、全ての写真が非表示になる

2. **Import modeで使えないフィルターが表示される**:
   - Star filter（Import modeの写真にはstar情報がない）
   - Comment filter（Import modeの写真にはcomment情報がない）
   - Tag filter（Import modeの写真にはtag情報がない）
   - 唯一有効なのは**Extension filter**のみ

3. **FilterPopoverがimport modeに対応していない**:
   - Import modeで開いても全てのフィルターが表示される

### ソートの問題

4. **Import modeで使えないソートオプションが表示される**:
   - **使用可能**: Added Time (create time, ファイルシステム情報), File Name (ファイルシステム情報)
   - **使用不可**: Shot Time (EXIF情報), Star Rating (DB情報)

## 解決策

1. Import mode用の独立したフィルター状態を作成（extensionのみ）
2. Import mode用の独立したソート状態を作成（Added Time, File Nameのみ）
3. Import modeでは使えないフィルター（star, comment, tag）を非表示にする
4. Import modeでは使えないソート（Shot Time, Star Rating）を非表示にする
5. ViewModeに応じてフィルター・ソート状態を切り替える

### 実装方針

#### Phase 1: Import mode用フィルター・ソート状態の追加

**PhotosList.jsx**:
```javascript
// Import mode用の独立したフィルター・ソート状態
const [importExtensionFilter, setImportExtensionFilter] = useState('all');
const [importSortOfPhotos, setImportSort] = useState(2); // Default: Added Time (desc)

// 現在のモードに応じたフィルターを取得
const activeExtensionFilter = viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter;
const activeStarFilter = viewModeObj.isImportMode() ? 0 : starFilter;
const activeHasCommentFilter = viewModeObj.isImportMode() ? false : hasCommentFilter;
const activeHasTagFilter = viewModeObj.isImportMode() ? false : hasTagFilter;
const activeSortOfPhotos = viewModeObj.isImportMode() ? importSortOfPhotos : sortOfPhotos;
```

#### Phase 2: PhotosToolbarの条件付きレンダリング

**PhotosToolbar.jsx**:
```javascript
function PhotosToolbar({
    // ... existing props
    isImportMode  // 追加
}) {
    return (
        <div className="photo-operation">
            {/* Icon selector - always visible */}

            {/* Sort selector - conditional options */}
            Sort:<select
                name="sort"
                value={sortOfPhotos}
                onChange={(e) => setSort(parseInt(e.target.value))}
            >
                {!isImportMode && <option value={0}>Shot Time (desc)</option>}
                {!isImportMode && <option value={1}>Shot Time (asc)</option>}
                <option value={2}>Added Time (desc)</option>
                <option value={3}>Added Time (asc)</option>
                {!isImportMode && <option value={4}>Star Rating (desc)</option>}
                {!isImportMode && <option value={5}>Star Rating (asc)</option>}
                <option value={6}>File Name (desc)</option>
                <option value={7}>File Name (asc)</option>
            </select>

            {/* Filter button - always visible */}
        </div>
    );
}
```

#### Phase 3: FilterPopoverの条件付きレンダリング

**FilterPopover.jsx**:
```javascript
const FilterPopover = ({
    isOpen,
    onClose,
    anchorRef,
    starFilter,
    setStarFilter,
    hasCommentFilter,
    setHasCommentFilter,
    hasTagFilter,
    setHasTagFilter,
    extensionFilter,
    setExtensionFilter,
    isImportMode  // 追加
}) => {
    // ...

    return (
        <div ref={popoverRef} style={{...}}>
            {/* Star Filter - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    {/* Star filter UI */}
                </div>
            )}

            {/* Comment Filter - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    {/* Comment filter UI */}
                </div>
            )}

            {/* Tag Filter - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    {/* Tag filter UI */}
                </div>
            )}

            {/* Extension Filter - Always visible */}
            <div style={{ marginBottom: '12px' }}>
                {/* Extension filter UI */}
            </div>

            {/* Clear Filters Button */}
            {/* Condition changes based on isImportMode */}
        </div>
    );
};
```

#### Phase 4: フィルター適用ロジックの修正

**PhotosList.jsx** - `applyFiltersWithConfig`:
```javascript
const applyFiltersWithConfig = useCallback((photos) => {
    // Import modeではextensionフィルターのみ適用
    if (viewModeObj.isImportMode()) {
        return applyFrontendFilters(photos, {
            starFilter: 0,
            hasCommentFilter: false,
            hasTagFilter: false,
            extensionFilter: importExtensionFilter
        });
    }

    // 通常モードでは全てのフィルターを適用
    return applyFrontendFilters(photos, {
        starFilter,
        hasCommentFilter,
        hasTagFilter,
        extensionFilter
    });
}, [viewModeObj, starFilter, hasCommentFilter, hasTagFilter, extensionFilter, importExtensionFilter]);
```

### 変更ファイル

1. **`src/App/PhotosList.jsx`**:
   - Import mode用フィルター・ソート状態を追加（`importExtensionFilter`, `importSortOfPhotos`）
   - `applyFiltersWithConfig`でモード別フィルター適用
   - FilterPopoverに`isImportMode`プロップを渡す
   - PhotosToolbarに`isImportMode`プロップを渡す

2. **`src/App/PhotosList/PhotosToolbar.jsx`**:
   - `isImportMode`プロップを追加
   - Import modeでShot Time/Star Ratingソートオプションを非表示

3. **`src/components/FilterPopover.jsx`**:
   - `isImportMode`プロップを追加
   - Import modeでstar/comment/tagフィルターを非表示
   - Clear Filtersボタンの条件を修正

### 期待される効果

- Import modeと通常モードでフィルター・ソート設定が独立する
- Import modeでは拡張子フィルターのみ表示・機能する
- Import modeではAdded Time/File Nameソートのみ表示・機能する
- モード切り替え時にフィルター・ソート設定が相互に影響しない
- ユーザーの混乱を防ぎ、適切なオプションのみ提供

### テスト項目

1. 通常モードでstar=5フィルターを設定し、import modeに切り替えても全ての写真が表示される
2. Import modeでFilterPopoverを開き、extensionフィルターのみ表示される
3. Import modeでextensionフィルター（例: JPGのみ）を設定し、正しくフィルターされる
4. Import modeでSortセレクターを開き、Added Time/File Nameのみ表示される（Shot Time/Star Ratingは非表示）
5. 通常モードでStar Rating (desc)を設定し、import modeに切り替えるとAdded Time (desc)にリセットされる
6. Import modeから通常モードに戻ると、通常モードのフィルター・ソート設定が保持されている
7. Import modeのextensionフィルター・ソート設定は通常モードに影響しない
