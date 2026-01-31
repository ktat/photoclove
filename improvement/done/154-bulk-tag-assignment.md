# Bulk Tag Assignment for Selected Photos

## Overview
Add the ability to assign tags to multiple selected photos simultaneously through a dedicated modal interface. This feature will add a new "Add Tags" operation to the SelectionTab's operation dropdown, enabling efficient batch tagging workflows.

## User Impact
- **Who benefits**: Users managing large photo collections who need to organize photos by tags
- **Workflow improvement**: Instead of opening each photo individually to add tags, users can select multiple photos and assign tags in one operation
- **Pain points solved**:
  - Tedious repetitive tagging of similar photos (e.g., event photos, photos of same person)
  - Time-consuming manual organization of imported photo batches
  - Inconsistent tagging due to manual repetition fatigue

## Influence on Existing Features

### Compatibility
- **No breaking changes**: This is a purely additive feature
- **Seamless integration**: Follows the same pattern as existing "Add to Album" bulk operation
- **Zero migration**: Existing tag data and functionality remain unchanged

### Related Features
This feature interacts with:

**Tag Management System**:
- `src/components/TagSelector.jsx` - Single-photo tag assignment UI
- `src/components/TagInput.jsx` - Tag creation interface
- `src/components/TagChip.jsx` - Tag display component
- `src/App/PhotosList/PhotoOption/PhotoTags.jsx` - Photo tags panel

**Photo Selection System**:
- `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx` - Operation selection UI
- `src/App/PhotosList.jsx` - Photo selection state management

**Unified Collection System**:
- `src/domain/UnifiedPhotoCollection.js` - Backend interface for tag operations
- `src-tauri/src/commands/tag_commands.rs` - Tag Tauri commands
- `src-tauri/src/repository/meta_db/sqlite/mod.rs` - Database operations

## Implementation Approach

### Architecture

**DDD Pattern**:
- **Domain Layer**: Uses existing `UnifiedPhotoCollection` domain entity for tag operations
- **Application Layer**: New modal component, new operation handler in PhotosList
- **Infrastructure Layer**: Reuses existing `add_tag_to_photo` Tauri command (no backend changes needed)

**State Management**:
- No new context needed - uses existing `photoSelection` state from PhotosList
- Modal state (open/close) managed locally in PhotosList
- Tag selection state managed within the new modal component

**Backend**:
- **No new Tauri commands required** - uses existing `add_tag_to_photo` command
- **No database changes** - uses existing `photo_collection_items` table
- **Batch processing**: Frontend iterates over selected photos, calls `add_tag_to_photo` for each

### Source Code Changes

**Frontend**:

1. **`src/components/BulkTagSelectorModal.jsx`** (NEW)
   - Similar structure to `AlbumSelectorModal.jsx`
   - Displays all available tags with search functionality
   - Allows multi-select tag selection (checkbox-based)
   - Tag creation inline (reuse `TagInput.jsx`)
   - Shows tag chips for selected tags (reuse `TagChip.jsx`)
   - Confirmation button with progress indicator during bulk assignment

2. **`src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`** (EDIT)
   - Add new option to `<select>` dropdown (line ~106):
     ```jsx
     {viewModeObj?.showAddTags() && <option value="addTags">Add Tags</option>}
     ```
   - Position: After "Add to Existing Album" option

3. **`src/App/PhotosList.jsx`** (EDIT)
   - Add modal state: `const [showBulkTagModal, setShowBulkTagModal] = useState(false);`
   - Add handler in `doOperation()` function:
     ```javascript
     case 'addTags':
         setShowBulkTagModal(true);
         break;
     ```
   - Add modal to render tree:
     ```jsx
     <BulkTagSelectorModal
         isOpen={showBulkTagModal}
         onClose={() => setShowBulkTagModal(false)}
         onConfirm={handleBulkTagAssignment}
         selectedPhotosCount={photoSelection.length}
     />
     ```
   - Add `handleBulkTagAssignment` function (similar to `addPhotosToAlbum`):
     ```javascript
     const handleBulkTagAssignment = async (selectedTagIds) => {
         for (const photoPath of photoSelection) {
             for (const tagId of selectedTagIds) {
                 const tag = tagsList.find(t => t.id === tagId);
                 const tagCollection = new UnifiedPhotoCollection({
                     id: tag.id,
                     type: 'tag',
                     name: tag.name,
                     color: tag.color
                 });
                 await tagCollection.addPhoto(photoPath);
             }
         }
         // Refresh photos to show new tags
         setShowBulkTagModal(false);
     };
     ```

4. **`src/domain/ViewMode.js`** (EDIT)
   - Add `showAddTags()` method:
     ```javascript
     showAddTags() {
         return this.shouldShowStandardOperations();
     }
     ```

**Backend**:
- No changes required - reuses existing infrastructure

**Database**:
- No schema changes
- No migration needed

### UI/UX Design

**Modal Design** (following PhotoClove dark theme guidelines):
```jsx
// Dark theme colors
backgroundColor: 'var(--bg-elevated)'  // Modal background
border: '1px solid var(--border)'      // Borders
color: 'var(--text)'                   // Text

// Tag list with multi-select checkboxes
// Search bar for filtering tags
// "Create New Tag" section at bottom (reuse TagInput)
// Selected tags displayed as chips
// "Add Tags to N Photos" confirmation button
```

## Dependencies & Risks

### External Dependencies
- **None** - Uses existing dependencies

### Performance
- **Potential Impact**: Bulk tagging of 100+ photos with multiple tags could take several seconds
- **Mitigation**:
  - Show progress indicator (e.g., "Adding tags to photo 5/100...")
  - Consider batching: Add batch command to backend if performance becomes an issue
  - For MVP: Sequential API calls are acceptable (similar to album bulk add)

### Security
- **Input Validation**: Tag IDs validated by existing backend logic
- **SQL Injection**: Protected by existing parameterized queries
- **File System Access**: Photo paths already validated in existing tag assignment flow

## Testing Strategy

### Manual Testing Steps
1. **Basic Bulk Tagging**:
   - Select 3 photos in date view
   - Choose "Add Tags" from Select Operation dropdown
   - Select 2 existing tags from modal
   - Verify tags added to all 3 photos
   - Check photo_collection_items table for entries

2. **Tag Creation During Bulk Assignment**:
   - Select 5 photos
   - Open Add Tags modal
   - Create new tag "Event2025"
   - Select it along with 1 existing tag
   - Verify both tags added to all photos

3. **Cross-Mode Compatibility**:
   - Test in Recent Photos mode
   - Test in Search Results mode
   - Test in Album View mode
   - Verify operation appears in appropriate modes

4. **Error Handling**:
   - Test with invalid photo paths
   - Test with already-tagged photos (should be idempotent)
   - Test with deleted tags
   - Verify error messages are user-friendly

5. **Performance Testing**:
   - Test with 50 photos, 5 tags (250 operations)
   - Monitor UI responsiveness
   - Check for memory leaks
   - Verify progress indicator updates

### Edge Cases
- Empty photo selection (button should be disabled)
- No tags selected in modal (disable confirm button)
- Tag deleted while modal is open (handle gracefully)
- Modal closed mid-operation (cancel pending requests)
- Duplicate tag assignment (should be idempotent, no duplicates in DB)

### Performance Benchmarks
- **Acceptable**: < 0.5s per photo-tag pair
- **Warning threshold**: > 1s per photo-tag pair
- **UI freeze threshold**: Should remain responsive during batch operations

## Open Questions

1. **Progress Indicator Details**:
   - Should we show "Adding tag X to photo Y of N"?
   - Or just "Adding tags... X% complete"?
   - **Recommendation**: Simple percentage with current photo name

2. **Error Handling Strategy**:
   - If tagging fails for one photo, continue with others or stop?
   - **Recommendation**: Continue and show summary of failures at end

3. **Tag Selection UX**:
   - Multi-select checkboxes or chip-based selection like TagSelector?
   - **Recommendation**: Checkboxes (clearer for bulk operations)

4. **Duplicate Prevention**:
   - Show which photos already have which tags?
   - **Recommendation**: For MVP, rely on backend idempotency; future enhancement could show existing tags

5. **Batch Backend Command**:
   - Should we add `add_tags_to_photos_batch(photo_paths: Vec<String>, tag_ids: Vec<i32>)` for performance?
   - **Recommendation**: Implement if > 10 photos shows performance issues; defer for MVP
