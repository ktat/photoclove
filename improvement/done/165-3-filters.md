# Editor: フィルター処理の修正

## Overview

フィルター（Brightness, Contrast, Saturation, Hue）の処理がCSS表示とCanvas出力で異なる問題を修正する。

## 問題一覧

| 優先度 | ファイル | 行 | 問題 |
|--------|----------|-----|------|
| 🟠 | imageProcessing.js | 132-162 | フィルター適用順序がCSS/Canvasで異なる可能性 |
| 🟠 | imageProcessing.js | 84-107 | Hue回転の色空間がCSS/Canvasで異なる |
| 🟠 | imageProcessing.js | 14-22 | Brightness負値の処理がない |

## 問題詳細

### 🟠 問題1: フィルター適用順序の不一致

**CSS表示**（cssUtils.js:129-132）:
```
filter: brightness(150%) contrast(120%) saturate(80%) hue-rotate(30deg);
```

**Canvas処理**（imageProcessing.js:132-162）:
```
1. brightness → 2. contrast → 3. saturation → 4. hue
```

CSSとCanvasで同じ順序だが、ブラウザのCSSフィルター実装とCanvas手動実装で結果が異なる可能性がある。

### 🟠 問題2: Hue回転の色空間の違い

**ファイル**: `imageProcessing.js:84-107`

```javascript
// RGB色空間での回転行列を使用
const newR = r * (cosHue + (1 - cosHue) / 3) + ...
```

**問題**:
- CSS `hue-rotate()`: HSL色空間での回転
- Canvas実装: RGB色空間での回転行列
- **結果**: 色見が異なる（特に赤・青の回転量が不均等）

### 🟠 問題3: Brightness負値の未処理

**ファイル**: `imageProcessing.js:14-22`

```javascript
export function applyBrightness(r, g, b, brightness) {
    const multiplier = brightness / 100;
    return {
        r: Math.min(255, r * multiplier),  // ← 負値チェックなし
        g: Math.min(255, g * multiplier),
        b: Math.min(255, b * multiplier)
    };
}
```

**問題**: DevToolsで負値を入力すると色が反転する可能性

## 修正方針

### Brightness負値ガード

```javascript
export function applyBrightness(r, g, b, brightness) {
    if (brightness === 100) return { r, g, b };

    // 負値を0にクランプ
    const safeBrightness = Math.max(0, brightness);
    const multiplier = safeBrightness / 100;

    return {
        r: Math.min(255, Math.max(0, r * multiplier)),
        g: Math.min(255, Math.max(0, g * multiplier)),
        b: Math.min(255, Math.max(0, b * multiplier))
    };
}
```

### Hue回転のHSL実装（中期的改善）

```javascript
export function applyHueHSL(r, g, b, hue) {
    if (hue === 0) return { r, g, b };

    // RGB → HSL
    const { h, s, l } = rgbToHsl(r, g, b);

    // Hue回転
    const newH = (h + hue / 360) % 1;

    // HSL → RGB
    return hslToRgb(newH, s, l);
}
```

### 修正箇所

1. `imageProcessing.js:14-22`: Brightness負値ガード追加
2. `imageProcessing.js:84-107`: HSL変換実装（中期的）
3. `PhotoEditor.jsx`: 入力値のバリデーション強化

## Testing Strategy

- [ ] Brightness 0% → 真っ黒
- [ ] Brightness 200% → 明るくなる
- [ ] Saturation 0% → グレースケール
- [ ] Saturation 200% → 色が濃くなる
- [ ] Hue 180° → 色反転
- [ ] 全フィルター組み合わせ → 表示と保存が一致

## Open Questions

1. **Hue回転の色空間統一**: HSL変換を実装するか、現状維持か？
   - 推奨: 中期的にはHSL実装（精度向上）
   - 短期的にはドキュメント化（「保存結果が若干異なる場合がある」）

2. **フィルター適用順序の統一**: 明示的に順序を固定するか？
   - 推奨: 現状維持（brightness → contrast → saturation → hue）
