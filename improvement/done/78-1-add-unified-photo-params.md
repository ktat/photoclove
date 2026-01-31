# Add getUnifiedPhotoParams() method to ViewMode class

## Task Description
Add the `getUnifiedPhotoParams()` method to the ViewMode class to generate unified parameters for `get_photos_unified` API calls, replacing the fetchConfig logic.

## Implementation Details

### Method Signature
```javascript
getUnifiedPhotoParams(appConfig, additionalParams = {})
```

### Implementation
Add this method to `src/domain/ViewMode.js`:

```javascript
/**
 * Generate parameters for get_photos_unified (absorbs fetchConfig role)
 */
getUnifiedPhotoParams(appConfig, additionalParams = {}) {
    const baseParams = {
        type: "search",
        sort_value: additionalParams.sort_value || 0,
        page: additionalParams.page || 1,
        limit: additionalParams.limit || appConfig?.max_photos_per_fetch || 1000,
        offset: additionalParams.offset || 0,
        star: additionalParams.star || -1,
        has_comment: additionalParams.has_comment || false,
        extension: additionalParams.extension || "all"
    };

    switch (this._mode) {
        case VIEW_MODES.DATE:
            return { ...baseParams, search_type: "date", query: this._data.date };
        case VIEW_MODES.RECENT:
            return { ...baseParams, search_type: "recent" };
        case VIEW_MODES.ALBUM:
            return { ...baseParams, search_type: "album_photos", params: { album_id: this._data.albumId } };
        case VIEW_MODES.ALBUM_LIST:
            return { ...baseParams, search_type: "all_albums" };
        case VIEW_MODES.TAG:
            return { ...baseParams, search_type: "tag", query: this._data.tagId?.toString() };
        case VIEW_MODES.TAG_LIST:
            return { ...baseParams, search_type: "all_tags_with_count" };
        case VIEW_MODES.SEARCH:
        case VIEW_MODES.ADVANCED_SEARCH:
            return { ...baseParams, search_type: "search", query: this._data.searchQuery, params: this._data.searchParams };
        case VIEW_MODES.TRASH:
            return { ...baseParams, search_type: "trash" };
        default:
            throw new Error(`No photo params defined for mode: ${this._mode}`);
    }
}
```

## Files to Modify
- `src/domain/ViewMode.js` - Add the method implementation

## Success Criteria
- [ ] Method added to ViewMode class
- [ ] Method returns correct parameters for all view modes
- [ ] Method handles additional parameters properly
- [ ] Method uses appConfig.max_photos_per_fetch as default limit
- [ ] Method throws error for unsupported modes

## Dependencies
- Requires VIEW_MODES constants
- Requires existing ViewMode class structure

## Related Tasks
- 78-2: Add getModeTitle() method
- 78-3: Add getModeConfig() method
- 78-4: Replace switch statements in PhotosList.jsx