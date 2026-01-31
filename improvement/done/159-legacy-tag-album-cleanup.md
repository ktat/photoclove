# Legacy Tag/Album Functions Cleanup

## Overview

`photo_collections` テーブルへの統合後、古い個別テーブル用の関数が残っています。これらは既に使用されておらず、削除可能です。

## 削除対象一覧

### 1. Repository Trait (`src-tauri/src/repository.rs`)

以下のメソッド定義を削除:

**Tag 関連 (166-180行目)**
- `create_tag(&self, name: &str, color: Option<&str>) -> Result<i32, String>`
- `delete_tag(&self, tag_id: i32) -> Result<bool, String>`
- `add_tag_to_photo(&self, photo_path: &str, tag_id: i32) -> Result<(), String>`
- `remove_tag_from_photo(&self, photo_path: &str, tag_id: i32) -> Result<bool, String>`

**Album 関連 (182-201行目)**
- `create_album(&self, name: &str, description: &str) -> Result<i32, String>`
- `update_album(&self, id: i32, name: &str, description: &str, cover_photo_path: Option<&str>) -> Result<bool, String>`
- `delete_album(&self, id: i32) -> Result<bool, String>`
- `add_photo_to_album(&self, album_id: i32, photo_path: &str) -> Result<(), String>`
- `remove_photo_from_album(&self, album_id: i32, photo_path: &str) -> Result<bool, String>`
- `get_album_photos(&self, album_id: i32) -> Result<Vec<String>, String>`
- `get_album_photos_with_metadata(&self, album_id: i32, config: config::Config) -> Result<Vec<photo::Photo>, String>`
- `reorder_album_photos(&self, album_id: i32, photo_order: Vec<String>) -> Result<(), String>`

### 2. SQLite 実装 (`src-tauri/src/repository/meta_db/sqlite/mod.rs`)

trait 実装の削除 (432-499行目付近):
- `create_tag`, `delete_tag`, `add_tag_to_photo`, `remove_tag_from_photo`
- `create_album`, `update_album`, `delete_album`, `add_photo_to_album`, `remove_photo_from_album`, `get_album_photos`, `get_album_photos_with_metadata`, `reorder_album_photos`

### 3. Tags モジュール (`src-tauri/src/repository/meta_db/sqlite/tags.rs`)

削除対象関数:
- `create_tag` (61-76行目)
- `delete_tag` (79-100行目)
- `add_tag_to_photo` (103-117行目)
- `remove_tag_from_photo` (120-133行目)

**注意**: 以下は維持 (photo_collections を使用済み)
- `get_all_tags` - photo_collections から取得
- `get_all_tags_with_photo_count` - photo_collections から取得
- `remove_all_tags_from_photo` - 削除時に使用
- `get_tags_for_photos_bulk` - バルク取得に使用
- `get_tags_for_photo` - 単一写真のタグ取得
- `get_photos_with_tags` - タグ検索に使用

### 4. Albums モジュール (`src-tauri/src/repository/meta_db/sqlite/albums.rs`)

削除対象関数:
- `create_album` (40-55行目)
- `update_album` (58-79行目)
- `delete_album` (82-103行目)
- `add_photo_to_album` (106-129行目)
- `remove_photo_from_album` (132-145行目)
- `get_album_photos` (148-167行目) - 古いテーブル `album_photos` を参照
- `get_album_photos_with_metadata` (170-237行目) - 古いテーブル `album_photos` を参照
- `reorder_album_photos` (240-265行目) - 古いテーブル `album_photos` を参照

**注意**: 以下は維持 (photo_collections を使用済み)
- `get_all_albums` - photo_collections から取得

### 5. Tauri Commands (削除可能性の検討)

現在、以下のコマンドは `photo_collections` API を内部で使用しているが、フロントエンドとの互換性のため維持:

**維持推奨** (フロントエンド互換性):
- `src-tauri/src/commands/tag_commands.rs` - 全関数
- `src-tauri/src/commands/album_commands.rs` - 全関数

これらは内部で `meta_db.create_collection()` 等を呼び出しており、photo_collections テーブルを正しく使用しています。

## 削除手順

1. `tags.rs` から不要な関数を削除
2. `albums.rs` から不要な関数を削除
3. `mod.rs` から trait 実装を削除
4. `repository.rs` から trait 定義を削除
5. `cargo check` でコンパイル確認

## 影響範囲

- フロントエンドへの影響: なし (Tauri コマンドは維持)
- データベースへの影響: なし (photo_collections テーブルはそのまま)
- 既存機能への影響: なし (全て photo_collections API に移行済み)

## Open Questions

- `get_all_tags`, `get_all_tags_with_photo_count`, `get_all_albums`, `get_tags_for_photo` 等の read 系関数は photo_collections を使用しているが、trait に残っている。これらも unified API に統合すべきか？
