# Common Mistakes in PhotoClove Development

This document lists the most frequently occurring issues found through session analysis of the PhotoClove project.

## Top 20 Most Common Issues

### Critical Issues (10+ sessions)

#### 1. **Hardcoded CSS Values Instead of Variables**
Most frequent issue across all sessions.
```javascript
// ❌ BAD
style={{ color: '#666', fontSize: '14px', padding: '8px' }}

// ✅ GOOD
style={{ 
  color: 'var(--color-text-muted)', 
  fontSize: 'var(--font-size-base)',
  padding: 'var(--space-2)'
}}
```

#### 2. **File Size Exceeding 600 Lines**
Current violations:
- `src/App/PhotosList.jsx` (1400+ lines)
- `src-tauri/src/lib.rs` (2600+ lines)
- `src-tauri/src/repository/meta_db/sqlite/collections.rs` (685 lines)

#### 3. **Using console.log / println! Instead of Structured Logging**
```javascript
// ❌ BAD
console.log('Error:', error);

// ✅ GOOD
import { logger } from '../services/LoggerService';
logger.error('ComponentName', 'operation_failed', 'Error message', { error });
```

```rust
// ❌ BAD
println!("Processing file: {}", path);

// ✅ GOOD
log::info!(target: "file_processor", "processing_file; path={}", path);
```

#### 4. **Recreating Existing Utils**
Before implementing any utility function, check:
- `src/utils/FileUtils.js`
- `src/utils/DateUtils.js`
- `src/utils/StringUtils.js`
- `src/utils/PathUtils.js`
- `src/utils/ShareUtils.js`

#### 5. **Direct State Mutation (React)**
```javascript
// ❌ BAD
config.items.push(newItem);
setConfig(config);

// ✅ GOOD
setConfig(prev => ({
  ...prev,
  items: [...prev.items, newItem]
}));
```

### High Frequency Issues (5-10 sessions)

#### 6. **Not Using Unified Search API**
- Check if `unified_search` command exists before implementing custom search
- Avoid creating separate search implementations for each feature

#### 7. **Recreating Similar Components**
Common duplications:
- Modal dialogs
- Loading spinners
- Dropdown menus
- Error displays
- Empty states

#### 8. **Duplicating Timestamp Generation**
```rust
// ❌ BAD - Repeated in multiple places
let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

// ✅ GOOD - Use DateTime Value Object or utility
use crate::domain::value_objects::DateTime;
let now = DateTime::now().to_timestamp_string();
```

#### 9. **Incorrect Lock Management**
```javascript
// ❌ BAD
function Component() {
  let isProcessing = false; // Reset on every render!
  
// ✅ GOOD
function Component() {
  const isProcessingRef = useRef(false);
```

#### 10. **Incorrect useEffect Dependencies**
```javascript
// ❌ BAD - Missing dependencies
useEffect(() => {
  fetchData(userId);
}, []); // userId missing!

// ✅ GOOD
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

### Medium Frequency Issues (3-5 sessions)

#### 11. **Duplicating Entity Construction Logic**
Photo entity construction appears in multiple places with slight variations.

#### 12. **Redefining Common Helper Functions**
- `formatFileSize()` - Use FileUtils
- `formatDate()` - Use DateUtils  
- `truncateString()` - Use StringUtils
- `joinPaths()` - Use PathUtils

#### 13. **Direct DOM Manipulation**
```javascript
// ❌ BAD
document.getElementById('modal').style.display = 'none';

// ✅ GOOD
const [isModalOpen, setIsModalOpen] = useState(false);
```

#### 14. **Excessive unwrap() / panic! Usage (Rust)**
```rust
// ❌ BAD
let result = operation().unwrap();

// ✅ GOOD
let result = operation()
    .map_err(|e| format!("Operation failed: {}", e))?;
```

#### 15. **Hardcoded Margins/Padding**
```css
/* ❌ BAD */
margin: 8px;
padding: 16px 24px;

/* ✅ GOOD */
margin: var(--space-2);
padding: var(--space-4) var(--space-6);
```

### Low Frequency Issues (1-3 sessions)

#### 16. **Insufficient Test Coverage**
- Only 2 unit tests in `src/test/`
- No integration tests
- No e2e tests

#### 17. **Missing Accessibility Features**
- Missing ARIA labels
- Keyboard navigation incomplete
- Focus management issues

#### 18. **Unhandled Promise Rejections**
```javascript
// ❌ BAD
invoke('command').then(handleSuccess);

// ✅ GOOD
invoke('command')
  .then(handleSuccess)
  .catch(error => {
    logger.error('Component', 'command_failed', 'Command failed', { error });
  });
```

#### 19. **Inconsistent Commit Messages**
Missing Claude signature format:
```
feat: Add new feature

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

#### 20. **Not Using Value Object Pattern**
Using primitive types directly instead of domain value objects for:
- Timestamps
- File paths
- User IDs
- Collection IDs

## Common "Reinventing the Wheel" Patterns

### Utils That Often Get Recreated

1. **File Operations**
   - `getFileExtension()` → Use `FileUtils.getExtension()`
   - `formatBytes()` → Use `FileUtils.formatSize()`
   - `getMimeType()` → Use `FileUtils.getMimeType()`

2. **Date/Time Operations**
   - `formatDate()` → Use `DateUtils.format()`
   - `getRelativeTime()` → Use `DateUtils.relative()`
   - `parseDate()` → Use `DateUtils.parse()`

3. **String Operations**
   - `truncate()` → Use `StringUtils.truncate()`
   - `capitalize()` → Use `StringUtils.capitalize()`
   - `slugify()` → Use `StringUtils.slugify()`

4. **Array/Object Operations**
   - `groupBy()` → Use existing lodash or utils
   - `sortBy()` → Use existing implementation
   - `unique()` → Use Set or existing util

### UI Components That Often Get Duplicated

1. **Modals**
   - Check `src/components/modals/` first
   - Use `Modal` base component

2. **Loading States**
   - Use `PhotoLoading` component
   - Don't create custom spinners

3. **Error Displays**
   - Use consistent error UI pattern
   - Check existing error components

4. **Empty States**
   - Use `EmptyState` component
   - Don't create custom "no data" displays

## Prevention Strategies

1. **Before implementing anything**, search for:
   - Existing utils with similar names
   - Components with similar functionality
   - Patterns in nearby code

2. **Use IDE search** (Cmd/Ctrl + Shift + F) for:
   - Function names you're about to create
   - CSS classes you're about to define
   - API endpoints you're about to implement

3. **Check these directories first**:
   - `/src/utils/` - Utility functions
   - `/src/components/` - Reusable components
   - `/src/hooks/` - Custom React hooks
   - `/src/services/` - Service layers

4. **Ask yourself**:
   - "Has someone solved this before?"
   - "Is this too generic to be the first time?"
   - "Should this be in utils?"

## References

- CLAUDE.md - Top 5 issues and general guidelines
- docs/terms.md - Standard terminology and file locations
- src/styles/base.css - All CSS variables