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
5. rename the `$num.md` to `$num-summary.md`. 

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

# Bug Investigation

## Log Files Location

Log files are under the following directory for bug investigation:

- ~/.local/share/photoclove/logs/

## Bug Investigation Methodology

Based on lessons learned, follow this systematic approach to avoid trial-and-error fixes:

### 1. Problem Documentation
- **Exact symptoms**: Record precise behavior, not assumptions
- **Reproduction steps**: Document exact steps to reproduce the issue
- **Environment state**: Note initial conditions (first launch, after restart, etc.)
- **Expected vs actual behavior**: Clear comparison

### 2. Data Flow Analysis
Follow the complete data flow systematically:
```
User Action → State Update → Component Props → Data Processing → UI Display
```

**For display issues, check in order:**
1. **UI State**: Component visibility conditions, props, context values
2. **Data Fetching**: API calls, backend responses, error handling
3. **State Management**: useEffect dependencies, state update timing
4. **Rendering Logic**: Component display conditions, conditional rendering

### 3. Log-Driven Investigation
- **Backend logs**: Check `~/.local/share/photoclove/logs/photoclove-*.log` for API responses
- **Frontend logs**: Check `~/.local/share/photoclove/logs/photoclove-frontend-*.log` for UI state
- **Correlation analysis**: Match backend success with frontend display issues

### 4. Component Architecture Review
**For React components, verify:**
- Display/hide conditions (`display: "none"`, conditional rendering)
- Props flow from parent to child components
- State management (Context, useState, useEffect)
- Event handlers and state update calls

### 5. Hypothesis Formation
- Base hypotheses on log data and component analysis, not assumptions
- Test one specific hypothesis at a time
- Use minimal test cases to validate hypotheses

### 6. Targeted Fix
- Address the root cause identified through investigation
- Make the minimal necessary change
- Avoid shotgun debugging (multiple simultaneous changes)

## Common Issue Patterns

### Display Issues
1. **Check component visibility conditions first**
   - Conditional rendering logic
   - CSS display properties
   - Parent component state
2. **Verify data flow**
   - Props passing
   - State updates
   - useEffect dependencies

### Timing Issues
1. **State update timing**
   - useEffect dependency arrays
   - Async operation completion
   - Component lifecycle timing
2. **Data synchronization**
   - Backend response timing
   - Frontend state update delays

### State Management Issues
1. **Context state**
   - Initial values vs runtime values
   - State update functions
   - Provider scope
2. **Local state**
   - useState initial values
   - State update batching
   - useEffect cleanup

## Investigation Tools

- `grep` for searching logs and codebase patterns
- Browser DevTools for frontend state inspection
- Backend logs for API response verification
- Component props debugging with logging statements

## Adding Effective Debug Logging

When existing logs are insufficient, add targeted logging strategically:

### Frontend Logging Strategy
```javascript
// State transition logging
logger.debug('ComponentName', 'state_change', 'State updated', {
  before: previousState,
  after: newState,
  trigger: 'user_action_name'
});

// Conditional rendering decisions
logger.debug('ComponentName', 'render_decision', 'Component visibility check', {
  condition: conditionValue,
  willRender: !!conditionValue,
  props: relevantProps
});

// Event handler execution
logger.debug('ComponentName', 'event_handler', 'User interaction', {
  event: 'click',
  target: 'button_name',
  currentState: state
});
```

### Backend Logging Strategy
```rust
// Request processing
log::info!(target: "component", "request_start; correlation_id={}; action={}", correlation_id, action);

// Data validation and transformation
log::debug!(target: "component", "data_validation; correlation_id={}; input={}; valid={}", 
           correlation_id, input, is_valid);

// Response preparation
log::info!(target: "component", "response_ready; correlation_id={}; result_count={}; success={}", 
          correlation_id, results.len(), success);
```

### Logging Placement Guidelines

**Add logs at these critical points:**
1. **State boundaries**: Before/after state changes
2. **Conditional branches**: Document which path was taken and why
3. **Async operations**: Start, completion, and error states
4. **Component lifecycle**: Mount, unmount, prop changes
5. **User interactions**: Click handlers, form submissions
6. **Data transformations**: Input validation, format conversion

### Temporary Debug Logging

For investigation purposes, add temporary detailed logging:

```javascript
// Temporary: Debug state flow issue
console.group('🐛 DEBUG: State Flow Investigation');
console.log('Current State:', { currentDate, recentPhotosMode, showPhotosList });
console.log('Props:', props);
console.log('Computed Values:', { fetchConfig, willRender });
console.groupEnd();
```

**Remove temporary logs** after issue resolution to avoid log pollution.

### Log Analysis Tips

- **Use correlation IDs** to trace requests across frontend/backend
- **Filter by component** to focus on specific areas
- **Search for error patterns** using grep with log levels
- **Timeline analysis** to identify timing issues

Remember: **Investigate first, hypothesize second, fix last**. Add logs strategically to fill knowledge gaps, not scatter them randomly.

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
