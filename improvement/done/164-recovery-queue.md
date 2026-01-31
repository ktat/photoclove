# リカバリキュー

## 概要

失敗した操作を記録し、ユーザーが準備できたときに再実行できる仕組み。

**背景**:
- エラー時に都度通知するのはユーザー体験が悪い
- 失敗の原因は主にユーザー起因（Permission、ディレクトリ不在など）
- 準備ができたときに再実行できれば良い

**重要度**: Medium
**対応優先度**: Medium

---

## job_queue との違い

| 項目 | job_queue | recovery_queue |
|------|-----------|----------------|
| 実行タイミング | 自動（バックグラウンド） | ユーザーが明示的に開始 |
| 目的 | 重い処理の非同期実行 | 失敗した操作の再実行 |
| 記録内容 | 処理内容 | 失敗した操作 + 失敗理由 + リカバリ履歴 |

---

## テーブル設計

### recovery_queue テーブル

```sql
CREATE TABLE IF NOT EXISTS recovery_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,        -- 操作種別: move_to_trash, restore, import, permanently_delete
    target_path TEXT NOT NULL,           -- 対象パス（操作によって意味が異なる）
    error_reason TEXT NOT NULL,          -- 失敗理由
    failed_at TEXT NOT NULL,             -- 失敗日時
    retry_count INTEGER DEFAULT 0,       -- リトライ回数
    last_retry_at TEXT,                  -- 最終リトライ日時
    status TEXT DEFAULT 'pending',       -- pending, resolved, discarded
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recovery_queue_status ON recovery_queue(status);
CREATE INDEX IF NOT EXISTS idx_recovery_queue_operation ON recovery_queue(operation_type);
```

---

## 操作別のパス管理

設定で変更される可能性があるパスがあるため、操作ごとに保存すべきパスが異なる。

| 操作 | 保存するパス | 設定から取得 | 備考 |
|------|-------------|-------------|------|
| `move_to_trash` | オリジナルファイルパス | trash_path | シンプル |
| `restore` | ゴミ箱内のパス | trash_path, library_path | ゴミ箱パス変更時のフォールバック必要 |
| `import` | import元のパスのみ | import_to | import先は保存不要 |
| `permanently_delete` | ゴミ箱内のパス | trash_path | restore と同様のフォールバック必要 |

### restore のフォールバック処理

ゴミ箱のパスが設定変更される可能性があるため：

```
1. 記録されたゴミ箱パスでファイルを確認
2. なければ現在の設定のゴミ箱パスを確認
3. それでもなければエラー（ファイルが見つからない）
```

**実装案**:
```rust
fn find_file_in_trash(recorded_path: &str, current_trash_path: &str) -> Option<PathBuf> {
    let recorded = Path::new(recorded_path);
    if recorded.exists() {
        return Some(recorded.to_path_buf());
    }

    // ファイル名を取得して現在のゴミ箱パスで探す
    let filename = recorded.file_name()?;
    let current_path = Path::new(current_trash_path).join(filename);
    if current_path.exists() {
        return Some(current_path);
    }

    None
}
```

---

## UI要件

### 1. 通知（Footer の🦀を活用）

リカバリキューにデータがあることを Footer の🦀で通知：

**通常時**:
```
🦀.｡o( ランダムメッセージ )
```

**リカバリキューに件数がある時**:
```
⚠️🦀.｡o( 3件の失敗した操作があります )
```

**目立たせる工夫**:
- ⚠️ 警告アイコンを追加
- 🦀が左右に揺れるアニメーション（wobble）
- メッセージ部分を警告色（`--color-warning`）で表示
- クリック可能であることを示す（下線 + ホバーエフェクト + `cursor: pointer`）

**CSS アニメーション例**:
```css
@keyframes wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.recovery-warning .crab {
  display: inline-block;
  animation: wobble 1s ease-in-out infinite;
}

.recovery-warning .message {
  color: var(--color-warning);
  text-decoration: underline;
  cursor: pointer;
}
```

**動作**:
- クリックでリカバリキュー一覧モーダルを開く
- 件数が0になったら通常表示（RandomMessages）に戻る

### 2. リカバリキュー一覧画面

- 失敗した操作の一覧表示
- 操作種別、対象パス、失敗理由、失敗日時を表示
- フィルター機能（操作種別、ステータス）

### 3. アクション

- **再実行**: 選択した操作を再実行
- **一括再実行**: すべての pending 操作を再実行
- **破棄**: 操作を破棄（status を discarded に）

---

## 実装チェックリスト

### バックエンド

- [ ] `recovery_queue` テーブルのマイグレーション作成
- [ ] `RecoveryQueueRepository` の実装
- [ ] 各操作（move_to_trash, restore, import, permanently_delete）でエラー時にキューに追加
- [ ] リカバリ実行コマンドの実装
- [ ] restore のフォールバック処理実装

### フロントエンド

- [ ] リカバリキュー件数取得 API 呼び出し
- [ ] Footer.jsx の拡張（リカバリキュー通知対応）
  - [ ] ⚠️ + 🦀 wobble アニメーション
  - [ ] 警告色メッセージ表示
  - [ ] クリックハンドラ追加
- [ ] リカバリキュー一覧モーダル
- [ ] 再実行/破棄のUI

---

## 関連

- `improvement/163-rust-error-handling-unwrap.md` - エラーハンドリング改善（本ドキュメントの実装後に対応）

---

*作成日: 2025-01-14*
