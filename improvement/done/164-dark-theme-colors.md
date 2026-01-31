# ダークテーマ: ハードコードされた色の問題

## 概要

CLAUDE.md のガイドラインでは、PhotoClove はダークテーマアプリケーションであり、以下のルールが定められています：

- 背景色は常にダーク
- テキストは常にライト
- 白色は小さなアクセントにのみ使用可能
- CSS変数を使用すること

本ドキュメントでは、ガイドライン違反箇所と修正方法を記載します。

**重要度**: Medium
**対応優先度**: Medium

---

## 対応方針

**CSS変数に一括置換する**

- `white` → `var(--text)`
- `#ffffff` / `#fff` → `var(--text)`
- ハードコードされた背景色 → `var(--bg)` または `var(--bg-elevated)`

---

## CSS変数の定義（参照用）

```css
:root {
    --bg: #1a1a2e;           /* メイン背景 */
    --bg-elevated: #16213e;   /* 浮き上がった要素の背景 */
    --text: #e4e4e4;          /* メインテキスト */
    --text-muted: #a0a0a0;    /* 薄いテキスト */
    --border: #374151;        /* ボーダー */
    --accent: #4f46e5;        /* アクセントカラー */
    --accent-hover: #6366f1;  /* アクセントホバー */
}
```

---

## 第1部: JSX インラインスタイルの違反

### 高優先度

| ファイル | 行 | 問題のコード | 修正後 |
|---------|-----|-------------|--------|
| `src/App/PhotosList/PhotoCard.jsx` | 314 | `color: "white"` | `color: "var(--text)"` |
| `src/App/DateList.jsx` | 308 | `color: 'white'` | `color: 'var(--text)'` |
| `src/App/DateList.jsx` | 323 | `color: 'white'` | `color: 'var(--text)'` |

### 低優先度

| ファイル | 行 | 問題のコード | 修正後 |
|---------|-----|-------------|--------|
| `src/components/ErrorDisplay.jsx` | 144 | `color: 'white'` | `color: 'var(--text)'` |
| `src/App/JobQueue.jsx` | 258 | `color: "white"` | `color: "var(--text)"` |
| `src/components/BulkTagSelectorModal.jsx` | 386 | `color: ... 'white'` | `color: 'var(--text)'` |

---

## 第2部: CSSファイルの違反（40箇所以上）

### style.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 320 | `color: white;` | `color: var(--text);` |
| 335 | `color: white;` | `color: var(--text);` |
| 389 | `background: white;` | 削除またはアクセント用途を確認 |

### Home.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 48 | `color: white;` | `color: var(--text);` |

### JobQueue.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 56 | `color: white;` | `color: var(--text);` |
| 118 | `color: white;` | `color: var(--text);` |
| 127 | `color: white;` | `color: var(--text);` |

### LogViewer.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 56 | `color: white;` | `color: var(--text);` |

### Preferences.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 214 | `#ffffff` | `var(--text)` |
| 304 | `#ffffff` | `var(--text)` |

### TagInput.module.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 92 | `color: white;` | `color: var(--text);` |

### PhotoOption.module.css

| 行 | 問題のコード | 修正提案 |
|-----|-------------|---------|
| 複数 | `color: white;` | `color: var(--text);` |

---

## 修正方法

### JSXインラインスタイルの修正

```jsx
// 修正前
<div style={{ color: "white" }}>テキスト</div>

// 修正後
<div style={{ color: "var(--text)" }}>テキスト</div>
```

### CSSの修正

```css
/* 修正前 */
.button {
    color: white;
    background: #ffffff;
}

/* 修正後 */
.button {
    color: var(--text);
    background: var(--bg-elevated);
}
```

### CSS Modules の修正（推奨パターン）

```css
/* ComponentName.module.css */
.container {
    color: var(--text);
    background: var(--bg);
}

.highlight {
    color: var(--accent);
}

.muted {
    color: var(--text-muted);
}
```

---

## 白色を使用してよいケース

以下の場合のみ白色の使用が許容されます：

### 1. 小さなアクセント要素

```css
/* OK: アイコンのハイライト */
.icon-active {
    color: white;
    background: var(--accent);
}

/* OK: 通知バッジ */
.notification-badge {
    color: white;
    background: #ef4444; /* 赤いバッジ */
}
```

### 2. 選択/アクティブ状態

```css
/* OK: 選択されたタブ */
.tab.active {
    color: white;
    background: var(--accent);
}
```

### 3. ボタンのテキスト

```css
/* OK: プライマリボタン */
.button-primary {
    color: white;
    background: var(--accent);
}
```

### 4. フォーカスインジケータ

```css
/* OK: フォーカスリング */
.input:focus {
    outline: 2px solid white;
    outline-offset: 2px;
}
```

---

## 一括修正スクリプト

### 検索コマンド

```bash
# JSXでの white 使用を検索
grep -rn "color.*['\"]white['\"]" src/ --include="*.jsx" --include="*.js"

# CSSでの white 使用を検索
grep -rn ":\s*white" src/ --include="*.css"

# #ffffff / #fff を検索
grep -rn "#fff" src/ --include="*.css"
```

### sed による一括置換（注意して使用）

```bash
# テスト: まず変更内容を確認
sed -n "s/color:\s*white/color: var(--text)/gp" src/App/DateList.jsx

# 実行（ファイルを直接編集）
# sed -i "s/color:\s*white/color: var(--text)/g" src/App/DateList.jsx
```

---

## 対応チェックリスト

### 高優先度（UIに影響大）

- [ ] `PhotoCard.jsx` の color: "white" を修正
- [ ] `DateList.jsx` の color: 'white' を修正（2箇所）
- [ ] `style.css` の主要な white を修正

### 中優先度

- [ ] `JobQueue.jsx` / `JobQueue.css` を修正
- [ ] `ErrorDisplay.jsx` を修正
- [ ] `BulkTagSelectorModal.jsx` を修正

### 低優先度

- [ ] `Preferences.css` の #ffffff を修正
- [ ] CSS Modules の white を修正
- [ ] LogViewer.css を修正
- [ ] Home.css を修正

---

## 確認方法

### 視覚的確認

1. アプリケーションを起動
2. 各画面を確認
3. 白い背景やまぶしい要素がないか確認
4. ダークモードで自然に見えるか確認

### 自動チェック（CI/CD）

```bash
# 禁止パターンをチェック
if grep -rn "background.*:\s*white" src/ --include="*.css" | grep -v "/* exception */" ; then
    echo "Error: White background found in CSS"
    exit 1
fi
```

---

## 参考: 色の選択ガイド

| 用途 | 推奨色 | 変数 |
|------|--------|------|
| メイン背景 | #1a1a2e | `var(--bg)` |
| カード/パネル背景 | #16213e | `var(--bg-elevated)` |
| メインテキスト | #e4e4e4 | `var(--text)` |
| 薄いテキスト | #a0a0a0 | `var(--text-muted)` |
| ボーダー | #374151 | `var(--border)` |
| アクセント | #4f46e5 | `var(--accent)` |
| 成功 | #10b981 | `var(--success)` |
| 警告 | #f59e0b | `var(--warning)` |
| エラー | #ef4444 | `var(--error)` |

---

*作成日: 2025-01-13*
*元ファイル: 2026-01-13-code-review.md*
