# 寄付・スポンサーシップ機能 (Donation & Sponsorship)

## Overview

PhotoCloveの開発を支援するための寄付導線をアプリ内に実装する。ユーザー体験を損なわない控えめな形で、GitHub Sponsorsへのリンクを提供する。

## User Impact

### 誰がこの機能の影響を受けるか
- **全ユーザー**: 設定画面で寄付オプションを確認可能
- **支援者**: 簡単に開発を支援できる導線

### ユーザー体験への影響
- 押し付けがましくない、控えめな表示
- 機能制限なし（寄付しなくても全機能利用可能）
- 感謝の気持ちを伝える手段を提供

## 実装アイデア

### 1. アプリ内での寄付導線

**`?` メニューに「Sponsor」項目追加**

```rust
// src-tauri/src/lib.rs
let help_submenu = SubmenuBuilder::new(app, "?")
    .text("show_log", "Show log")
    .text("github", "GitHub")
    .text("sponsor", "Sponsor")  // 追加
    .separator()
    // ...

// イベントハンドラ
} else if e.id == "sponsor" {
    app.emit("click_menu_static", "sponsor").unwrap();
}
```

```jsx
// src/App.jsx - click_menu_static イベントハンドラ内
} else if (e.payload === "sponsor") {
  open("https://github.com/sponsors/ktat");
}
```

### 2. 控えめな寄付リマインダー

**初回起動後30日経過時**
- 非侵入的なトースト通知（右下に小さく表示、数秒で自動消去）
- "PhotoCloveを使い続けていますか？開発を支援する"
- 「今後表示しない」オプション付き
- 1回だけ表示（しつこくしない）

### 3. UI配置案

**`?` メニュー（ヘルプメニュー）に配置**

```
┌──────────────────┐
│ ?               ▼│
├──────────────────┤
│ Show log         │
│ GitHub           │
│ Sponsor          │  ← GitHub Sponsorsへ（外部ブラウザで開く）
├──────────────────┤
│ Privacy Policy   │
│ Terms of Use     │
│ Licenses         │
├──────────────────┤
│ About            │
└──────────────────┘
```

**理由:**
- Preferencesは「設定を変更する場所」であり、寄付リンクは設定ではない
- `?` メニューは「アプリについて」の情報が集まる場所
- GitHubの近くに「Sponsor」があると、GitHub Sponsorsへのリンクとして自然

## Implementation Approach

### Source Code Changes

**Backend (Tauri)**:
- `src-tauri/src/lib.rs` - `?`メニューに「Sponsor」項目追加、イベントハンドラ追加

**Frontend**:
- `src/App.jsx` - `click_menu_static`で`sponsor`イベント処理、`shell.open()`で外部ブラウザを開く

### 実装の優先順位

**Phase 1（初期実装）**
1. `src-tauri/src/lib.rs`の`?`メニューに「Sponsor」項目追加
2. `src/App.jsx`でイベントハンドラ追加
3. Tauri `shell.open()` で GitHub Sponsors ページを外部ブラウザで開く

**Phase 2（リマインダー）**
1. 初回起動日をローカルストレージに保存
2. 30日後に1回だけトースト通知を表示
3. 「今後表示しない」オプション

## 注意点

- **押し付けがましくしない**: 寄付は任意であることを明確に
- **機能制限しない**: 寄付しないユーザーも全機能利用可能
- **透明性**: 寄付金の使途を明確に（開発費、サーバー代など）
- **感謝の表明**: 寄付者への感謝を忘れない
- **ダークテーマ対応**: CSS変数を使用してUIの一貫性を保つ

## 決定事項

1. **プラットフォーム**: GitHub Sponsors
2. **リマインダー通知**: あり（控えめに実装）
3. **スポンサー特典**: なし（全機能無料）

## 実装スコープ

### Phase 1（初期実装）
- [ ] `src-tauri/src/lib.rs`の`?`メニューに「Sponsor」項目追加（GitHubの下）
- [ ] `src/App.jsx`で`sponsor`イベントハンドラ追加
- [ ] Tauri `shell.open()` で GitHub Sponsors ページを外部ブラウザで開く

### Phase 2（リマインダー）
- [ ] 初回起動日をローカルストレージに保存
- [ ] 30日後に1回だけトースト通知を表示
- [ ] 「今後表示しない」オプション
- [ ] 非侵入的なデザイン（右下に小さく表示、数秒で自動消去）

---
**ステータス: 承認済み - 実装待ち**
