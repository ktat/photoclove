# Improvement WorkFlow

If I say "do improvement", do the following.

Read files under `improvement/*.md` order by file name as int.
And then do the task in the file.
Before starting task, do current steps

1. create branch `improvement-#-summary` (ex. `improvement-10-improve-ui`) from current branch
2. read the docs/feature-documentation-index.md. and read related document and source code.
3. rename the `$num.md` to `$num-summary.md`.

When you finished task, `*.md` file which you did should be moved to `improvement/done` directory.
At last commit your changes to the branch.

If `improvement/*.md` are left, repeat this step and clear context if "keep context" is not written at the last line of `*.md` file.

# Update Document WorkFlow

If I say "update docs", do the following.

Read "docs/.current-docs-sha" and get commit sha hash.
Check difference from it to latest, update document under docs and README\*.md.
After finishing document update, commit your changes and update "docs/.current-docs-sha" with latest commit sha hash and then commit "docs/.current-docs-sha" at last.

Note that: You carefully check whether the update of docs/feature-documentation-index.md is required or not.

# Compile check

If I say `compile check`, do the follwoing.

You should check `cd src-tauri/src/` and `cargo check` when you change `*.rs` files.

# Logging Rules

When implementing logging in the codebase:

## Frontend Logging
- Use the structured `logger` service from `src/services/LoggerService.js`
- Import: `import { logger } from '../services/LoggerService.js';`
- Pattern: `logger.level('ComponentName', 'event_name', 'Description', { data })`
- Example: `logger.info('PhotosList', 'search_triggered', 'User initiated search', { query, filters })`
- Avoid direct `console.log/warn/error` calls - use the structured logger instead

## Backend Logging
- Use Rust's `log` macros with structured format in semicolon-separated key=value pairs
- Pattern: `log::level!(target: "component", "event; key1={}; key2={}", value1, value2)`
- Always include `correlation_id` when available for request tracing
- Example: `log::info!(target: "search", "search_request; correlation_id={}; query={}", correlation_id, query)`

## LogViewer Integration
- All logs are automatically collected and viewable in LogViewer.jsx
- Frontend logs: stored in memory via LoggerService
- Backend logs: written to daily files and retrieved via `get_logs` command
- Use structured logging to enable proper filtering and search in LogViewer

# Bug Investigation

## First-Click Bug Solution (Fixed 2025-07-20)

**Problem**: "No Photo Found!" displayed on first date/Recent Photos click after app startup.  
**Root Cause**: Null reference error in logging code (`config.fetch_method` when `config` is null).  
**Solution**: Use optional chaining in PhotosList.jsx:873:

```javascript
fetchMethod: config?.fetch_method || fetchConfig?.fetch_method || 'unknown',
```

**Lesson**: Logging errors can prevent state updates. Always use defensive programming in logging code.

## Investigation Process

1. **Check logs first**: `~/.local/share/photoclove/logs/`
2. **Trace data flow**: User Action → State → Backend → Response → UI
3. **Use optional chaining** for null-safe property access
4. **Investigate systematically**, avoid repeated fixes

# Terms & Source Code Reference

For effective communication about PhotoClove features and implementation:

- **Use terms document**: Refer to `docs/terms.doc` for standard terminology and source code mappings
- **Find implementation quickly**: Use the Term → File mapping to locate where features are implemented
- **Consistent naming**: Use the documented terms when discussing features, components, and concepts
- **Example**: Instead of saying "photo grid component", use "PhotosList" and reference `src/App/PhotosList.jsx`

When working on features:
1. Check `docs/terms.doc` for the correct term and file location
2. Use the documented patterns (e.g., `toggle*()` for UI state, `use*()` for hooks)
3. Follow the source code structure shown in the mappings

# Improvement Discussion

When I say `dicussion`, create new `imporvement/$number.md` file.
`$number` is determined from the file under improvement/done/.

I suggest to you new feature. do discussion about it.

- carefuly consider about the influence of the new feature to exiting futures.
- How do you implement the task?
- Which source code you will change
