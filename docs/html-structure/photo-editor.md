# PhotoClove Photo Editor & Info Panels HTML Structure

This document describes the HTML structure for PhotoClove's Photo Editor panel and Photo Info panel (metadata display).

See also:
- [Component Hierarchy](../component-structure.md#component-hierarchy)
- [Main Screens](main-screens.md)
- [Sidebar Panels](sidebar-panels.md)
- [CSS Reference](../css-reference.md)

## Photo Editor Panel

**Component**: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` (980 lines, refactored from 1,292 lines)

**Utility Modules** (extracted for better organization):
- **`cssUtils.js`** (218 lines): CSS parsing and generation
  - `parseCssToEditorValues()`: Parse CSS string to editor state
  - `generateCSSFromValues()`: Generate CSS from editor values
  - `DEFAULT_EDITOR_VALUES`: Default transformation values
- **`cropUtils.js`** (144 lines): Crop calculations and presets
  - `calculateCropFromPreset()`: Apply aspect ratio presets
  - `CROP_PRESETS`: 8 predefined aspect ratios (Square, 16:9, 4:3, etc.)
- **`styleUtils.js`** (199 lines): Style application utilities
  - `applyTempStyles()`: Apply temporary styles to DOM elements
  - `rotateValue()`: Calculate rotated transformation values

```html
<div class="photo-editor-panel">
  <!-- Transform controls -->
  <div class="editor-section">
    <h3>Transform</h3>
    <div class="control-group">
      <label>Brightness: <input type="range" min="-100" max="100" /></label>
      <label>Contrast: <input type="range" min="-100" max="100" /></label>
      <label>Saturation: <input type="range" min="-100" max="100" /></label>
      <label>Hue: <input type="range" min="-180" max="180" /></label>
      <label>Blur: <input type="range" min="0" max="10" /></label>
      <label>Rotation: <input type="range" min="-180" max="180" /></label>
    </div>
  </div>

  <!-- Crop controls -->
  <div class="editor-section">
    <h3>Crop</h3>
    <button onClick="toggleCropMode">Toggle Crop Mode</button>
    <button onClick="applyCrop">Apply Crop</button>
    <button onClick="resetCrop">Reset Crop</button>
  </div>

  <!-- Action buttons -->
  <div class="editor-actions">
    <button onClick="saveStyle">Save Style</button>
    <button onClick="saveAsCopy">Save As Copy</button>
    <button onClick="resetAll">Reset All</button>
  </div>
</div>
```

## Photo Info Panel

**Component**: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`

**Features**:
- EXIF metadata display (ISO, F-Number, Shutter Speed, Lens, Camera, etc.)
- Star rating (1-5 stars)
- Comment field with save functionality
- File operations:
  - 📋 Copy file path to clipboard
  - 🚀 Open in external application (uses `openUrl` from @tauri-apps/plugin-opener)
  - Hover to show full file path in footer

```html
<div class="rightMenu">
  <!-- Photo metadata display -->
  <div class="photo-info-section">
    <h3>Photo Information</h3>
    <div class="info-item">
      <label>File:</label>
      <a href="#" onClick="copyToClipboard">📋</a>
      <span class="file-path">{filename}</span>
      <a href="#" onClick="openInExternalApp">🚀</a>
    </div>
    <div class="info-item">
      <label>Size:</label>
      <span>{width} x {height}</span>
    </div>
    <div class="info-item">
      <label>Date:</label>
      <span>{date_taken}</span>
    </div>
    <!-- Additional EXIF metadata rows -->
    <div class="info-item">
      <label>ISO:</label>
      <span>{iso}</span>
    </div>
    <div class="info-item">
      <label>F-Number:</label>
      <span>{fnumber}</span>
    </div>
    <div class="info-item">
      <label>Shutter Speed:</label>
      <span>{exposure_time}</span>
    </div>
    <div class="info-item">
      <label>Lens Model:</label>
      <span>{lens_model}</span>
    </div>
    <div class="info-item">
      <label>Camera:</label>
      <span>{make} {model}</span>
    </div>
    <div class="info-item">
      <label>Date & Time:</label>
      <span>{date_time}</span>
    </div>
    <div class="info-item">
      <label>Focal Length:</label>
      <span>{focal_length} ({focal_length_in_35mm}mm)</span>
    </div>
  </div>

  <!-- Star rating -->
  <div class="rating-section">
    <h4>Rating</h4>
    <div class="star-rating">
      <span class="star" data-rating="1">⭐</span>
      <span class="star" data-rating="2">⭐</span>
      <span class="star" data-rating="3">⭐</span>
      <span class="star" data-rating="4">⭐</span>
      <span class="star" data-rating="5">⭐</span>
    </div>
  </div>

  <!-- Comments -->
  <div class="comment-section">
    <h4>Comment</h4>
    <textarea placeholder="Add a comment..."></textarea>
    <button onClick="saveComment">Save Comment</button>
  </div>

  <!-- Actions -->
  <div class="actions-section">
    <button onClick="openInEditor">Edit Photo</button>
    <button onClick="openInExternal">Open in External App</button>
    <button onClick="moveToTrash">Delete</button>
  </div>
</div>
```
