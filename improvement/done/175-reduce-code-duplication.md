# Reduce Code Duplication in Rust Backend

## Overview

jscpd による重複チェックで、Rust バックエンドに **90個のクローン（5.16%、946行）** が検出された。これらの重複コードを共通化し、保守性とコード品質を向上させる。

## User Impact

- **開発者**: コードの保守が容易になり、バグ修正が一箇所で済む
- **ユーザー**: 直接的な影響はないが、バグの減少と将来の機能追加が迅速になる

## 主な重複箇所と解決策

### 1. DB接続パターンの重複

**現状**: ほぼ全ての関数で同じDB接続コードが繰り返されている

```rust
let conn = sqlite
    .get_connection()
    .map_err(|_| "Failed to connect to database".to_string())?;
```

**解決策**: マクロまたはヘルパー関数で共通化

```rust
// utils.rs に追加
pub(super) fn with_connection<F, T>(sqlite: &SQLite, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let conn = sqlite.get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;
    f(&conn)
}
```

### 2. recovery_queue.rs の重複（29行×2）

**現状**: `get_pending_items` と `get_all_items` がほぼ同じ

**解決策**: 共通の `get_items_with_filter` 関数を作成

```rust
fn get_items_with_filter(db: &SQLite, status_filter: Option<&str>) -> Result<Vec<RecoveryItem>, String>
```

### 3. photo_metadata.rs の重複（31行×2）

**現状**: `get_photo_meta` と `get_photo_meta_from_trash` が類似

**解決策**: 共通のrow→Photo変換ヘルパーを拡張

### 4. job_queue.rs の重複（35行×2）

**現状**: recovery_queue.rs と同様のパターン

**解決策**: 共通のジョブ取得ロジックを抽出

### 5. mod.rs の burst_group 関連重複

**現状**: `get_all_photos_for_grouping` と `get_photos_for_grouping_in_date` が類似

**解決策**: 日付フィルターをオプショナルにした共通関数

```rust
fn get_photos_for_grouping(db: &SQLite, date_filter: Option<&str>) -> Result<Vec<Photo>, String>
```

### 6. collections.rs の order_index 取得重複

**現状**: 2箇所で同じ MAX(order_index) クエリ

**解決策**: ヘルパー関数を作成

```rust
fn get_next_order_index(conn: &Connection, collection_id: i32) -> i32
```

## Implementation Approach

### Phase 1: ユーティリティ関数の追加
- `utils.rs` に共通ヘルパー関数を追加
- 既存コードへの影響なし

### Phase 2: 重複度の高いファイルから順に修正
1. `recovery_queue.rs` - 最も重複が多い
2. `job_queue.rs` - recovery_queue と類似
3. `photo_metadata.rs`
4. `mod.rs` (burst_group 関連)
5. `collections.rs`
6. `photo_crud.rs`

### Phase 3: 検証
- `cargo check` でコンパイル確認
- `make check-duplicate-rust` で重複削減を確認

## Source Code Changes

**Backend**:
- `src-tauri/src/repository/meta_db/sqlite/utils.rs` - 共通ヘルパー追加
- `src-tauri/src/repository/meta_db/sqlite/recovery_queue.rs` - リファクタリング
- `src-tauri/src/repository/meta_db/sqlite/job_queue.rs` - リファクタリング
- `src-tauri/src/repository/meta_db/sqlite/photo_metadata.rs` - リファクタリング
- `src-tauri/src/repository/meta_db/sqlite/mod.rs` - burst_group 関数統合
- `src-tauri/src/repository/meta_db/sqlite/collections.rs` - ヘルパー抽出
- `src-tauri/src/repository/meta_db/sqlite/photo_crud.rs` - パターン統一

## Success Metrics

- 重複クローン数: 90 → 50以下 (目標: 45%削減)
- 重複行率: 5.16% → 3%以下

## Dependencies & Risks

### Risks
- リファクタリングによる意図しないバグ混入
- 過度な抽象化による可読性低下

### Mitigation
- 各変更後に `cargo check` で確認
- 機能的な変更は行わず、構造のみ変更
- 段階的に進め、各フェーズで動作確認

## Testing Strategy

1. `cargo check` - コンパイルエラーなし
2. `cargo test` - 既存テストがパス
3. `make check-duplicate-rust` - 重複削減を確認
4. 手動テスト - 主要機能（写真表示、タグ、アルバム）の動作確認

## Open Questions

1. DB接続のヘルパー関数はマクロにすべきか、関数にすべきか？
2. 重複削減の目標値（45%削減）は適切か？
