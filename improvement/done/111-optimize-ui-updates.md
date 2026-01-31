# Optimize UI Updates for Delete/Restore Operations

## Priority: High

## Background
Current implementation calls `getDates()` or `reloadCurrentModeData()` after delete/restore operations, which refetches all data from backend. This is inefficient and causes unnecessary network traffic.

## Current Issues

### Issue 1: Excessive Data Fetching
After delete or restore operations:
```javascript
// DirectoryMenu.jsx
if (props.reloadCurrentModeData) {
    await props.reloadCurrentModeData();  // Fetches ALL trash/date photos again
}

// PhotosList.jsx - updatePhotosAfterTrashOperation
if (props.getDatesNum) {
    await props.getDatesNum();  // Fetches ALL dates and counts
}
```

Problems:
- **Inefficient**: Refetches all data when we only need to update counts
- **Slow**: Noticeable delay for large photo libraries
- **Unnecessary**: We already know which dates were affected and by how much

### Issue 2: State Management Complexity
Current approach mixes data fetching with state updates, making it hard to:
- Track what changed
- Optimize performance
- Debug issues
- Test components

## Solution: Local State Updates Only

### Approach 1: Calculate Date Count Changes Locally

Instead of refetching, calculate the changes:

```javascript
// In DirectoryMenu.jsx - after batch delete/restore
async function updateLocalDateCounts(affectedPaths, delta) {
    // Group by date
    const dateChanges = new Map();

    for (const path of affectedPaths) {
        // Get photo from current collection
        const photo = props.allPhotosForCurrentFetch?.find(p => p.originalPath === path);
        if (photo?.date) {
            const dateKey = photo.date.split(' ')[0]; // Extract YYYY-MM-DD
            dateChanges.set(dateKey, (dateChanges.get(dateKey) || 0) + delta);
        }
    }

    // Update dateNum state directly
    if (props.dateNum && props.setDateNum) {
        const updatedDateNum = {...props.dateNum};
        for (const [dateKey, change] of dateChanges) {
            if (updatedDateNum[dateKey]) {
                updatedDateNum[dateKey] += change;
                if (updatedDateNum[dateKey] <= 0) {
                    delete updatedDateNum[dateKey];
                }
            }
        }
        props.setDateNum(updatedDateNum);
    }
}

// Usage
await invoke("move_to_trash_batch", { paths: props.photoSelection });
await updateLocalDateCounts(props.photoSelection, -1); // Decrement
// No getDates() call needed!
```

### Approach 2: Backend Returns Date Changes

Modify batch operations to return affected dates and counts:

```rust
// Backend: src-tauri/src/lib.rs
#[derive(Serialize)]
struct BatchResult {
    succeeded: usize,
    failed: usize,
    date_changes: HashMap<String, i32>,  // date -> count delta
}

#[tauri::command]
async fn move_to_trash_batch(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // ... existing code ...

    // Return structured result with date changes
    let result = BatchResult {
        succeeded,
        failed,
        date_changes: date_counts,  // Already calculated
    };

    Ok(serde_json::to_string(&result)?)
}
```

```javascript
// Frontend: DirectoryMenu.jsx
const resultStr = await invoke("move_to_trash_batch", { paths });
const result = JSON.parse(resultStr);

// Apply date changes directly
if (props.dateNum && props.setDateNum) {
    const updatedDateNum = {...props.dateNum};
    for (const [date, delta] of Object.entries(result.date_changes)) {
        updatedDateNum[date] = (updatedDateNum[date] || 0) + delta;
        if (updatedDateNum[date] <= 0) {
            delete updatedDateNum[date];
        }
    }
    props.setDateNum(updatedDateNum);
}
```

## Implementation Steps

### Step 1: Modify Backend (Approach 2 - Recommended)
1. Update batch operation return types in `src-tauri/src/lib.rs`:
   - `move_to_trash_batch`
   - `restore_from_trash_batch`
   - `delete_permanently_batch`
2. Return `BatchResult` with date_changes
3. Test backend returns correct date changes

### Step 2: Update Frontend
1. Parse batch operation results
2. Update `dateNum` state directly using returned date_changes
3. Remove `getDates()` and `reloadCurrentModeData()` calls
4. Update PhotosList to pass `dateNum` and `setDateNum` to DirectoryMenu

### Step 3: Verification
1. Test delete: date counts update without refetch
2. Test restore: date counts update without refetch
3. Monitor network tab: no `get_dates` calls after operations
4. Verify counts match database

## Files to Change
- `src-tauri/src/lib.rs`: Update batch operation return types
- `src/App/PhotosList/DirectoryMenu.jsx`: Update operation handlers
- `src/App/PhotosList.jsx`: Pass dateNum/setDateNum props
- `src/App.jsx`: Ensure dateNum state is accessible

## Benefits
- **Performance**: No unnecessary backend calls
- **Responsiveness**: Instant UI updates
- **Scalability**: Works efficiently with large libraries
- **Simplicity**: Clear data flow

## Testing
1. Delete 5 photos from same date: count updates instantly
2. Delete photos from multiple dates: all counts update
3. Restore photos: counts increment correctly
4. Network monitor: verify no get_dates calls
5. Reload page: verify counts match database

---

keep context
