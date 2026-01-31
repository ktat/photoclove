# Improvement #84-01: Add Album-Photo Operations to usePhotoOperations

## Goal
Implement missing album-photo relationship operations in usePhotoOperations.js

## Current Status
- PhotosList.jsx references these functions but they don't exist yet (lines 330-331):
  - `handleAddToAlbum` - Not implemented
  - `removePhotoFromAlbum` - Not implemented

## Implementation Plan

### Step 1: Add `handleAddToAlbum` to usePhotoOperations.js

**Function signature:**
```javascript
const handleAddToAlbum = useCallback(async (photoPath, albumId) => {
    // Implementation
}, [handleError, addFooterMessage]);
```

**Implementation:**
1. Use `invoke("add_photo_to_album", { albumId, photoPath })`
2. Log operation with structured logging
3. Show success message via addFooterMessage
4. Handle errors via handleError callback
5. Return success/failure status

### Step 2: Add `removePhotoFromAlbum` to usePhotoOperations.js

**Function signature:**
```javascript
const removePhotoFromAlbum = useCallback(async (photoPath, albumId) => {
    // Implementation
}, [handleError, addFooterMessage]);
```

**Implementation:**
1. Use `invoke("remove_photo_from_album", { albumId, photoPath })`
2. Log operation with structured logging
3. Show success message via addFooterMessage
4. Handle errors via handleError callback
5. Return success/failure status

### Step 3: Export new functions

Update return object in usePhotoOperations.js:
```javascript
return {
    // Existing exports...

    // New album-photo operations
    handleAddToAlbum,
    removePhotoFromAlbum,
};
```

## Testing
- Test adding a photo to an album
- Test removing a photo from an album
- Verify error handling for non-existent albums
- Verify error handling for non-existent photos
- Check that success messages appear correctly
- Verify structured logging captures operation details

## Expected Results
- usePhotoOperations.js: +40-50 lines
- Two new reusable functions for album-photo relationships
- PhotosList.jsx can now use these functions without errors

## Related Files
- `src/hooks/usePhotoOperations.js` (modify)
- `src/App/PhotosList.jsx` (already references these functions)

## Backend Commands Required
These Tauri commands should already exist:
- `add_photo_to_album(albumId, photoPath)`
- `remove_photo_from_album(albumId, photoPath)`

## Notes
- This is a small, focused task that can be completed independently
- No changes to PhotosList.jsx required (already destructures these functions)
- Enables album photo management throughout the application
