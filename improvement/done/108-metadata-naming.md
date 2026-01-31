# Refactor: Clarify metadata visibility naming in ViewMode

## Priority: Low

## Background
Code review found that `showMetadata` and `showEditor` in ViewMode have unclear relationship.

## Current Issue
```javascript
getModeConfig() {
    return {
        showMetadata: this.isPhotoViewingMode(),  // true in trash mode
        showEditor: !this.isTrashMode() && !this.isImportMode()  // false in trash mode
    };
}
```

Problem: When `showMetadata` is true but `showEditor` is false, it's unclear that:
- Metadata can be **viewed** but not **edited**
- This intent is not clear from the property names

## Solution
Use more explicit naming to distinguish between viewing and editing:

```javascript
getModeConfig() {
    return {
        canViewMetadata: this.isPhotoViewingMode(),
        canEditMetadata: !this.isTrashMode() && !this.isImportMode(),
        // Or alternatively:
        showMetadataViewer: this.isPhotoViewingMode(),
        showMetadataEditor: !this.isTrashMode() && !this.isImportMode()
    };
}
```

## Implementation Steps
1. Rename properties in `src/domain/ViewMode.js`:
   - `showMetadata` → `canViewMetadata`
   - `showEditor` → `canEditMetadata`
2. Update all usages in components:
   - `src/App/PhotosList.jsx`
   - `src/App/PhotosList/PhotoOption.jsx`
   - Any other files using these properties
3. Update tests if any

## Files to Change
- `src/domain/ViewMode.js`
- `src/App/PhotosList.jsx`
- `src/App/PhotosList/PhotoOption.jsx`

## Testing
- Verify trash mode: Can view but not edit metadata
- Verify import mode: Same behavior
- Verify normal mode: Can both view and edit

## Benefits
- Clearer code intent
- Easier to understand permission model
- Better self-documenting code

## Alternative Approach
Keep current names but add JSDoc comments:
```javascript
/**
 * @property {boolean} showMetadata - Whether metadata can be **viewed**
 * @property {boolean} showEditor - Whether metadata can be **edited**
 */
```

However, renaming is preferred for better self-documentation.
