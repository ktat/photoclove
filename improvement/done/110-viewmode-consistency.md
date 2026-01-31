# Refactor: Improve ViewMode usage consistency in PhotosList

## Priority: Low

## Background
Code review found that PhotosList useEffect for showSideMenu mixes ViewMode API with direct mode checks.

## Current Issue
```javascript
useEffect(() => {
    const modeConfig = viewModeObj?.getModeConfig();
    if (modeConfig && !modeConfig.canEdit) {
        setShowSideMenu(false);
    } else {
        setShowSideMenu(isSearchMode || viewMode === VIEW_MODES.IMPORT);  // ← Direct mode check
    }
}, [isSearchMode, viewMode, viewModeObj, setShowSideMenu]);
```

Problem:
- Uses `viewModeObj.getModeConfig()` for trash/import check
- But uses direct `viewMode === VIEW_MODES.IMPORT` check in else branch
- Inconsistent - defeats the purpose of ViewMode abstraction

## Solution
Use ViewMode API consistently:

```javascript
useEffect(() => {
    const modeConfig = viewModeObj?.getModeConfig();
    if (!modeConfig) return;

    // Determine if side menu should be shown based on mode configuration
    const shouldShowSideMenu = modeConfig.canEdit &&
        (viewModeObj.isSearchMode() || viewModeObj.isImportMode());

    setShowSideMenu(shouldShowSideMenu);
}, [viewModeObj, setShowSideMenu]);
```

Or, add a method to ViewMode:

```javascript
// In ViewMode.js
shouldShowSideMenuByDefault() {
    return this.getModeConfig().canEdit &&
           (this.isSearchMode() || this.isImportMode());
}

// In PhotosList.jsx
useEffect(() => {
    if (viewModeObj) {
        setShowSideMenu(viewModeObj.shouldShowSideMenuByDefault());
    }
}, [viewModeObj, setShowSideMenu]);
```

## Implementation Steps
1. Review the business logic: When should side menu be shown by default?
2. Add method to ViewMode.js if complex logic
3. Update PhotosList.jsx to use ViewMode API consistently
4. Remove direct viewMode checks where ViewMode API exists

## Files to Change
- `src/domain/ViewMode.js` (optional: add helper method)
- `src/App/PhotosList.jsx`

## Testing
- Test all modes: date, search, import, trash, album
- Verify side menu shows/hides correctly in each mode
- Verify pressing 'i' key toggles correctly

## Benefits
- Consistent use of ViewMode abstraction
- Business logic centralized in domain object
- Easier to add new modes
- Follows DDD principles

## Notes
This is a low-priority refactoring that improves code quality but doesn't fix a bug.
Consider doing this alongside other ViewMode-related changes.
