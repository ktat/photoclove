# Improvement #84-04: Refactor usePhotoOperations Hook Parameters

## Goal
Organize usePhotoOperations parameters into logical groups to improve maintainability

## Current Status
After implementing 84-01, 84-02, and 84-03, usePhotoOperations will have 30+ parameters, making it hard to maintain and use.

## Problem
**Current parameter pattern:**
```javascript
usePhotoOperations({
    selectedAlbums,
    setSelectedAlbums,
    selectedTags,
    setSelectedTags,
    tagsList,
    albumsList,
    appConfig,
    currentViewMode,
    currentDate,
    currentAlbumName,
    currentTagName,
    searchQuery,
    handleError,
    addFooterMessage,
    loadAlbums,
    loadTags,
    currentAlbumId,
    toggleAlbumListMode,
    isTrashMode,
    // After 84-02:
    setTrashPhotos,
    setPhotosListMiniAllPhotos,
    photosListMiniAllPhotos,
    currentPhotoIndex,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    setPhotosListMiniReread,
    photosListMiniReread,
    closePhotoDisplay,
    dateNum,
    setDateNum,
    dateList,
    setDateList,
    sortOfPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    // ...too many parameters!
})
```

## Implementation Plan

### Step 1: Group parameters into logical objects

**Proposed structure:**
```javascript
usePhotoOperations({
    // Selection state
    selectionState: {
        selectedAlbums,
        setSelectedAlbums,
        selectedTags,
        setSelectedTags,
    },

    // Photo list state
    photoListState: {
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        setTrashPhotos,
    },

    // Navigation state
    navigationState: {
        currentPhotoIndex,
        setCurrentPhotoIndex,
        currentPhotoPath,
        setCurrentPhotoPath,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        photosListMiniReread,
        setPhotosListMiniReread,
        closePhotoDisplay,
    },

    // Date state
    dateState: {
        currentDate,
        dateNum,
        setDateNum,
        dateList,
        setDateList,
    },

    // View mode context
    viewModeContext: {
        currentViewMode,
        isTrashMode,
        currentAlbumId,
        currentAlbumName,
        currentTagId,
        currentTagName,
        searchQuery,
        sortOfPhotos,
    },

    // Data lists
    dataLists: {
        tagsList,
        albumsList,
    },

    // Callbacks
    callbacks: {
        handleError,
        addFooterMessage,
        loadAlbums,
        loadTags,
        toggleAlbumListMode,
    },

    // App config
    appConfig,
})
```

### Step 2: Update usePhotoOperations.js

1. Destructure grouped parameters at the start:
```javascript
export function usePhotoOperations({
    selectionState,
    photoListState,
    navigationState,
    dateState,
    viewModeContext,
    dataLists,
    callbacks,
    appConfig
}) {
    // Destructure nested objects for easier use
    const { selectedAlbums, setSelectedAlbums, selectedTags, setSelectedTags } = selectionState;
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos, /* ... */ } = photoListState;
    // ... etc

    // Rest of implementation unchanged
}
```

### Step 3: Update PhotosList.jsx

1. Prepare grouped parameter objects:
```javascript
const selectionState = {
    selectedAlbums,
    setSelectedAlbums,
    selectedTags,
    setSelectedTags,
};

const photoListState = {
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    setTrashPhotos,
};

// ... prepare other groups

const photoOps = usePhotoOperations({
    selectionState,
    photoListState,
    navigationState,
    dateState,
    viewModeContext,
    dataLists,
    callbacks,
    appConfig
});
```

2. Alternative: Use useMemo to create groups once:
```javascript
const photoOpsParams = useMemo(() => ({
    selectionState: {
        selectedAlbums,
        setSelectedAlbums,
        selectedTags,
        setSelectedTags,
    },
    // ... other groups
}), [/* dependencies */]);

const photoOps = usePhotoOperations(photoOpsParams);
```

## Benefits
- ✅ Easier to understand parameter purpose
- ✅ Easier to add new parameters (just add to appropriate group)
- ✅ Better IDE autocomplete (grouped by category)
- ✅ Easier to test (mock entire groups)
- ✅ Self-documenting code structure
- ✅ Easier to spot missing dependencies

## Testing
- Verify all existing functionality still works
- Test album operations
- Test tag operations
- Test photo deletion/trash operations
- Test navigation after photo removal
- No behavioral changes, only parameter organization

## Expected Results
- usePhotoOperations.js: Parameter handling improved
- PhotosList.jsx: More organized hook call
- No functional changes
- Better maintainability for future enhancements

## Related Files
- `src/hooks/usePhotoOperations.js` (modify - restructure parameters)
- `src/App/PhotosList.jsx` (modify - update hook call)

## Notes
- This is a pure refactoring task
- Should be done AFTER implementing 84-01, 84-02, and 84-03
- No functional changes, only organizational improvements
- Can be skipped if the flat parameter list is acceptable
- Consider this especially if the parameter count exceeds 25-30
