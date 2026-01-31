# Editor: Rotate/Scale寸法計算の修正

## Overview

回転・スケール変更時に出力画像の寸法が正しく計算されない問題を修正する。

## 問題一覧

| 優先度 | ファイル | 行 | 問題 |
|--------|----------|-----|------|
| 🔴 | imageProcessing.js | 236-237 | 回転時の寸法計算がない |
| 🔴 | imageProcessing.js | 190-193 | Scale時の寸法計算がない |

## 問題詳細

### 🔴 問題1: 回転時のCanvas寸法計算がない

**ファイル**: `imageProcessing.js:236-237`

```javascript
finalCanvas.width = width;   // ← 常に元の寸法
finalCanvas.height = height;
```

**問題**: 90度回転時、縦横が入れ替わるべきだがCanvas寸法は変わらない

**例**:
- 元画像: 1920×1080（横長）
- 90度回転後: 期待値 1080×1920
- 実際: Canvas 1920×1080 のまま → 画像が切り取られる

### 🔴 問題2: Scale時の出力寸法計算がない

**ファイル**: `imageProcessing.js:190-193`

```javascript
if (scale !== 100) {
    const scaleValue = scale / 100;
    ctx.scale(scaleValue, scaleValue);  // 描画時にスケール
}
```

**問題**: Canvas寸法は変わらず、内容だけ縮小される

**例**:
- 元画像: 1000×1000
- Scale 50%: 期待値 500×500
- 実際: Canvas 1000×1000、中央に500×500の画像、周囲は空白

## 修正方針

### 回転時の寸法計算

```javascript
export function calculateRotatedDimensions(width, height, rotate) {
    const normalizedRotate = ((rotate % 360) + 360) % 360;

    if (normalizedRotate === 90 || normalizedRotate === 270) {
        return { width: height, height: width };  // 縦横入れ替え
    }

    if (normalizedRotate === 0 || normalizedRotate === 180) {
        return { width, height };
    }

    // 任意角度の場合（回転後に収まる矩形を計算）
    const rad = (normalizedRotate * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
        width: Math.ceil(width * cos + height * sin),
        height: Math.ceil(width * sin + height * cos)
    };
}
```

### Scale時の寸法計算

```javascript
export function calculateScaledDimensions(width, height, scale) {
    const factor = scale / 100;
    return {
        width: Math.round(width * factor),
        height: Math.round(height * factor)
    };
}
```

### 修正箇所

1. `imageProcessing.js`: 寸法計算関数を追加
2. `imageProcessing.js:232-240`: Canvas作成時に計算結果を使用
3. `photoExportUtils.js`: 出力サイズを正しく設定

## Testing Strategy

**Rotateテスト**
- [ ] 90度回転 → 横長画像が縦長になる（寸法入れ替え）
- [ ] 180度回転 → 寸法変わらず、上下反転
- [ ] 270度回転 → 縦横入れ替え
- [ ] 45度回転 → 画像が切れない（Canvas拡大）

**Scaleテスト**
- [ ] Scale 50% → 出力画像が半分のサイズ
- [ ] Scale 200% → 出力画像が2倍のサイズ
- [ ] 余白なし

**組み合わせテスト**
- [ ] Scale 50% + Rotate 90° → 正しいサイズで回転
- [ ] Scale 200% + Rotate 45° → 拡大＆回転が正しく適用

## Open Questions

1. **任意角度回転時のCanvas拡大**: 画像が収まるようにCanvasを拡大するか、切り取るか？
   - 推奨: Canvas拡大（余白は透明）
