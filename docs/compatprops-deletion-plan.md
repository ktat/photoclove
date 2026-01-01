# compatProps Deletion Plan

## Executive Summary

`compatProps` is a temporary compatibility layer in `PhotosList.jsx` that was created during earlier refactoring phases. It contains a mix of:
- State values and setters from PhotoContext
- Parent props (`config`, `shortCutNavigation`, `addFooterMessage`)
- Date navigation state

This document outlines a step-by-step strategy to eliminate `compatProps` by migrating its properties to appropriate state groups or direct prop passing.

## Current compatProps Structure

```javascript
const compatProps = {
    // Date navigation state (from PhotoContext)
    dateList: dateList || [],
    datePage: datePage || {},
    currentDate: currentDate || "",
    dateNum: dateNum || {},

    // Display state (from PhotoContext)
    showPhotoDisplay: showPhotoDisplay || {},

    // State setters (from PhotoContext)
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setShowPhotoDisplay: updateShowPhotoDisplay,
    setDateNum: updateDateNum,
    setDateList: updateDateList,

    // Handlers (from PhotoContext)
    togglePhotoDisplay: togglePhotoDisplay,
    setCurrentDateNum: setCurrentDateNum,

    // Parent props (from App.jsx)
    addFooterMessage: addFooterMessage,  // Function from App.jsx
    ...props  // Spreads: config, shortCutNavigation
};
```

## Usage Analysis

### Properties Passed to Child Components

**SideMenuWrapper.jsx:**
- Uses: `compatProps.addFooterMessage`, `compatProps.showPhotoDisplay`

**PhotoListContent.jsx:**
- Uses: `compatProps.showPhotoDisplay`

**PhotoDisplayWrapper.jsx:**
- Uses: `compatProps.showPhotoDisplay`, `compatProps.setShowPhotoDisplay`, `compatProps.addFooterMessage`

**PhotosList.jsx (internally):**
- Uses: `compatProps.addFooterMessage` (10+ places for notifications)
- Uses: `compatProps.datePage` (in displayState definition - line 1177)
- Uses: `compatProps.showPhotoDisplay` (2 places for conditional rendering)

### Properties Referenced in Dependencies Arrays

- `compatProps.datePage` → displayState dependency (line 1179)
- `compatProps.addFooterMessage` → handlers dependency (line 1284)
- `compatProps` (entire object) → deletePhotos/restorePhotos callbacks (lines 1029, 1130)

## Migration Strategy

### Phase 1: Fix datePage Duplication (IMMEDIATE)

**Problem:** `datePage` exists in both `compatProps` and `displayState`, with displayState referencing compatProps.

**Solution:**
```javascript
// BEFORE
const displayState = useMemo(() => ({
    // ...
    datePage: compatProps.datePage,
    // ...
}), [/* ... */, compatProps.datePage, /* ... */]);

// AFTER
const displayState = useMemo(() => ({
    // ...
    datePage: datePage || {},
    // ...
}), [/* ... */, datePage, /* ... */]);
```

**Impact:** Low risk, removes circular reference
**Files affected:** `src/App/PhotosList.jsx`

### Phase 2: Create NavigationState Group

**Problem:** Date navigation state (`dateList`, `dateNum`) is scattered.

**Current location:** PhotoContext → compatProps → passed to SideMenuWrapper

**Proposal:** Create a `NavigationState` group

```javascript
/** @typedef {Object} NavigationState
 * @property {Array} dateList - Available dates list
 * @property {Object} dateNum - Date count mapping
 * @property {Function} updateDateList - Update dateList
 * @property {Function} updateDateNum - Update dateNum
 * @property {Function} setCurrentDateNum - Set current date number
 */
const navigationState = useMemo(() => ({
    dateList: dateList || [],
    dateNum: dateNum || {},
    updateDateList: updateDateList,
    updateDateNum: updateDateNum,
    setCurrentDateNum: setCurrentDateNum
}), [dateList, dateNum, updateDateList, updateDateNum, setCurrentDateNum]);
```

**Migration:**
1. Remove `dateList`, `dateNum` from compatProps
2. Pass `navigationState` to SideMenuWrapper
3. Update SideMenuWrapper to destructure from navigationState
4. Update type definitions in `src/types/PageState.js`

**Impact:** Medium risk, affects SideMenuWrapper props
**Files affected:**
- `src/App/PhotosList.jsx`
- `src/App/PhotosList/SideMenuWrapper.jsx`
- `src/types/PageState.js`

### Phase 3: Add showPhotoDisplay to DisplayState

**Problem:** `showPhotoDisplay` is a display-related state but lives in compatProps.

**Current:** PhotoContext → compatProps → used in 4 places

**Proposal:** Move to displayState

```javascript
const displayState = useMemo(() => ({
    currentPhotoPath: currentPhotoPath,
    currentPhotoIndex: currentPhotoIndex,
    showSideMenu: showSideMenu,
    iconSize: iconSize,
    sort: sortOfPhotos,
    importSort: importSortOfPhotos,
    scrollPosition: 0,
    datePage: datePage || {},
    numOfPhoto: numOfPhoto,
    showPhotoDisplay: showPhotoDisplay || {},  // ADD
    updateShowPhotoDisplay: updateShowPhotoDisplay  // ADD (setter)
}), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos,
     importSortOfPhotos, datePage, numOfPhoto, showPhotoDisplay, updateShowPhotoDisplay]);
```

**Migration:**
1. Add `showPhotoDisplay` and `updateShowPhotoDisplay` to displayState
2. Update all references from `compatProps.showPhotoDisplay` to `displayState.showPhotoDisplay`
3. Update child components (SideMenuWrapper, PhotoListContent, PhotoDisplayWrapper)
4. Update type definitions

**Impact:** Medium-High risk, affects 4 files
**Files affected:**
- `src/App/PhotosList.jsx`
- `src/App/PhotosList/SideMenuWrapper.jsx`
- `src/App/PhotosList/PhotoListContent.jsx`
- `src/App/PhotosList/PhotoDisplayWrapper.jsx`
- `src/types/PageState.js`

### Phase 4: Create UIHandlers Group

**Problem:** `addFooterMessage`, `togglePhotoDisplay` are UI handlers scattered in compatProps.

**Current:** App.jsx → PhotosList props → compatProps → used everywhere

**Proposal:** Create a `uiHandlers` object

```javascript
const uiHandlers = useMemo(() => ({
    addFooterMessage: addFooterMessage,  // From parent props
    togglePhotoDisplay: togglePhotoDisplay,  // From PhotoContext
    handleTauriError: handleTauriError  // Already in handlers
}), [addFooterMessage, togglePhotoDisplay, handleTauriError]);
```

**Migration:**
1. Accept `addFooterMessage` as a direct prop (not in compatProps)
2. Create `uiHandlers` group combining parent and context handlers
3. Replace all `compatProps.addFooterMessage` with `uiHandlers.addFooterMessage`
4. Move `addFooterMessage` from `handlers` object to `uiHandlers`
5. Pass `uiHandlers` to child components

**Impact:** High risk, affects 10+ call sites
**Files affected:**
- `src/App/PhotosList.jsx`
- `src/App/PhotosList/PhotoDisplayWrapper.jsx`
- `src/App/PhotosList/SideMenuWrapper.jsx`

**Alternative (Simpler):** Just move `addFooterMessage` into existing `handlers` object directly (not from compatProps)

### Phase 5: Handle Parent Props Directly

**Problem:** `...props` spreads parent props into compatProps

**Current:** App.jsx passes `config`, `shortCutNavigation` → spread into compatProps

**Proposal:** Accept parent props directly

```javascript
// BEFORE
function PhotosList(props) {
    const { config: appConfig } = props;
    // ...
    const compatProps = {
        // ...
        ...props
    };
}

// AFTER
function PhotosList({ config: appConfig, shortCutNavigation, addFooterMessage }) {
    // Use props directly, no spreading needed
}
```

**Migration:**
1. Destructure all parent props in function signature
2. Remove `...props` from compatProps
3. Pass props directly where needed

**Impact:** Low risk, cleanup
**Files affected:**
- `src/App/PhotosList.jsx`

### Phase 6: Remove compatProps Entirely

**Final Step:** After all properties have been migrated, delete the compatProps object.

**Verification checklist:**
- [ ] No references to `compatProps` in PhotosList.jsx
- [ ] No references to `compatProps` in child components
- [ ] All state is in appropriate state groups
- [ ] All parent props are passed directly
- [ ] TypeScript/JSDoc types updated
- [ ] No compilation errors
- [ ] Manual testing passes

## Recommended Implementation Order

1. **Phase 1** (datePage duplication fix) - SAFE, immediate benefit
2. **Phase 5** (parent props direct passing) - SAFE, reduces complexity
3. **Phase 2** (NavigationState group) - Medium complexity
4. **Phase 3** (showPhotoDisplay to DisplayState) - Higher complexity, many touch points
5. **Phase 4** (UIHandlers group OR simpler alternative) - Depends on architecture preference
6. **Phase 6** (delete compatProps) - Final cleanup

## Alternative: Conservative Approach

If full migration is too risky, consider a conservative approach:

1. **Keep compatProps temporarily** but make it explicit and minimal
2. **Rename to `legacyProps`** to signal it's temporary
3. **Document** what still needs migration
4. **Migrate incrementally** over multiple iterations

## Risk Mitigation

- **Test after each phase** before proceeding to next
- **Use git commits** for each phase to enable easy rollback
- **Check console for errors** after each change
- **Verify photo display**, date navigation, and search still work
- **Run cargo check** if Rust types are affected (unlikely)

## Questions to Resolve

1. **UIHandlers vs existing handlers:** Should we merge into existing `handlers` object or create separate `uiHandlers`?
2. **NavigationState necessity:** Is date navigation complex enough to warrant its own state group, or should it go into DisplayState?
3. **showPhotoDisplay complexity:** This object has per-mode keys (`{recent: true, date: false}`). Should we rethink this pattern entirely?

## Expected Outcome

After full migration:
- ✅ No `compatProps` object
- ✅ All state in semantic groups (ViewState, DisplayState, etc.)
- ✅ Direct prop passing from parent
- ✅ Cleaner dependencies arrays
- ✅ Easier to understand data flow
- ✅ Reduced indirection

## Estimated Line Reduction

- Remove compatProps definition: ~15 lines
- Simplified dependencies: ~5-10 lines
- Net reduction: **~20-25 lines** after accounting for new state groups
