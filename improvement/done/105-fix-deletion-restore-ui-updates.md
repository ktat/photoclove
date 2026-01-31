# Fix Photo Deletion and Restore UI Update Issues

## Problem Summary

There are two critical bugs related to photo deletion and restoration that affect UI state updates:

### Bug 1: Multiple Photo Deletion from Viewing Mode
**Current Behavior:**
1. When deleting 2 photos from viewing mode, DateList.jsx shows only -1 in photo count
2. After reload, the count returns to original value (DB not updated)
3. Only 1 photo disappears from the photo list
4. However, when re-selecting, deleted photos are gone (trash operation actually succeeded)

**Root Cause:**
- Photo deletion from viewing mode (PhotosListMini) is not properly updating all UI states
- DateList count update is incorrect (only decrements by 1 regardless of selection)
- Photo list removal is incomplete
- DB update might be failing or not being called for all selected photos

**Expected Behavior:**
- Deleting 2 photos should decrease DateList count by 2
- Both photos should be removed from the photo list immediately
- DB should reflect the deletion for both photos
- date_summary table should be updated correctly

### Bug 2: Restore from Trash Does Not Update DateList
**Current Behavior:**
1. Selecting multiple photos in trash and clicking Restore
2. DateList.jsx photo count does not change
3. After reload, the count updates correctly (DB is updated correctly)
4. Trash view reloads entire collection (performance issue)

**Root Cause:**
- `reloadCurrentModeData()` is being called, which fetches all trash data again
- DateList is not being notified of the change
- The reload is inefficient - should just remove items from current list instead

**Expected Behavior:**
- DateList should update immediately without reload
- Trash view should remove restored photos from current state without full reload
- Performance should be improved by avoiding unnecessary data fetching

## Technical Details

### Files Involved
- `src/App/PhotosList/DirectoryMenu.jsx` - Restore and delete operations
- `src/App/PhotosList.jsx` - Main component with reloadCurrentModeData
- `src/App/DateList.jsx` - Date list display with photo counts
- `src/hooks/usePhotoOperations.js` - Photo deletion logic
- `src-tauri/src/lib.rs` - Backend batch operations
- `src-tauri/src/repository/meta_db/sqlite.rs` - date_summary updates

### Current Implementation Issues

1. **DirectoryMenu.jsx:349-350**: Calls `reloadCurrentModeData()` after restore
   - This triggers full trash collection reload
   - Should instead update local state only

2. **PhotosListMini deletion**: When deleting from detail view
   - Not properly updating parent PhotosList state
   - DateList count update logic may be broken

3. **date_summary updates**: Backend is updating correctly but frontend not reflecting

## Solution Approach

### For Bug 1 (Deletion from Viewing Mode)
1. Check `moveToTrashCan` in PhotosList.jsx and usePhotoOperations.js
2. Ensure all selected photos are processed in deletion
3. Fix DateList count update to handle multiple deletions
4. Update both `photosListMiniAllPhotos` and `filteredPhotos` states correctly

### For Bug 2 (Restore UI Update)
1. Instead of `reloadCurrentModeData()`, update local state:
   - Remove restored photos from `photoCollection.photos`
   - Update `filteredPhotos` state
   - Trigger DateList refresh with updated counts

2. Add efficient state update function:
   ```javascript
   function updatePhotosAfterRestore(restoredPaths) {
       // Remove from current collection
       const updatedPhotos = photoCollection.photos.filter(
           p => !restoredPaths.includes(p.originalPath)
       );
       setPhotoCollection({...photoCollection, photos: updatedPhotos});

       // Update date counts
       // ... calculate and update dateNum state
   }
   ```

3. Pass this function to DirectoryMenu instead of `reloadCurrentModeData`

## Implementation Steps

1. Investigate and fix deletion from viewing mode (Bug 1)
   - [ ] Trace deletion flow from PhotosListMini
   - [ ] Fix multi-photo deletion logic
   - [ ] Fix DateList count update
   - [ ] Test with 2+ photo selections

2. Optimize restore operation (Bug 2)
   - [ ] Create efficient state update function
   - [ ] Replace `reloadCurrentModeData` call with state update
   - [ ] Update dateNum calculation for restored photos
   - [ ] Test trash restore with multiple photos

3. Verify date_summary backend updates are working
   - [ ] Check backend logs for update_date_summary_for_date
   - [ ] Ensure errors are logged properly
   - [ ] Verify SQL queries are correct

## Related Code Sections

- `src/App/PhotosList.jsx:1489-1498` - reloadCurrentModeData function
- `src/App/PhotosList/DirectoryMenu.jsx:342-351` - restoreSelectedFromTrash
- `src/hooks/usePhotoOperations.js` - moveToTrashCan implementation
- `src-tauri/src/lib.rs:1999-2009` - restore_from_trash_batch date_summary update
- `src-tauri/src/repository/meta_db/sqlite.rs:3298-3330` - update_date_summary_for_date

## Success Criteria

1. Deleting N photos updates DateList count by -N immediately
2. All deleted photos disappear from photo list without reload
3. Restoring N photos updates DateList count by +N immediately
4. Restored photos disappear from trash view without full reload
5. No unnecessary backend data fetches
6. DB and UI state remain consistent

---

## Detailed Analysis and Implementation Plan

### Bug 1: Root Cause Analysis

**Location**: `src/App/PhotosList/DirectoryMenu.jsx:313-321`

```javascript
async function deleteFiles() {
    if (!lockDelete) {
        props.photoSelection.map((v, i) => {
            props.moveToTrashCan(v);
        });
        lockDelete = false;
        props.clearPhotoSelection()
    }
}
```

**Problems**:
1. **No `await` on `map`**: Each `moveToTrashCan(v)` is async but not awaited
2. **Parallel execution without Promise.all**: Deletions run in parallel but completion isn't tracked
3. **Immediate state clearing**: `clearPhotoSelection()` runs before deletions complete
4. **No error handling**: Failed deletions are silently ignored
5. **State update race condition**: `moveToTrashCan` updates states individually, causing:
   - `dateNum` gets decremented once per call, but UI might not re-render for each
   - `photosListMiniAllPhotos` gets spliced once per deletion
   - Grid view (`allPhotosForCurrentFetch`) updated per deletion

**Why only 1 photo is removed from UI**:
- `moveToTrashCan` in `usePhotoOperations.js:407-529` handles single photo deletion
- It updates `dateNum` by -1 (Line 430)
- It removes photo from `photosListMiniAllPhotos` at `currentPhotoIndex` (Line 445)
- When multiple photos are deleted in parallel:
  - All deletions try to update states simultaneously
  - React batches state updates, causing race conditions
  - Only the last state update is applied, showing -1 instead of -N

**Current Flow**:
```
deleteFiles() called
  ├─> map() over selection (no await)
  │   ├─> moveToTrashCan(photo1) starts
  │   ├─> moveToTrashCan(photo2) starts
  │   └─> moveToTrashCan(photoN) starts
  ├─> clearPhotoSelection() called immediately
  └─> Each moveToTrashCan updates dateNum[-1] concurrently
      └─> React batches updates, only last -1 is applied
```

### Bug 1: Solution

**Option 1: Create Backend Batch Delete Command** (Recommended)
Follow the pattern used for `restore_from_trash_batch` and `delete_permanently_batch`.

**Backend Changes**:
1. Create `move_to_trash_batch` in `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
async fn move_to_trash_batch(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "trash", "move_to_trash_batch; count={}", paths.len());

    let meta_db = &state.meta_db;
    let trash = trash::Trash::new(state.config.trash_path.to_string());

    // Group photos by date for efficient date_summary update
    let mut date_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut succeeded = 0;
    let mut failed = 0;

    for path_str in paths {
        let photo = photo::Photo::new(file::File::new(path_str.clone()), Option::None);
        let file = file::File::new(path_str.clone());

        // Get photo date before moving to trash
        let photo_meta = meta_db.get_photo_meta(photo.clone());
        let photo_date = photo_meta.photo_time();
        let date_key = if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(&photo_date, "%Y-%m-%d %H:%M:%S") {
            parsed.format("%Y-%m-%d").to_string()
        } else {
            photo_date.split(' ').next().unwrap_or(&photo_date).to_string()
        };

        // Move file to trash
        match file_service::move_to_trash(file, trash.clone()) {
            Ok(_) => {
                // Mark as deleted in DB (set delete_flg = 1)
                meta_db.delete_photo(&photo);
                *date_counts.entry(date_key).or_insert(0) -= 1;
                succeeded += 1;
                log::debug!(target: "trash", "move_to_trash_batch; moved={}", path_str);
            }
            Err(e) => {
                failed += 1;
                log::error!(target: "trash", "move_to_trash_batch; failed={}; error={}", path_str, e);
            }
        }
    }

    // Batch update date_summary
    for (date, count) in date_counts {
        match meta_db.update_date_summary_for_date(&date, count) {
            Ok(_) => {
                log::info!(target: "trash", "move_to_trash_batch; date={}; count_delta={}; status=success", date, count);
            }
            Err(e) => {
                log::error!(target: "trash", "move_to_trash_batch; date={}; count_delta={}; error={}; status=failed", date, count, e);
            }
        }
    }

    log::info!(target: "trash", "move_to_trash_batch; succeeded={}; failed={}", succeeded, failed);
    Ok(format!("Moved {} photos to trash, {} failed", succeeded, failed))
}
```

2. Register command in `invoke_handler` (after `move_to_trash` at line ~3077):
```rust
move_to_trash,
move_to_trash_batch,
```

**Frontend Changes**:
1. Update `DirectoryMenu.jsx:313-321`:
```javascript
async function deleteFiles() {
    if (lockDelete) return;

    if (props.photoSelection.length === 0) {
        props.addFooterMessage('Please select photos first');
        return;
    }

    const count = props.photoSelection.length;
    const confirmed = await confirm(
        `Move ${count} photo${count > 1 ? 's' : ''} to trash?`,
        "Move to Trash"
    );

    if (!confirmed) return;

    try {
        lockDelete = true;

        logger.info('DirectoryMenu', 'move_to_trash_batch_start', 'Moving photos to trash', {
            photoCount: count
        });

        // Use batch command for efficient date_summary update
        const result = await invoke("move_to_trash_batch", { paths: props.photoSelection });

        // Remove deleted photos from current view
        if (props.allPhotosForCurrentFetch && props.setAllPhotosForCurrentFetch) {
            const updatedPhotos = props.allPhotosForCurrentFetch.filter(
                photo => !props.photoSelection.includes(photo.originalPath)
            );
            props.setAllPhotosForCurrentFetch(updatedPhotos);
        }

        // Update grid/list views
        if (props.filteredPhotos && props.setFilteredPhotos) {
            const updatedFiltered = props.filteredPhotos.filter(
                photo => !props.photoSelection.includes(photo.originalPath)
            );
            props.setFilteredPhotos(updatedFiltered);
        }

        props.clearPhotoSelection();
        props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} moved to trash`);

        // Reload current mode to refresh date list and photo counts
        if (props.reloadCurrentModeData) {
            await props.reloadCurrentModeData();
        }

        logger.info('DirectoryMenu', 'photos_moved_to_trash', 'Photos moved to trash successfully', {
            photoCount: count,
            result
        });
    } catch (error) {
        logger.error('DirectoryMenu', 'move_to_trash_failed', 'Failed to move photos to trash', {
            photoCount: count,
            error: error.message
        });
        handleTauriError(error, 'Move to trash');
    } finally {
        lockDelete = false;
    }
}
```

2. Pass required props to DirectoryMenu in `PhotosList.jsx`:
```javascript
<DirectoryMenu
    // ... existing props
    allPhotosForCurrentFetch={allPhotosForCurrentFetch}
    setAllPhotosForCurrentFetch={setAllPhotosForCurrentFetch}
    filteredPhotos={filteredPhotos}
    setFilteredPhotos={setFilteredPhotos}
/>
```

**Option 2: Fix Async/Await in Current Implementation** (Quick fix, less optimal)
```javascript
async function deleteFiles() {
    if (lockDelete) return;
    lockDelete = true;

    try {
        // Sequential deletion to avoid race conditions
        for (const photoPath of props.photoSelection) {
            await props.moveToTrashCan(photoPath);
        }
        props.clearPhotoSelection();
    } finally {
        lockDelete = false;
    }
}
```

**Recommendation**: Use Option 1 (batch command) for consistency with restore/delete operations and better performance.

### Bug 2: Root Cause Analysis

**Location**: `src/App/PhotosList/DirectoryMenu.jsx:348-351`

```javascript
// Reload trash view and date list
if (props.reloadCurrentModeData) {
    await props.reloadCurrentModeData();
}
```

**Location**: `src/App/PhotosList.jsx:1489-1498`

```javascript
async function reloadCurrentModeData() {
    const loader = modeLoaders[viewMode];
    if (loader) {
        await loader();
    }
    // Also refresh date list if needed
    if (props.getDatesNum) {
        await props.getDatesNum();
    }
}
```

**Problems**:
1. **Full data reload**: `modeLoaders[VIEW_MODES.TRASH]` calls `PhotoCollection.fetchPhotos()` which fetches all trash photos again
2. **Inefficient**: Downloading all trash metadata when we only need to remove specific items from current state
3. **DateList not refreshing**: `props.getDatesNum` is undefined (not passed from parent)
4. **Missing state updates**: Restored photos should be removed from `photoCollection.photos` and `filteredPhotos`

**Why DateList doesn't update**:
- `props.getDatesNum` is undefined in PhotosList context
- DateList component doesn't re-render because its props haven't changed
- `dateNum` state in parent (App.jsx) isn't being updated

### Bug 2: Solution

**Create Efficient State Update Function**:

1. Add to `PhotosList.jsx` (around line 1487):
```javascript
// Efficient state update after trash operations (restore/delete)
async function updatePhotosAfterTrashOperation(affectedPaths, operation) {
    logger.info('PhotosList', 'update_after_trash_op', 'Updating photos after trash operation', {
        operation,
        pathCount: affectedPaths.length
    });

    if (operation === 'restore' || operation === 'permanentDelete') {
        // Remove from trash collection
        if (photoCollection && photoCollection.photos) {
            const updatedPhotos = photoCollection.photos.filter(
                p => !affectedPaths.includes(p.originalPath)
            );
            setPhotoCollection({...photoCollection, photos: updatedPhotos});

            logger.debug('PhotosList', 'trash_collection_updated', 'Removed photos from trash view', {
                beforeCount: photoCollection.photos.length,
                afterCount: updatedPhotos.length
            });
        }

        // Update filtered photos
        if (filteredPhotos && filteredPhotos.length > 0) {
            const updatedFiltered = filteredPhotos.filter(
                p => !affectedPaths.includes(p.originalPath)
            );
            setFilteredPhotos(updatedFiltered);
        }
    }

    // Refresh date list counts from backend
    if (props.getDatesNum) {
        await props.getDatesNum();
    }
}
```

2. Pass function to DirectoryMenu in `PhotosList.jsx`:
```javascript
<DirectoryMenu
    // ... existing props
    updatePhotosAfterTrashOperation={updatePhotosAfterTrashOperation}
/>
```

3. Update DirectoryMenu operations:

**For restore** (`DirectoryMenu.jsx:348-351`):
```javascript
// Remove restored photos from trash view efficiently
if (props.updatePhotosAfterTrashOperation) {
    await props.updatePhotosAfterTrashOperation(props.photoSelection, 'restore');
}
```

**For permanent delete** (`DirectoryMenu.jsx:391-394`):
```javascript
// Remove deleted photos from trash view efficiently
if (props.updatePhotosAfterTrashOperation) {
    await props.updatePhotosAfterTrashOperation(props.photoSelection, 'permanentDelete');
}
```

4. Ensure `getDatesNum` is passed to PhotosList from App.jsx:
```javascript
// In App.jsx
<PhotosList
    // ... existing props
    getDatesNum={getDatesNum}
/>
```

### Implementation Order

1. **Fix Bug 1 (Delete Files)** - High Priority
   - [ ] Implement `move_to_trash_batch` backend command
   - [ ] Register command in invoke_handler
   - [ ] Update `deleteFiles()` in DirectoryMenu.jsx
   - [ ] Pass required props to DirectoryMenu
   - [ ] Test with multiple photo selections

2. **Fix Bug 2 (Restore UI Update)** - High Priority
   - [ ] Add `updatePhotosAfterTrashOperation` to PhotosList.jsx
   - [ ] Pass function to DirectoryMenu
   - [ ] Update restore and permanentDelete to use new function
   - [ ] Ensure `getDatesNum` is passed from App.jsx
   - [ ] Test trash restore and delete with multiple photos

3. **Verification** - Critical
   - [ ] Test deleting 2-5 photos: DateList decrements correctly, all photos removed from view
   - [ ] Test restoring 2-5 photos: DateList increments correctly, photos removed from trash
   - [ ] Check backend logs for date_summary updates
   - [ ] Verify no unnecessary data fetches in network tab
   - [ ] Test edge cases: deleting all photos in a date, restoring to empty date

### Architecture Notes

**State Management Flow**:
```
User Action (Delete/Restore Selection)
    ↓
DirectoryMenu.jsx (UI Handler)
    ↓
Backend Batch Command (move_to_trash_batch / restore_from_trash_batch)
    ├─> File Operations (move files)
    ├─> DB Updates (delete_flg changes)
    └─> date_summary Updates (batch by date)
    ↓
Frontend State Updates (updatePhotosAfterTrashOperation)
    ├─> Remove from photoCollection.photos
    ├─> Update filteredPhotos
    └─> Refresh DateList (getDatesNum)
    ↓
UI Re-renders with Updated State
```

**Key Principles**:
1. **Batch Operations**: Group photos by date for single date_summary update per date
2. **Optimistic UI**: Update local state immediately without full reload
3. **Single Source of Truth**: Backend updates DB, frontend reflects changes
4. **Error Handling**: Log errors, show user feedback, maintain consistent state
5. **Performance**: Avoid fetching all data when only removing specific items

### Testing Checklist

**Bug 1 (Delete Files)**:
- [ ] Delete 1 photo: DateList -1, photo removed
- [ ] Delete 2 photos: DateList -2, both removed
- [ ] Delete 5 photos: DateList -5, all removed
- [ ] Delete all photos in a date: Date removed from list
- [ ] Delete with mixed dates: Each date count updates correctly
- [ ] Delete with network error: Error shown, state consistent

**Bug 2 (Restore)**:
- [ ] Restore 1 photo: DateList +1, photo removed from trash
- [ ] Restore 2 photos: DateList +2, both removed from trash
- [ ] Restore 5 photos: DateList +5, all removed from trash
- [ ] Restore to create new date: Date appears in list
- [ ] Restore with mixed dates: Each date count updates correctly
- [ ] Permanent delete: Photos removed from trash, DateList unchanged

**Integration**:
- [ ] Delete then restore: Counts return to original
- [ ] Restore then delete again: Operations work correctly
- [ ] Switch between trash and normal view: State consistent
- [ ] Reload page: DB and UI match
