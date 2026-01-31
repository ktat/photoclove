# Add getModeConfig() method to ViewMode class

## Task Description
Add the `getModeConfig()` method to the ViewMode class to provide mode-specific configuration settings for UI components.

## Implementation Details

### Method Signature
```javascript
getModeConfig()
```

### Implementation
Add this method to `src/domain/ViewMode.js`:

```javascript
/**
 * Get mode-specific configuration
 */
getModeConfig() {
    return {
        showCreateButton: this.isAlbumListMode() || this.isTagListMode(),
        showSearchBar: this.isSearchMode(),
        allowSelection: this.isPhotoViewingMode(),
        showMetadata: this.isPhotoViewingMode(),
        showTrashOperations: this.isTrashMode(),
        showAlbumOperations: this.isAlbumMode(),
        showImportOperations: this.isImportMode(),
        enablePhotoNavigation: this.isPhotoViewingMode(),
        showBulkOperations: this.isPhotoViewingMode() || this.isListMode()
    };
}
```

## Files to Modify
- `src/domain/ViewMode.js` - Add the method implementation

## Success Criteria
- [ ] Method added to ViewMode class
- [ ] Method returns configuration object with boolean flags
- [ ] Method uses existing ViewMode detection methods (isAlbumListMode, etc.)
- [ ] Configuration covers all major UI interaction patterns
- [ ] Method is consistent with existing ViewMode patterns

## Dependencies
- Requires existing ViewMode class methods:
  - `isAlbumListMode()`
  - `isTagListMode()`
  - `isSearchMode()`
  - `isPhotoViewingMode()`
  - `isTrashMode()`
  - `isAlbumMode()`
  - `isImportMode()`
  - `isListMode()`

## Related Tasks
- 78-1: Add getUnifiedPhotoParams() method
- 78-2: Add getModeTitle() method
- 78-4: Replace switch statements in PhotosList.jsx

## Usage Example
```javascript
const config = viewModeObj.getModeConfig();

// Use in UI components
{config.showCreateButton && <CreateButton />}
{config.allowSelection && <SelectionControls />}
{config.showSearchBar && <SearchBar />}
```