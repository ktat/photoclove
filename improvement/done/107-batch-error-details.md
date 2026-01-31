# Enhance: Return detailed error information in batch operations

## Priority: Medium

## Background
Code review of improvement-105 identified that batch operations only return a summary message.
When some files fail, users don't know which specific files failed.

## Current Issue
Batch operations return only success/failure counts:
```rust
Ok(format!("Moved {} photos to trash, {} failed", succeeded, failed))
```

This makes it difficult to:
- Retry failed operations
- Debug issues
- Provide detailed feedback to users

## Solution
Return structured result with failed file details:

```rust
#[derive(Serialize)]
struct BatchOperationResult {
    succeeded: usize,
    failed: usize,
    failed_paths: Vec<String>,
    message: String,
}
```

## Implementation Steps
1. Define `BatchOperationResult` struct in `src-tauri/src/lib.rs`
2. Track failed paths during batch operations:
   ```rust
   let mut failed_paths = Vec::new();
   // In error case:
   failed_paths.push(path_str.clone());
   ```
3. Return structured result:
   ```rust
   Ok(serde_json::to_string(&BatchOperationResult {
       succeeded,
       failed,
       failed_paths,
       message: format!("Moved {} photos, {} failed", succeeded, failed)
   })?)
   ```
4. Update frontend to parse and display failed paths
5. Consider adding retry functionality for failed files

## Files to Change
Backend:
- `src-tauri/src/lib.rs`: Update batch operation functions

Frontend:
- `src/App/PhotosList/DirectoryMenu.jsx`: Parse result and show details
- Consider creating a modal to show failed files with retry option

## Testing
- Batch delete with some files locked/in-use (should fail)
- Verify failed file paths are returned
- Test retry functionality (if implemented)

## Benefits
- Better user experience (know what failed)
- Easier debugging
- Enables retry functionality
- More professional error handling

## Optional Enhancement
Add progress callback for large batch operations:
```rust
async fn move_to_trash_batch_with_progress(
    paths: Vec<String>,
    progress_callback: impl Fn(usize, usize),
    state: tauri::State<'_, AppState>,
) -> Result<String, String>
```
