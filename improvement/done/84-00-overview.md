# Improvement #84: PhotosList.jsx Refactoring - Overview

## Goal
Reduce PhotosList.jsx from 1,902 lines by extracting photo operations into usePhotoOperations.js hook.

## Current Status
- ✅ **Completed**: Album/tag selection and deletion operations (see `done/84-already-done.md`)
- ❌ **Remaining**: Photo operations (trash, album-photo relationships, list management)

## Task Breakdown

### 84-01: Add Album-Photo Operations ⭐ **Start Here**
**File**: `84-01-add-album-photo-operations.md`
**Complexity**: Low
**Time estimate**: 30-45 minutes
**Dependencies**: None

Implement missing album-photo relationship operations:
- `handleAddToAlbum(photoPath, albumId)`
- `removePhotoFromAlbum(photoPath, albumId)`

**Why start here:**
- Simplest task (just 2 functions)
- No complex dependencies
- Quick win to build momentum
- PhotosList.jsx already references these functions

**Expected impact:**
- usePhotoOperations.js: +40-50 lines
- PhotosList.jsx: No changes needed (already calls these)

---

### 84-02: Add Trash Operations
**File**: `84-02-add-trash-operations.md`
**Complexity**: High
**Time estimate**: 2-3 hours
**Dependencies**: None (can be done in parallel with 84-01 and 84-03)

Implement trash-related operations:
- Enhance `permanentlyDeletePhoto` (add UI state updates)
- Implement `moveToTrash(photoPath, sortValue)`
- Implement `restorePhoto(photoPath)`

**Complexity reasons:**
- Many UI state dependencies (30+ parameters)
- Complex navigation logic after deletion
- Must handle multiple edge cases
- Consolidates duplicate implementations

**Expected impact:**
- PhotosList.jsx: -100 lines
- usePhotoOperations.js: +120 lines

---

### 84-03: Add Remove From List Operation
**File**: `84-03-add-remove-from-list.md`
**Complexity**: Medium
**Time estimate**: 45-60 minutes
**Dependencies**: None (can be done in parallel)

Extract `removePhotoFromList` function:
- Remove photo from current view (album removal)
- Update thumbnail lists and navigation

**Expected impact:**
- PhotosList.jsx: -36 lines
- usePhotoOperations.js: +40 lines

---

### 84-04: Refactor Hook Parameters (Optional)
**File**: `84-04-refactor-hook-params.md`
**Complexity**: Medium
**Time estimate**: 1-2 hours
**Dependencies**: Must complete 84-01, 84-02, and 84-03 first

Organize 30+ hook parameters into logical groups:
- `selectionState`, `photoListState`, `navigationState`, etc.

**Why optional:**
- Pure refactoring (no functional changes)
- Only needed if parameter count becomes unwieldy
- Improves maintainability but not required for functionality

**Expected impact:**
- Better code organization
- Easier to maintain and extend
- No line count changes

---

## Recommended Implementation Order

### Option A: Sequential (Safest)
1. **84-01** (Quick win)
2. **84-03** (Medium complexity)
3. **84-02** (Most complex)
4. **84-04** (Cleanup/optional)

### Option B: Parallel Development
- Developer 1: **84-01** + **84-03** (Lower complexity)
- Developer 2: **84-02** (High complexity)
- After merge: **84-04** (Optional cleanup)

### Option C: Incremental (Recommended for solo work)
1. **84-01** → Test → Commit
2. **84-03** → Test → Commit
3. **84-02** → Test → Commit
4. **84-04** (If desired) → Test → Commit

---

## Total Expected Impact

### Line Count Changes
- PhotosList.jsx: **-136 lines** (1,902 → ~1,766)
- usePhotoOperations.js: **+200 lines** (219 → ~419)

### Benefits
- ✅ All photo operations centralized in one reusable hook
- ✅ Consistent error handling and logging
- ✅ Easier to test operations in isolation
- ✅ Better separation of concerns
- ✅ Reusable across other components

---

## Testing Checklist (After All Tasks Complete)

### Album-Photo Operations (84-01)
- [ ] Add photo to album
- [ ] Remove photo from album
- [ ] Error handling for non-existent album/photo

### Trash Operations (84-02)
- [ ] Move photo to trash from library view
- [ ] Permanent delete from trash mode
- [ ] Restore photo from trash
- [ ] Navigation after deletion (last photo, middle, only photo)
- [ ] Date counts update correctly

### Remove From List (84-03)
- [ ] Remove photo from album view
- [ ] Thumbnail list updates
- [ ] Navigation edge cases

### General
- [ ] All existing functionality still works
- [ ] No console errors
- [ ] Structured logging working
- [ ] Error messages display correctly

---

## Files to Modify

### Primary
- `src/hooks/usePhotoOperations.js` - Add all new operations
- `src/App/PhotosList.jsx` - Remove inline functions, update hook calls

### Secondary (May need updates)
- None expected (self-contained changes)

---

## Notes
- All tasks are independent and can be worked on separately
- 84-04 is optional - only do if parameter count becomes problematic
- Each task should be committed separately for easier review
- Full test suite should be run after each task completion
