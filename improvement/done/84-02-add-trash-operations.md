# Improvement #84-02: Add Trash Operations to usePhotoOperations

## Goal
Implement trash-related photo operations and consolidate duplicate implementations

## Current Status
- PhotosList.jsx has inline `moveToTrashCan` function (lines 1071-1117)
- PhotosList.jsx has duplicate `permanentlyDeletePhoto` (lines 1119-1156)
- usePhotoOperations.js has incomplete `permanentlyDeletePhoto` (lacks UI updates)
- PhotosList.jsx references `restorePhoto` but it doesn't exist yet (line 333)

## Implementation Plan

### Step 1: Enhance `permanentlyDeletePhoto` in usePhotoOperations.js

**Current implementation:**
- Only invokes backend command
- Doesn't update UI state

**Required enhancements:**
1. Accept additional parameters for UI state updates:
   - `photoListState` - Object with photo list setters
   - `currentPhotoIndex` - Current photo index
   - `photosListMiniCurrentIndex` - Mini list index
   - `closePhotoDisplay` - Function to close display when no photos left

2. After deletion:
   - Remove from trash photos list
   - Update thumbnail lists
   - Adjust navigation if needed
   - Close photo display if no photos remain

**Dependencies to add to hook params:**
- `setTrashPhotos`
- `setPhotosListMiniAllPhotos`
- `photosListMiniAllPhotos`
- `currentPhotoIndex`
- `photosListMiniCurrentIndex`
- `setPhotosListMiniCurrentIndex`
- `setCurrentPhotoPath`
- `setCurrentPhotoIndex`
- `setPhotosListMiniReread`
- `photosListMiniReread`
- `closePhotoDisplay`

### Step 2: Implement `moveToTrash` in usePhotoOperations.js

**Function to implement:**
```javascript
const moveToTrash = useCallback(async (photoPath, sortValue) => {
    // If in trash mode, permanently delete instead
    if (isTrashMode) {
        return permanentlyDeletePhoto(photoPath);
    }

    // Otherwise move to trash
    // Implementation based on PhotosList.jsx lines 1079-1116
}, [isTrashMode, permanentlyDeletePhoto, handleError, /* other deps */]);
```

**Implementation:**
1. Use `invoke("move_to_trash", { pathStr: photoPath, sortValue })`
2. Update date counts (dateNum, dateList)
3. Update thumbnail lists
4. Adjust navigation after deletion
5. Close photo display if no photos remain
6. Log operation with structured logging

**Dependencies to add to hook params:**
- `dateNum`
- `setDateNum`
- `dateList`
- `setDateList`
- `sortOfPhotos`

### Step 3: Implement `restorePhoto` in usePhotoOperations.js

**Function signature:**
```javascript
const restorePhoto = useCallback(async (photoPath) => {
    // Implementation
}, [handleError, addFooterMessage]);
```

**Implementation:**
1. Use `invoke("restore_from_trash", { pathStr: photoPath })`
2. Log operation with structured logging
3. Remove from trash photos list
4. Show success message via addFooterMessage
5. Handle errors via handleError callback

### Step 4: Update return object

```javascript
return {
    // Existing exports...

    // Enhanced/new trash operations
    permanentlyDeletePhoto, // Enhanced version
    moveToTrash,            // New
    restorePhoto,           // New
};
```

### Step 5: Update PhotosList.jsx

1. Remove inline `moveToTrashCan` function (lines 1071-1117)
2. Remove duplicate `permanentlyDeletePhoto` function (lines 1119-1156)
3. Update usePhotoOperations call to pass new dependencies
4. Replace `moveToTrashCan(f)` calls with `moveToTrash(f, parseInt(sortOfPhotos))`
5. Update `restorePhoto` usage (currently undefined)

## Testing
- Test moving photo to trash from library view
- Test permanent delete from trash mode
- Test restore from trash
- Verify thumbnail list updates correctly
- Verify navigation works after deletion
- Verify date counts update correctly
- Test edge cases (deleting last photo, deleting while at end of list)

## Expected Results
- PhotosList.jsx: -100 lines (removing moveToTrashCan and duplicate permanentlyDeletePhoto)
- usePhotoOperations.js: +120 lines (enhanced permanentlyDeletePhoto, moveToTrash, restorePhoto)
- All trash operations centralized in hook
- Consistent behavior across all deletion scenarios

## Related Files
- `src/hooks/usePhotoOperations.js` (modify - add functions)
- `src/App/PhotosList.jsx` (modify - remove inline functions, update calls)

## Backend Commands Required
These Tauri commands should already exist:
- `move_to_trash(pathStr, sortValue)`
- `delete_permanently(pathStr)`
- `restore_from_trash(pathStr)`

## Notes
- This is the most complex subtask due to UI state updates
- Requires many dependencies passed to the hook
- Consider splitting hook params into logical groups (photoListState, navigationState, etc.)
- Ensure backward compatibility - existing calls should still work
