# Phase 2: Frontend Refactoring - PhotoEditor.jsx

## Overview

`PhotoEditor.jsx`（980行）を分割し、約500行を削減します。特に、重複した画像処理コード（150行）を排除します。

## Current Problems

- `saveAsCopy()`と`downloadStyled()`に同一のフィルター処理コード（150行の重複）
- 複雑なクロップインタラクションロジック（150行）
- 大量の繰り返しコントロールJSX（200行）

## Target Structure

```
src/App/PhotosList/PhotoOption/
  ├── PhotoEditor.jsx (300 lines - メインコンポーネント)
  └── PhotoEditor/
      ├── imageProcessing.js (200 lines - 画像処理ロジック)
      ├── CropTool.jsx (100 lines - クロップUI)
      ├── useCropInteractions.js (100 lines - マウスインタラクション)
      ├── EditorControl.jsx (50 lines - 再利用可能なコントロール)
      ├── cssUtils.js (既存)
      ├── cropUtils.js (既存)
      └── styleUtils.js (既存)
```

## Implementation Details

### imageProcessing.js

```javascript
// PhotoEditor/imageProcessing.js
export function applyImageFilters(canvas, ctx, editorStyles) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 共通のピクセル操作ロジック
    for (let i = 0; i < data.length; i += 4) {
        // Brightness
        data[i] = data[i] * (editorStyles.brightness / 100);
        data[i + 1] = data[i + 1] * (editorStyles.brightness / 100);
        data[i + 2] = data[i + 2] * (editorStyles.brightness / 100);

        // Contrast
        // ... etc
    }

    ctx.putImageData(imageData, 0, 0);
}

export function canvasToBlob(canvas, mimeType = 'image/jpeg') {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Canvas to blob failed')),
            mimeType,
            0.95
        );
    });
}
```

### EditorControl.jsx

```javascript
// PhotoEditor/EditorControl.jsx
export function EditorControl({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    onChange,
    onReset
}) {
    return (
        <div className="editor-control">
            <label>{label}</label>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <span>{value}{unit}</span>
            <button onClick={onReset}>Reset</button>
        </div>
    );
}
```

### PhotoEditor.jsx (簡略化後)

```javascript
import { applyImageFilters, canvasToBlob } from './PhotoEditor/imageProcessing';
import { EditorControl } from './PhotoEditor/EditorControl';
import { CropTool } from './PhotoEditor/CropTool';

// saveAsCopy - 簡略化
async function saveAsCopy() {
    const canvas = createCanvas(mainImage);
    const ctx = canvas.getContext('2d');
    applyImageFilters(canvas, ctx, editorStyles);

    const blob = await canvasToBlob(canvas);
    await invoke('save_photo_copy', { blob, originalPath });
}

// downloadStyled - 簡略化（重複排除）
async function downloadStyled() {
    const canvas = createCanvas(mainImage);
    const ctx = canvas.getContext('2d');
    applyImageFilters(canvas, ctx, editorStyles);

    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, generateFilename());
}

// コントロール部分 - 簡略化
return (
    <div className="photo-editor">
        <EditorControl
            label="Brightness"
            value={editorStyles.brightness}
            min={0}
            max={200}
            unit="%"
            onChange={(v) => updateStyle('brightness', v)}
            onReset={() => resetSingleControl('brightness')}
        />
        <EditorControl
            label="Contrast"
            value={editorStyles.contrast}
            min={0}
            max={200}
            unit="%"
            onChange={(v) => updateStyle('contrast', v)}
            onReset={() => resetSingleControl('contrast')}
        />
        {/* ... 他のコントロール */}

        {cropMode && (
            <CropTool
                image={mainImage}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropMode(false)}
            />
        )}
    </div>
);
```

## Implementation Steps

1. `imageProcessing.js` を作成し、フィルター処理ロジックを抽出
2. `canvasToBlob()` および関連ユーティリティを移動
3. `EditorControl.jsx` コンポーネントを作成
4. `CropTool.jsx` コンポーネントを作成
5. `useCropInteractions.js` フックを作成（マウスイベント処理）
6. `PhotoEditor.jsx` を新モジュールを使用するように更新
7. 全編集機能の動作テスト

## Testing Checklist

- [ ] Brightness 調整が動作する
- [ ] Contrast 調整が動作する
- [ ] Saturation 調整が動作する
- [ ] Hue 調整が動作する
- [ ] クロップツールが動作する
- [ ] 画像の回転が動作する
- [ ] フィルター適用が動作する
- [ ] `saveAsCopy()` が動作する（編集した画像を保存）
- [ ] `downloadStyled()` が動作する（編集した画像をダウンロード）
- [ ] 元に戻す/リセットが動作する

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| PhotoEditor.jsx | 980行 | 300行 |
| 重複コード | 150行 | 0行 |
| 新規モジュール | 0 | 4ファイル |
| 再利用可能コンポーネント | 0 | EditorControl |
