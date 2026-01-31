# src-tauri/src 未使用コード・変数一覧

`cargo check` により検出された未使用コード・変数のレポートです。

**検出された警告数**: 99件

---

## 1. 未使用インポート (Unused Imports)

| ファイル | 未使用インポート |
|---------|----------------|
| `commands/image_commands.rs:9` | `crate::entity::config::Config` |
| `commands/import_commands.rs:3,5,7` | `Config`, `entity::*`, `Arc`, `Mutex` |
| `commands/trash_commands.rs:14` | `RepositoryDB` |
| `commands/collection_commands.rs:2` | `MetaInfoDB` |
| `commands/photo_handlers/album.rs:7` | `MetaInfoDB` |
| `commands/photo_handlers/collections.rs:6` | `MetaInfoDB` |
| `domain_service/job_queue/executor.rs:7` | `Manager` |
| `domain_service/job_queue/utils/mod.rs:4-5` | `date_extractor::*`, `events::*` |
| `domain_service/logging_service.rs:1,3,6,9` | `DateTime`, `Utc`, `debug`, `error`, `Path`, `uuid::Uuid` |
| `entity/photo_meta.rs:4` | `date` |
| `repository/meta_db/sqlite/mod.rs:20-21` | `meta_db`, `file` |
| `repository/meta_db/sqlite/dates.rs:5` | `rusqlite::params` |
| `repository/meta_db/sqlite/search.rs:8` | `rusqlite::params` |
| `lib.rs:22` | `BatchOperationResult`, `CameraInfo`, `ExtensionInfo`, `LensInfo`, `PhotoRequest`, `SearchFilters` |

---

## 2. 未使用変数 (Unused Variables)

| ファイル | 変数名 |
|---------|--------|
| `commands/database_commands.rs:133` | `date_str` |
| `commands/logging_commands.rs:67` | `state` |
| `commands/config_commands.rs:16,32` | `state` (2箇所) |
| `domain_service/photo_service.rs:40,50` | `tr`, `ret` |
| `domain_service/file_service.rs:41` | `library_path` |
| `domain_service/job_queue/handlers/google_photos.rs:10` | `db` |
| `entity/importer.rs:271,320` | `origin_repo_db`, mutable変数 |
| `repository/db/directory.rs:439,481` | `config` (2箇所) |
| `repository/dir.rs:72` | `sort` |

---

## 3. 未使用メソッド・関数 (Dead Code)

### entity/google_photos.rs
- `struct GooglePhotosAlbum` (構造体自体が未使用)
- `field refresh_token`
- `methods: get_album, create_album, get_request`

### entity/importer.rs
- `struct ImporterSelectedFiles`
- `fn is_sha256_hash`
- `fn get_directory_sha256_hash`
- `fn migrate_files_from_sha256_to_uuid`
- `fn get_or_create_source_uuid`
- `fn copy_file`
- `impl: new, import_photos, add_photo_file, update`

### entity/photo.rs
- `method set_tags`

### entity/photo_collection.rs
- `fn from_str, to_string`
- 複数の associated items
- `fn new, get_metadata_value, set_metadata_value`

### entity/photo_meta.rs
- `methods: set_star, set_comment`
- `methods: iter, remove, get_with_photo`
- `fn new_from_photo, clone`

### entity/config.rs
- `method reload`

### error.rs
- `methods: category, severity, suggestion, is_recoverable, with_correlation_id`
- `method with_user_action`
- `type alias PhotoCloveResult`
- `fn: permission_denied, file_not_found, database_error, insufficient_space, import_error, thumbnail_failed`

### repository.rs
- `variants PhotoTime, Name` (Sort enum)
- `method len` (DatesNum)
- `method new_connect`
- `trait RepositoryConfig`
- 複数のメソッド

### repository/meta_db/sqlite/*.rs
- `mod.rs:174`: `get_photo_created_at`, `get_photos_with_tags`
- `photo_metadata.rs:10`: `record_photo_metas`
- `photo_crud.rs:98,135,358`: `restore_photo_from_trash`, `update_photo_path`, `get_photo_created_at`
- `tags.rs`: `get_all_tags`, `get_all_tags_with_photo_count`, `create_tag`, `delete_tag`, `add_tag_to_photo`, `remove_tag_from_photo`, `get_photos_with_tags`
- `albums.rs`: `get_all_albums`, `create_album`, `update_album`, `delete_album`, `add_photo_to_album`, `remove_photo_from_album`

### domain_service/job_queue/manager.rs
- `method stop_background_processing`

### value/*.rs
- `comment.rs:15`: `set_comment`
- `file.rs:297`: `create_file_if_not_exists`
- `star.rs:17`: `set_star`

---

## 4. その他の問題

| 種類 | ファイル | 内容 |
|------|---------|------|
| 到達不能コード | `entity/google_photos.rs:114` | `todo!()` マクロ後のコード |
| 未使用代入 | `entity/google_photos.rs:125` | `album_id` |
| 未使用代入 | `repository/meta_db/sqlite/albums.rs:198` | `photo_count` |
| 非推奨API | `entity/photo_meta.rs:83` | `IndexMap::remove` → `swap_remove` or `shift_remove` |
| snake_case違反 | `repository.rs:104,116` | `hasComment` |
| snake_case違反 | `repository/db/directory.rs:96,339` | `hasComment` |
| 無意味な `.clone()` | `entity/importer.rs:252` | 参照への clone |
| 未使用Result | `entity/google_photos.rs:111` | Result未処理 |

---

## 推定影響

- **コンパイル時警告**: 99件
- **削除可能な推定行数**: 500〜800行
- **主要な未使用モジュール**:
  - `entity/google_photos.rs` の大部分
  - `entity/importer.rs` のヘルパー関数群
  - `tags.rs`, `albums.rs` の古いAPI（collectionsに統合済み？）

---

## 推奨アクション

### 優先度: High
1. `cargo fix --lib -p photoclove` で自動修正可能な21件を修正
2. 完全に未使用の構造体・関数を削除（特に `google_photos.rs`, `importer.rs`）
3. `hasComment` → `has_comment` に変数名を修正

### 優先度: Medium
4. `tags.rs`, `albums.rs` の関数が `collections.rs` に統合済みなら削除を検討
5. 非推奨API `IndexMap::remove` を `swap_remove` or `shift_remove` に置換

### 優先度: Low
6. `error.rs` の未使用ヘルパー関数は将来使用予定なら `#[allow(dead_code)]` を追加
7. 到達不能コード (`google_photos.rs:114`) の整理

---

## 自動修正コマンド

```bash
# 未使用インポートの自動削除
cargo fix --lib -p photoclove

# 警告の確認
cargo check 2>&1 | grep warning | wc -l
```
