# TODO: Recovery Queue 機能の完成

**作成日**: 2026-01-20
**優先度**: 中
**関連ファイル**:
- `src-tauri/src/repository/recovery_queue.rs`
- `src-tauri/src/entity/recovery_queue.rs`
- `src-tauri/src/commands/recovery_queue_commands.rs`
- `src/App/RecoveryQueueModal.jsx`
- `src/App/Footer.jsx`

## 概要

Recovery Queue機能は現在、UIと読み取り・リトライ・削除機能のみ実装されている。
**失敗した操作をキューに追加する処理が未実装**のため、実質的に使用されていない。

## 現状

### 実装済み
- Recovery Queue テーブル（`recovery_queue`）
- UIモーダル（`RecoveryQueueModal.jsx`）
- 既存アイテムの表示・リトライ・削除コマンド
- `add_to_recovery_queue()` 関数（未使用だが保持）

### 未実装
- 操作失敗時の自動キュー追加

## 必要な実装

### 1. 失敗操作の検出と追加

以下の操作が失敗した際に `add_to_recovery_queue()` を呼び出す：

| 操作 | ファイル | 関数 |
|------|----------|------|
| ゴミ箱移動 | `trash_commands.rs` | `move_to_trash`, `move_to_trash_batch` |
| 復元 | `trash_commands.rs` | `restore_from_trash`, `restore_from_trash_batch` |
| インポート | `import_commands.rs` | `import_photos` |
| 完全削除 | `trash_commands.rs` | `permanently_delete` |

### 2. 実装例

```rust
// trash_commands.rs での例
pub async fn move_to_trash(path: String) -> Result<(), String> {
    match actual_move_to_trash(&path) {
        Ok(()) => Ok(()),
        Err(e) => {
            // 失敗時にRecovery Queueに追加
            if let Err(queue_err) = add_to_recovery_queue(
                OperationType::MoveToTrash,
                path.clone(),
                e.to_string()
            ) {
                log::error!("Failed to add to recovery queue: {}", queue_err);
            }
            Err(e)
        }
    }
}
```

### 3. UI改善（オプション）

- 操作失敗時のトースト通知にRecovery Queue へのリンクを追加
- Footer.jsx にRecovery Queue のアイテム数バッジを表示

## 削除された関数

以下の関数は未使用のため削除済み。必要に応じて再実装すること：

- `RecoveryItem::new()` - 直接SQL INSERTで代替可能
- 現在は `add_to_recovery_queue()` 内で直接INSERTしているため不要

## 備考

- `add_to_recovery_queue()` 関数は保持（将来の実装用）
- `operation_description()` メソッドも保持（UIで使用する可能性あり）
