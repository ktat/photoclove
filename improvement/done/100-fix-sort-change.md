# Improvement #100: Fix sort change not triggering photo list re-sort

## 問題

ソートオプション（Sort selector）を変更しても、写真リストが並び替えられない。

### 発生状況

1. **Import mode**: Sort selector（Added Time / File Name）を変更しても写真リストの順序が変わらない
2. **通常mode**: 要確認（Search modeでは動作している可能性あり）

### 期待される動作

- ユーザーがSort selectorを変更すると、即座に写真リストが新しいソート順で並び替えられる
- 例: "Added Time (desc)" → "File Name (asc)" に変更すると、リストがファイル名の昇順で再表示される

## 原因（調査完了）

### 根本原因: filteredPhotosにソート処理が含まれていない

**`src/App/PhotosList.jsx` line 702-732** の`filteredPhotos` useMemoは、フィルタリングのみを実行し、ソート処理を含んでいない。

```javascript
const filteredPhotos = useMemo(() => {
    const sourcePhotos = /* ... */;
    const photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);

    // フィルタリングのみ実行
    const result = applyFiltersWithConfig(photosWithMethods);

    // ソート処理が存在しない！
    return result;
}, [viewModeObj, albumPhotos, tagPhotos, photoCollection?.photos, allPhotosForCurrentFetch, applyFiltersWithConfig]);
```

### 既存のソート動作

- **Search mode**: line 794-830でsort変更時に`performSearch()`を再実行（バックエンド再フェッチ）
- **Import mode**: ソート変更を監視するロジックが存在しない
- **その他のmode**: ソート変更を監視するロジックが存在しない

### フロントエンドソートが可能な理由

#### 1. 全写真データがメモリに存在

- **Import mode**: `show_importer`コマンドで全ての写真を一度に取得
- **その他のmode**: `allPhotosForCurrentFetch`に全写真が格納済み

#### 2. バックエンドから必要なフィールドが提供される

**Rust側 `src-tauri/src/value/file.rs`**:
```rust
pub struct File {
    pub path: String,
    pub name: String,
    pub dir: String,
    pub created_at: String,  // ✅ Added Time用
    pub is_link: bool,
}
```

**フロントエンド側で利用可能なプロパティ** (`src/domain/Photo.js`):
- `name`: ファイル名（File Name sort用）
- バックエンドの`file.created_at`がフロントエンドで利用可能（要確認・マッピング確認）

#### 3. フィルタリングと同じパターンで実装可能

既存のフィルタリング処理（improvement #99）もフロントエンドで実行されており、ソートも同様のパターンで実装できる。

## 解決策: パターン1（フロントエンドソート）

### 実装方針

`filteredPhotos` useMemo内でフィルタリング後にソート処理を追加する。

### 実装内容

**`src/App/PhotosList.jsx` line 702-732**:

```javascript
const filteredPhotos = useMemo(() => {
    const sourcePhotos = viewModeObj.isAlbumMode() ? albumPhotos :
        (viewModeObj.isTagMode() ? tagPhotos :
            (viewModeObj.isTrashMode() ? (photoCollection?.photos || []) :
                allPhotosForCurrentFetch));

    logger.debug('PhotosList', 'filtered_photos_source', 'Using photo source for filtering', {
        mode: viewModeObj.mode,
        sourceCount: sourcePhotos.length,
        /* ... */
    });

    // Convert source photos to Photo entities if they're plain objects
    const photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);

    // Apply frontend filters
    let result = applyFiltersWithConfig(photosWithMethods);

    // ========== 新規追加: フロントエンドソート ==========
    // Import modeでソート適用
    if (viewModeObj.isImportMode()) {
        const sortComparator = {
            2: (a, b) => {
                // Added Time (desc) - 新しい順
                const aTime = a.file?.created_at || a.created_at || 0;
                const bTime = b.file?.created_at || b.created_at || 0;
                return bTime.localeCompare(aTime);
            },
            3: (a, b) => {
                // Added Time (asc) - 古い順
                const aTime = a.file?.created_at || a.created_at || 0;
                const bTime = b.file?.created_at || b.created_at || 0;
                return aTime.localeCompare(bTime);
            },
            6: (a, b) => {
                // File Name (desc) - Z→A
                return (b.name || '').localeCompare(a.name || '');
            },
            7: (a, b) => {
                // File Name (asc) - A→Z
                return (a.name || '').localeCompare(b.name || '');
            }
        }[importSortOfPhotos];

        if (sortComparator) {
            result = [...result].sort(sortComparator);
            logger.debug('PhotosList', 'import_photos_sorted', 'Applied frontend sort to import photos', {
                sortValue: importSortOfPhotos,
                photoCount: result.length
            });
        }
    }
    // 通常mode・その他のmodeでもソート適用（今後の拡張）
    // else {
    //     // 通常modeのソート処理（必要に応じて追加）
    // }
    // ========== 新規追加ここまで ==========

    logger.debug('PhotosList', 'filtered_photos_result', 'Filtering completed', {
        inputCount: sourcePhotos.length,
        outputCount: result.length,
        resultType: result.length > 0 ? typeof result[0] : 'empty'
    });

    return result;
}, [viewModeObj, albumPhotos, tagPhotos, photoCollection?.photos, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos]);
// ↑ 依存配列に importSortOfPhotos を追加
```

### 変更ファイル

- **`src/App/PhotosList.jsx`**: `filteredPhotos` useMemo内にソート処理を追加、依存配列に`importSortOfPhotos`を追加

### 実装上の注意点

1. **Photo entityのプロパティ確認**:
   - バックエンドの`file.created_at`がフロントエンドでどのプロパティにマッピングされるか確認
   - `a.file?.created_at`、`a.created_at`、または別のプロパティ名の可能性

2. **Date comparison**:
   - `created_at`が文字列（ISO 8601形式）の場合、`localeCompare()`で正しくソート可能
   - タイムスタンプ（数値）の場合、数値比較に変更

3. **通常modeへの拡張**:
   - Import mode以外でもフロントエンドソートを適用する場合、`sortOfPhotos`も依存配列に追加
   - Search modeは既にバックエンドソートを使用しているため、競合しないよう条件分岐が必要

## テスト項目

1. Import modeでAdded Time (desc) → Added Time (asc)に変更し、写真が逆順になる
2. Import modeでAdded Time → File Nameに変更し、ファイル名順に並び替えられる
3. Import modeでFile Name (desc) → File Name (asc)に変更し、A→Z順に変わる
4. フィルター（extension）とソートを組み合わせて正しく動作する
5. ソート変更後、infinite scrollが正しく動作する
6. 通常mode・Search modeで既存のソート動作が壊れていない（回帰テスト）
