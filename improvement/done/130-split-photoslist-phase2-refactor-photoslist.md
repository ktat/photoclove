# Improvement #130: PhotosList.jsx Further Refactoring (Phase 2)

## Goal
Reduce PhotosList.jsx from **1400 lines to under 900 lines** (reduce by ~500 lines)

## Current Status
- Phase 1-3 completed (improvement #129)
- Extracted hooks: usePhotoLoader, useCollectionManagement, useSearchAndFilterManagement
- Current line count: **1400 lines**
- Target: **< 900 lines**

## Analysis

### Current PhotosList.jsx Structure (1400 lines)
- Imports: 64 lines
- Context hooks & state: 186 lines
- ViewMode logic: 100 lines
- Custom hooks usage: 300 lines
- Event handlers & functions: 250 lines
- useEffects: 250 lines (13 useEffect hooks remaining)
- Helper functions: 100 lines
- JSX Return: 150 lines

### Remaining Functions to Extract
1. **Photo Display Functions** (displayPhoto, closePhotoDisplay, closeRightColumn)
2. **Tab Management** (changeTab, tabClass state)
3. **Data Reload/Update** (reloadCurrentModeData, updatePhotosAfterTrashOperation)
4. **Search Effects** (3 useEffect hooks for search initialization/execution)
5. **Utility Functions** (convertPhotosWithConfig, getPageIdFromViewMode, getCurrentPageSubId)
6. **Side Menu Effects** (showSideMenu management useEffects)

## Refactoring Plan

### Phase 4: Extract Photo Display Management (~120 lines)
**Create**: `src/hooks/usePhotoDisplay.js`

**Extract**:
- `displayPhoto` function (line 793)
- `closePhotoDisplay` function (line 341)
- `closeRightColumn` function (line 939)
- Related state management for photo display
- Photo navigation logic

**Benefits**:
- Centralizes photo display/navigation logic
- Removes ~120 lines from PhotosList.jsx

---

### Phase 5: Extract Tab Management (~100 lines)
**Create**: `src/hooks/useTabManagement.js`

**Extract**:
- `tabClass` state
- `changeTab` function (line 874)
- Tab-related useEffects (3 useEffects)
  - Initialize showSideMenu based on view mode
  - Close side menu on search mode transition
  - Notify parent of menu state changes

**Benefits**:
- Isolates tab/side menu state management
- Removes ~100 lines from PhotosList.jsx

---

### Phase 6: Extract Data Synchronization (~120 lines)
**Create**: `src/hooks/useDataSynchronization.js`

**Extract**:
- `reloadCurrentModeData` function (line 950)
- `updatePhotosAfterTrashOperation` function (line 962)
- State reload logic after operations
- Album/tag refresh after updates

**Benefits**:
- Centralizes data reload/sync logic
- Better separation of concerns
- Removes ~120 lines from PhotosList.jsx

---

### Phase 7: Extract Search Initialization Effects (~100 lines)
**Create**: `src/hooks/useSearchInitialization.js`

**Extract**:
- Search parameter initialization useEffect (line 905)
- Initial search execution useEffect (line 916)
- Search results loading trigger useEffect (line 923)
- Filter options loading useEffect (line 774)

**Benefits**:
- Consolidates search-related effects
- Removes complex useEffect chains from main component
- Removes ~100 lines from PhotosList.jsx

---

### Phase 8: Extract Utility Functions (~70 lines)
**Move to**: `src/utils/PhotosListUtils.js`

**Extract**:
- `convertPhotosWithConfig` (line 290)
- `getPageIdFromViewMode` (line 1220)
- `getCurrentPageSubId` (line 1237)
- Other helper functions

**Benefits**:
- Reusable utility functions
- Testable in isolation
- Removes ~70 lines from PhotosList.jsx

---

### Phase 9: Extract Selection Wrapper Functions (~60 lines)
**Update**: `src/hooks/usePhotoSelection.js`

**Move**:
- `addSelection` function (line 822)
- `toggleSelection` function (line 835)
- `isSelected` function (line 841)
- `selectAllPhotoToSelection` function (line 847)

**Note**: These functions currently exist in PhotosList.jsx but usePhotoSelection hook already exists.
Need to either:
- Move these wrappers into usePhotoSelection
- Remove wrappers if usePhotoSelection provides equivalent functionality

**Benefits**:
- Completes usePhotoSelection extraction
- Removes ~60 lines from PhotosList.jsx

---

## Implementation Order

1. **Phase 4**: Extract Photo Display Management (usePhotoDisplay)
2. **Phase 5**: Extract Tab Management (useTabManagement)
3. **Phase 6**: Extract Data Synchronization (useDataSynchronization)
4. **Phase 7**: Extract Search Initialization (useSearchInitialization)
5. **Phase 8**: Extract Utility Functions (PhotosListUtils.js)
6. **Phase 9**: Complete Selection Management (update usePhotoSelection)

## Expected Results

| Phase | Lines Removed | Remaining Lines |
|-------|---------------|-----------------|
| Current | - | 1400 |
| Phase 4 | 120 | 1280 |
| Phase 5 | 100 | 1180 |
| Phase 6 | 120 | 1060 |
| Phase 7 | 100 | 960 |
| Phase 8 | 70 | 890 |
| Phase 9 | 60 | **830** |

**Final Target**: **~830 lines** (well under 900 line goal)

## Additional Considerations

### Future Optimization (Optional)
If further reduction is needed:
- Extract ViewMode construction logic to separate hook
- Extract useMemo computations to dedicated hooks
- Split JSX into more sub-components

### Testing Strategy
- Test each phase independently
- Verify all view modes work correctly (Date, Recent, Import, Trash, Album, Tag, Search)
- Test photo selection in different modes
- Test photo display/navigation
- Test search functionality
- Test tab switching

### Migration Notes
- Each phase should be committed separately
- Run full regression testing after each phase
- Update any components that depend on extracted functions
- Maintain backward compatibility during transition

## Success Criteria
- [x] PhotosList.jsx reduced to under 900 lines
- [ ] All functionality preserved
- [ ] All tests passing
- [ ] No performance degradation
- [ ] Code is more maintainable and testable
- [ ] Each extracted hook has single responsibility

## Related Issues
- Builds on improvement #129 (Phases 1-3)
- Part of ongoing effort to make PhotosList.jsx maintainable
- Aligns with DDD architecture principles
