# Improvement #84-03: Add Remove From List Operation

## Goal
Extract `removePhotoFromList` function from PhotosList.jsx into usePhotoOperations.js

## Current Status
- PhotosList.jsx has inline `removePhotoFromList` function (lines 1034-1069)
- Used for removing photos from current view (e.g., album removal without deletion)
- Handles thumbnail list updates and navigation adjustment

## Implementation Plan

### Step 1: Add `removePhotoFromList` to usePhotoOperations.js

**Function signature:**
```javascript
const removePhotoFromList = useCallback((indexToRemove) => {
    // Implementation
}, [/* dependencies */]);
```

**Implementation:**
Based on PhotosList.jsx lines 1034-1069:

1. Log operation with structured logging
2. Remove from photosListMiniAllPhotos at indexToRemove
3. Remove from allPhotosForCurrentFetch by matching path
4. Adjust current index if needed:
   - If removed last photo: go to previous photo
   - If photos remain at same index: stay at same index (shows next photo)
   - If no photos left: close photo display
5. Update currentPhotoPath and currentPhotoIndex

**Dependencies to add to hook params:**
- `photosListMiniAllPhotos`
- `setPhotosListMiniAllPhotos`
- `allPhotosForCurrentFetch`
- `setAllPhotosForCurrentFetch`
- `photosListMiniCurrentIndex`
- `setPhotosListMiniCurrentIndex`
- `setCurrentPhotoPath`
- `setCurrentPhotoIndex`
- `closePhotoDisplay`

### Step 2: Export function

Update return object in usePhotoOperations.js:
```javascript
return {
    // Existing exports...

    // Photo list management
    removePhotoFromList,
};
```

### Step 3: Update PhotosList.jsx

1. Remove inline `removePhotoFromList` function (lines 1034-1069)
2. Update usePhotoOperations call to pass new dependencies
3. Use hook version: Already using `removePhotoFromList` from hook

## Testing
- Test removing photo from album view
- Verify thumbnail list updates correctly
- Verify navigation when removing last photo
- Verify navigation when removing photo in middle of list
- Verify navigation when removing only photo (closes display)
- Test edge case: removing photo at various positions

## Expected Results
- PhotosList.jsx: -36 lines (removing removePhotoFromList function)
- usePhotoOperations.js: +40 lines (adding removePhotoFromList)
- Consistent photo removal behavior across the app
- Reusable function for any view mode

## Related Files
- `src/hooks/usePhotoOperations.js` (modify)
- `src/App/PhotosList.jsx` (modify - remove inline function)

## Notes
- This function is pure UI state management (no backend calls)
- Used when removing from album without deleting the file
- Different from moveToTrash (which calls backend)
- Must handle navigation edge cases carefully
