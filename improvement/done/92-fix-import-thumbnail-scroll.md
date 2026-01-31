# Improvement #92: Fix Import Mode Thumbnail Scrolling Issue (Continuation)

## Current Status
- **WIP**: Import mode photos disappearing on scroll
- Commit: `a8d1421` - Implemented on-demand EXIF thumbnail loading
- Rust-side disk caching working (LRU eviction, 200 file limit)
- JavaScript-side on-demand loading implemented with `forceUpdate`

## Problem
Images still disappear when scrolling in import mode:
- Initial images display correctly
- After scrolling, previously displayed images disappear
- Likely caused by React component re-rendering issues
- `forceUpdate({})` may be causing full component re-render and losing cached state

## Root Cause Analysis

**Confirmed Issues in PhotoGrid.jsx:**

1. **React key instability** (Line 155): ✅ CONFIRMED
   ```javascript
   const uniqueKey = `${photo.originalPath}-${index}`;
   ```
   - Index changes on scroll, causing React to unmount/remount components
   - This destroys component state and cached images

2. **forceUpdate abuse** (Line 138): ✅ CONFIRMED
   ```javascript
   convertThumbnailDataSrc(photo.originalPath).then(() => {
       forceUpdate({});  // Forces full component re-render
   });
   ```
   - Causes complete re-render of all photos, not just the loaded one
   - May trigger cascade of re-renders during scroll

3. **Module-level cache exists** (Line 9-10): ✅ WORKING
   ```javascript
   const thumbnailCache = {};
   ```
   - Cache persists across renders (correct)
   - But unstable keys prevent effective reuse

4. **Import mode detection** (Line 130): ✅ CONFIRMED
   ```javascript
   if (photo.import_source === true) {
       // On-demand loading logic
   }
   ```

5. **Async timing issue**: Likely related to key instability + forceUpdate

## Debugging Steps

### Step 1: Add Comprehensive Logging
Add logs to track:
```javascript
// In PhotoGrid.jsx renderPhotoTile
console.log('[PhotoGrid] Rendering photo', {
    index,
    photoPath: photo.originalPath,
    hasCachedThumbnail: !!thumbnailCache[photo.originalPath],
    cacheSize: Object.keys(thumbnailCache).length,
    imgSrc: imgSrc ? imgSrc.substring(0, 50) : 'none'
});

// In convertThumbnailDataSrc
console.log('[convertThumbnailDataSrc] Before invoke', {
    photoPath,
    cacheSize: Object.keys(thumbnailCache).length
});

console.log('[convertThumbnailDataSrc] After invoke', {
    photoPath,
    result: result.substring(0, 50),
    cached: !!thumbnailCache[photoPath]
});
```

### Step 2: Verify Key Stability
Check if React keys are stable:
```javascript
// Current: const uniqueKey = `${photo.originalPath}-${index}`;
// Problem: index changes on scroll!

// Solution: Use stable key
const uniqueKey = photo.originalPath;
```

### Step 3: Prevent Unnecessary Re-renders
Instead of `forceUpdate({})`, try:
```javascript
// Option 1: Use a counter
const [refreshCounter, setRefreshCounter] = useState(0);

// In convertThumbnailDataSrc callback
.then(() => {
    setRefreshCounter(c => c + 1);
});

// Option 2: Use a Set of loaded paths
const [loadedPaths, setLoadedPaths] = useState(new Set());

// In convertThumbnailDataSrc callback
.then(() => {
    setLoadedPaths(prev => new Set([...prev, photoPath]));
});

// Then check in render:
const isLoaded = loadedPaths.has(photo.originalPath);
```

### Step 4: Investigate Image Element Lifecycle
Add logging to img element:
```javascript
<img
    ref={(el) => {
        if (el) {
            console.log('[img ref]', {
                photoPath: photo.originalPath,
                src: el.src,
                complete: el.complete,
                naturalWidth: el.naturalWidth
            });
        }
    }}
    src={imgSrc}
    onLoad={(e) => {
        console.log('[img onLoad]', {
            photoPath: photo.originalPath,
            src: e.currentTarget.src
        });
    }}
/>
```

## Potential Solutions (Priority Order)

### Solution 1: Stable Keys ⭐ HIGHEST PRIORITY
**Current code (Line 155):**
```javascript
const uniqueKey = `${photo.originalPath}-${index}`;  // ❌ WRONG
```

**Fix:**
```javascript
const uniqueKey = photo.originalPath;  // ✅ STABLE
```

**Why this is critical:**
- Index changes on scroll, React thinks it's a different component
- Causes unmount/remount cycle, destroying image src
- Must be fixed FIRST before other solutions will work

### Solution 2: Separate Render Trigger
```javascript
// Use a Map instead of forcing full re-render
const [thumbnailsReady, setThumbnailsReady] = useState(new Map());

// In convertThumbnailDataSrc callback
.then(() => {
    setThumbnailsReady(prev => new Map(prev).set(photoPath, true));
});

// In render
const isThumbnailReady = thumbnailsReady.get(photo.originalPath);
```

### Solution 3: Use useReducer Instead
```javascript
const [thumbnailState, dispatch] = useReducer(
    (state, action) => {
        switch (action.type) {
            case 'THUMBNAIL_LOADED':
                return { ...state, [action.path]: true };
            default:
                return state;
        }
    },
    {}
);

// In convertThumbnailDataSrc callback
.then(() => {
    dispatch({ type: 'THUMBNAIL_LOADED', path: photoPath });
});
```

### Solution 4: Conditional Rendering
Only trigger update for specific photo:
```javascript
// Store loading state per photo
const [loadingPhotos, setLoadingPhotos] = useState(new Set());

// Mark as loading
if (!thumbnailCache[photo.originalPath] && !loadingPhotos.has(photo.originalPath)) {
    setLoadingPhotos(prev => new Set([...prev, photo.originalPath]));
    convertThumbnailDataSrc(photo.originalPath).then(() => {
        setLoadingPhotos(prev => {
            const next = new Set(prev);
            next.delete(photo.originalPath);
            return next;
        });
    });
}
```

### Solution 5: Memoize Render Function
```javascript
const renderPhotoTile = useCallback((photo, index) => {
    // ... rendering logic
}, [thumbnailCache]); // Only re-create when cache changes
```

## Implementation Plan

### Phase 1: Critical Fix (Must Do First)
1. **Fix key stability** (Line 155 in PhotoGrid.jsx)
   ```javascript
   // Change from:
   const uniqueKey = `${photo.originalPath}-${index}`;
   // To:
   const uniqueKey = photo.originalPath;
   ```
   - This alone may fix 80% of the problem
   - Test immediately after this change

### Phase 2: Improve State Management
2. **Replace forceUpdate** (Line 138 in PhotoGrid.jsx)
   - Option A: Use `useState` counter
   - Option B: Use `useState` Set of loaded paths
   - Option C: Use `useReducer` for thumbnail state
   - **Recommendation**: Option B (Set of loaded paths) for cleaner logic

### Phase 3: Add Debug Logging (Optional)
3. **Add logging only if issues persist after Phase 1+2**
   - Don't add logging before fixing obvious bugs
   - Use structured logger from LoggerService.js

### Phase 4: Test & Validate
4. **Test thoroughly**
   - Load 100+ photos in import mode
   - Scroll down/up multiple times
   - Check React DevTools for unnecessary renders
   - Verify cache hit rate in logs

### Phase 5: Cleanup
5. **Remove debug code** (if added)
6. **Add code comments** explaining the fix
7. **Update this improvement doc** with final solution

## Expected Results
- Thumbnails remain visible after scrolling
- No unnecessary re-renders
- Smooth scrolling performance
- Stable component keys
- Cached thumbnails persist across renders

## Testing
- Load import mode with 100+ photos
- Scroll down to load more photos
- Scroll back up to previously displayed photos
- Verify thumbnails are still visible
- Check console for cache hits
- Monitor component re-renders with React DevTools
- Test with different scroll speeds
- Test rapid scrolling up and down

## Related Files
- `src/App/PhotosList/PhotoGrid.jsx` (needs fixes)
- `src-tauri/src/lib.rs` (get_resized_image - working correctly)

## Notes
- This is high priority - blocking import mode functionality
- May need to revisit architecture if on-demand loading proves problematic
- Consider alternative: Pre-load all visible thumbnails in useEffect (like before but fixed)
- Document final solution for future reference

## Next Steps After Fix
1. Add comprehensive comments explaining the solution
2. Create test case for thumbnail caching
3. Update improvement/done/83-file-size-reduction.md with final approach
4. Consider extracting thumbnail logic into separate hook
