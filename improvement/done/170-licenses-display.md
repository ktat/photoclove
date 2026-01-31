# Licenses Display Feature

## Overview

PhotoCloveが使用しているライブラリ（npm packages、Rust crates）のライセンス情報を表示する機能。オープンソースライセンスの遵守と透明性のために必要。

## User Impact

- **対象ユーザー**: すべてのユーザー
- **目的**:
  - オープンソースライセンスの遵守（多くのライセンスは表示を義務付け）
  - 透明性の確保
  - 法的リスクの回避

## Influence on Existing Features

### Compatibility

- 既存機能への影響なし
- Tauriツールバー `?` メニューにLicenses項目を追加

### Related Features

| 関連機能 | ファイル | 影響 |
|----------|----------|------|
| Tauriメニュー | `src-tauri/src/lib.rs` | `?`メニューにLicenses項目追加 |
| Staticモーダル | `src/App.jsx` | Licensesモーダル表示処理 |

## Implementation Approach

### ライセンス情報の収集

#### npm packages

```bash
# license-checker を使用
npx license-checker --json --out licenses-npm.json
```

#### Rust crates

```bash
# cargo-about を使用（推奨）
cargo install cargo-about
cargo about generate about.hbs -o licenses-rust.html

# または cargo-license
cargo install cargo-license
cargo license --json > licenses-rust.json
```

### ビルド時に生成

```
ビルドフロー:
1. npm run build:licenses  → public/licenses-npm.json
2. cargo about generate    → src-tauri/licenses-rust.json
3. vite build             → ライセンスファイルをバンドル
```

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Licenses Display                    │
├─────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ licenses-npm.json│  │licenses-rust.json│      │
│  │  (ビルド時生成)  │  │  (ビルド時生成)  │       │
│  └────────┬────────┘  └────────┬────────┘       │
│           │                     │                │
│           └──────────┬──────────┘                │
│                      ▼                           │
│           ┌─────────────────┐                    │
│           │  LicensesView   │                    │
│           │   Component     │                    │
│           └─────────────────┘                    │
└─────────────────────────────────────────────────┘
```

### Source Code Changes

**Backend (Tauri)**:

| ファイル | 変更内容 |
|----------|----------|
| `src-tauri/src/lib.rs` | `?`メニューに`licenses`項目追加、イベントハンドラ追加 |

**Frontend**:

| ファイル | 変更内容 |
|----------|----------|
| `src/App.jsx` | `click_menu_static` で`licenses`イベント処理、モーダル表示 |
| `src/App/LicensesView.jsx` (新規) | ライセンス一覧表示コンポーネント |

**Build Scripts**:

| ファイル | 変更内容 |
|----------|----------|
| `package.json` | `build:licenses` スクリプト追加 |
| `src-tauri/build.rs` | Rustライセンス生成 (optional) |

**Static Files**:

| ファイル | 内容 |
|----------|------|
| `public/licenses-npm.json` | npmパッケージのライセンス情報 |
| `public/licenses-rust.json` | Rust cratesのライセンス情報 |

### Implementation Code Examples

**Backend: `src-tauri/src/lib.rs` の変更**

```rust
// help_submenu の変更
let help_submenu = SubmenuBuilder::new(app, "?")
    .text("show_log", "Show log")
    .text("github", "GitHub")
    .separator()
    .text("privacy_policy", "Privacy Policy")
    .text("terms_of_use", "Terms of Use")
    .text("licenses", "Licenses")  // 追加
    .separator()
    .text("about", "About")
    .build()?;

// イベントハンドラ追加
} else if e.id == "licenses" {
    app.emit("click_menu_static", "licenses").unwrap();
}
```

**Frontend: `src/App.jsx` のイベント処理**

```javascript
// click_menu_static イベントハンドラ内
case 'licenses':
  setShowLicenses(true);
  break;
```

### ライセンス情報のフォーマット

```json
{
  "packages": [
    {
      "name": "react",
      "version": "18.3.1",
      "license": "MIT",
      "repository": "https://github.com/facebook/react",
      "licenseText": "MIT License\n\nCopyright (c) ..."
    }
  ]
}
```

## UI Design

### 実装場所: Tauriツールバー `?` メニュー

既存の `?` メニュー（`src-tauri/src/lib.rs`）に「Licenses」を追加:

```
現在の構成:
┌──────────────────┐
│ ?               ▼│
├──────────────────┤
│ Show log         │
│ GitHub           │
├──────────────────┤
│ Privacy Policy   │
│ Terms of Use     │
├──────────────────┤
│ About            │
└──────────────────┘

変更後:
┌──────────────────┐
│ ?               ▼│
├──────────────────┤
│ Show log         │
│ GitHub           │
├──────────────────┤
│ Privacy Policy   │
│ Terms of Use     │
│ Licenses         │  ← 追加
├──────────────────┤
│ About            │
└──────────────────┘
```

### Licensesダイアログ

```
┌─────────────────────────────────────────────────┐
│ Open Source Licenses                        [×] │
├─────────────────────────────────────────────────┤
│ ─── JavaScript Libraries ───                    │
│                                                 │
│ react v18.3.1 (MIT)                             │
│ axios v1.12.2 (MIT)                             │
│ firebase v9.23.0 (Apache-2.0)                   │
│ ...                                             │
│                                                 │
│ ─── Rust Crates ───                             │
│                                                 │
│ tauri v2.0.0 (MIT OR Apache-2.0)                │
│ rusqlite v0.x.x (MIT)                           │
│ serde v1.0.x (MIT OR Apache-2.0)                │
│ ...                                             │
│                                                 │
│ [Show Full License Text]  ← 個別ライセンス表示  │
└─────────────────────────────────────────────────┘
```

## Dependencies & Risks

### External Dependencies

**開発時ツール (devDependencies)**:
```json
"license-checker": "^25.0.1"
```

**Rust ツール**:
```bash
cargo install cargo-about
# または
cargo install cargo-license
```

### Performance

- ライセンスファイルはビルド時に生成（ランタイム影響なし）
- JSONファイルサイズ: 数十KB〜数百KB程度

### Security

- 静的ファイルなのでセキュリティリスクなし

## Testing Strategy

### Manual Testing

1. ビルド時にライセンスファイルが生成されること
2. Licenses画面が正しく表示されること
3. 全ライブラリが一覧に含まれていること

### Edge Cases

- ライセンスファイルが見つからない場合のフォールバック
- 非常に長いライセンステキストの表示

## Implementation Phases

### Phase 1: ライセンス情報収集
- `license-checker` でnpmパッケージのライセンス収集
- `cargo-about` でRust cratesのライセンス収集
- ビルドスクリプト追加

### Phase 2: UI実装
- Tauriメニュー（`src-tauri/src/lib.rs`）に`licenses`項目追加
- `src/App.jsx`でイベントハンドリング追加
- LicensesViewコンポーネント作成

### Phase 3: 自動化
- CI/CDでライセンス情報を自動更新
- 新しい依存追加時に自動反映

## Open Questions

1. **表示場所**: ~~Preferencesタブ vs About画面 vs 別ウィンドウ？~~
   - → **決定**: Tauriツールバー `?` メニューに追加（Privacy Policy, Terms of Useと同じ場所）

2. **ライセンステキスト全文**: 表示するか、リンクのみか？
   - → 推奨: 一覧は概要のみ、クリックで全文表示

3. **更新タイミング**: ビルド時のみ？ 起動時にチェック？
   - → 推奨: ビルド時のみ（静的ファイルとして同梱）
