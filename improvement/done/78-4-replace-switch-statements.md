# Replace switch statements in PhotosList.jsx with ViewMode method calls

## Task Description
Replace the existing fetchConfig switch statements in PhotosList.jsx with ViewMode method calls to eliminate code duplication and centralize logic.

## Implementation Details

### Current Code Pattern
```javascript
switch (fetchConfig.fetch_method) {
    case "date":
        result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "date",
                query: fetchConfig.value,
                sort_value: parseInt(sortOfPhotos),
                limit: Math.min(9999, appConfig?.max_photos_per_fetch || 1000),
                // ...many duplicate parameters
            }
        });
        break;
    // other cases...
}
```

### New Code Pattern
```javascript
try {
    const photoParams = viewModeObj.getUnifiedPhotoParams(appConfig, {
        sort_value: parseInt(sortOfPhotos),
        star: starFilter,
        has_comment: commentFilter,
        extension: extensionFilter
    });
    
    result = await invoke("get_photos_unified", {
        request: photoParams
    });
} catch (error) {
    logger.error('PhotosList', 'unsupported_mode', `Mode ${viewModeObj.mode} not supported`);
    return;
}
```

## Files to Modify
- `src/App/PhotosList.jsx` - Replace switch statements with ViewMode method calls

## Locations to Change
1. **Main photo fetching logic** - Replace fetchConfig switch statement
2. **Secondary fetch operations** - Any other switch statements based on fetch_method
3. **Error handling** - Add proper error handling for unsupported modes

## Success Criteria
- [ ] All fetchConfig.fetch_method switch statements removed
- [ ] ViewMode.getUnifiedPhotoParams() used for parameter generation
- [ ] Proper error handling for unsupported modes
- [ ] All existing functionality preserved
- [ ] Code is cleaner and more maintainable

## Dependencies
- 78-1: getUnifiedPhotoParams() method must be implemented first
- Requires ViewMode object available as `viewModeObj` in PhotosList.jsx

## Related Tasks
- 78-5: Remove fetchConfig dependency from PhotosList.jsx
- 78-10: Update UI title display to use viewModeObj.getModeTitle()

## Testing Considerations
- Test all view modes work correctly after changes
- Verify parameter passing works for sorting, filtering, pagination
- Ensure error handling works for edge cases

## Benefits
- Eliminates 50+ lines of duplicate parameter generation code
- Centralizes logic in ViewMode class
- Reduces maintenance burden
- Improves type safety through ViewMode constraints