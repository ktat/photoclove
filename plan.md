# Plan: RAW/HEIC デコード済みキャッシュを thumbnail_store に永続化

## 背景
- RAW/HEIC のデコード済みキャッシュは `~/.cache/photoclove/thumbnails/` に保存されている
- 起動時に `clear_import_cache` で全ファイルが削除される → 毎回再デコードが発生（遅い）
- `thumbnail_store`（`~/.photoclove/thumbnail/`）は永続的で起動時にクリアされない

## 変更1: cache.rs - 永続キャッシュパス生成関数を追加

`generate_persistent_cache_path(photo_path, thumbnail_store)` を新規追加。
- ベースディレクトリ: `{thumbnail_store}/.cache/`
- ファイル名: 既存と同じハッシュベース（`{hash}.jpg`）
- `import_directory` は不要（RAW/HEIC 専用なのでphoto_pathのみでハッシュ）

既存の `generate_cache_path` は変更なし（JPEG用の一時キャッシュとして継続使用）。

## 変更2: image_commands.rs - get_resized_image

RAW/HEIC ファイルの場合のみ永続キャッシュを使用：
- `is_raw || is_heic_avif` の判定後、`generate_persistent_cache_path` でキャッシュパスを再計算
- 通常の JPEG は従来の `generate_cache_path`（`~/.cache/...`）を継続使用

## 変更3: image_commands.rs - get_progressive_image

- `state: tauri::State<'_, crate::AppState>` パラメータを追加
- `generate_cache_path` → `generate_persistent_cache_path` に変更
- （tauri commandのstate注入は自動なのでフロントエンド変更不要）

## 変更4: thumbnail_service.rs - 永続キャッシュ削除関数を追加

`delete_decoded_cache(photo_path, thumbnail_store)` を新規追加：
- `generate_persistent_cache_path` でベースパスを計算
- ベースファイル（`{hash}.jpg`）+ `_exif` + `_full` の3パターンを削除

## 変更5: trash_commands.rs - 永久削除時にキャッシュも削除

- `delete_permanently_batch`: `thumbnail_service::delete_decoded_cache` を呼び出し追加
- `empty_trash`: 同様に `delete_decoded_cache` を呼び出し追加
  - （注: empty_trashは現在 `delete_thumbnail` も呼んでいないが、今回のスコープ外）

## 検証
- `cargo check` で Rust コンパイル確認
