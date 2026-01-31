# Improvement 115: Use EXIF Thumbnail for Import Thumbnail Generation

## 概要

インポート処理でサムネイルを生成する際、`FolderCompressor` を独自の並列処理に置き換え、`use_exif_thumbnail` 設定が `true` の場合はEXIFデータから埋め込みサムネイルを抽出して保存する処理を実装する。

## 背景

現在の実装では：
- インポート後のサムネイル生成は `create_thumbnails()` 関数で外部クレート `image_compressor` の `FolderCompressor` を使用
- `FolderCompressor` はフルサイズ画像をロードしてリサイズしているため、処理時間がかかる
- `use_exif_thumbnail` 設定は存在するが、実際のインポート処理では使用されていない
- インポート前の写真一覧表示では、`import_directory` パラメータがある場合は常にEXIFサムネイルを使用（improvement-114で修正済み）

## 目的

- インポート処理を高速化する
- `use_exif_thumbnail` 設定を実際のインポート処理で活用する
- EXIF埋め込みサムネイルを使用することで、元画像の画質を維持しつつ処理を軽量化
- `FolderCompressor` を独自実装に置き換えることで、処理フローを統一的に管理

## 実装方針

### 1. `create_thumbnails()` 関数の書き換え

**場所**: `src-tauri/src/domain_service/photo_service.rs:28-123`

外部クレート `FolderCompressor` の使用を廃止し、独自の並列処理実装に置き換える。

**新しい関数シグネチャ**:
```rust
pub async fn create_thumbnails(
    dates: date::Dates,
    origin: &PathBuf,
    dest: &PathBuf,
    thread_count: u32,
    quality: f32,
    size_ratio: f32,
    ignore_file_size: u32,
    use_exif_thumbnail: bool,  // 新規パラメータ
) -> Result<(), Box<dyn Error>>
```

**処理フロー**:
```rust
pub async fn create_thumbnails(...) -> Result<(), Box<dyn Error>> {
    for date in dates.dates {
        log::info!(target: "photo_service", "thumbnail_creation; date={}", date.to_string());
        let from = origin.join(date.to_string());
        let to = dest.join(date.to_string());

        process_thumbnails_parallel(
            &from,
            &to,
            thread_count,
            quality,
            size_ratio,
            ignore_file_size,
            use_exif_thumbnail,
        ).await?;
    }
    Ok(())
}
```

### 2. 並列処理関数の実装

**新規関数**: `process_thumbnails_parallel()`

```rust
async fn process_thumbnails_parallel(
    from: &PathBuf,
    to: &PathBuf,
    thread_count: u32,
    quality: f32,
    size_ratio: f32,
    ignore_file_size: u32,
    use_exif_thumbnail: bool,
) -> Result<(), Box<dyn Error>> {
    // 1. ファイル一覧を取得（UUID サブディレクトリも含む）
    let dir = file::Dir::new(from.display().to_string());
    let files = crate::domain_service::dir_service::find_files(&dir);

    // 2. Semaphoreで並列数を制御（thumbnail_parallel設定を使用）
    let semaphore = Arc::new(Semaphore::new(thread_count as usize));
    let mut tasks = vec![];

    // 3. 各ファイルを並列処理
    for file in files.files {
        let sem = semaphore.clone();
        let to = to.clone();
        let file_path = PathBuf::from(file.path);
        let quality = quality;
        let size_ratio = size_ratio;
        let ignore_file_size = ignore_file_size;
        let use_exif = use_exif_thumbnail;

        let task = tokio::spawn(async move {
            let _permit = sem.acquire().await;  // 並列数制限
            process_single_file(
                &file_path,
                &to,
                quality,
                size_ratio,
                ignore_file_size,
                use_exif,
            ).await
        });
        tasks.push(task);
    }

    // 4. すべてのタスクの完了を待つ
    for task in tasks {
        task.await??;
    }

    Ok(())
}
```

**ポイント**:
- `dir_service::find_files()` を使用して、UUID サブディレクトリも含めてファイルを再帰的に取得
- `tokio::sync::Semaphore` で `thumbnail_parallel` 設定に基づいた並列数を制御
- すべてのファイルに対してタスクを生成するが、同時実行数は `thread_count` で制限される
- `FolderCompressor` の動作と同等の並列処理を実現

### 3. 単一ファイル処理関数の実装

**新規関数**: `process_single_file()`

```rust
async fn process_single_file(
    source_path: &PathBuf,
    dest_dir: &PathBuf,
    quality: f32,
    size_ratio: f32,
    ignore_file_size: u32,
    use_exif_thumbnail: bool,
) -> Result<(), Box<dyn Error>> {
    let extension = get_extension(source_path)?;

    match extension.as_str() {
        "jpg" | "jpeg" => {
            if use_exif_thumbnail {
                // EXIF サムネイル抽出を試みる
                if let Some(thumbnail_data) = extract_exif_thumbnail(source_path)? {
                    log::info!(target: "photo_service", "thumbnail_created; method=exif; source={:?}", source_path);
                    save_thumbnail(dest_dir, source_path, &thumbnail_data)?;
                } else {
                    // フォールバック: 画像をリサイズ
                    log::info!(target: "photo_service", "thumbnail_created; method=resize_fallback; source={:?}", source_path);
                    resize_and_save(source_path, dest_dir, quality, size_ratio)?;
                }
            } else {
                // use_exif_thumbnail = false: 直接リサイズ（従来の動作）
                log::info!(target: "photo_service", "thumbnail_created; method=resize; source={:?}", source_path);
                resize_and_save(source_path, dest_dir, quality, size_ratio)?;
            }

            // ignore_file_size チェック（既存の処理を移植）
            check_and_cleanup_small_files(source_path, dest_dir, ignore_file_size)?;
        }
        "mp4" | "webm" => {
            // ffmpeg で動画サムネイル生成（既存の処理を移植）
            generate_video_thumbnail(source_path, dest_dir)?;
        }
        _ => {
            // その他のファイルはスキップ
        }
    }

    Ok(())
}
```

**処理分岐**:
- `use_exif_thumbnail = true`: EXIF抽出 → 成功ならそのまま保存、失敗ならリサイズ
- `use_exif_thumbnail = false`: 直接リサイズ（従来の `FolderCompressor` と同じ動作）

### 4. ヘルパー関数の実装

以下の関数を新規実装：

#### `extract_exif_thumbnail()`
```rust
fn extract_exif_thumbnail(path: &PathBuf) -> Result<Option<Vec<u8>>, Box<dyn Error>> {
    // 既存の get_resized_image() (src-tauri/src/lib.rs:1248-1322) の
    // EXIF抽出ロジックを参考に実装
    // exif クレートを使用して埋め込みサムネイルを抽出
}
```

#### `save_thumbnail()`
```rust
fn save_thumbnail(
    dest_dir: &PathBuf,
    source_path: &PathBuf,
    thumbnail_data: &[u8],
) -> Result<(), Box<dyn Error>> {
    let file_name = source_path.file_name().unwrap();
    let dest_path = dest_dir.join(file_name);
    std::fs::write(dest_path, thumbnail_data)?;
    Ok(())
}
```

#### `resize_and_save()`
```rust
fn resize_and_save(
    source_path: &PathBuf,
    dest_dir: &PathBuf,
    quality: f32,
    size_ratio: f32,
) -> Result<(), Box<dyn Error>> {
    // image クレートを使用してリサイズ処理
    // Factor::new(quality * 100.0, size_ratio) と同等の処理
}
```

#### `check_and_cleanup_small_files()`
```rust
fn check_and_cleanup_small_files(
    source_path: &PathBuf,
    dest_dir: &PathBuf,
    ignore_file_size: u32,
) -> Result<(), Box<dyn Error>> {
    // 既存の52-85行目の処理を移植
    // ファイルサイズチェックとクリーンアップ
}
```

#### `generate_video_thumbnail()`
```rust
fn generate_video_thumbnail(
    source_path: &PathBuf,
    dest_dir: &PathBuf,
) -> Result<(), Box<dyn Error>> {
    // 既存の86-110行目のffmpeg処理を移植
}
```

### 5. ジョブキュー処理の更新

**場所**: `src-tauri/src/domain_service/job_queue_service.rs`

`process_thumbnail_job()` 関数を修正して、`config.use_exif_thumbnail` を渡す：

```rust
let thumbnail_result = futures::executor::block_on(async {
    crate::domain_service::photo_service::create_thumbnails(
        dates_obj,
        &origin,
        &dest,
        config.thumbnail_parallel as u32,
        config.thumbnail_compression_quality,
        config.thumbnail_ratio,
        config.thumbnail_ignore_file_size,
        config.use_exif_thumbnail,  // 追加
    ).await
});
```

## 変更ファイル

### 修正
1. `src-tauri/src/domain_service/photo_service.rs`
   - `create_thumbnails()` を完全に書き換え
   - `process_thumbnails_parallel()` 追加（`dir_service::find_files()` を使用）
   - `process_single_file()` 追加
   - 各種ヘルパー関数追加
   - `FolderCompressor` の使用を削除

2. `src-tauri/src/domain_service/job_queue_service.rs`
   - `process_thumbnail_job()` で `use_exif_thumbnail` を渡す

3. `src-tauri/Cargo.toml`
   - `tokio = { version = "...", features = ["sync"] }` を確認（Semaphore用）
   - `image_compressor` クレートへの依存を削除可能（他で使用していなければ）

### 既存機能の活用
- `src-tauri/src/domain_service/dir_service.rs::find_files()` を使用してファイル一覧を取得
  - UUID サブディレクトリも再帰的にスキャンしてくれる
  - 拡張子フィルタリングは `process_single_file()` 内で行う（対象外の拡張子はスキップ）

## テスト計画

1. **EXIF埋め込みサムネイルがある写真のインポート**
   - `use_exif_thumbnail = true` でインポート
   - サムネイルが正しく生成されることを確認
   - 処理時間が短縮されることを確認
   - ログで `method=exif` が出力されることを確認

2. **EXIF埋め込みサムネイルがない写真のインポート**
   - `use_exif_thumbnail = true` でインポート
   - フォールバック処理（リサイズ）が動作し、サムネイルが生成されることを確認
   - ログで `method=resize_fallback` が出力されることを確認

3. **混在ケース**
   - EXIFありとなしの写真が混在するディレクトリをインポート
   - すべての写真にサムネイルが生成されることを確認
   - 各ファイルで適切な方法が選択されることを確認

4. **動画ファイル**
   - MP4/WebMファイルが含まれるインポート
   - ffmpeg処理が正常に動作することを確認

5. **設定切り替え**
   - `use_exif_thumbnail = false` でインポート
   - 従来通りリサイズ処理が動作することを確認
   - ログで `method=resize` が出力されることを確認

6. **並列処理の検証**
   - `thumbnail_parallel` 設定を変更（1, 4, 8など）
   - 指定した並列数で処理が実行されることを確認
   - ログで同時処理数を確認

7. **ignore_file_size の検証**
   - 小さいファイルサイズの写真をインポート
   - `ignore_file_size` 設定に基づいてサムネイルが削除されることを確認

## パフォーマンス期待値

- **EXIF埋め込みサムネイルのある写真**: **50-90%の処理時間短縮**
  - 現在: フルサイズロード + リサイズ（2-10秒/枚）
  - 改善後: EXIFデータ読み込み + ファイル保存（0.1-0.5秒/枚）

- **EXIF埋め込みサムネイルのない写真**: **既存と同等**
  - フォールバック処理により既存の処理と同じ

- **並列処理**: `thumbnail_parallel` 設定に基づいた並列実行により、複数ファイルの処理が高速化

## リスク・注意点

1. **EXIFサムネイルの品質**
   - カメラによってはEXIFサムネイルの品質が低い場合がある
   - ユーザーが `use_exif_thumbnail` 設定で選択可能

2. **フォールバック処理**
   - EXIF抽出失敗時のリサイズ処理が正しく動作することを確認
   - エラーハンドリングを適切に実装

3. **後方互換性**
   - `use_exif_thumbnail = false` 設定で従来通り動作することを保証
   - リサイズ処理のロジックは `FolderCompressor` と同等にする

4. **依存クレートの削除**
   - `image_compressor` クレートを他で使用していないか確認してから削除

5. **tokio依存**
   - `tokio::sync::Semaphore` を使用するため、tokio の `sync` feature が必要

## ドキュメント更新

- `docs/features/import-process.md` （存在する場合）
  - `use_exif_thumbnail` 設定の説明を更新
  - パフォーマンス情報を追加
  - 並列処理の説明を追加

- `README.md` （該当セクションがある場合）
  - インポートオプションの説明を更新

## 参考

- improvement-114: インポートモード表示でのEXIFサムネイル使用
- improvement-102: EXIF thumbnail config の初期実装
- `src-tauri/src/lib.rs:1248-1322`: 既存のEXIF抽出ロジック
- `src-tauri/src/domain_service/photo_service.rs:28-123`: 既存の `create_thumbnails()` 実装
