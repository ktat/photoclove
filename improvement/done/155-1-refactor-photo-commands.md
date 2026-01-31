# Phase 1: Backend Refactoring - photo_commands.rs

## Overview

`photo_commands.rs`（934行）を小さなハンドラーモジュールに分割し、約400行を削減します。

**注**: 2025-01 の EXIF orientation 修正により行数が増加しています。

## Current State

```rust
// photo_commands.rs (920 lines)
pub async fn get_photos_unified(...) -> Result<String, ()> {
    match request {
        PhotoRequest::Search { search_type, .. } => {
            match search_type.as_str() {
                "recent" => { /* 50 lines */ },
                "date" => { /* 70 lines */ },
                "album_photos" => { /* 80 lines */ },
                "tag" => { /* 150 lines */ },
                "search" => { /* 120 lines */ },
                "trash" => { /* 120 lines */ },
                // ... etc
            }
        }
    }
}
```

## Target Structure

### 1. photo_commands.rs の分割

**リファクタリング後の構造**:
```rust
// commands/photo_commands.rs (150 lines - ルーターのみ)
pub async fn get_photos_unified(...) -> Result<String, ()> {
    match request {
        PhotoRequest::Search { search_type, .. } => {
            match search_type.as_str() {
                "recent" => handlers::recent::handle(...).await,
                "date" => handlers::date::handle(...).await,
                "album_photos" => handlers::album::handle(...).await,
                "tag" => handlers::tag::handle(...).await,
                "search" => handlers::search::handle(...).await,
                "trash" => handlers::trash::handle(...).await,
                "all_albums" => handlers::collections::handle_albums(...).await,
                "all_tags" => handlers::collections::handle_tags(...).await,
                _ => Err(format!("Unsupported search type: {}", search_type)),
            }
        }
        // ... other request types
    }
}

// commands/photo_handlers/recent.rs (~50 lines)
pub async fn handle(
    state: &State,
    config: &Config,
    meta_db: &SQLite,
    params: RecentParams,
) -> Result<String, String> {
    // Recent photos logic only
}

// commands/photo_handlers/date.rs (~70 lines)
pub async fn handle(...) -> Result<String, String> {
    // Date-based search logic only
}

// ... 他のハンドラー
```

**新規ファイル構造**:
```
src-tauri/src/commands/
  ├── photo_commands.rs (150 lines - router)
  └── photo_handlers/
      ├── mod.rs (20 lines)
      ├── recent.rs (50 lines)
      ├── date.rs (70 lines)
      ├── album.rs (80 lines)
      ├── tag.rs (150 lines)
      ├── search.rs (120 lines)
      ├── trash.rs (120 lines)
      ├── collections.rs (50 lines)
      └── navigation.rs (100 lines - next/prev logic)
```

### 2. photo_navigation.rs の抽出

`get_next_photo()`と`get_prev_photo()`はほぼ同一のロジックを持つため、統合：

```rust
// commands/photo_handlers/navigation.rs
enum Direction {
    Next,
    Previous,
}

pub async fn get_adjacent_photo(
    state: &State,
    direction: Direction,
    current_path: &str,
    search_params: SearchParams,
) -> Result<Option<Photo>, String> {
    // Unified navigation logic
}

// photo_commands.rs
#[tauri::command]
pub async fn get_next_photo(...) -> Result<Option<Photo>, ()> {
    navigation::get_adjacent_photo(state, Direction::Next, current_path, search_params).await
}

#[tauri::command]
pub async fn get_prev_photo(...) -> Result<Option<Photo>, ()> {
    navigation::get_adjacent_photo(state, Direction::Previous, current_path, search_params).await
}
```

## Benefits

- 各ハンドラーが独立してテスト可能
- 新しい検索タイプの追加が容易
- コードレビューが簡単（関連コードのみ）
- コンパイル時間の改善（変更されたモジュールのみ再コンパイル）

## Implementation Steps

1. `photo_handlers/` ディレクトリを作成
2. `mod.rs` を作成し、モジュール構造を定義
3. 各検索タイプのロジックを個別のファイルに抽出:
   - `recent.rs`: Recent photos handler
   - `date.rs`: Date-based search handler
   - `album.rs`: Album photos handler
   - `tag.rs`: Tag-based search handler
   - `search.rs`: Full-text search handler
   - `trash.rs`: Trash operations handler
   - `collections.rs`: Album/Tag list handlers
4. `navigation.rs` を作成し、next/prev ロジックを統合
5. `photo_commands.rs` をルーターのみに簡略化
6. 全検索タイプの動作テスト

## Testing Checklist

- [ ] `recent` 検索タイプが動作する
- [ ] `date` 検索タイプが動作する
- [ ] `album_photos` 検索タイプが動作する
- [ ] `tag` 検索タイプが動作する
- [ ] `search` 検索タイプが動作する
- [ ] `trash` 検索タイプが動作する
- [ ] `all_albums` 検索タイプが動作する
- [ ] `all_tags` 検索タイプが動作する
- [ ] `get_next_photo` が動作する
- [ ] `get_prev_photo` が動作する
- [ ] パフォーマンスが維持されている

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| photo_commands.rs | 934行 | 150行 |
| 新規ハンドラーファイル | 0 | 9ファイル（各50-150行） |
| next/prev 重複コード | 200行 | 0行 |
