# Add getModeTitle() method to ViewMode class

## Task Description
Add the `getModeTitle()` method to the ViewMode class to provide UI display titles for each view mode, replacing the fetchConfig.title logic.

## Implementation Details

### Method Signature
```javascript
getModeTitle()
```

### Implementation
Add this method to `src/domain/ViewMode.js`:

```javascript
/**
 * Get UI display title (absorbs fetchConfig.title role)
 */
getModeTitle() {
    switch (this._mode) {
        case VIEW_MODES.ALBUM_LIST: return 'Albums';
        case VIEW_MODES.TAG_LIST: return 'Tags';
        case VIEW_MODES.TRASH: return 'Trash';
        case VIEW_MODES.SEARCH: return 'Search Results';
        case VIEW_MODES.ADVANCED_SEARCH: return 'Advanced Search';
        case VIEW_MODES.DATE: return this._data.date || 'Photos';
        case VIEW_MODES.RECENT: return 'Recent Photos';
        case VIEW_MODES.ALBUM: return this._data.albumName || 'Album';
        case VIEW_MODES.TAG: return this._data.tagName || 'Tag';
        case VIEW_MODES.HOME: return 'Home';
        case VIEW_MODES.IMPORT: return 'Import';
        case VIEW_MODES.PREFERENCES: return 'Preferences';
        case VIEW_MODES.JOB_QUEUE: return 'Job Queue';
        case VIEW_MODES.LOGIN: return 'Login';
        default: return 'Photos';
    }
}
```

## Files to Modify
- `src/domain/ViewMode.js` - Add the method implementation

## Success Criteria
- [ ] Method added to ViewMode class
- [ ] Method returns appropriate titles for all view modes
- [ ] Method uses dynamic data (date, albumName, tagName) when available
- [ ] Method provides fallback titles for missing data
- [ ] Method handles all VIEW_MODES constants

## Dependencies
- Requires VIEW_MODES constants
- Requires existing ViewMode class structure with _data property

## Related Tasks
- 78-1: Add getUnifiedPhotoParams() method
- 78-3: Add getModeConfig() method
- 78-10: Update UI title display to use viewModeObj.getModeTitle()

## UI Integration
Once implemented, this method will replace:
```javascript
// Current
<span>{fetchConfig?.title || 'Photos'}</span>

// After
<span>{viewModeObj.getModeTitle()}</span>
```