# Fix: Add logging and remove unused parameter in trash photo meta

## Priority: Low

## Background
Code review found two minor issues in `new_from_photo_info_from_trash()`.

## Issues

### 1. Unused Parameter
```rust
pub fn new_from_photo_info_from_trash(
    record: &meta_db::PhotoInfo,
    trash_path: &str,
    _library_path: &str  // ← This parameter is never used
) -> Option<PhotoMeta>
```

The `_library_path` parameter is prefixed with `_` indicating it's intentionally unused, but if it's truly not needed, it should be removed.

### 2. Missing Debug Logging
When a file is not found in trash, the function silently returns None without logging:
```rust
if f.is_none() {
    return None;  // ← No logging
}
```

This makes debugging difficult when photos are missing from trash.

## Solution

### Remove Unused Parameter
If `library_path` is truly not needed:
```rust
pub fn new_from_photo_info_from_trash(
    record: &meta_db::PhotoInfo,
    trash_path: &str
) -> Option<PhotoMeta>
```

Update all call sites:
- `src-tauri/src/repository/meta_db/sqlite.rs`
- `src-tauri/src/lib.rs`

### Add Logging
```rust
let f = file::File::new_if_exists(trash_file_path.clone());
if f.is_none() {
    log::warn!(
        target: "photo_meta",
        "trash_file_not_found; path={}; original_path={}",
        trash_file_path,
        record.path
    );
    return None;
}
```

## Implementation Steps
1. Check if `library_path` is needed for any future use
   - If not, remove parameter from function signature
   - Update all call sites
2. Add logging when file not found in trash
3. Test with missing files to verify logging works

## Files to Change
- `src-tauri/src/entity/photo_meta.rs`
- `src-tauri/src/repository/meta_db/sqlite.rs` (if removing parameter)
- `src-tauri/src/lib.rs` (if removing parameter)

## Testing
- Delete a file from trash directory manually
- Try to view trash mode
- Verify warning is logged

## Benefits
- Cleaner function signature (if parameter removed)
- Better debugging when files are missing
- Follows logging best practices
