# Add Selection Tab to Full Photo Viewer

## Overview
Add a Selection tab to the PhotoOption vertical tab bar that appears during full photo viewing (PhotosListMini). This allows users to manage batch selections and perform bulk operations without exiting the photo viewer.

## User Impact
- **Who benefits**: Users who want to select multiple photos while browsing in full-screen mode
- **Workflow improvement**:
  - Can add current photo to selection without leaving photo viewer
  - Can view all selected photos and perform batch operations
  - Can manage selection state while navigating through photos
  - No need to exit photo viewer to access Selection panel
- **Pain points solved**:
  - Currently must exit photo viewer to access Selection tab in grid view
  - Interrupts browsing flow when building a selection set
  - Can't see how many photos are selected while in viewer

## Influence on Existing Features

### Compatibility
- **No breaking changes**: Adds new tab alongside existing Info/Editor/Tags/Album tabs
- **Existing tabs preserved**: All current PhotoOption tabs remain unchanged
- **No migration needed**: Feature works immediately

### Related Features
- **PhotoOption** (`src/App/PhotosList/PhotoOption.jsx`): Vertical tab bar in photo viewer (Info, Editor, Tags, Album)
- **SelectionTab** (`src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`): Selection panel component (reusable)
- **PhotosListMini** (`src/App/PhotosList/PhotosListMini.jsx`): Full photo viewer component
- **VerticalTabBar** (`src/components/VerticalTabBar.jsx`): Grid view tab bar (Directory, Search, Selection, Maintenance)

### Current Behavior
- **Grid view**: VerticalTabBar displays with Selection tab access
- **Photo viewer**: PhotoOption displays with Info/Editor/Tags/Album tabs only
- **Selection access**: Must exit photo viewer to access Selection tab

## Implementation Approach

### Architecture
- **DDD Pattern**: No domain entity changes needed
- **State Management**:
  - Reuse existing selection state from PhotosList
  - Pass selection handlers to PhotoOption
- **Backend**: No backend changes required (frontend-only feature)

### Source Code Changes

**Frontend**:

1. **`src/App/PhotosList/PhotoOption.jsx`** - Add Selection tab
   ```javascript
   import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";

   function PhotoOption(props) {
       const [activeTab, setActiveTab] = useState("info");

       // Add Selection tab button (between existing tabs and close button)
       <button
           className={activeTab === "selection" ? "vertical-tab-button active" : "vertical-tab-button"}
           onClick={() => handleTabClick("selection")}
           title="Photo Selection"
       >
           <span className="vertical-text">Selection</span>
       </button>

       // Add Selection tab content panel
       {activeTab === "selection" && (
           <div className="side-menu-content">
               <SelectionTab
                   photoSelection={props.photoSelection}
                   photoSelectionDict={props.photoSelectionDict}
                   currentPhotoPath={props.currentPhotoPath}
                   // ... other required props
               />
           </div>
       )}
   }
   ```

2. **`src/App/PhotosList.jsx`** - Pass selection props to PhotoOption
   ```javascript
   <PhotoOption
       // Existing props...

       // Add selection-related props
       photoSelection={photoSelection}
       photoSelectionDict={photoSelectionDict}
       toggleSelection={toggleSelection}
       addSelection={addSelection}
       clearPhotoSelection={clearPhotoSelection}
       selectAllPhotoToSelection={selectAllPhotoToSelection}

       // Batch operation handlers
       deletePhotos={deletePhotosHandler}
       handleAddToAlbum={handleAddToAlbum}
       moveToTrashCan={moveToTrashCan}

       // Other required state
       allPhotosForCurrentFetch={allPhotosForCurrentFetch}
       photosListMiniAllPhotos={photosListMiniAllPhotos}
   />
   ```

3. **`src/App/PhotosList/PhotoOption.css`** - Ensure layout supports Selection panel
   - Verify side menu content area can accommodate SelectionTab
   - May need to adjust height/overflow for batch operations list

4. **Optional: Add visual indicator on Selection tab**
   - Show count badge when photos are selected
   - Example: "Selection (5)" or orange dot indicator
   - Consistent with 152-auto-open-selection-tab proposal

**Backend**: None

**Database**: None

### Implementation Steps

1. **Import SelectionTab component** into PhotoOption.jsx
2. **Add Selection tab button** to vertical tab bar
3. **Add Selection tab content panel** with conditional rendering
4. **Pass required props** from PhotosList to PhotoOption
   - Selection state: `photoSelection`, `photoSelectionDict`
   - Handlers: `toggleSelection`, `addSelection`, `clearPhotoSelection`
   - Batch operations: `deletePhotos`, `handleAddToAlbum`, etc.
   - Photo lists: `allPhotosForCurrentFetch`, `photosListMiniAllPhotos`
5. **Test integration**:
   - Verify SelectionTab renders correctly in PhotoOption
   - Test all batch operations work from photo viewer
   - Ensure selection state syncs between grid and viewer

## Dependencies & Risks

### External Dependencies
- None (reuses existing SelectionTab component)

### Performance
- **Negligible impact**: SelectionTab already exists, just rendering in different context
- **No load time impact**: No additional data fetching
- **Memory**: No additional memory usage (same selection state)

### Security
- **No security implications**: Pure UI composition change

### UX Considerations
- **Tab bar height**: PhotoOption vertical tabs may become taller with Selection tab added
- **Mitigation**: Tabs are already responsive, should handle one more tab
- **Alternative**: Use scrollable tab bar if height becomes an issue

## Testing Strategy

### Manual Testing Steps

1. **Selection tab visibility**:
   - Open a photo in full viewer
   - ✅ Verify Selection tab appears in vertical tab bar
   - ✅ Verify tab is positioned correctly (between existing tabs and close button)

2. **Selection tab functionality**:
   - Click Selection tab
   - ✅ Verify SelectionTab panel opens
   - ✅ Verify current photo can be added to selection via checkbox
   - ✅ Verify batch operations are available (Delete, Add to Album, etc.)

3. **Selection state sync**:
   - Select photos in grid view
   - Open a photo in full viewer
   - Click Selection tab
   - ✅ Verify previously selected photos are shown
   - Add current photo to selection in viewer
   - Close photo viewer
   - ✅ Verify selection persists in grid view

4. **Batch operations from viewer**:
   - Select multiple photos in grid view
   - Open one of the selected photos
   - Click Selection tab
   - Perform batch operation (e.g., "Add to Album")
   - ✅ Verify operation completes successfully
   - ✅ Verify UI updates correctly

5. **Cross-mode testing**:
   - Test Selection tab in viewer across different ViewModes:
     - DATE mode
     - ALBUM mode
     - TAG mode
     - SEARCH mode
     - IMPORT mode (if applicable)
     - TRASH mode
   - ✅ Verify consistent behavior

### Edge Cases
- **Empty selection**: Selection tab shows empty state message
- **Single photo selected**: Selection tab shows 1 photo
- **All photos selected**: Selection tab shows all, "Select All" is checked
- **Delete all selected from viewer**: Viewer closes if current photo is deleted
- **Navigate to unselected photo**: Checkbox in Selection tab is unchecked

### Performance Benchmarks
- Not applicable (lightweight component composition)

## Open Questions

1. **Should Selection tab be the default tab when opening a selected photo?**
   - Current proposal: No (keep Info as default)
   - Alternative: If current photo is selected, default to Selection tab
   - **Decision**: Keep Info as default for consistency

2. **Should we add a selection count badge to the tab?**
   - Example: "Selection (5)"
   - Current proposal: Yes (consistent with good UX)
   - **Decision**: Add count badge in parentheses

3. **Should all batch operations be available in viewer?**
   - Some operations might close the viewer (e.g., Delete All)
   - Current proposal: Show all operations, handle viewer closing gracefully
   - **Decision**: Show all, close viewer if current photo is affected by operation

4. **Should this integrate with 152-auto-open-selection-tab?**
   - When photo is selected in viewer, auto-open Selection tab?
   - Current proposal: Yes, apply same auto-open logic in PhotoOption
   - **Decision**: Implement consistently with 152 proposal

5. **Tab ordering in PhotoOption?**
   - Where should Selection tab appear? (Info, Editor, Tags, Album, Selection, Close)
   - Current proposal: Before Close button, after mode-specific tabs
   - **Decision**: Last tab before Close button

## Integration with 152-auto-open-selection-tab

This proposal should work harmoniously with #152:

- **152**: Auto-open Selection tab in grid view when items selected
- **153**: Add Selection tab to photo viewer
- **Combined UX**:
  1. User checks photo in grid → Selection tab auto-opens in grid
  2. User opens a photo → Selection tab available in viewer too
  3. User checks photo in viewer → Selection tab auto-opens in viewer (if #152 logic applied)
  4. User can manage selections from either grid or viewer seamlessly

## References
- PhotoOption component: `src/App/PhotosList/PhotoOption.jsx`
- SelectionTab component: `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`
- Related proposal: `improvement/152-auto-open-selection-tab.md`
