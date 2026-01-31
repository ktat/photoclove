# 重複機能の調査とDRY原則に基づく修正案

## 調査結果

重複機能を調査した結果、以下の重複が確認されました：

### 1. ファイルパスの処理
- `src-tauri/src/lib.rs` 内の `get_thumbnail_path_for_photo` と `get_resized_image` 関数で同じパスハッシュ計算ロジックが重複
- `get_thumbnail_path_for_photo` と `get_resized_image` の両方で同じSHA256ハッシュ計算ロジックが使用されています

### 2. 日付フィルターの処理
- `get_photos_unified` 関数内に複数箇所で日付のパースロジックが重複
- `date::Date::from_string()` の呼び出しと日付フォーマットの判定ロジックが複数箇所で再利用

### 3. ジョブキュー操作の共通処理
- `retry_job`, `delete_job`, `delete_job_unit` などのジョブ管理コマンドで、ジョブキュー管理の基本的なロジックが重複

### 4. データベース操作の共通処理
- `get_all_collections` と `get_collection_photos` で、データベース接続とクエリの基本的な構造が似ています

## DRY原則に基づく修正案

### 1. 共通のユーティリティ関数の作成

```rust
// src-tauri/src/utils.rs
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use sha2::{Digest, Sha256};
use std::path::Path;

/// 画像ファイルのキャッシュパスを生成する共通関数
pub fn generate_cache_path(photo_path: &str, import_directory: Option<&str>) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use sha2::{Digest, Sha256};

    // キャッシュディレクトリの取得
    let cache_dir = dirs::cache_dir()
        .expect("Failed to get cache directory")
        .join("photoclove")
        .join("thumbnails");

    // パスハッシュの生成
    let mut hasher = DefaultHasher::new();
    photo_path.hash(&mut hasher);

    if let Some(dir) = import_directory {
        let mut sha_hasher = Sha256::new();
        sha_hasher.update(dir.as_bytes());
        let dir_uuid = format!("{:x}", sha_hasher.finalize());
        dir_uuid.hash(&mut hasher);
    }

    let hash = hasher.finish();
    let cache_filename = format!("{:x}.jpg", hash);
    cache_dir.join(&cache_filename).to_string_lossy().to_string()
}

/// 日付のパースを共通化
pub fn parse_date_string(date_str: &str, delimiter: Option<&str>) -> date::Date {
    if date_str.trim().is_empty() {
        date::Date::empty()
    } else {
        date::Date::from_string(&date_str.to_string(), delimiter)
    }
}

/// データベース接続の共通処理
pub fn get_database_connection(import_to: &str) -> Result<rusqlite::Connection, String> {
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(import_to.to_string());
    sqlite_db.get_connection()
        .map_err(|e| format!("Database connection failed: {}", e))
}
```

### 2. データベース操作の共通化

```rust
// src-tauri/src/database_utils.rs
use crate::entity::photo_collection::PhotoCollection;
use crate::entity::photo::Photos;
use crate::value::date::Dates;

/// コレクション情報を取得する共通関数
pub fn get_collections_common(
    meta_db: &repository::MetaDB,
    collection_type: Option<&str>,
    config: &config::Config,
) -> Result<Vec<serde_json::Value>, String> {
    meta_db.get_all_collections(collection_type, config.clone())
}

/// 写真コレクションに写真を追加する共通関数
pub fn add_photo_to_collection_common(
    meta_db: &repository::MetaDB,
    collection_id: i32,
    photo_path: &str,
) -> Result<(), String> {
    meta_db.add_photo_to_collection(collection_id, photo_path)
}

/// 写真コレクションから写真を削除する共通関数
pub fn remove_photo_from_collection_common(
    meta_db: &repository::MetaDB,
    collection_id: i32,
    photo_path: &str,
) -> Result<(), String> {
    meta_db.remove_photo_from_collection(collection_id, photo_path)
}
```

### 3. ジョブ管理の共通化

```rust
// src-tauri/src/job_utils.rs
use crate::domain_service::job_queue_service::JobQueueManager;

/// ジョブ管理の共通関数
pub fn manage_job_common<F>(
    job_queue_manager: &std::sync::Mutex<JobQueueManager>,
    job_id: i64,
    operation: F,
) -> Result<String, String>
where
    F: FnOnce(&JobQueueManager) -> Result<bool, String>,
{
    let job_queue_manager = job_queue_manager.lock().unwrap();
    match operation(&job_queue_manager) {
        Ok(success) => Ok(format!("{{\"result\": {}}}", success)),
        Err(e) => Err(e),
    }
}

/// ジョブの再試行
pub fn retry_job_common(
    job_queue_manager: &std::sync::Mutex<JobQueueManager>,
    job_id: i64,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    manage_job_common(job_queue_manager, job_id, |manager| {
        manager.retry_job(job_id, app_handle)
    })
}

/// ジョブの削除
pub fn delete_job_common(
    job_queue_manager: &std::sync::Mutex<JobQueueManager>,
    job_id: i64,
) -> Result<String, String> {
    manage_job_common(job_queue_manager, job_id, |manager| {
        manager.delete_job(job_id)
    })
}

/// ジョブユニットの削除
pub fn delete_job_unit_common(
    job_queue_manager: &std::sync::Mutex<JobQueueManager>,
    job_unit_id: String,
) -> Result<String, String> {
    manage_job_common(job_queue_manager, 0, |manager| {
        manager.delete_job_unit(job_unit_id)
    })
}
```

### 4. 修正後の主要な関数のリファクタリング例

#### `get_resized_image` 関数の修正

```rust
#[tauri::command]
fn get_resized_image(
    path_str: &str,
    max_size: u32,
    import_directory: Option<&str>,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    use image::imageops::FilterType;
    use image::io::Reader as ImageReader;
    use image::{GenericImageView, ImageFormat};
    use std::io::Cursor;
    use base64::{Engine as _, engine::general_purpose};
    use std::time::Instant;
    use std::fs::File;
    use std::io::BufReader;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::io::Write;
    use sha2::{Digest, Sha256};

    // 1. キャッシュパスの生成を共通関数に移動
    let cache_path_str = generate_cache_path(path_str, import_directory);
    let cache_path = std::path::Path::new(&cache_path_str);

    // 2. キャッシュのチェックロジックを共通化
    if cache_path.exists() {
        if let Ok(cache_metadata) = fs::metadata(cache_path) {
            if let Ok(source_metadata) = fs::metadata(path_str) {
                if let (Ok(cache_modified), Ok(source_modified)) = (cache_metadata.modified(), source_metadata.modified()) {
                    if cache_modified >= source_modified {
                        return Ok(cache_path_str);
                    }
                }
            }
        }
    }

    // 3. 以降のロジックは変更なし
    // ... (省略)
}
```

#### `get_photos_unified` 関数内の日付処理のリファクタリング

```rust
// 1. 日付のパースロジックを共通化
match search_type.as_str() {
    "date" => {
        let date_str = query.ok_or_else(|| {
            log::error!(target: "get_photos", "missing_date_query");
        })?;
        
        // 2. 共通の日付パース関数を使用
        let date = parse_date_string(&date_str, Some("-")); // または Option::Some("-")
        
        // ... 以降のロジック
    }
    // ... 他のケース
}
```

#### ジョブ管理コマンドのリファクタリング

```rust
#[tauri::command]
fn retry_job(
    job_id: i64,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    retry_job_common(&state.job_queue_manager, job_id, window.app_handle().clone())
}

#[tauri::command]
fn delete_job(job_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    delete_job_common(&state.job_queue_manager, job_id)
}

#[tauri::command]
fn delete_job_unit(
    job_unit_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    delete_job_unit_common(&state.job_queue_manager, job_unit_id)
}
```

## 修正の利点

1. **保守性の向上**: 一度修正すれば、すべての場所で変更が反映される
2. **コードの可読性**: 共通処理が明確になり、各関数の目的がより明確になる
3. **バグの減少**: 同じロジックが複数箇所に分散することによる潜在的な不整合を防ぐ
4. **開発効率**: 新しい機能追加時に共通処理を再利用できる
5. **DRY原則の遵守**: 無駄なコードの重複を排除し、より効率的な開発が可能になる

これらの修正により、プロジェクト全体の品質と保守性が向上します。
