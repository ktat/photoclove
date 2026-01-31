# Improvement #89: Refactor DirectoryMenu.jsx (Sidebar Menu) - REVISED

## Actual File Analysis
**Note**: Original plan assumed directory tree browser, but actual file is a sidebar menu component.

## Current Status
- File: `src/App/PhotosList/DirectoryMenu.jsx`
- Lines: **966 lines**
- Actual Purpose: Multi-tab sidebar menu for filters, operations, and selections
- Complexity: High - managing 5 different tabs with various operations

## Actual File Structure

### Main Components (5 Tabs)
1. **Search Tab** (~10 lines) - Search tools container
2. **Maintenance Tab** (~10 lines) - Database operations
3. **Directory Tab** (~100 lines) - Import mode directory navigation
4. **Filter Tab** (~400 lines) - Star filter, comment filter, extension filters
5. **Selection Tab** (~400 lines) - Operations on selected photos

### Key Functions (15 functions, ~350 lines total)
- **Tutorial functions** (3): getTutorialContent, handleTutorialDismiss, handleTutorialDisable
- **Photo operations** (5): importSelectedPhotos, deleteFiles, removeFromCurrentAlbum
- **Maintenance operations** (3): createDbInDate, movePhotosToExifDate, createThumbnails
- **Google Photos** (1): uploadToGooglePhotos
- **Album operations** (3): showCreateAlbumModal, createAlbumFromSelection, addPhotosToAlbum
- **Main handler** (1): doOperation

### Inline JSX Logic (~200 lines)
- Extension filter checkboxes with complex state logic
- Album list rendering
- Tag list rendering
- Tutorial tooltip

## Problem
DirectoryMenu.jsx handles too many responsibilities:
- Tutorial state and content generation
- Photo bulk operations (import, delete, upload)
- Album operations (create, add to)
- Extension filters with complex checkbox logic
- Multiple tab rendering
- Maintenance operations
- Directory navigation (import mode)

## Goal
Extract focused components and hooks to reduce from 966 to ~300 lines.

## Implementation Plan

### Step 1: Extract Tutorial Logic
Create `DirectoryMenu/useTutorialLogic.js` (~100 lines):
```javascript
export function useTutorialLogic(photoSelection, viewModeObj) {
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialContent, setTutorialContent] = useState('');

    // Tutorial content generation
    const getTutorialContent = (context, photoCount) => { /* ... */ };

    // Event handlers
    const handleTutorialDismiss = () => { /* ... */ };
    const handleTutorialDisable = () => { /* ... */ };

    return {
        showTutorial,
        tutorialContent,
        handleTutorialDismiss,
        handleTutorialDisable
    };
}
```

### Step 2: Extract Photo Operations
Create `DirectoryMenu/usePhotoOperations.js` (~150 lines):
```javascript
export function usePhotoOperations({ photoSelection, importState, onRefresh }) {
    // Photo operations
    const importSelectedPhotos = async () => { /* ... */ };
    const deleteFiles = async () => { /* ... */ };
    const removeFromCurrentAlbum = async () => { /* ... */ };
    const uploadToGooglePhotos = async () => { /* ... */ };

    // Maintenance operations
    const createDbInDate = async () => { /* ... */ };
    const movePhotosToExifDate = async () => { /* ... */ };
    const createThumbnails = async () => { /* ... */ };

    return {
        importSelectedPhotos,
        deleteFiles,
        removeFromCurrentAlbum,
        uploadToGooglePhotos,
        createDbInDate,
        movePhotosToExifDate,
        createThumbnails
    };
}
```

### Step 3: Extract Album Operations
Create `DirectoryMenu/useAlbumOperations.js` (~100 lines):
```javascript
export function useAlbumOperations({ photoSelection, onRefresh }) {
    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);

    const showCreateAlbumModal = () => { /* ... */ };
    const createAlbumFromSelection = async (albumData) => { /* ... */ };
    const showAddToAlbumModal = () => { /* ... */ };
    const addPhotosToAlbum = async (albumId) => { /* ... */ };

    return {
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        showAlbumSelectorModal,
        setShowAlbumSelectorModal,
        showCreateAlbumModal,
        createAlbumFromSelection,
        showAddToAlbumModal,
        addPhotosToAlbum
    };
}
```

### Step 4: Extract Filter Tab Component
Create `DirectoryMenu/FilterTab.jsx` (~200 lines):
- Star filter UI
- Comment filter checkbox
- Extension filters (grouped: image, movie, with complex logic)
- Tag filter checkbox

```javascript
export default function FilterTab({
    starFilter, setStarFilter,
    hasCommentFilter, setHasCommentFilter,
    hasTagFilter, setHasTagFilter,
    extensionFilter, setExtensionFilter
}) {
    // Extension filter logic
    // Rendering
}
```

### Step 5: Extract Selection Tab Component
Create `DirectoryMenu/SelectionTab.jsx` (~250 lines):
- Photo selection dropdown
- Album list with checkboxes
- Tag list with checkboxes
- Operation buttons (create album, add to album, delete, etc.)

```javascript
export default function SelectionTab({
    photoSelection,
    albumsList,
    tagsList,
    viewModeObj,
    operations,
    albumOperations
}) {
    // Rendering
}
```

### Step 6: Extract Directory Tab Component
Create `DirectoryMenu/DirectoryTab.jsx` (~100 lines):
- Import path selector
- Current directory display
- Date filter
- Directory navigation

```javascript
export default function DirectoryTab({ importState }) {
    // Directory navigation rendering
}
```

### Step 7: Update DirectoryMenu.jsx (main component)
Reduce to ~300 lines:
- Import extracted hooks and components
- Main state management
- Tab switching logic
- Component composition

```javascript
import { useTutorialLogic } from './DirectoryMenu/useTutorialLogic.js';
import { usePhotoOperations } from './DirectoryMenu/usePhotoOperations.js';
import { useAlbumOperations } from './DirectoryMenu/useAlbumOperations.js';
import FilterTab from './DirectoryMenu/FilterTab.jsx';
import SelectionTab from './DirectoryMenu/SelectionTab.jsx';
import DirectoryTab from './DirectoryMenu/DirectoryTab.jsx';

function DirectoryMenu(props) {
    // Use extracted hooks
    const tutorial = useTutorialLogic(props.photoSelection, props.viewModeObj);
    const photoOps = usePhotoOperations({ /* ... */ });
    const albumOps = useAlbumOperations({ /* ... */ });

    // Main render with extracted components
    return (
        <div id="directory-maintenance">
            {/* Search Tab */}
            {/* Maintenance Tab */}
            {props.viewModeObj?.shouldShowDirectoryTab() && (
                <DirectoryTab importState={props.importState} />
            )}
            <FilterTab {...filterProps} />
            <SelectionTab {...selectionProps} />
        </div>
    );
}
```

## Expected Results
- DirectoryMenu.jsx: 966 → ~300 lines (~66% reduction)
- useTutorialLogic.js: ~100 lines (new)
- usePhotoOperations.js: ~150 lines (new)
- useAlbumOperations.js: ~100 lines (new)
- FilterTab.jsx: ~200 lines (new)
- SelectionTab.jsx: ~250 lines (new)
- DirectoryTab.jsx: ~100 lines (new)
- **Total**: ~1,200 lines across 7 files (better organized)

## File Structure
```
src/App/PhotosList/
  DirectoryMenu.jsx                      # Main component (300 lines)
  DirectoryMenu/
    useTutorialLogic.js                  # Tutorial hook (100 lines)
    usePhotoOperations.js                # Photo ops hook (150 lines)
    useAlbumOperations.js                # Album ops hook (100 lines)
    FilterTab.jsx                        # Filter tab component (200 lines)
    SelectionTab.jsx                     # Selection tab component (250 lines)
    DirectoryTab.jsx                     # Directory tab component (100 lines)
```

## Benefits
- ✅ Much better separation of concerns
- ✅ Reusable hooks for photo/album operations
- ✅ Easier to test individual tabs
- ✅ Clearer component hierarchy
- ✅ Reduced cognitive load per file
- ✅ Easier to add new features to specific tabs

## Implementation Order
1. Extract FilterTab (simplest, pure UI)
2. Extract DirectoryTab (import mode specific)
3. Extract useAlbumOperations (moderate complexity)
4. Extract usePhotoOperations (complex, many operations)
5. Extract SelectionTab (uses album operations)
6. Extract useTutorialLogic (simple)
7. Update DirectoryMenu.jsx to use all extracted pieces

## Testing
- Test each tab independently
- Test photo operations (import, delete, remove from album)
- Test album operations (create, add to)
- Test filter changes
- Test tutorial display and dismissal
- Test maintenance operations
- Verify all operations still work end-to-end

## Notes
- This is actually a sidebar menu, not a directory tree browser
- Original plan (#88 in file name) was based on wrong assumptions
- Revised plan based on actual file analysis
- Can be done incrementally (one extraction at a time)
