# Improvement #87: Refactor PhotoEditor.jsx - Extract Utilities and Components

## Current Status
- File: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- Lines: **1,292 lines** (exceeds 1000 line limit)
- Complexity: High - mixing UI, logic, and utilities

## Problem
PhotoEditor.jsx handles multiple concerns:
- CSS parsing and generation (transform, filter, crop)
- Crop functionality (selection, overlay, presets)
- Style utilities (rotation, brightness, contrast, etc.)
- UI rendering (toolbar, controls, overlay)
- Event handling (mouse drag, keyboard shortcuts)
- State management (editor state, crop state, undo/redo)

## Goal
Extract utilities and sub-components to reduce file size and improve testability.

## Implementation Plan

### Step 1: Create `PhotoEditor/cssUtils.js`
Extract CSS parsing and generation utilities (~200 lines):
- `parseCssStyle(cssString)` - Parse CSS string to object
- `generateCssStyle(editorStyles)` - Generate CSS from state
- `applyCropToCss(crop)` - Convert crop to CSS clip-path
- `applyRotationToCss(degrees)` - Rotation transform
- `applyFiltersToCss(filters)` - Filter properties
- `mergeStyles(original, editor)` - Combine styles
- CSS string manipulation helpers

### Step 2: Create `PhotoEditor/cropUtils.js`
Extract crop-related logic (~200 lines):
- `calculateCropBounds(imageRect, containerRect)` - Crop overlay positioning
- `applyCropPreset(preset, imageRect)` - Apply preset ratios
- `validateCropSelection(selection, bounds)` - Validate crop area
- `cropPresets` - Preset definitions (square, 4:3, 16:9, etc.)
- `snapToGrid(point, gridSize)` - Grid snapping (if implemented)
- `getCropPercentages(selection, imageSize)` - Convert pixels to percentages

### Step 3: Create `PhotoEditor/styleUtils.js`
Extract style application utilities (~150 lines):
- `applyRotation(degrees)` - Rotation logic
- `applyBrightness(value)` - Brightness adjustment
- `applyContrast(value)` - Contrast adjustment
- `applySaturation(value)` - Saturation adjustment
- `applyHue(value)` - Hue shift
- `applyScale(value)` - Zoom/scale
- `resetStyles()` - Reset to defaults
- Value range validation

### Step 4: Create `PhotoEditor/ToolBar.jsx`
Extract toolbar UI component (~250 lines):
- Rotation controls (+90°, -90°)
- Brightness slider
- Contrast slider
- Saturation slider
- Hue slider
- Scale/zoom slider
- Reset button
- Save button
- Cancel button
- Undo/redo buttons (if implemented)

Props:
```javascript
{
    editorStyles,
    onStyleChange,
    onSave,
    onCancel,
    onReset,
    cropMode,
    onToggleCropMode,
    disabled
}
```

### Step 5: Create `PhotoEditor/CropOverlay.jsx`
Extract crop overlay component (~200 lines):
- Crop selection rectangle
- Resize handles (corners and edges)
- Drag-to-move functionality
- Crop preview overlay (darkened outside)
- Grid lines (rule of thirds)
- Crop dimensions display

Props:
```javascript
{
    cropSelection,
    cropBounds,
    onCropChange,
    aspectRatio,
    imageRect,
    containerRect
}
```

### Step 6: Create `PhotoEditor/CropPresets.jsx`
Extract crop preset selector (~100 lines):
- Preset buttons (Original, Square, 4:3, 16:9, etc.)
- Visual preset icons/thumbnails
- Active preset indicator
- Custom ratio input (optional)

Props:
```javascript
{
    presets,
    activePreset,
    onPresetSelect,
    disabled
}
```

### Step 7: Update PhotoEditor.jsx (main component)
Keep only (~300-400 lines):
- Main component structure
- State management (useState hooks)
- Event handlers (calls to utility functions)
- Component composition
- Photo image rendering
- Integration with PhotosList

Use extracted modules:
```javascript
import { parseCssStyle, generateCssStyle } from './PhotoEditor/cssUtils.js';
import { calculateCropBounds, applyCropPreset } from './PhotoEditor/cropUtils.js';
import { applyRotation, applyBrightness } from './PhotoEditor/styleUtils.js';
import ToolBar from './PhotoEditor/ToolBar.jsx';
import CropOverlay from './PhotoEditor/CropOverlay.jsx';
import CropPresets from './PhotoEditor/CropPresets.jsx';
```

### Step 8: Add tests
Create test files for utilities:
- `cssUtils.test.js` - Test CSS parsing and generation
- `cropUtils.test.js` - Test crop calculations
- `styleUtils.test.js` - Test style transformations

## Expected Results
- PhotoEditor.jsx reduced from 1,292 lines to ~300-400 lines
- Reusable utility functions
- Better separation of concerns
- Easier to test individual features
- More maintainable code
- Potential to reuse utilities in other editors

## File Structure
```
src/App/PhotosList/PhotoOption/
  PhotoEditor.jsx              # Main component (300-400 lines)
  PhotoEditor.css              # Existing styles
  PhotoEditor/
    cssUtils.js                # CSS utilities (200 lines)
    cssUtils.test.js           # Tests
    cropUtils.js               # Crop utilities (200 lines)
    cropUtils.test.js          # Tests
    styleUtils.js              # Style utilities (150 lines)
    styleUtils.test.js         # Tests
    ToolBar.jsx                # Toolbar component (250 lines)
    CropOverlay.jsx            # Crop overlay (200 lines)
    CropPresets.jsx            # Preset selector (100 lines)
```

## Testing
- Test all editing operations:
  - Rotation (90°, -90°, custom)
  - Brightness adjustment
  - Contrast adjustment
  - Saturation adjustment
  - Hue shift
  - Crop with different presets
  - Crop with custom selection
  - Save and load styles
  - Reset functionality
- Test edge cases:
  - Very small/large images
  - Extreme style values
  - Invalid crop selections
  - Rapid style changes
- Unit tests for utilities
- Integration tests for component

## Related Files
- `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` (will be refactored)
- `src/App/PhotosList/PhotoOption/PhotoEditor.css` (may need updates)
- `src/App/PhotosList/PhotoOption.jsx` (parent component)

## Notes
- Keep backward compatibility with saved CSS styles
- Ensure undo/redo works if implemented
- Consider adding keyboard shortcuts
- May want to add more crop presets (golden ratio, etc.)
- Consider adding filter presets (vintage, B&W, etc.)
