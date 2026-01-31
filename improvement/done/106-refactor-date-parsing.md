# Refactor: Extract common date parsing logic in trash operations

## Priority: Medium

## Background
Code review of improvement-105 revealed code duplication in trash batch operations.
Both `move_to_trash_batch` and `restore_from_trash_batch` have identical date parsing logic.

## Current Issue
The same date parsing code appears in two places (DRY violation):
- `src-tauri/src/lib.rs:1951-1957` (move_to_trash_batch)
- `src-tauri/src/lib.rs:2045-2051` (restore_from_trash_batch)

```rust
let date_key = date::Date::try_from_string(&photo_date, Some("-"))
    .or_else(|_| date::Date::try_from_string(&photo_date, Some("/")))
    .map(|d| d.to_string())
    .unwrap_or_else(|_| {
        photo_date.replace('/', "-").split(' ').next().unwrap_or(&photo_date).to_string()
    });
```

## Solution
Extract common logic into a helper function:

```rust
/// Parse photo date string to normalized date key (YYYY-MM-DD format)
/// Handles both YYYY-MM-DD and YYYY/MM/DD formats
fn parse_photo_date_to_key(photo_date: &str) -> String {
    date::Date::try_from_string(photo_date, Some("-"))
        .or_else(|_| date::Date::try_from_string(photo_date, Some("/")))
        .map(|d| d.to_string())
        .unwrap_or_else(|_| {
            photo_date.replace('/', "-").split(' ').next().unwrap_or(photo_date).to_string()
        })
}
```

## Implementation Steps
1. Add helper function in `src-tauri/src/lib.rs` (near trash operation functions)
2. Replace duplicated code in `move_to_trash_batch` with function call
3. Replace duplicated code in `restore_from_trash_batch` with function call
4. Test both operations to ensure behavior is unchanged

## Files to Change
- `src-tauri/src/lib.rs`

## Testing
- Delete photos and verify date_summary updates
- Restore photos and verify date_summary updates
- Test with photos that have different date formats (YYYY-MM-DD and YYYY/MM/DD)

## Benefits
- Reduced code duplication
- Easier maintenance (single point of change)
- Follows DRY principle
