# Improvement #133: Fix useEffect Dependencies and Direct Mutations

## Goal
Fix React best practices violations in PhotosList.jsx and related hooks:
1. Correct useEffect dependency arrays
2. Eliminate direct state mutations
3. Follow React's immutability principles

## Background
- useEffect hooks with incorrect dependencies cause bugs and stale closures
- Direct state mutations (e.g., `array.push()`, `object.field = value`) violate React's immutability contract
- These issues can cause subtle bugs that are hard to debug

## Current Issues

### 1. Missing Dependencies in useEffect
**Problem**: useEffect hooks may reference values not listed in dependency array
**Impact**: Stale closures, unexpected behavior, bugs

### 2. Unnecessary Dependencies
**Problem**: Functions recreated on every render added to dependencies
**Impact**: useEffect runs too often, performance degradation

### 3. Direct State Mutations
**Problem**: Modifying state objects/arrays directly instead of creating new copies
**Examples**:
```javascript
// BAD
photos.push(newPhoto);
setPhotos(photos);

// BAD
photo.star = 5;
setPhoto(photo);
```
**Impact**: React may not detect changes, UI doesn't update, bugs

### 4. Object/Array Reference Issues
**Problem**: Comparing objects/arrays by reference in dependencies
**Impact**: useEffect runs on every render even when values haven't changed

## Implementation Plan

### Step 1: Audit All useEffect Hooks
- List all useEffect hooks in PhotosList.jsx
- List all useEffect hooks in custom hooks
- For each useEffect, identify all referenced values
- Compare with dependency array

### Step 2: Fix Missing Dependencies
- Add missing dependencies to array
- Use useCallback for function dependencies
- Use useMemo for object/array dependencies

**Example**:
```javascript
// BEFORE (missing dependency)
useEffect(() => {
  loadPhotos(viewMode); // viewMode not in deps
}, []);

// AFTER
useEffect(() => {
  loadPhotos(viewMode);
}, [viewMode, loadPhotos]); // loadPhotos should be wrapped in useCallback
```

### Step 3: Fix Unnecessary Dependencies with useCallback
- Wrap functions in useCallback to stabilize references
- Only include necessary dependencies in useCallback deps

**Example**:
```javascript
// BEFORE
const loadPhotos = (mode) => {
  // ... uses appConfig
};

useEffect(() => {
  loadPhotos(viewMode);
}, [viewMode, loadPhotos]); // loadPhotos recreated every render

// AFTER
const loadPhotos = useCallback((mode) => {
  // ... uses appConfig
}, [appConfig]); // only recreate when appConfig changes

useEffect(() => {
  loadPhotos(viewMode);
}, [viewMode, loadPhotos]); // loadPhotos reference stable
```

### Step 4: Fix Direct Mutations - Arrays
Find and fix all direct array mutations:

**Pattern 1: Array.push()**
```javascript
// BEFORE
const newPhotos = photos;
newPhotos.push(photo);
setPhotos(newPhotos);

// AFTER
setPhotos([...photos, photo]);
// or
setPhotos(prev => [...prev, photo]);
```

**Pattern 2: Array.splice()**
```javascript
// BEFORE
photos.splice(index, 1);
setPhotos(photos);

// AFTER
setPhotos(photos.filter((_, i) => i !== index));
// or
setPhotos([
  ...photos.slice(0, index),
  ...photos.slice(index + 1)
]);
```

**Pattern 3: Array.sort()**
```javascript
// BEFORE
photos.sort((a, b) => a.time - b.time);
setPhotos(photos);

// AFTER
setPhotos([...photos].sort((a, b) => a.time - b.time));
// or use toSorted() if available
```

### Step 5: Fix Direct Mutations - Objects
Find and fix all direct object mutations:

**Pattern 1: Property Assignment**
```javascript
// BEFORE
photo.star = 5;
setPhoto(photo);

// AFTER
setPhoto({ ...photo, star: 5 });
// or
setPhoto(prev => ({ ...prev, star: 5 }));
```

**Pattern 2: Nested Object Updates**
```javascript
// BEFORE
config.display.grid = true;
setConfig(config);

// AFTER
setConfig({
  ...config,
  display: {
    ...config.display,
    grid: true
  }
});
```

### Step 6: Fix useMemo Dependencies
- Check all useMemo hooks
- Ensure dependencies are correct
- Use primitive values or memoized objects in dependencies

**Example**:
```javascript
// BEFORE
const filteredPhotos = useMemo(() => {
  return photos.filter(p => filters.includes(p.type));
}, [photos]); // missing 'filters'

// AFTER
const filteredPhotos = useMemo(() => {
  return photos.filter(p => filters.includes(p.type));
}, [photos, filters]);
```

### Step 7: Use useRef for Values That Shouldn't Trigger Re-renders
- Identify values that need to persist but shouldn't trigger re-renders
- Convert to useRef where appropriate

**Example**:
```javascript
// BEFORE
const [isInitialized, setIsInitialized] = useState(false);
// Causes re-render when set to true

// AFTER (if re-render not needed)
const isInitialized = useRef(false);
// No re-render when set to true
```

### Step 8: Testing
- Test each component after fixes
- Verify no infinite loops
- Check React DevTools for unnecessary re-renders
- Test all user interactions

## Files to Audit

### Priority 1: PhotosList.jsx
- [ ] All useEffect hooks (~13 total)
- [ ] All useMemo hooks
- [ ] All useCallback hooks
- [ ] All state mutations

### Priority 2: Custom Hooks (from #130)
- [ ] `src/hooks/usePhotoDisplay.js`
- [ ] `src/hooks/useTabManagement.js`
- [ ] `src/hooks/useDataSynchronization.js`
- [ ] `src/hooks/useSearchInitialization.js`
- [ ] `src/hooks/usePhotoLoader.js`

### Priority 3: Existing Hooks
- [ ] `src/hooks/usePhotoSelection.js`
- [ ] `src/hooks/useCollectionManagement.js`
- [ ] `src/hooks/useSearchAndFilterManagement.js`

## Common Patterns to Fix

### Pattern A: Initialization useEffect
```javascript
// BEFORE
useEffect(() => {
  if (!initialized) {
    initialize();
    setInitialized(true);
  }
}, []); // missing dependencies

// AFTER
const initialized = useRef(false);
useEffect(() => {
  if (!initialized.current) {
    initialize();
    initialized.current = true;
  }
}, [initialize]); // or add all dependencies
```

### Pattern B: Conditional useEffect
```javascript
// BEFORE
useEffect(() => {
  if (condition) {
    doSomething(value);
  }
}, [condition]); // missing 'value'

// AFTER
useEffect(() => {
  if (condition) {
    doSomething(value);
  }
}, [condition, value, doSomething]);
```

### Pattern C: Cleanup Functions
```javascript
// BEFORE
useEffect(() => {
  const listener = listen('event', handler);
  return () => listener.then(l => l()); // uses stale handler
}, []);

// AFTER
useEffect(() => {
  const listener = listen('event', handler);
  return () => listener.then(l => l());
}, [handler]); // include handler dependency
```

## ESLint Rules to Enable

Add to `.eslintrc`:
```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

This will warn about missing dependencies automatically.

## Expected Results

### Before
- Incorrect dependency arrays causing bugs
- Direct mutations causing missed updates
- Unnecessary re-renders due to unstable references
- Difficult to debug state issues

### After
- All useEffect dependencies correct
- No direct state mutations
- Stable function/object references with useCallback/useMemo
- Predictable re-render behavior
- Better performance

## Success Criteria
- [ ] All useEffect hooks have correct dependencies
- [ ] No direct array mutations (no .push, .splice, .sort on state)
- [ ] No direct object mutations (no `obj.prop = value` on state)
- [ ] All functions used in dependencies wrapped in useCallback
- [ ] All complex objects used in dependencies wrapped in useMemo
- [ ] ESLint hook rules enabled and passing
- [ ] No infinite loops
- [ ] All functionality preserved
- [ ] No performance regression

## Testing Strategy

### Automated
- Enable ESLint exhaustive-deps rule
- Run lint and fix all warnings
- Add unit tests for hooks if possible

### Manual
- Test all view modes
- Test all user interactions
- Monitor React DevTools Profiler
- Check for unnecessary re-renders
- Verify no console warnings

## Related Work
- Builds on improvements #129, #130
- Improves code quality and maintainability
- Reduces bugs and unexpected behavior
- Foundation for future optimizations

## Notes
- Some useEffect warnings may be intentional - document with comments if so
- Use `// eslint-disable-next-line react-hooks/exhaustive-deps` sparingly
- Prefer fixing the root cause over disabling the rule
- Consider using `useReducer` for complex state logic
- Consider using state management library (Zustand, Jotai) if state gets too complex
