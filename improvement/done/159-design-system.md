# デザインシステム構築

## Overview
PhotoCloveの視覚的一貫性を向上させるため、包括的なデザイントークン（CSS変数）を定義し、段階的に適用する。

## User Impact
- 統一感のあるUIで使いやすさ向上
- 野暮ったさの解消（色・スペーシング・角丸の不統一）
- 今後の開発での一貫性維持が容易に

## 現状の問題点

### 既存のCSS変数（base.css）- たった5つ
```css
--bg: #5b5b5b;        /* 明るすぎる */
--bg-elevated: #242424;
--text: #e4e4e4;
--border: #444;
--accent: #999;       /* 地味すぎる */
```

### ハードコードされた色の例
| ファイル | 色 | 用途 |
|---------|---|------|
| PhotoOption.module.css | `#4CAF50` | 選択状態（Material緑） |
| PhotoOption.module.css | `#FF9800` | 選択あり（Material橙） |
| PhotoOption.module.css | `#d32f2f` | 閉じるボタン（Material赤） |
| TagChip.module.css | `#e1e5e9` | 背景（ライト色！） |
| FormControls.css | `#007acc` | ボタン |
| style.css | `#333`, `#444`, `#555`... | 各所 |
| search/*.css | `#2a2a2a`, `#3a3a3a` | 背景 |

---

## 提案: 新しいデザイントークン

### 1. カラーパレット

```css
:root {
  /* === ベースカラー === */
  --color-bg-base: #1b1b1b;        /* 最も暗い背景 */
  --color-bg-elevated: #242424;    /* カード・パネル */
  --color-bg-surface: #2a2a2a;     /* 入力欄・ホバー */
  --color-bg-muted: #333333;       /* 無効状態・区切り */

  /* === テキストカラー === */
  --color-text-primary: #e4e4e4;   /* メインテキスト */
  --color-text-secondary: #9ca3af; /* 補助テキスト */
  --color-text-muted: #6b7280;     /* 無効・プレースホルダ */

  /* === ボーダー === */
  --color-border-default: #444444;
  --color-border-subtle: #333333;
  --color-border-strong: #555555;

  /* === アクセントカラー（メインアクション） === */
  --color-primary: #4a9eff;
  --color-primary-hover: #3a8eef;
  --color-primary-muted: rgba(74, 158, 255, 0.2);

  /* === 状態カラー === */
  --color-success: #22c55e;        /* 成功・選択済み */
  --color-success-muted: rgba(34, 197, 94, 0.2);

  --color-warning: #f59e0b;        /* 警告・選択あり */
  --color-warning-muted: rgba(245, 158, 11, 0.2);

  --color-danger: #ef4444;         /* 削除・エラー */
  --color-danger-muted: rgba(239, 68, 68, 0.2);

  --color-info: #3b82f6;           /* 情報 */
}
```

### 2. スペーシングスケール

```css
:root {
  /* 4pxベースのスケール */
  --space-1: 4px;    /* 極小 */
  --space-2: 8px;    /* 小 */
  --space-3: 12px;   /* 中小 */
  --space-4: 16px;   /* 中 */
  --space-5: 20px;   /* 中大 */
  --space-6: 24px;   /* 大 */
  --space-8: 32px;   /* 特大 */
  --space-10: 40px;  /* 極大 */
}
```

### 3. 角丸

```css
:root {
  --radius-sm: 4px;   /* ボタン・入力欄 */
  --radius-md: 6px;   /* カード */
  --radius-lg: 8px;   /* モーダル・パネル */
  --radius-xl: 12px;  /* 大きなコンテナ */
  --radius-full: 9999px; /* ピル型 */
}
```

### 4. シャドウ

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 12px rgba(74, 158, 255, 0.4);
}
```

### 5. トランジション

```css
:root {
  --transition-fast: 150ms ease-out;
  --transition-normal: 250ms ease-out;
  --transition-slow: 350ms ease-out;
}
```

### 6. フォント

```css
:root {
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-2xl: 20px;
}
```

---

## 実装アプローチ

### Phase 1+2: 今回実装する範囲（決定済み）

#### Step 1: base.css にデザイントークン追加
- 全ての新変数を定義
- 既存変数（--bg, --text等）は**廃止**し、新変数を使用するよう修正

#### Step 2: 旧変数を使用しているファイルの修正（19ファイル）
旧変数 → 新変数への置換

**対象ファイル**:
- src/App/PhotosList/PhotosToolbar.module.css
- src/App/PhotosList/PhotoGrid.module.css
- src/App/PhotosList/PhotoOption.module.css
- src/App/Preferences.css
- src/App/LeftMenu.css
- src/App/Footer.css
- src/App/JobQueue.css
- src/App/LogViewer.css
- src/style.css
- src/styles/base.css
- src/components/BulkTagSelectorModal.css
- src/components/VerticalTabBar.css
- src/components/TagInput.module.css
- src/components/TagManager.module.css
- src/components/AdvancedFilters.css
- src/components/FormControls.css
- src/components/HelpDialog.css
- src/components/TagSelector.module.css
- src/components/AlbumSelectorModal.css

**変換ルール**（順序重要）:
| 順番 | 旧変数 | 新変数 | 備考 |
|------|--------|--------|------|
| 1 | `--bg-elevated` | `--color-bg-elevated` | **先に置換**（--bgを含むため） |
| 2 | `--bg` | `--color-bg-surface` | 後から置換 |
| 3 | `--text` | `--color-text-primary` | |
| 4 | `--border` | `--color-border-default` | |
| 5 | `--accent` | `--color-primary` | |

#### Step 3: TagChip.module.css
- ライト背景 `#e1e5e9` → `var(--color-bg-surface)`
- 文字色・ボーダーも新変数に

#### Step 4: PhotoOption.module.css
- Material色を状態カラーに置換
- `#4CAF50` → `var(--color-success)`
- `#FF9800` → `var(--color-warning)`
- `#d32f2f` → `var(--color-danger)`

#### Step 5: style.css
- ハードコード色（`#333`, `#444`, `#555`等）を変数化

### Phase 3: 将来の改善（今回は対象外）
1. **FormControls.css** - ボタン色統一
2. **search/*.css** - 背景色統一
3. **LeftMenu.css** - スペーシング調整
4. アニメーションのease調整
5. 残りのグローバルCSS整理

---

## 変換マッピング

### PhotoOption.module.css
| Before | After |
|--------|-------|
| `#4CAF50` | `var(--color-success)` |
| `#FF9800` | `var(--color-warning)` |
| `#d32f2f` | `var(--color-danger)` |

### TagChip.module.css
| Before | After |
|--------|-------|
| `#e1e5e9` (背景) | `var(--color-bg-surface)` |
| `#374151` (文字) | `var(--color-text-primary)` |
| `#d1d5db` (ボーダー) | `var(--color-border-default)` |

### style.css / FormControls.css
| Before | After |
|--------|-------|
| `#007acc` | `var(--color-primary)` |
| `#333` | `var(--color-bg-muted)` |
| `#444` | `var(--color-border-default)` |
| `#555` | `var(--color-border-strong)` |

---

## 決定事項

1. **プライマリカラー**: `#4a9eff` を採用（明るいブルー、現在多用）
2. **既存変数の扱い**: 新変数に置き換え、旧変数（--bg, --accent等）は**廃止**
3. **スペーシング単位**: `px` 固定（シンプルさ優先）
4. **実装範囲**: Phase 1+2を一気に実装（トークン定義 + TagChip/PhotoOption/style.css修正）

---

## 参考: 色の比較

### 現在の問題のある色
- `--bg: #5b5b5b` → 明るすぎる（`#2a2a2a`程度が適切）
- `--accent: #999` → 地味すぎる（`#4a9eff`でアクションを明確に）
- TagChip `#e1e5e9` → ダークテーマ違反

### 提案する色階調
```
#1b1b1b ████ 最暗（ベース背景）
#242424 ████ 暗（カード）
#2a2a2a ████ 中暗（入力欄）
#333333 ████ 中（区切り）
#444444 ████ ボーダー
#555555 ████ 強調ボーダー
```
