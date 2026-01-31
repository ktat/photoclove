# Improvement #89: Refactor PhotosListMini.jsx - Extract Photo Display Logic

## Current Status
- File: `src/App/PhotosList/PhotosListMini.jsx`
- Lines: **833 lines**
- Complexity: Medium-High - photo display modal with multiple features

## Problem
PhotosListMini.jsx is approaching the 1000 line limit and handles:
- Full-screen photo display modal
- Photo navigation (next/previous, keyboard)
- Photo metadata display (EXIF, date, path)
- Photo actions (star, comment, delete, edit)
- Keyboard shortcuts
- Touch/swipe gestures
- Zoom and pan
- Side panel (metadata, tags, albums)
- Animation/transitions

## Goal
Extract display components and logic to improve modularity and reduce file size.

## Implementation Plan

### Step 1: Create `PhotosListMini/PhotoNavigation.jsx`
Extract navigation controls (~150 lines):
- Previous/next buttons
- Thumbnail strip (optional)
- Keyboard navigation (arrows, Esc)
- Photo counter (1/100)
- Jump to photo (input)

Props:
```javascript
{
    currentIndex,
    totalPhotos,
    onPrevious,
    onNext,
    onJumpTo,
    onClose,
    photos // for thumbnail strip
}
```

### Step 2: Create `PhotosListMini/PhotoMetadata.jsx`
Extract metadata display panel (~200 lines):
- EXIF data display
  - Camera (make, model)
  - Lens
  - Settings (ISO, aperture, shutter speed)
  - Date/time
  - Location (GPS if available)
- File information
  - Path
  - Size
  - Dimensions
  - Format
- Metadata formatting utilities

Props:
```javascript
{
    photo,
    exifData,
    fileInfo,
    collapsed,
    onToggleCollapse
}
```

### Step 3: Create `PhotosListMini/PhotoActions.jsx`
Extract action buttons panel (~150 lines):
- Star rating control
- Comment input
- Edit button
- Delete button
- Share button (if implemented)
- Download button
- Add to album
- Add tags
- Action confirmation dialogs

Props:
```javascript
{
    photo,
    onStarChange,
    onCommentChange,
    onEdit,
    onDelete,
    onAddToAlbum,
    onAddTags,
    disabled
}
```

### Step 4: Create `PhotosListMini/usePhotoNavigation.js`
Extract navigation logic hook (~100 lines):
- Navigation state
- Keyboard event handlers
- Swipe gesture handlers
- Preloading next/previous
- Navigation history

Return:
```javascript
{
    currentIndex,
    canGoPrevious,
    canGoNext,
    goToPrevious,
    goToNext,
    goToIndex,
    handleKeyPress,
    handleSwipe
}
```

### Step 5: Create `PhotosListMini/usePhotoZoom.js`
Extract zoom and pan logic (~100 lines):
- Zoom level state
- Pan position
- Zoom in/out
- Reset zoom
- Fit to screen
- Mouse wheel handler
- Pinch gesture handler
- Pan drag handler

Return:
```javascript
{
    zoomLevel,
    panPosition,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    handleWheel,
    handlePinch,
    handlePan
}
```

### Step 6: Update PhotosListMini.jsx (main component)
Keep only (~200-300 lines):
- Main modal structure
- Photo image rendering
- Component composition
- Integration with PhotosList
- Animation/transition logic
- Modal open/close

Use extracted components and hooks:
```javascript
import PhotoNavigation from './PhotosListMini/PhotoNavigation.jsx';
import PhotoMetadata from './PhotosListMini/PhotoMetadata.jsx';
import PhotoActions from './PhotosListMini/PhotoActions.jsx';
import { usePhotoNavigation } from './PhotosListMini/usePhotoNavigation.js';
import { usePhotoZoom } from './PhotosListMini/usePhotoZoom.js';
```

## Expected Results
- PhotosListMini.jsx reduced from 833 lines to ~200-300 lines
- Reusable navigation component
- Better separation of concerns
- Easier to test individual features
- Improved performance (component memoization)

## File Structure
```
src/App/PhotosList/
  PhotosListMini.jsx                     # Main modal (200-300 lines)
  PhotosListMini/
    PhotoNavigation.jsx                  # Navigation controls (150 lines)
    PhotoMetadata.jsx                    # Metadata panel (200 lines)
    PhotoActions.jsx                     # Action buttons (150 lines)
    usePhotoNavigation.js                # Navigation hook (100 lines)
    usePhotoZoom.js                      # Zoom/pan hook (100 lines)
    PhotoDisplay.jsx                     # Already exists (415 lines)
```

## Testing
- Test photo display:
  - Large images
  - Small images
  - Various formats (JPEG, PNG, etc.)
  - Videos (if supported)
- Test navigation:
  - Previous/next buttons
  - Keyboard arrows
  - Swipe gestures
  - Jump to index
  - First/last photo edge cases
- Test zoom and pan:
  - Zoom in/out
  - Mouse wheel
  - Pinch gestures
  - Pan drag
  - Reset zoom
  - Fit to screen
- Test metadata display:
  - Photos with EXIF
  - Photos without EXIF
  - Various camera models
  - GPS data (if available)
- Test actions:
  - Star rating
  - Comment
  - Edit
  - Delete
  - Add to album
  - Add tags
- Test keyboard shortcuts:
  - Left/right arrows
  - Escape
  - Space (play/pause)
  - +/- (zoom)

## Related Files
- `src/App/PhotosList/PhotosListMini.jsx` (will be refactored)
- `src/App/PhotosList/PhotosListMini/PhotoDisplay.jsx` (already exists)
- `src/App/PhotosList.jsx` (parent component)

## Notes
- Already has PhotoDisplay.jsx (415 lines) - may need further refactoring
- Consider adding slideshow mode
- May want to add image comparison (side-by-side)
- Consider adding histogram display
- May want to add color picker/eyedropper
- Consider adding print preview
