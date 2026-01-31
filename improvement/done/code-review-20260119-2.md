# Code Review: 不要コードの調査結果

**日付**: 2026-01-19
**更新**: 2026-01-20
**対象**: PhotoClove バックエンド (src-tauri)
**レビュー観点**: 未使用コードの検出と削除候補の特定

## 概要

`cargo check` の警告を基に、未使用コードを調査した。統一コレクションAPIへの移行に伴うレガシー関数や、定義のみで呼び出し元がない関数が複数検出された。

## 検出された不要コード

### 1. albums.rs - レガシー関数 ✅ 解消済み

| 行 | 関数名 | 状態 |
|----|--------|------|
| 8 | `get_album_photos()` | ~~未使用~~ 削除済み |
| 30 | `get_album_photos_with_metadata()` | ~~未使用~~ 削除済み |
| 100 | `reorder_album_photos()` | ~~未使用~~ 削除済み |

**対応完了**: `albums.rs` ファイル全体を削除済み。

### 2. tags.rs - 未使用関数 ✅ 解消済み

| 行 | 関数名 | 状態 |
|----|--------|------|
| 6 | `get_all_tags()` | ~~未使用~~ 削除済み |
| 30 | `get_all_tags_with_photo_count()` | ~~未使用~~ 削除済み |

**対応完了**: 未使用関数を削除済み。

### 3. recovery_queue.rs - 未使用関数（保持推奨）

| 行 | 関数/メソッド | 状態 | 判定 |
|----|--------------|------|------|
| 62 | `add_to_recovery_queue()` | 未使用 | **保持** |
| 98 | `RecoveryItem::new()` | 未使用 | 削除可能 |
| 115 | `operation_description()` | 未使用 | 保留 |

**詳細調査結果 (2026-01-20)**:

Recovery Queue機能自体はアクティブに使用されている:
- フロントエンド: `RecoveryQueueModal.jsx`, `Footer.jsx`, `App.jsx`
- バックエンド: `recovery_queue_commands.rs`（retry, discard, delete等のコマンド）

しかし、**失敗した操作をキューに追加する処理が未実装**:
- `move_to_trash`, `restore`, `import` などが失敗した際に `add_to_recovery_queue()` を呼ぶべきだが、現在どこからも呼ばれていない
- Recovery Queueは「読み取り・リトライ・削除」のUIのみ存在し、「追加」機能が未完成

**推奨対応**:
- `add_to_recovery_queue()` → **保持** - 失敗操作の追加機能を実装する際に必要
- `RecoveryItem::new()` → **削除可能** - 直接SQL INSERTで代替されている
- `operation_description()` → **保留** - UIで使う可能性あり

### 4. burst_groups.rs - 未使用関数（削除または統一）

| 行 | 関数名 | 状態 | 判定 |
|----|--------|------|------|
| 134 | `get_photos_in_group()` | 未使用 | 削除 or 統一 |

**詳細調査結果 (2026-01-20)**:

`handle_burst_group()` (`photo_handlers/burst.rs:236`) で同じ機能を**直接SQLクエリで実装**している:
```rust
// burst.rs:247-257 で直接SQLを実行
SELECT pm.path, ... FROM photo_metadata pm WHERE pm.burst_group_id = ?1 ...
```

`get_photos_in_group()` は同じクエリを実行するが、どこからも呼ばれていない（重複実装）。

**推奨対応**:
1. **削除** - `handle_burst_group` が直接SQLを使っているので不要
2. **統一** - `handle_burst_group` を `get_photos_in_group()` を使うように修正（DRY原則）

### 5. google_photos.rs - 未読フィールド（保持）

| 行 | 構造体/フィールド | 状態 |
|----|------------------|------|
| 31-35 | `GooglePhotosAlbumResponse` のフィールド | 未読 |

**理由**: APIレスポンスのデシリアライズ用構造体。フィールドを読み取っていないが、JSON構造のマッピングに必要。

**対応**: `#[allow(dead_code)]` アトリビュートを追加するか、そのまま保持。

## 推奨アクション

### 解消済み ✅

1. ~~**albums.rs のレガシー関数**~~ → ファイル削除済み
2. ~~**tags.rs の未使用関数**~~ → 関数削除済み

### 保持（機能未完成）

3. **recovery_queue.rs の `add_to_recovery_queue()`** - 失敗操作の追加機能実装時に必要

### 削除または統一

4. **burst_groups.rs の `get_photos_in_group()`** - 重複実装のため削除、またはDRYにするなら統一
5. **entity/recovery_queue.rs の `RecoveryItem::new()`** - 削除可能

### 保持

6. **google_photos.rs** - APIマッピング用に必要
7. **entity/recovery_queue.rs の `operation_description()`** - UIで使う可能性あり

## 削除による影響

- **コンパイル警告**: ~~11件~~ → 大幅削減済み（残り数件）
- **コードベースサイズ**: albums.rs削除で約100行削減済み
- **保守性**: 不要コード削除により向上

## 備考

統一コレクションAPI（`photo_collections` テーブル）への移行が完了しており、旧来の `album_photos` テーブルを使用するレガシー関数は安全に削除完了。

Recovery Queue機能は「追加」部分が未実装のため、関連コードは保持が推奨される。
