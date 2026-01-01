# CLAUDE.md - PhotoClove Development Guidelines

## 📋 General Development Rules (Apply to ALL Tasks)

### 1. Logging Standards

When implementing logging in the codebase:

#### Frontend Logging

- Never use console.log
- Use the structured `logger` service from `src/services/LoggerService.js`
- Import: `import { logger } from '../services/LoggerService.js';`
- Pattern: `logger.level('ComponentName', 'event_name', 'Description', { data })`
- Example: `logger.info('PhotosList', 'search_triggered', 'User initiated search', { query, filters })`
- Avoid direct `console.log/warn/error` calls - use the structured logger instead

#### Backend Logging
- Nerver use `print!`, `println!` etc.
- Use Rust's `log` macros with structured format in semicolon-separated key=value pairs
- Pattern: `log::level!(target: "component", "event; key1={}; key2={}", value1, value2)`
- Always include `correlation_id` when available for request tracing
- Example: `log::info!(target: "search", "search_request; correlation_id={}; query={}", correlation_id, query)`

#### LogViewer Integration
- All logs are automatically collected and viewable in LogViewer.jsx
- Frontend logs: stored in memory via LoggerService
- Backend logs: written to daily files and retrieved via `get_logs` command
- Use structured logging to enable proper filtering and search in LogViewer

### 2. Code Style & Patterns

#### Terms & Source Code Reference
For effective communication about PhotoClove features and implementation:

- **Use terms document**: Refer to `docs/terms.md` for standard terminology and source code mappings
- **Find implementation quickly**: Use the Term → File mapping to locate where features are implemented
- **Consistent naming**: Use the documented terms when discussing features, components, and concepts
- **Example**: Instead of saying "photo grid component", use "PhotosList" and reference `src/App/PhotosList.jsx`

When working on features:
1. Check `docs/terms.md` for the correct term and file location
2. Use the documented patterns (e.g., `toggle*()` for UI state, `use*()` for hooks)
3. Follow the source code structure shown in the mappings

#### UI Theme & Color Guidelines
**PhotoClove is a dark theme application**. Follow these strict color rules:

- **Background colors**: Always use dark colors (e.g., `var(--bg)`, `var(--bg-elevated)`, `#1f2937`, `#374151`)
- **Text colors**: Always use light colors for text (e.g., `var(--text)`, `#e4e4e4`, `#f9fafb`)
- **Light colors prohibition**: NEVER use light colors (white, light gray) for large areas or backgrounds
- **Light color usage**: Light colors can ONLY be used for:
  - Small accents (buttons, highlights, icons)
  - Active/selected states
  - Focus indicators
  - Small UI elements that need emphasis
- **CSS Variables**: Always prefer CSS variables over hardcoded colors:
  - `var(--bg)` for main background
  - `var(--bg-elevated)` for elevated surfaces
  - `var(--text)` for text
  - `var(--border)` for borders
  - `var(--accent)` for accent colors
- **Hardcoded colors to avoid**: Never use `white`, `#fff`, `#ffffff`, `#f5f5f5`, `#fafafa` for backgrounds

### 3. Testing & Validation
- Run `cargo check` for Rust changes in `src-tauri/src/`
- Verify with appropriate test commands
- Check neighboring files for conventions and patterns

### 4. Code Quality Standards
- **DDD Architecture**: Prioritize Domain-Driven Design - separate business logic into domain layers, use repositories for data access, and maintain clear boundaries between layers
- **DRY Principle**: Don't Repeat Yourself - extract common logic into reusable functions, components, or modules
- **File Length Limit**: Keep each file under 600 lines - split large files into smaller, focused modules
- **Task Verification**: After implementing code changes, compare the implementation with the original task requirements. If any features are missing or incomplete, create subtasks to address them

### 5. Important Reminders
- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## 🔧 Context-Specific Guidelines

### Database Migration Implementation

#### Album Tables Migration
**File**: `src-tauri/src/repository/meta_db/sqlite.rs`

##### Migration Pattern
PhotoClove uses a proper database migration system that checks for table existence before creation. All new tables should follow this pattern:

```rust
// Check if table exists
let table_exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='table_name'")
    .and_then(|mut stmt| {
        stmt.query_row([], |row| {
            let _name: String = row.get(0)?;
            Ok(true)
        })
    })
    .unwrap_or(false);

if !table_exists {
    log::info!(target: "component", "table_creation; status=creating_table");
    
    // Create table with full schema
    conn.execute("CREATE TABLE table_name (...)", [])?;
    
    // Create indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_name ON table_name(column)", [])?;
    
    log::info!(target: "component", "table_creation; status=completed");
}
```

##### Album Tables Implementation
**Location**: Lines 644-718 in `init_db()` function

**Tables Created**:
1. **`albums`**: Stores album metadata (id, name, description, cover_photo_path, timestamps)
2. **`album_photos`**: Junction table for album-photo relationships (album_id, photo_path, added_at, order_index)

**Key Features**:
- **Conditional creation**: Only creates tables if they don't exist
- **Proper foreign keys**: Maintains referential integrity with photo_metadata table
- **Performance indexes**: Optimized queries for album operations
- **Structured logging**: Clear migration progress tracking
- **Error handling**: Proper Result<()> return types, no silent failures

**Migration Triggers**:
- App startup calls `init_db()`
- Tables created automatically if missing
- Existing installations get tables on next app start
- No data loss or conflicts with existing databases

##### Best Practices
When adding new tables:

1. **Follow the pattern**: Use `sqlite_master` existence check
2. **Add proper logging**: Use structured logging with correlation info
3. **Include indexes**: Add performance indexes during creation
4. **Handle errors**: Use Result types, avoid silent failures
5. **Test thoroughly**: Verify migration works on fresh and existing databases

##### Migration Benefits
- **Automatic**: No manual database setup required
- **Safe**: Checks existence before creation, prevents conflicts
- **Traceable**: Comprehensive logging for debugging
- **Consistent**: Follows established patterns used by other tables
- **Maintainable**: Clear, readable migration code

This migration system ensures album functionality works reliably across all user installations.

### Bug Investigation

#### First-Click Bug Solution (Fixed 2025-07-20)
**Problem**: "No Photo Found!" displayed on first date/Recent Photos click after app startup.  
**Root Cause**: Null reference error in logging code (`config.fetch_method` when `config` is null).  
**Solution**: Use optional chaining in PhotosList.jsx:873:

```javascript
fetchMethod: config?.fetch_method || fetchConfig?.fetch_method || 'unknown',
```

**Lesson**: Logging errors can prevent state updates. Always use defensive programming in logging code.

#### Investigation Process
1. **Check logs first**: `~/.local/share/photoclove/logs/`
2. **Trace data flow**: User Action → State → Backend → Response → UI
3. **Use optional chaining** for null-safe property access
4. **Investigate systematically**, avoid repeated fixes

### Debugging Full-Stack Issues

#### Key Principles (Learned from Date Count Bug - 2025-12-22)

When debugging issues that span frontend and backend:

##### 1. **Don't Assume One Side is Correct**
- ❌ BAD: "Backend works, fix the frontend"
- ✅ GOOD: Investigate both frontend AND backend
- **Example**: Date count update issue was in backend date calculation, not frontend state management

##### 2. **Compare Working vs Non-Working Code**
- If user says "X works but Y doesn't", **compare their implementations carefully**
- **Example**: `move_to_trash` (single, working) vs `move_to_trash_batch` (batch, broken)
- Look for differences in:
  - How data is retrieved
  - How dates/values are calculated
  - What parameters are passed

##### 3. **Pay Attention to Log Inconsistencies**
- Date/time format mismatches (e.g., `2025-12-22` vs `2023/05/04`)
- Value type differences (string vs number, different delimiters)
- **These are red flags pointing to the real problem**

##### 4. **Prefer Simplification Over Addition**
- ❌ BAD: Add more handlers, props, state management
- ✅ GOOD: Find and fix the root cause
- **Before adding code, ask**: "Can I fix this by simplifying existing code?"

##### 5. **Check Entity/Domain Logic First**
- Issues with data often originate in domain entities (Photo, Date, etc.)
- Check how entities calculate/derive their properties
- **Example**: Photo's date calculation method had inconsistencies

#### Debugging Checklist for "Feature X Not Working"

1. **Identify Working vs Non-Working Scenarios**
   - What works? What doesn't?
   - Compare their code paths

2. **Check Both Ends**
   ```
   Frontend: State → Handler → API Call
   Backend: Command → Entity → Repository → Database
   ```

3. **Look for Format/Type Mismatches**
   - Check logs for inconsistent data formats
   - Verify data types match expectations

4. **Find the Simplest Fix**
   - Can you fix it in the entity/domain layer?
   - Can you unify duplicated logic?
   - Can you remove code instead of adding?

5. **Test the Theory**
   - Add targeted console.log/log::debug to verify hypothesis
   - Compare actual vs expected values at each step

#### When to Check Backend vs Frontend

**Check Backend When:**
- Data format inconsistencies in logs
- Single operation works but batch doesn't (or vice versa)
- Issue involves dates, calculations, or data transformations
- Same frontend code worked before (backend might have changed)

**Check Frontend When:**
- UI doesn't update despite correct API responses
- State management issues (useEffect, deps arrays)
- Event handlers not firing
- Props not passed correctly

**Check Both When:**
- Complete feature not working
- Unclear where the problem originates
- Logs show data flowing but results are wrong
