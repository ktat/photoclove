# Editor: CSS解析・バックエンドの修正

## Overview

CSS解析の精度不足、およびバックエンドのCSS正規化でclip-pathが無視される問題を修正する。

## 問題一覧

| 優先度 | ファイル | 行 | 問題 |
|--------|----------|-----|------|
| 🟡 | cssUtils.js | 38-46 | CSS解析で小数点が切り捨て |
| 🟡 | style_commands.rs | 188-220 | バックエンドCSS正規化でclip-path無視 |

## 問題詳細

### 🟡 問題1: CSS解析の精度不足

**ファイル**: `cssUtils.js:38-46`

```javascript
const rotateMatch = transformValue.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
if (rotateMatch) {
    values.rotate = parseInt(rotateMatch[1]);  // ← 小数点切り捨て
}

const scaleMatch = transformValue.match(/scale\((\d+(?:\.\d+)?)\)/);
if (scaleMatch) {
    values.scale = Math.round(parseFloat(scaleMatch[1]) * 100);  // ← 丸め誤差
}
```

**問題**: `rotate(45.5deg)` → 45° に、再保存で精度喪失

### 🟡 問題2: バックエンドCSS正規化でclip-path無視

**ファイル**: `style_commands.rs:188-220`

```rust
pub(crate) fn normalize_css_style(css: &str) -> String {
    let mut properties = HashMap::new();

    // transform と filter のみ処理
    if let Some(transform_start) = css.find("transform:") { ... }
    if let Some(filter_start) = css.find("filter:") { ... }

    // clip-path が処理されていない！
}
```

**問題**: clip-path（Crop情報）がハッシュ計算に含まれない

## 修正方針

### CSS解析の精度向上

```javascript
// cssUtils.js
const rotateMatch = transformValue.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
if (rotateMatch) {
    values.rotate = parseFloat(rotateMatch[1]);  // 小数点保持
}

const scaleMatch = transformValue.match(/scale\((\d+(?:\.\d+)?)\)/);
if (scaleMatch) {
    values.scale = parseFloat(scaleMatch[1]) * 100;  // 丸めない
}
```

### バックエンドCSS正規化の修正

```rust
// style_commands.rs
pub(crate) fn normalize_css_style(css: &str) -> String {
    let mut properties = HashMap::new();

    // transform
    if let Some(transform_start) = css.find("transform:") {
        if let Some(transform_end) = css[transform_start..].find(';') {
            let transform_value = css[transform_start + 10..transform_start + transform_end].trim();
            properties.insert("transform", transform_value);
        }
    }

    // filter
    if let Some(filter_start) = css.find("filter:") {
        if let Some(filter_end) = css[filter_start..].find(';') {
            let filter_value = css[filter_start + 7..filter_start + filter_end].trim();
            properties.insert("filter", filter_value);
        }
    }

    // clip-path（追加）
    if let Some(clip_start) = css.find("clip-path:") {
        if let Some(clip_end) = css[clip_start..].find(';') {
            let clip_value = css[clip_start + 10..clip_start + clip_end].trim();
            properties.insert("clip-path", clip_value);
        }
    }

    // ... 以下同様
}
```

### 修正箇所

**フロントエンド**:
1. `cssUtils.js:38-46`: parseFloat使用、小数点保持

**バックエンド**:
1. `style_commands.rs:188-220`: clip-path対応追加

## Testing Strategy

- [ ] rotate(45.5deg) → 再読み込みで45.5°が維持される
- [ ] scale(1.333) → 再読み込みで133.3%が維持される
- [ ] Crop適用 → 同じCropで同じハッシュが生成される
- [ ] 異なるCrop → 異なるハッシュが生成される

## 影響範囲

- CSS解析の精度向上は表示のみに影響
- バックエンドの正規化はファイル名ハッシュに影響
  - 既存のstyled copyファイル名との互換性に注意
