# Improvement 121: Split PhotoEditor.jsx into Feature Components

## 概要

`src/App/PhotosList/PhotoOption/PhotoEditor.jsx` (980行) を機能ごとのサブコンポーネントに分割し、コンポーネントの複雑さを軽減する。

## 背景

現在の `PhotoEditor.jsx` は以下の問題を抱えている：

1. **ファイルサイズが大きい**: 980行の単一コンポーネント
2. **複数の編集機能が混在**: フィルター、クロップ、回転、テキストなど
3. **状態管理が複雑**: 多数の useState が混在
4. **UI要素が多様**: ツールバー、プレビュー、スライダーなど

## 目的

- 編集機能ごとにコンポーネントを分割
- UI要素を独立したコンポーネント化
- 状態管理を整理
- コードの保守性と可読性を向上

## 実装方針

### ディレクトリ構造

```
src/App/PhotosList/PhotoOption/PhotoEditor/
├── PhotoEditor.jsx         # メインコンポーネント (約250行)
├── components/
│   ├── EditorToolbar.jsx      # ツールバー (約150行)
│   ├── ImagePreview.jsx       # プレビュー表示 (約150行)
│   ├── FilterPanel.jsx        # フィルター選択 (約200行)
│   ├── CropTool.jsx           # クロップツール (約150行)
│   └── TextTool.jsx           # テキストツール (約150行)
├── hooks/
│   ├── usePhotoEditor.js      # エディタ状態管理 (約200行)
│   └── useImageTransform.js   # 画像変換処理 (約150行)
└── utils/
    └── imageFilters.js        # フィルター定義 (約100行)
```

### 1. PhotoEditor.jsx (メインコンポーネント)

**責務**: サブコンポーネントの統合とレイアウト

```javascript
import React from 'react';
import EditorToolbar from './components/EditorToolbar';
import ImagePreview from './components/ImagePreview';
import FilterPanel from './components/FilterPanel';
import CropTool from './components/CropTool';
import TextTool from './components/TextTool';
import { usePhotoEditor } from './hooks/usePhotoEditor';
import './PhotoEditor.css';

function PhotoEditor({ photo, onClose, onSave }) {
    const {
        activetool,
        setActiveTool,
        imageData,
        appliedFilters,
        applyFilter,
        resetFilters,
        cropData,
        setCropData,
        saveImage
    } = usePhotoEditor(photo);

    const handleSave = async () => {
        const result = await saveImage();
        if (result && onSave) {
            onSave(result);
        }
    };

    return (
        <div className="photo-editor">
            <EditorToolbar
                activeToolactiveTool={activeTool}
                onToolSelect={setActiveTool}
                onSave={handleSave}
                onClose={onClose}
            />

            <div className="editor-content">
                <ImagePreview
                    imageData={imageData}
                    appliedFilters={appliedFilters}
                    cropData={cropData}
                />

                <div className="editor-panel">
                    {activeTool === 'filter' && (
                        <FilterPanel
                            appliedFilters={appliedFilters}
                            onFilterApply={applyFilter}
                            onFilterReset={resetFilters}
                        />
                    )}

                    {activeTool === 'crop' && (
                        <CropTool
                            imageData={imageData}
                            cropData={cropData}
                            onCropChange={setCropData}
                        />
                    )}

                    {activeTool === 'text' && (
                        <TextTool
                            imageData={imageData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default PhotoEditor;
```

**行数**: 約250行

### 2. components/EditorToolbar.jsx (ツールバー)

**責務**: 編集ツールの選択とアクションボタン

```javascript
import React from 'react';
import './EditorToolbar.css';

function EditorToolbar({ activeTool, onToolSelect, onSave, onClose }) {
    const tools = [
        { id: 'filter', label: 'フィルター', icon: '🎨' },
        { id: 'crop', label: 'クロップ', icon: '✂️' },
        { id: 'rotate', label: '回転', icon: '🔄' },
        { id: 'text', label: 'テキスト', icon: '📝' },
        { id: 'adjust', label: '調整', icon: '🔧' }
    ];

    return (
        <div className="editor-toolbar">
            <div className="toolbar-left">
                <button onClick={onClose} className="close-btn">
                    ✕ 閉じる
                </button>
            </div>

            <div className="toolbar-center">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => onToolSelect(tool.id)}
                        title={tool.label}
                    >
                        <span className="tool-icon">{tool.icon}</span>
                        <span className="tool-label">{tool.label}</span>
                    </button>
                ))}
            </div>

            <div className="toolbar-right">
                <button onClick={onSave} className="save-btn">
                    💾 保存
                </button>
            </div>
        </div>
    );
}

export default EditorToolbar;
```

**行数**: 約150行

### 3. components/ImagePreview.jsx (プレビュー表示)

**責務**: 編集中の画像プレビュー

```javascript
import React, { useRef, useEffect } from 'react';
import { useImageTransform } from '../hooks/useImageTransform';
import './ImagePreview.css';

function ImagePreview({ imageData, appliedFilters, cropData }) {
    const canvasRef = useRef(null);
    const { applyTransforms } = useImageTransform();

    useEffect(() => {
        if (!canvasRef.current || !imageData) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            // 画像を描画
            ctx.drawImage(img, 0, 0);

            // フィルターとトランスフォームを適用
            applyTransforms(ctx, canvas, {
                filters: appliedFilters,
                crop: cropData
            });
        };

        img.src = imageData;
    }, [imageData, appliedFilters, cropData]);

    return (
        <div className="image-preview">
            <canvas ref={canvasRef} />
        </div>
    );
}

export default ImagePreview;
```

**行数**: 約150行

### 4. components/FilterPanel.jsx (フィルター選択)

**責務**: フィルターの選択と調整

```javascript
import React, { useState } from 'react';
import { FILTERS } from '../utils/imageFilters';
import './FilterPanel.css';

function FilterPanel({ appliedFilters, onFilterApply, onFilterReset }) {
    const [selectedFilter, setSelectedFilter] = useState(null);
    const [filterIntensity, setFilterIntensity] = useState(100);

    const handleFilterSelect = (filter) => {
        setSelectedFilter(filter);
        onFilterApply(filter.id, filterIntensity / 100);
    };

    const handleIntensityChange = (value) => {
        setFilterIntensity(value);
        if (selectedFilter) {
            onFilterApply(selectedFilter.id, value / 100);
        }
    };

    return (
        <div className="filter-panel">
            <h3>フィルター</h3>

            <div className="filter-presets">
                {FILTERS.map(filter => (
                    <div
                        key={filter.id}
                        className={`filter-preset ${selectedFilter?.id === filter.id ? 'active' : ''}`}
                        onClick={() => handleFilterSelect(filter)}
                    >
                        <div className="filter-preview">
                            {/* フィルタープレビュー */}
                        </div>
                        <div className="filter-name">{filter.name}</div>
                    </div>
                ))}
            </div>

            {selectedFilter && (
                <div className="filter-controls">
                    <label>強度</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterIntensity}
                        onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                    />
                    <span>{filterIntensity}%</span>
                </div>
            )}

            <button onClick={onFilterReset} className="reset-btn">
                リセット
            </button>
        </div>
    );
}

export default FilterPanel;
```

**行数**: 約200行

### 5. components/CropTool.jsx (クロップツール)

**責務**: クロップ領域の選択と調整

```javascript
import React, { useState, useRef, useEffect } from 'react';
import './CropTool.css';

function CropTool({ imageData, cropData, onCropChange }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const containerRef = useRef(null);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        const rect = containerRef.current.getBoundingClientRect();
        setDragStart({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !dragStart) return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        onCropChange({
            x: Math.min(dragStart.x, currentX),
            y: Math.min(dragStart.y, currentY),
            width: Math.abs(currentX - dragStart.x),
            height: Math.abs(currentY - dragStart.y)
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div className="crop-tool">
            <h3>クロップ</h3>

            <div
                ref={containerRef}
                className="crop-container"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <img src={imageData} alt="Crop preview" />

                {cropData && (
                    <div
                        className="crop-overlay"
                        style={{
                            left: `${cropData.x}px`,
                            top: `${cropData.y}px`,
                            width: `${cropData.width}px`,
                            height: `${cropData.height}px`
                        }}
                    />
                )}
            </div>

            <div className="crop-presets">
                <button onClick={() => onCropChange(null)}>リセット</button>
                <button onClick={() => onCropChange({ aspectRatio: '1:1' })}>正方形</button>
                <button onClick={() => onCropChange({ aspectRatio: '4:3' })}>4:3</button>
                <button onClick={() => onCropChange({ aspectRatio: '16:9' })}>16:9</button>
            </div>
        </div>
    );
}

export default CropTool;
```

**行数**: 約150行

### 6. components/TextTool.jsx (テキストツール)

**責務**: テキストの追加と編集

```javascript
import React, { useState } from 'react';
import './TextTool.css';

function TextTool({ imageData }) {
    const [text, setText] = useState('');
    const [fontSize, setFontSize] = useState(24);
    const [fontColor, setFontColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });

    return (
        <div className="text-tool">
            <h3>テキスト</h3>

            <div className="text-controls">
                <label>テキスト</label>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="テキストを入力..."
                />

                <label>フォントサイズ</label>
                <input
                    type="range"
                    min="12"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                />
                <span>{fontSize}px</span>

                <label>色</label>
                <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                />
            </div>
        </div>
    );
}

export default TextTool;
```

**行数**: 約150行

### 7. hooks/usePhotoEditor.js (エディタ状態管理)

**責務**: エディタの状態とロジックの管理

```javascript
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../../../services/LoggerService';

export function usePhotoEditor(photo) {
    const [activeactiveTool, setActiveTool] = useState('filter');
    const [imageData, setImageData] = useState(photo.path);
    const [appliedFilters, setAppliedFilters] = useState([]);
    const [cropData, setCropData] = useState(null);

    const applyFilter = useCallback((filterId, intensity) => {
        logger.info('PhotoEditor', 'apply_filter', 'Applying filter', { filterId, intensity });

        setAppliedFilters(prev => {
            const existing = prev.find(f => f.id === filterId);
            if (existing) {
                return prev.map(f =>
                    f.id === filterId ? { ...f, intensity } : f
                );
            } else {
                return [...prev, { id: filterId, intensity }];
            }
        });
    }, []);

    const resetFilters = useCallback(() => {
        logger.info('PhotoEditor', 'reset_filters', 'Resetting filters');
        setAppliedFilters([]);
    }, []);

    const saveImage = useCallback(async () => {
        logger.info('PhotoEditor', 'save_image', 'Saving edited image');

        try {
            const result = await invoke('save_edited_image', {
                originalPath: photo.path,
                filters: JSON.stringify(appliedFilters),
                crop: JSON.stringify(cropData)
            });

            logger.info('PhotoEditor', 'save_image_success', 'Image saved successfully');
            return result;
        } catch (error) {
            logger.error('PhotoEditor', 'save_image_error', 'Failed to save image', { error });
            throw error;
        }
    }, [photo.path, appliedFilters, cropData]);

    return {
        activeTool,
        setActiveTool,
        imageData,
        appliedFilters,
        applyFilter,
        resetFilters,
        cropData,
        setCropData,
        saveImage
    };
}
```

**行数**: 約200行

### 8. utils/imageFilters.js (フィルター定義)

**責務**: 利用可能なフィルターの定義

```javascript
export const FILTERS = [
    {
        id: 'grayscale',
        name: 'グレースケール',
        cssFilter: 'grayscale(100%)'
    },
    {
        id: 'sepia',
        name: 'セピア',
        cssFilter: 'sepia(100%)'
    },
    {
        id: 'brightness',
        name: '明るさ',
        cssFilter: 'brightness(150%)'
    },
    {
        id: 'contrast',
        name: 'コントラスト',
        cssFilter: 'contrast(150%)'
    },
    {
        id: 'blur',
        name: 'ぼかし',
        cssFilter: 'blur(5px)'
    }
];
```

**行数**: 約100行

## 移行手順

### Phase 1: ディレクトリ構造の作成

1. `PhotoEditor/` ディレクトリを作成
2. サブディレクトリとファイルを作成

### Phase 2: サブコンポーネントの実装

1. `EditorToolbar.jsx` を作成
2. `ImagePreview.jsx` を作成
3. `FilterPanel.jsx` を作成
4. `CropTool.jsx` を作成
5. `TextTool.jsx` を作成

### Phase 3: フックとユーティリティ

1. `hooks/usePhotoEditor.js` を作成
2. `utils/imageFilters.js` を作成

### Phase 4: メインコンポーネントのリファクタリング

1. `PhotoEditor.jsx` でサブコンポーネントを統合
2. テストで動作確認

## 期待される効果

1. **可読性の向上**: 各コンポーネントが150-250行程度に
2. **再利用性の向上**: 編集ツールを個別に使用可能
3. **テスタビリティの向上**: 各コンポーネントを個別にテスト可能
4. **保守性の向上**: 機能ごとに分離され、変更が容易

## 参考

- React コンポーネント設計のベストプラクティス
- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
