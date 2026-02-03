---
name: code-review
description: Perform code review for PhotoClove codebase. Automatically invoked when reviewing code changes, PRs, or when asked to check code quality. Uses project-specific guidelines and knows what NOT to flag.
slash_command: /code-review
---

# Code Review

PhotoClove固有のガイドラインに基づいてコードレビューを実施する。

## When This Skill is Invoked

Claude automatically uses this skill when:
- ユーザーが「コードレビューして」「レビューして」と依頼
- PRやコード変更のレビューを依頼された
- コード品質のチェックを依頼された
- `/code-review`

## レビュー観点

### 1. 必須確認事項

**⚠️ 最初に確認**:
1. **`docs/common-mistakes.md`** - 頻出問題TOP20と具体例
2. **`CLAUDE.md`** - プロジェクト固有のガイドライン
3. **`docs/terms.md`** - 標準用語とファイル位置

### 2. セキュリティ

**注意**: PhotoCloveはローカルデスクトップアプリのため、Webアプリとはリスクプロファイルが異なる

- 外部入力のサニタイズ（外部データ連携がある場合のみ）
- SQLクエリのパラメータ化（動的な値のみ、識別子はホワイトリスト）

### 3. エラーハンドリング（Rust）

| 状況 | 推奨パターン |
|------|-------------|
| エラー伝播 | `?` 演算子 |
| Optionでデフォルト値あり | `unwrap_or` / `unwrap_or_default` |
| Optionで分岐処理 | `if let` |
| 複数ケース処理 | `match` |

**避けるべきパターン**:
```rust
// NG: 冗長
if opt.is_some() {
    let val = opt.unwrap();
}

// OK: 簡潔
if let Some(val) = opt {
}
```

### 4. パフォーマンス

- 不要なクローン/再レンダリング
- N+1クエリ

### 5. 設計原則

**DRY (Don't Repeat Yourself)**:
- 同じロジックが3回以上出現したら抽出
- 重複コードの検出: `make check-duplicate`

**KISS (Keep It Simple, Stupid)**:
- 最もシンプルな解決策を選ぶ
- 将来の要件を予測しすぎない

---

## 指摘しない項目（重要）

以下は意図的に許容されているため、**指摘しないこと**:

### Rust: 静的Regexパターンのunwrap

```rust
// OK: ハードコードされた静的パターン
let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
```

**指摘すべきケース**: 外部入力からパターンを構築する場合のみ

### ローカルアプリのXSS/SQLインジェクション

- PhotoCloveはTauriローカルアプリ
- 攻撃者=ユーザー自身
- **重要度: Low**

### LoggerService.js内のconsole使用

ロガー自体の実装なので許容

### テストファイルの行数制限

テストファイル（`*.test.js`, `*.test.ts`, `*_test.rs`）は**600行制限の対象外**

### Rust: unwrapを使用してよいケース

1. **テストコード**: テスト失敗時はパニックが適切
2. **静的パターンの初期化**: lazy_static/once_cell 内での expect
3. **論理的に確実な場合**: コメントで理由を明記

```rust
// OK: 論理的に確実（コメント必須）
let first = vec![1, 2, 3].first().unwrap(); // vec is never empty
```

---

## レビュープロセス

### 1. 変更範囲の把握

```bash
git diff --stat
git diff <base>..HEAD
```

### 2. チェックリスト

- [ ] **docs/common-mistakes.md TOP20の確認**（最重要）
- [ ] CLAUDE.mdガイドライン準拠
- [ ] 「指摘しない項目」に該当しないか確認
- [ ] 既存utils/コンポーネントの再実装がないか確認
- [ ] エラーハンドリング
- [ ] テストの有無/更新
- [ ] コード重複チェック（`make check-duplicate`）
- [ ] 使わなくなった不要コードが残っていないか

### 3. 出力フォーマット

```markdown
## レビュー結果

### 問題点
- [ ] ファイル:行 - 問題の説明

### 改善提案（任意）
- ファイル:行 - 提案内容

### 良い点
- 良かった実装のポイント
```

---

## PhotoClove固有のチェックポイント

### フロントエンド

- ViewModeの状態管理
- useEffectの依存配列
- CSS Modulesの使用（新規コンポーネント）
- Reactイベントハンドリング優先（addEventListener避ける）
- Container/Presentationalパターン推奨

### バックエンド

- ログターゲット名はレイヤーベース（`repository::sqlite`, `domain::photo`等）
- 適切なエラー伝播（`?` 演算子優先）
- IndexMap vs HashMap（順序保持が必要な場合）

### 統合

- Tauriコマンドのパラメータ名/型
- フロントエンド-バックエンド間のデータ整合性
