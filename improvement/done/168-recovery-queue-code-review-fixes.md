# Improvement #168: Recovery Queue Code Review Fixes

Code review fixes for the Recovery Queue feature (improvement-164).

## Priority: Low

These are minor issues that don't affect functionality but should be addressed for code consistency.

---

## Tasks

### 1. Fix Hardcoded Color in Footer.css

**File**: `src/App/Footer.css:34`

**Current**:
```css
#footer-message .clipboard {
  color: greenyellow;
}
```

**Should be**:
```css
#footer-message .clipboard {
  color: var(--color-success);
}
```

---

### 2. Fix Gap Value Without CSS Variable in Footer.css

**File**: `src/App/Footer.css:46`

**Current**:
```css
#footer-message .recovery-warning {
  ...
  gap: 1px;
}
```

**Should be**:
```css
#footer-message .recovery-warning {
  ...
  gap: var(--space-1);  /* Or use 2px if 4px is too large */
}
```

---

### 3. Remove CSS `!important` Overuse in RecoveryQueueModal.css

**File**: `src/App/RecoveryQueueModal.css:58-86`

Refactor to remove `!important` declarations by improving selector specificity or restructuring CSS. Current code has many `!important` flags suggesting CSS specificity issues.

**Example problematic code**:
```css
.recovery-queue-actions button {
    background: var(--color-bg-elevated) !important;
    color: var(--color-text-primary) !important;
    border: 1px solid var(--color-border-default) !important;
}
```

---

### 4. Investigate Duplicate RecoveryQueueModal Rendering in App.jsx

**File**: `src/App.jsx:365, 436, 560`

The modal conditional rendering appears in 3 places:
```jsx
{showRecoveryQueueModal && (
  <RecoveryQueueModal ... />
)}
```

Verify that only one is active at any time, or consolidate to a single render location.

---

### 5. (Optional) Use serde_json for JSON Construction

**File**: `src-tauri/src/commands/recovery_queue_commands.rs:96, 179-181`

**Current**:
```rust
Ok("{\"success\": true}".to_string())
// and
Ok(format!(
    "{{\"total\": {}, \"succeeded\": {}, \"failed\": {}}}",
    total, succeeded, failed
))
```

**Suggested**:
```rust
use serde_json::json;

Ok(serde_json::json!({"success": true}).to_string())
// and
Ok(serde_json::json!({
    "total": total,
    "succeeded": succeeded,
    "failed": failed
}).to_string())
```

---

### 6. (Optional) Add Keyboard Shortcut for RecoveryQueueModal

**File**: `src/App.jsx`

Add `Ctrl+Shift+R` keyboard shortcut for consistency with:
- LogViewer: `Ctrl+Shift+L`
- JobQueue: `Ctrl+Shift+J`

---

## Acceptance Criteria

- [x] No hardcoded colors in CSS files
- [x] CSS variables used consistently for spacing
- [x] `!important` usage minimized or eliminated
- [x] Only one RecoveryQueueModal instance rendered at a time (verified: multiple branches, not duplicates)
- [x] JSON construction using serde_json (optional)
- [x] Keyboard shortcut added (Ctrl+Shift+R)
