# Improvement #101: Add SD card UUID to import mode thumbnail cache filename

## 問題

Import modeのサムネイルキャッシュが、ファイルパスのハッシュのみで生成されているため、異なるSDカード間でファイルパスが同じ場合に衝突が発生する。

### 具体例

**SDカード A**:
- `/media/sdcard-a/DCIM/IMG_0001.jpg`

**SDカード B**:
- `/media/sdcard-b/DCIM/IMG_0001.jpg`

両方のファイルが`/media/*/DCIM/IMG_0001.jpg`として認識される場合、同じハッシュ値が生成され、キャッシュファイルが上書きされる可能性がある。

### 現在の実装

**`src-tauri/src/lib.rs` line 1048-1069**:

```rust
fn get_thumbnail_path_for_photo(photo_path: &str) -> Result<String, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    // Get cache directory
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())?
        .join("photoclove")
        .join("thumbnails");

    // Generate cache filename from path hash (same algorithm as get_resized_image)
    let mut hasher = DefaultHasher::new();
    photo_path.hash(&mut hasher);  // ← ファイルパスのみをハッシュ化
    let hash = hasher.finish();
    let cache_filename = format!("{:x}.jpg", hash);
    let cache_path = cache_dir.join(&cache_filename);

    // Return the cache file path
    cache_path.to_str()
        .ok_or_else(|| "Failed to convert cache path to string".to_string())
        .map(|s| s.to_string())
}
```

### 問題点

1. **衝突リスク**: 同じ相対パスを持つファイルが異なるSDカード上に存在する場合、キャッシュが衝突
2. **キャッシュの誤使用**: SDカード AのサムネイルがSDカード Bの写真に表示される可能性
3. **UUIDが活用されていない**: 通常モードではSDカードごとにUUIDを使用してディレクトリを分けているが、import modeでは未使用

## 解決策

SDカード（またはimport元ディレクトリ）のUUIDをハッシュに含めてキャッシュファイル名を生成する（パターン1）。

### 実装方針

キャッシュファイル名の生成時に、`photo_path + directory_uuid`の組み合わせでハッシュを生成:

```rust
fn get_thumbnail_path_for_photo(photo_path: &str, import_directory: Option<&str>) -> Result<String, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Failed to get cache directory".to_string())?
        .join("photoclove")
        .join("thumbnails");

    // Generate cache filename from path + directory UUID hash
    let mut hasher = DefaultHasher::new();
    photo_path.hash(&mut hasher);

    // If import_directory is provided, include it in hash to avoid collisions
    if let Some(dir) = import_directory {
        // Use existing get_directory_sha256_hash logic
        let dir_uuid = get_directory_sha256_hash(dir);
        dir_uuid.hash(&mut hasher);
    }

    let hash = hasher.finish();
    let cache_filename = format!("{:x}.jpg", hash);
    let cache_path = cache_dir.join(&cache_filename);

    cache_path.to_str()
        .ok_or_else(|| "Failed to convert cache path to string".to_string())
        .map(|s| s.to_string())
}
```

**利点**:
- 衝突リスクがほぼゼロ
- ファイル名が短く保たれる
- ディレクトリ構造がシンプル
- パフォーマンスが良い（ディレクトリ作成不要）

### UUIDの取得方法

#### バックエンド側（調査完了）

既存のロジック`get_directory_sha256_hash()`を使用してディレクトリパスからUUIDを生成。

**`src-tauri/src/entity/importer.rs` line 90-94**:
```rust
fn get_directory_sha256_hash(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

このロジックを`get_thumbnail_path_for_photo()`でも使用する。

#### フロントエンド側

`ImportState`が`currentImportPath`を保持している。

**`src/domain/ImportState.js` line 11**:
```javascript
this.currentImportPath = '';  // 例: "/media/sdcard-a"
```

このパスをバックエンドに渡し、バックエンド側でSHA256ハッシュを生成する。

### フロントエンドの変更

**`src/App/PhotosList/PhotoGrid.jsx`** および **`src/App/PhotosList/PhotosListMini.jsx`**:

```javascript
// 現在
invoke('get_thumbnail_path', { photoPath: photo.originalPath })

// 変更後（import mode判定を追加）
if (photo.import_source === true && importState) {
    invoke('get_thumbnail_path', {
        photoPath: photo.originalPath,
        importDirectory: importState.currentImportPath
    })
} else {
    // 通常モード（既存の動作）
    invoke('get_thumbnail_path', { photoPath: photo.originalPath })
}
```

または、バックエンド側でimport_directoryがnullの場合に既存ロジックを使用するため、常に渡す:

```javascript
invoke('get_thumbnail_path', {
    photoPath: photo.originalPath,
    importDirectory: importState?.currentImportPath || null
})
```

### 変更ファイル

#### バックエンド
1. **`src-tauri/src/lib.rs`**:
   - `get_thumbnail_path_for_photo()` (line 1048-1069): `import_directory: Option<&str>` パラメータを追加
   - ディレクトリUUIDを取得し、ハッシュに含める
   - `get_thumbnail_path()` (line 1300-1302): `import_directory: Option<&str>` パラメータを追加（Tauri command）
   - `get_directory_sha256_hash()`を使用してディレクトリUUIDを生成（既存関数を活用）

#### フロントエンド
2. **`src/App/PhotosList/PhotoGrid.jsx`**:
   - `invoke('get_thumbnail_path')`呼び出し時にuuidを渡す

3. **`src/App/PhotosList/PhotosListMini.jsx`**:
   - `invoke('get_thumbnail_path')`呼び出し時にuuidを渡す

4. **`src/domain/ImportState.js`**:
   - 変更不要（既存の`currentImportPath`をそのまま使用）

### キャッシュクリーンアップへの影響

パターン1では、UUID別のディレクトリ構造を使用しないため、`clear_import_cache()`の変更は不要。
全てのimport modeキャッシュを一括削除する既存のロジックをそのまま使用。

## 期待される効果

- 異なるSDカード間でのサムネイルキャッシュ衝突を完全に防止
- 正しい写真に対応するサムネイルが表示される
- SDカードごとのキャッシュ管理が可能（必要に応じて削除）

## テスト項目

1. 同じファイル名（例: `IMG_0001.jpg`）を持つ写真が異なるSDカードに存在する場合、それぞれ異なるサムネイルキャッシュが生成される
2. SDカード Aのimport modeから通常モードに戻り、SDカード Bのimport modeに入った際、キャッシュが混在しない
3. Import modeから通常モードに切り替えた際、キャッシュがクリアされる
4. 既存の通常モードのサムネイルキャッシュ（UUID別ディレクトリ）と競合しない
