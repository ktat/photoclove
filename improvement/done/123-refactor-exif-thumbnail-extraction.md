# 123: Refactor EXIF Thumbnail Extraction to PhotoMeta

## 概要

EXIF thumbnail抽出ロジックを`photo_meta.rs`の`PhotoMeta`または`PhotoMetaWithExif`のメソッドとして実装し、共通化する。現在2箇所に重複しているコードを統合し、保守性と再利用性を向上させる。

## 背景

### 現在の問題点

#### 1. **コードの重複**
EXIF thumbnail抽出ロジックが2箇所に存在：

**場所1**: `src-tauri/src/domain_service/photo_service.rs`
```rust
fn extract_exif_thumbnail(path: &PathBuf) -> Result<Option<Vec<u8>>, ...> {
    // kexif::Reader を使用してEXIF thumbnailを抽出
    // JPEG marker処理（FFD8, FFD9）
    // 約66行のコード (line 153-219)
}
```

**場所2**: `src-tauri/src/commands/image.rs`
```rust
pub fn get_resized_image(...) -> Result<String, String> {
    // 同じロジックが関数内に埋め込まれている
    // kexif::Reader を使用してEXIF thumbnailを抽出
    // JPEG marker処理（FFD8, FFD9）
    // 約100行のコード (line 153-261)
}
```

#### 2. **不適切な配置**
- `photo_meta.rs`は既に`PhotoMetaWithExif`でEXIFを扱っている
- しかし、EXIF thumbnail抽出ロジックは別の場所に散在
- エンティティ中心の設計になっていない

#### 3. **設定の硬直性**
`use_exif_thumbnail`が各関数内で直接参照され、外部から制御しにくい

## 提案実装

### アプローチ: `PhotoMeta`のメソッドとして実装

#### Phase 1: `photo_meta.rs`に共通メソッドを追加

**ファイル**: `src-tauri/src/entity/photo_meta.rs`

```rust
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::error::Error;

impl PhotoMeta {
    /// EXIF thumbnailを抽出する
    ///
    /// # Arguments
    /// * `path` - 画像ファイルのパス
    /// * `use_exif_thumbnail` - EXIF thumbnail抽出を試みるかどうか（外部から制御）
    ///
    /// # Returns
    /// * `Ok(Some(Vec<u8>))` - EXIF thumbnailデータ（JPEG形式）
    /// * `Ok(None)` - EXIF thumbnailが見つからない、または設定がfalse
    /// * `Err` - ファイル読み込みエラー
    pub fn extract_exif_thumbnail(
        path: &PathBuf,
        use_exif_thumbnail: bool,
    ) -> Result<Option<Vec<u8>>, Box<dyn Error + Send + Sync>> {
        // 設定がfalseなら即座にNone
        if !use_exif_thumbnail {
            log::debug!(target: "photo_meta", "thumbnail_extraction_skipped; use_exif_thumbnail=false; path={:?}", path);
            return Ok(None);
        }

        let file = File::open(path)?;
        let mut bufreader = BufReader::new(&file);

        // EXIF Readerの初期化
        let exif_reader = match kexif::Reader::new().read_from_container(&mut bufreader) {
            Ok(reader) => reader,
            Err(_) => {
                log::debug!(target: "photo_meta", "thumbnail_extraction_failed; error=no_exif_data; path={:?}", path);
                return Ok(None);
            }
        };

        // Thumbnailのオフセットを取得
        let thumbnail_field = match exif_reader.get_field(
            kexif::Tag::JPEGInterchangeFormat,
            kexif::In::THUMBNAIL,
        ) {
            Some(field) => field,
            None => {
                log::debug!(target: "photo_meta", "thumbnail_extraction_failed; error=no_thumbnail_field; path={:?}", path);
                return Ok(None);
            }
        };

        // Thumbnailのサイズを取得
        let length_field = match exif_reader.get_field(
            kexif::Tag::JPEGInterchangeFormatLength,
            kexif::In::THUMBNAIL,
        ) {
            Some(field) => field,
            None => {
                log::debug!(target: "photo_meta", "thumbnail_extraction_failed; error=no_length_field; path={:?}", path);
                return Ok(None);
            }
        };

        // オフセットとサイズを取得
        if let (kexif::Value::Long(ref offset_vec), kexif::Value::Long(ref length_vec)) =
            (&thumbnail_field.value, &length_field.value)
        {
            if let (Some(&offset), Some(&length)) = (offset_vec.get(0), length_vec.get(0)) {
                // Thumbnailデータを読み込む
                drop(bufreader);
                let mut file = File::open(path)?;
                file.seek(SeekFrom::Start(offset as u64))?;
                let mut thumbnail_data = vec![0u8; length as usize];
                file.read_exact(&mut thumbnail_data)?;

                // JPEG start marker (FFD8) を探してトリミング
                let jpeg_start = thumbnail_data
                    .windows(2)
                    .position(|w| w[0] == 0xFF && w[1] == 0xD8);
                let jpeg_data_slice = if let Some(start_pos) = jpeg_start {
                    &thumbnail_data[start_pos..]
                } else {
                    &thumbnail_data[..]
                };

                // JPEG end marker (FFD9) を探してトリミング
                let jpeg_end = jpeg_data_slice
                    .windows(2)
                    .rposition(|w| w[0] == 0xFF && w[1] == 0xD9);

                let jpeg_data: Vec<u8> = if let Some(end_pos) = jpeg_end {
                    // EOI marker found - 有効なJPEGデータを抽出（マーカー含む）
                    jpeg_data_slice[..end_pos + 2].to_vec()
                } else {
                    // EOI marker not found - 追加する
                    log::debug!(target: "photo_meta", "thumbnail_missing_eoi; appending_marker; path={:?}", path);
                    let mut complete_jpeg = jpeg_data_slice.to_vec();
                    complete_jpeg.push(0xFF);
                    complete_jpeg.push(0xD9);
                    complete_jpeg
                };

                log::info!(target: "photo_meta", "thumbnail_extracted; size={}; jpeg_start_offset={}; path={:?}",
                    jpeg_data.len(), jpeg_start.unwrap_or(0), path);
                return Ok(Some(jpeg_data));
            }
        }

        log::debug!(target: "photo_meta", "thumbnail_extraction_failed; error=invalid_field_format; path={:?}", path);
        Ok(None)
    }
}
```

**または、PhotoMetaWithExifのインスタンスメソッドとして**:

```rust
impl PhotoMetaWithExif {
    /// インスタンスが持つ写真のEXIF thumbnailを抽出
    pub fn extract_thumbnail(
        &self,
        use_exif_thumbnail: bool,
    ) -> Result<Option<Vec<u8>>, Box<dyn Error + Send + Sync>> {
        // self.meta.photo.file.path からパスを取得
        let path = PathBuf::from(&self.meta.photo.file.path);
        PhotoMeta::extract_exif_thumbnail(&path, use_exif_thumbnail)
    }
}
```

#### Phase 2: `photo_service.rs` のリファクタリング

**ファイル**: `src-tauri/src/domain_service/photo_service.rs`

```rust
use crate::entity::photo_meta::PhotoMeta;

// 既存のextract_exif_thumbnail関数を削除 (line 153-219)

async fn process_single_file(
    source_path: &PathBuf,
    dest_path: &PathBuf,
    quality: f32,
    size_ratio: f32,
    ignore_file_size: u32,
    use_exif_thumbnail: bool,  // 外部から渡される
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let extension = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "jpg" | "jpeg" => {
            // PhotoMetaの静的メソッドを使用
            if let Some(thumbnail_data) = PhotoMeta::extract_exif_thumbnail(source_path, use_exif_thumbnail)? {
                log::info!(target: "photo_service", "thumbnail_created; method=exif; source={:?}", source_path);
                save_thumbnail(dest_path, source_path, &thumbnail_data)?;
            } else {
                // フォールバック: 画像をリサイズ
                log::info!(target: "photo_service", "thumbnail_created; method=resize_fallback; source={:?}", source_path);
                resize_and_save(source_path, dest_path, quality, size_ratio)?;
            }

            check_and_cleanup_small_files(source_path, dest_path, ignore_file_size)?;
        }
        "mp4" | "webm" => {
            generate_video_thumbnail(source_path, dest_path)?;
        }
        _ => {}
    }

    Ok(())
}
```

#### Phase 3: `image.rs` のリファクタリング

**ファイル**: `src-tauri/src/commands/image.rs`

```rust
use crate::entity::photo_meta::PhotoMeta;

#[tauri::command]
pub fn get_resized_image(
    path_str: &str,
    max_size: u32,
    import_directory: Option<&str>,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    use std::fs::File;
    use std::io::Write;
    use std::time::Instant;

    let start_time = Instant::now();

    // ... キャッシュディレクトリ準備とキャッシュチェック（既存コード）

    // EXIF thumbnailの抽出を試みる（PhotoMetaの静的メソッドを使用）
    let exif_start = Instant::now();
    let should_use_exif = import_directory.is_some() || state.config.use_exif_thumbnail;

    if let Ok(Some(jpeg_data)) = PhotoMeta::extract_exif_thumbnail(&PathBuf::from(path_str), should_use_exif) {
        let exif_time = exif_start.elapsed();

        // キャッシュに保存
        if let Ok(mut cache_file) = File::create(&cache_path) {
            if cache_file.write_all(&jpeg_data).is_ok() {
                log::info!(target: "image", "exif_thumbnail_cached; cache_path={}; exif_ms={}; total_ms={}",
                    cache_path.display(), exif_time.as_millis(), start_time.elapsed().as_millis());

                let cache_path_str = cache_path.to_str()
                    .ok_or_else(|| "Failed to convert cache path to string".to_string())?;
                return Ok(cache_path_str.to_string());
            }
        }

        // キャッシュ書き込み失敗時はdata URLで返す
        let base64_string = general_purpose::STANDARD.encode(&jpeg_data);
        log::warn!(target: "image", "cache_write_failed; returning_data_url");
        return Ok(format!("data:image/jpeg;base64,{}", base64_string));
    }

    // フォールバック: 画像全体をリサイズ（既存コード）
    // ...
}
```

## メリット

### 1. **エンティティ中心の設計**
- EXIF関連の処理が`PhotoMeta`に集約
- `PhotoMetaWithExif`との関連が明確
- DDDの原則に沿った設計

### 2. **コードの一貫性**
- EXIF thumbnail抽出ロジックが1箇所に
- バグ修正や改善が1回で済む
- テストが容易

### 3. **柔軟性の向上**
- `use_exif_thumbnail`を外部から引数として渡す
- サムネイル作成の共通処理として利用可能
- テスト時の制御が容易

### 4. **保守性の向上**
- DRY原則の遵守
- 責任の明確化（PhotoMetaがEXIF処理を担当）
- コード量の削減

## 設計の選択肢

### Option A: 静的メソッド（推奨）
```rust
impl PhotoMeta {
    pub fn extract_exif_thumbnail(
        path: &PathBuf,
        use_exif_thumbnail: bool,
    ) -> Result<Option<Vec<u8>>, ...> { ... }
}

// 使用例
PhotoMeta::extract_exif_thumbnail(&path, true)?;
```

**メリット**:
- パスだけで呼び出せる
- PhotoMetaインスタンス不要
- シンプルで使いやすい

### Option B: インスタンスメソッド
```rust
impl PhotoMetaWithExif {
    pub fn extract_thumbnail(
        &self,
        use_exif_thumbnail: bool,
    ) -> Result<Option<Vec<u8>>, ...> { ... }
}

// 使用例
let photo_meta = PhotoMetaWithExif::new(...);
photo_meta.extract_thumbnail(true)?;
```

**メリット**:
- EXIFデータと関連付けられる
- より OOP的

**デメリット**:
- PhotoMetaWithExifインスタンスが必要
- 使用箇所でインスタンス生成のオーバーヘッド

**推奨**: Option A（静的メソッド）
- 現在の使用パターンに適している
- シンプルで効率的

## 実装手順

### Phase 1: PhotoMetaに静的メソッドを追加
1. `src-tauri/src/entity/photo_meta.rs` に `extract_exif_thumbnail` 静的メソッドを追加
2. 既存のロジックを移植
3. 必要なimportを追加（`kexif`, `std::io::*`など）
4. コンパイル確認（`cargo check`）

### Phase 2: photo_service.rs のリファクタリング
1. `extract_exif_thumbnail` 関数を削除
2. `process_single_file` で `PhotoMeta::extract_exif_thumbnail` を呼ぶ
3. コンパイル確認
4. JobQueue経由でのサムネイル生成をテスト

### Phase 3: image.rs のリファクタリング
1. `get_resized_image` 内のEXIF抽出コードを削除
2. `PhotoMeta::extract_exif_thumbnail` を呼ぶ
3. コンパイル確認
4. リスト表示でのon-demand生成をテスト

### Phase 4: テストと検証
1. Import時のサムネイル生成（JobQueue）
2. リスト表示でのon-demand生成（Date/Album/Tag views）
3. `use_exif_thumbnail = true/false` での動作確認
4. パフォーマンス測定

### Phase 5: ドキュメント更新
1. `docs/source-tree.md` - PhotoMetaの機能追加を記載
2. `docs/architecture.md` - EXIF処理フローを更新

## テスト計画

### 単体テスト（`photo_meta.rs`）
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_extract_exif_thumbnail_with_valid_exif() {
        let path = PathBuf::from("test_data/photo_with_exif_thumbnail.jpg");
        let result = PhotoMeta::extract_exif_thumbnail(&path, true).unwrap();
        assert!(result.is_some());
        let data = result.unwrap();
        assert!(data.starts_with(&[0xFF, 0xD8])); // JPEG start
        assert!(data.ends_with(&[0xFF, 0xD9]));   // JPEG end
    }

    #[test]
    fn test_extract_exif_thumbnail_disabled() {
        let path = PathBuf::from("test_data/photo_with_exif_thumbnail.jpg");
        let result = PhotoMeta::extract_exif_thumbnail(&path, false).unwrap();
        assert!(result.is_none()); // use_exif_thumbnail = false
    }

    #[test]
    fn test_extract_exif_thumbnail_no_exif() {
        let path = PathBuf::from("test_data/photo_without_exif.jpg");
        let result = PhotoMeta::extract_exif_thumbnail(&path, true).unwrap();
        assert!(result.is_none());
    }
}
```

### 統合テスト
1. JobQueue経由のサムネイル生成
2. on-demand生成（リスト表示）
3. 各種view_modeでの動作確認

## 影響範囲

### 変更ファイル
- ✅ **修正**: `src-tauri/src/entity/photo_meta.rs` - 静的メソッド追加
- ✅ **修正**: `src-tauri/src/domain_service/photo_service.rs` - PhotoMetaメソッドを呼ぶ
- ✅ **修正**: `src-tauri/src/commands/image.rs` - PhotoMetaメソッドを呼ぶ

### 影響を受ける機能
- ✅ Import時のサムネイル生成（JobQueue）
- ✅ リスト表示でのon-demand生成（Date/Album/Tag/Import views）

## まとめ

このリファクタリングにより：
1. **コードの重複を排除**（約130行削減）
2. **エンティティ中心の設計**（PhotoMetaがEXIF処理を担当）
3. **柔軟性の向上**（`use_exif_thumbnail`を外部から制御）
4. **保守性の向上**（1箇所の修正で済む）

`PhotoMeta`に配置することで、EXIF関連の処理が自然にまとまり、DDDの原則に沿った設計になります。
