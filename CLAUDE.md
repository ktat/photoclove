# Improvement WorkFlow

If I say "do improvement", do the following.

Read files under `improvement/*.md` order by file name as int.
And then do the task in the file.
Before starting task, do current steps

1. create branch `improvement-#-summary` (ex. `improvement-10-improve-ui`) from current branch
2. read the docs/feature-documentation-index.md. and read related document and source code.
3.  re-write the md file to include the following:
    - How do you implement the task? 
    - Which source code you will change
4. review document using another claude agent

When you finished task, `*.md` file which you did should be moved to `improvement/done` directory.
At last commit your changes to the branch if my permission is got.

If `improvement/*.md` are left, repeat this step and clear context if "keep context" is not written at the last line of `*.md` file.

ultra think

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
