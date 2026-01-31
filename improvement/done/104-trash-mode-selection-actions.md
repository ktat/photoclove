# Improvement 104: Fix Selection Tab Actions for Trash Mode

## Current Issue

When photos are selected in Trash mode, the selection tab dropdown shows inappropriate actions:
- Upload to Google Photos
- Delete files
- Create Album
- Add to Existing Album

These actions don't make sense for photos in the trash.

Additionally, when switching between modes (trash mode, import mode, normal mode), selections persist, which is confusing to users.

## Required Changes

### 1. Context-Aware Selection Actions for Trash Mode

When in Trash mode, the selection dropdown should only show:
- **Delete Permanently** - Permanently delete selected photos from trash
- **Restore** - Restore selected photos to their original locations

### 2. Clear Selection on Mode Switch

Selection state should be cleared when switching between different operational modes:
- Normal mode → Trash mode: Clear selection
- Trash mode → Normal mode: Clear selection
- Normal mode → Import mode: Clear selection
- Import mode → Normal mode: Clear selection
- Trash mode → Import mode: Clear selection
- Import mode → Trash mode: Clear selection

In general, when switching between:
- Import mode
- Trash mode
- Other modes (normal/date/album/tag)

The selection state should not persist across mode boundaries.

## Implementation Notes

### Selection Tab Component
- Check current view mode (trash, import, normal)
- Render different dropdown options based on mode
- For trash mode: only "Delete Permanently" and "Restore"
- For import mode: import-specific actions
- For normal mode: current actions (Upload, Delete, Create Album, Add to Album)

### Mode Switch Detection
- Listen for view mode changes
- Clear `photoSelection` state when mode type changes
- Mode types to distinguish:
  - `VIEW_MODES.TRASH` (trash mode)
  - `VIEW_MODES.IMPORT` (import mode)
  - Other modes (date, recent, album, tag, search)

### Files to Modify
- Selection tab component (likely in `src/components/` or `src/App/PhotosList/`)
- PhotosList or parent component that manages mode switching
- Photo selection state management (PhotoContext or usePhotoSelection hook)

## Expected Behavior

### Before
1. User selects photos in Trash mode
2. Dropdown shows "Upload to Google Photos", "Create Album", etc. (wrong)
3. User switches to Date mode
4. Photos remain selected (confusing)

### After
1. User selects photos in Trash mode
2. Dropdown shows only "Delete Permanently" and "Restore" (correct)
3. User switches to Date mode
4. Selection is cleared automatically (clear)

## Benefits
- Prevents users from attempting invalid operations on trashed photos
- Reduces confusion when switching between modes
- Clearer separation of concerns between different operational contexts
