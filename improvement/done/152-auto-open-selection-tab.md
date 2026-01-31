# Auto-Open Selection Tab and Highlight on Selection

## Overview
Automatically open the Selection tab in the sidebar when items are selected, and visually highlight the tab based on selection state. This improves UX by immediately showing the selection panel with batch operation options and providing clear visual feedback about active selections.

## User Impact
- **Who benefits**: All users who use batch operations (photos, albums, tags)
- **Workflow improvement**:
  - No need to manually switch to Selection tab after selecting items
  - Immediate visual feedback via tab highlight when items are selected
  - Tab automatically opens when first item is selected
  - Tab highlight clears when all items are deselected
  - Reduces clicks: from "check item → click Selection tab → perform operation" to "check item → perform operation"
- **Pain points solved**:
  - Confusion about where selected items are shown
  - Extra manual tab switching
  - Not realizing Selection tab exists for batch operations
  - No visual indication when items are selected in Album/Tag list modes
  - Tab stays highlighted even when selection is cleared (current bug)

## Influence on Existing Features

### Compatibility
- **No breaking changes**: This is a purely additive UX enhancement
- **Existing behavior preserved**: Manual tab switching still works
- **No migration needed**: Feature works immediately for all users

### Related Features
- **PhotoCard** (`src/App/PhotosList/PhotoCard.jsx`): Contains checkbox with `onAddSelection` handler
- **Selection Tab** (`src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`): Tab that displays selected photos and batch operations
- **useTabManagement** (`src/hooks/useTabManagement.js`): Manages tab state and switching
- **usePhotoListHelpers** (`src/hooks/usePhotoListHelpers.js`): Contains `addSelection` function that already switches to Selection tab when adding photos

### Current Behavior Analysis
**Currently implemented**:
- `addSelection(true, photoPath)` in `usePhotoListHelpers.js:139-150` already calls `changeTab(undefined, "#tab-selection")` when adding a photo to selection
- This is used for programmatic selection (e.g., "Add to selection" button)

**Not implemented**:
- Checkbox toggle via `onAddSelection` in `PhotoCard.jsx:331` does NOT trigger tab switch
- Checkbox directly calls `onAddSelection(checked, path)` which maps to `addSelection` but the current implementation only switches tabs when `checked=true`

**Gap**:
- The auto-switch logic exists in `addSelection`, but it may not be consistently triggered when checking the checkbox
- Need to verify the prop binding chain: `PhotoCard.onAddSelection` → handler in PhotosList → `addSelection`

## Implementation Approach

### Architecture
- **DDD Pattern**: No domain entity changes needed
- **State Management**:
  - Use existing `useTabManagement` hook's `changeTab` function
  - Monitor selection state (`photoSelection`, `selectedAlbums`, `selectedTags`)
- **Backend**: No backend changes required (frontend-only feature)

### Source Code Changes

**Frontend**:

1. **`src/App/PhotosList.jsx`** - Auto-open tab logic
   ```javascript
   // Add useRef to track previous selection count
   const prevSelectionLength = useRef(0);

   useEffect(() => {
       // Auto-open Selection tab when selection goes from 0 to 1+
       if (prevSelectionLength.current === 0 && photoSelection.length > 0) {
           changeTab(undefined, "#tab-selection");
       }
       prevSelectionLength.current = photoSelection.length;
   }, [photoSelection.length, changeTab]);
   ```
   - Track previous selection count with `useRef`
   - Only open tab when selection changes from 0 to 1+
   - Prevents re-opening if user manually switches tabs

2. **`src/components/VerticalTabBar.jsx`** - Tab highlighting logic
   - Add props: `photoSelectionCount`, `selectedAlbumsCount`, `selectedTagsCount`
   - Add conditional class for Selection tab:
     ```javascript
     const hasSelection = photoSelectionCount > 0 || selectedAlbumsCount > 0 || selectedTagsCount > 0;
     className={`directory-vertical-tab-button ${tabClass.selection ? "active" : ""} ${hasSelection ? "has-selection" : ""}`}
     ```
   - Apply `has-selection` class when any items are selected

3. **`src/components/VerticalTabBar.css`** - Visual styling
   ```css
   /* Tab with active selections (but not currently open) */
   .directory-vertical-tab-button.has-selection:not(.active) {
       background: #FF9800;  /* Orange to indicate pending selections */
       color: white;
   }

   /* Tab with selections AND currently open */
   .directory-vertical-tab-button.has-selection.active {
       background: #4CAF50;  /* Keep green when active */
       color: white;
   }
   ```
   - Orange highlight when items selected but tab not open
   - Green when tab is active (current behavior)
   - Normal color when no selections

4. **`src/App/PhotosList.jsx`** - Pass selection counts to VerticalTabBar
   ```javascript
   <VerticalTabBar
       viewMode={viewMode}
       isSearchMode={isSearchMode}
       showSideMenu={showSideMenu}
       tabClass={tabClass}
       changeTab={changeTab}
       setShowSideMenu={setShowSideMenu}
       closeRightColumn={closeRightColumn}
       viewModeObj={viewModeObj}
       photoSelectionCount={photoSelection.length}
       selectedAlbumsCount={selectedAlbums.length}
       selectedTagsCount={selectedTags.length}
   />
   ```

**Backend**: None

**Database**: None

### Implementation Steps

1. **Add auto-open logic** (PhotosList.jsx)
   - Add `useRef` for previous selection count
   - Add `useEffect` to monitor `photoSelection.length`
   - Call `changeTab` when transitioning from 0 to 1+

2. **Add visual highlighting** (VerticalTabBar)
   - Add props for selection counts
   - Calculate `hasSelection` state
   - Apply conditional CSS classes

3. **Add CSS styles** (VerticalTabBar.css)
   - Define `.has-selection` styling
   - Define `.has-selection.active` styling

4. **Testing**:
   - Test auto-open in all ViewModes
   - Test highlighting for photos, albums, tags
   - Test highlight clears when selection reaches 0
   - Test tab doesn't re-open if manually closed

## Dependencies & Risks

### External Dependencies
- None (uses existing React hooks and components)

### Performance
- **Negligible impact**: Tab switching is a lightweight state update
- **No load time impact**: No additional data fetching
- **Memory**: No additional memory usage

### Security
- **No security implications**: Pure UI state change

### UX Considerations
- **Potential issue**: Tab auto-switching might be surprising to users
- **Mitigation**: Only switch when checking (adding), not unchecking
- **Alternative**: Add user preference to enable/disable this behavior (future enhancement)

## Testing Strategy

### Manual Testing Steps

1. **Photo selection - Auto-open**:
   - Open PhotosList in DATE mode
   - Ensure Selection tab is closed
   - Check a photo's checkbox
   - ✅ Verify Selection tab opens automatically
   - ✅ Verify tab has orange highlight

2. **Photo selection - Highlighting**:
   - With photos selected, manually switch to Filter tab
   - ✅ Verify Selection tab shows orange highlight
   - Click Selection tab
   - ✅ Verify tab turns green (active state)
   - Uncheck all photos
   - ✅ Verify tab returns to normal color (no orange highlight)

3. **Album selection - Highlighting**:
   - Switch to Album List mode
   - Select one or more albums
   - ✅ Verify Selection tab shows orange highlight
   - ✅ Verify Selection tab opens automatically (if starting from 0 selections)
   - Open Selection tab
   - ✅ Verify tab turns green
   - Deselect all albums
   - ✅ Verify tab returns to normal color

4. **Tag selection - Highlighting**:
   - Switch to Tag List mode
   - Select one or more tags
   - ✅ Verify Selection tab shows orange highlight
   - ✅ Verify Selection tab opens automatically
   - Clear all tag selections
   - ✅ Verify tab returns to normal color

5. **Tab persistence after manual close**:
   - Select a photo (Selection tab opens)
   - Manually switch to Filter tab
   - Select another photo
   - ❌ Verify Selection tab does NOT re-open (respects user's choice)
   - ✅ Verify Selection tab still shows orange highlight

6. **Multi-ViewMode testing**:
   - Test photo selection in: HOME, DATE, ALBUM, TAG, SEARCH, TRASH, IMPORT modes
   - Verify consistent auto-open and highlighting behavior

### Edge Cases
- **Rapid selection**: Check multiple photos quickly → tab should only open once
- **Already open**: Select photos when Selection tab already open → should remain open
- **Select All**: Click "Select All" button → tab should open and highlight
- **Clear selection**: Uncheck last photo → highlight should disappear immediately
- **Mixed selections**: Have photos AND albums selected → highlight should show

### Performance Benchmarks
- Not applicable (lightweight state and CSS changes)

## Open Questions

1. **What color for the "has-selection" highlight?**
   - Current proposal: Orange (#FF9800)
   - Alternative: Blue, yellow, or use theme accent color
   - **Decision**: Orange provides good contrast with green (active) and dark background

2. **Should we support mixed selection highlighting?**
   - When both photos AND albums are selected, show different indicator?
   - Current proposal: Single unified highlight (either shows orange or doesn't)
   - **Decision**: Start with unified highlight for simplicity

3. **Should unchecking the LAST item auto-close the Selection tab?**
   - Current proposal: No (keep tab open, just remove highlight)
   - Alternative: Close tab when selection count reaches 0
   - **Decision**: Keep tab open (user can close manually), only remove highlight

4. **Should this work for keyboard-based selection?**
   - If keyboard shortcuts select items, should tab auto-open?
   - **Decision**: Yes, because we're monitoring state changes, not events

5. **User preference for auto-open behavior?**
   - Should this be a toggleable setting?
   - **Decision**: Implement as default behavior first, add preference only if users request it

## References
- Related pattern: `addSelection` in `src/hooks/usePhotoListHelpers.js:139-150` already implements this
- Selection panel: `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`
- Tab management: `src/hooks/useTabManagement.js`
