---
name: code-review
description: Perform code review for PhotoClove codebase. Automatically invoked when reviewing code changes, PRs, or when asked to check code quality. Uses project-specific guidelines and knows what NOT to flag.
---

# Code Review

PhotoClove固有のガイドラインに基づいてコードレビューを実施する。

## When This Skill is Invoked

Claude automatically uses this skill when:
- ユーザーが「コードレビューして」「レビューして」と依頼
- PRやコード変更のレビューを依頼された
- コード品質のチェックを依頼された

## レビュー観点

### 1. CLAUDE.md のガイドライン準拠

- **ロギング標準**:
  - フロントエンド: `logger`サービス使用（`console.*`禁止）
  - バックエンド: `log`マクロ使用（`println!`禁止）
  - 例外使用時は直前にコメントで理由を明記
- **CSSデザインシステム**: ハードコード値禁止、CSS変数必須（詳細は下記）
- **ファイルサイズ**: 600行以下
- **CSS Modules**: 新規コンポーネントは必須

### 1.1 CSSデザインシステム準拠（重要）

**ハードコード値は禁止**。すべて `src/styles/base.css` のCSS変数を使用すること。

| カテゴリ | NG例 | OK例 |
|---------|------|------|
| 背景色 | `#374151`, `#1f2937` | `var(--color-bg-muted)`, `var(--color-bg-elevated)` |
| テキスト色 | `#666`, `#999`, `#ccc` | `var(--color-text-muted)`, `var(--color-text-secondary)` |
| ボーダー色 | `#444`, `#ddd` | `var(--color-border-default)` |
| プライマリ色 | `#646cff`, `#3B82F6` | `var(--color-primary)` |
| フォントサイズ | `12px`, `14px`, `16px` | `var(--font-size-xs)`, `var(--font-size-base)`, `var(--font-size-lg)` |
| スペーシング | 直接px指定 | `var(--space-1)` ~ `var(--space-6)` |
| 角丸 | `4px`, `8px` | `var(--radius-sm)`, `var(--radius-lg)` |

**主要CSS変数一覧:**
- 背景: `--color-bg-base`, `--color-bg-elevated`, `--color-bg-surface`, `--color-bg-muted`
- テキスト: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- ボーダー: `--color-border-default`, `--color-border-subtle`
- 状態: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`
- フォント: `--font-size-2xs`(9px), `--font-size-xs`(11px), `--font-size-sm`(13px), `--font-size-base`(14px), `--font-size-lg`(16px), `--font-size-xl`(18px)

### 2. セキュリティ

**注意**: PhotoCloveはローカルデスクトップアプリのため、Webアプリとはリスクプロファイルが異なる

- 外部入力のサニタイズ（外部データ連携がある場合のみ）
- SQLクエリのパラメータ化（動的な値のみ、識別子はホワイトリスト）

### 3. エラーハンドリング（Rust）

**基本方針**: `?` 演算子を優先、状況に応じて使い分け

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

**SOLID 原則**:
- **S**ingle Responsibility - 1つのコンポーネント/関数は1つの責務
- **O**pen/Closed - 拡張に開き、修正に閉じる
- **D**ependency Inversion - 抽象に依存、具象に依存しない

**DRY (Don't Repeat Yourself)**:
- 同じロジックが3回以上出現したら抽出
- ただし、早すぎる抽象化は避ける

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

**理由**:
- パターンはコード内にハードコードされており、外部入力ではない
- 不正なパターンは開発/テスト時に即座にパニックで発見される
- 本番で突然パニックする可能性はない

**指摘すべきケース**: 外部入力からパターンを構築する場合のみ
```rust
// NG: 外部入力を使用
let re = Regex::new(&user_input).unwrap(); // これは指摘する
```

### ローカルアプリのXSS/SQLインジェクション

- PhotoCloveはTauriローカルアプリ
- 攻撃者=ユーザー自身（DevToolsで操作可能だが自己責任）
- 外部からの攻撃ベクターなし
- **重要度: Low**（コード品質として改善は可だが、セキュリティ緊急対応は不要）

### LoggerService.js内のconsole使用

```javascript
// OK: LoggerService自体のフォールバック出力
// LoggerService.js内でのconsole使用は許容
console.log(...);
```

**理由**: ロガー自体の実装なので、console使用は許容される

### Rust: unwrapを使用してよいケース

以下の場合は `unwrap()` の使用が許容される：

1. **テストコード**: テスト失敗時はパニックが適切
2. **静的パターンの初期化**: lazy_static/once_cell 内での expect
3. **論理的に確実な場合**: コメントで理由を明記

```rust
// OK: テストコード
#[test]
fn test_parse_date() {
    let result = parse_date("2024-01-15").unwrap();
    assert_eq!(result.year(), 2024);
}

// OK: 静的パターンの初期化
lazy_static! {
    static ref PATTERN: Regex = Regex::new(r"\d+")
        .expect("Static regex pattern is invalid");
}

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

- [ ] CLAUDE.mdガイドライン準拠
- [ ] 「指摘しない項目」に該当しないか確認
- [ ] エラーハンドリング
- [ ] テストの有無/更新

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

- ViewModeの状態管理が正しいか
- useEffectの依存配列が適切か
- CSS Modulesの使用（新規コンポーネント）
- **CSSデザインシステム**: ハードコード色・サイズ禁止、CSS変数使用必須
- **Reactイベントハンドリング優先**: DOM操作（addEventListener）よりReactの方法（onClick等）を使用
- **複合フックパターン**: 過剰なフックインポートは複合フックにまとめる
- **Container/Presentationalパターン**: ロジックと表示の分離を推奨

### バックエンド

- logマクロの使用（println!禁止）
- ログターゲット名はレイヤーベース（`repository::sqlite`, `domain::photo`, `service::file`, `command::import`）
- 適切なエラー伝播（`?` 演算子優先）
- IndexMap vs HashMap（順序保持が必要な場合）

### 統合

- Tauriコマンドのパラメータ名/型
- フロントエンド-バックエンド間のデータ整合性
