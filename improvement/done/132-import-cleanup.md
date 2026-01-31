# Improvement #132: Import Cleanup and Dead Code Removal

## Goal
Remove unused imports, dead code, and clean up the import section of PhotosList.jsx and related files.

## Background
- After improvements #129 and #130, many imports may be unused
- Hook extraction moved code to separate files, leaving orphaned imports
- Clean imports improve code readability and build performance

## Current Issues
- Unused imports clutter the top of files
- Hard to identify which imports are actually used
- Potential for importing deprecated or removed code
- Build bundle may include unnecessary dependencies

## Scope

### Files to Clean
1. **PhotosList.jsx** (primary target)
   - Remove unused React imports (useState, useCallback if not used)
   - Remove unused context imports
   - Remove unused utility imports
   - Remove unused component imports

2. **Newly created hooks** (from #130)
   - `src/hooks/usePhotoDisplay.js`
   - `src/hooks/useTabManagement.js`
   - `src/hooks/useDataSynchronization.js`
   - `src/hooks/useSearchInitialization.js`
   - `src/utils/PhotosListUtils.js`

3. **Related files**
   - Check if any other components have unused imports
   - Clean up barrel exports if needed

## Implementation Plan

### Step 1: Analyze PhotosList.jsx Imports
- Read through PhotosList.jsx
- List all imports at the top
- For each import, search for usage in the file
- Mark unused imports for removal

### Step 2: Remove Unused Imports
- Remove imports with no usage
- Test that the app still builds
- Run `npm run build` to check for errors

### Step 3: Clean Up Hook Files
- Check each newly created hook file
- Ensure only necessary imports are included
- Remove any redundant imports

### Step 4: Optimize Import Organization
- Group imports by category:
  1. React imports
  2. Third-party library imports
  3. Context imports
  4. Hook imports
  5. Component imports
  6. Utility imports
  7. Style imports
- Sort imports alphabetically within each group

### Step 5: Remove Dead Code
- Identify unused functions (if any)
- Remove commented-out code
- Remove unused constants
- Remove unused helper functions

### Step 6: Verification
- Run `npm run build` to ensure no build errors
- Run `npm run lint` to check for linting issues
- Test app functionality in all view modes
- Check browser console for errors

## Expected Results

### PhotosList.jsx Import Section
**Before** (estimated ~64 lines):
```javascript
import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
// ... 60 more import lines
```

**After** (estimated ~40-45 lines):
```javascript
// React
import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';

// Tauri
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Contexts
import { UIContext } from '../contexts/UIContext';
// ... only necessary contexts

// Hooks
import usePhotoDisplay from '../hooks/usePhotoDisplay';
// ... only used hooks

// Components
import PhotoCard from '../components/PhotoCard';
// ... only used components

// Utilities & Services
import { logger } from '../services/LoggerService';
// ... only used utilities

// Styles
import './PhotosList.css';
```

**Lines saved**: ~20-25 lines

### Dead Code Removal
- Remove unused helper functions: ~50-100 lines
- Remove commented code: ~20-30 lines
- Remove unused constants: ~10-20 lines

**Total lines saved**: ~100-175 lines

## Checklist

### Import Cleanup
- [ ] Analyze all imports in PhotosList.jsx
- [ ] Remove unused React hooks from import
- [ ] Remove unused context imports
- [ ] Remove unused component imports
- [ ] Remove unused utility imports
- [ ] Organize imports by category
- [ ] Sort imports alphabetically

### Hook Files
- [ ] Clean usePhotoDisplay.js imports
- [ ] Clean useTabManagement.js imports
- [ ] Clean useDataSynchronization.js imports
- [ ] Clean useSearchInitialization.js imports
- [ ] Clean PhotosListUtils.js imports

### Dead Code
- [ ] Remove unused functions
- [ ] Remove commented code
- [ ] Remove unused constants
- [ ] Remove debug console.logs (use logger instead)

### Verification
- [ ] Run `npm run build` successfully
- [ ] Run `npm run lint` with no errors
- [ ] Test all view modes (Date, Recent, Import, Trash, Album, Tag, Search)
- [ ] Check browser console for errors
- [ ] Verify no functionality broken

## Tools to Use

### ESLint
```bash
npm run lint
```
- Will warn about unused imports
- Will warn about unused variables

### Build Process
```bash
npm run build
```
- Will fail if imports are broken
- Will show missing dependencies

### Manual Search
- Use editor's "Find All References" feature
- Search for each imported item in the file
- Remove if zero references found

## Success Criteria
- [ ] All unused imports removed
- [ ] Imports organized by category
- [ ] No dead code remaining
- [ ] Build passes with no warnings
- [ ] Lint passes with no errors
- [ ] All functionality preserved
- [ ] Code is cleaner and more readable

## Related Work
- Follows improvements #129 and #130 (hook extraction)
- Prepares codebase for future improvements
- Improves build performance

## Notes
- Use caution when removing imports - some may be used indirectly
- Test thoroughly after each removal
- Commit changes incrementally
- If unsure about an import, keep it and document why
- Consider adding ESLint rule to prevent unused imports in future
