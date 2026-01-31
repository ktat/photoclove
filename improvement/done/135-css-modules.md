# Improvement #135: Migrate to CSS Modules

## Goal
Migrate PhotosList.jsx and related components from global CSS to CSS Modules for better style encapsulation and maintainability.

## Current Status (Updated: 2025-01-13)

### Implementation Progress: **PHASE 3 COMPLETE**

CSS Modules migration completed for main PhotosList components.

#### CSS Modules Setup
- [x] **vite.config.js**: CSS Modules configured with `localsConvention: 'camelCase'`
- [x] **classnames library**: Installed in package.json

#### Component Structure (Current)
The PhotosList component has been partially split into sub-components (improvement #131 partially done):

**Main Components:**
| Component | JSX File | CSS Module | Status |
|-----------|----------|------------|--------|
| PhotosList | `src/App/PhotosList.jsx` | ❌ Uses global `PhotosList.css` | Not migrated (complex layout) |
| PhotoCard | `src/App/PhotosList/PhotoCard.jsx` | ✅ `PhotoCard.module.css` | **Migrated** |
| PhotoGrid | `src/App/PhotosList/PhotoGrid.jsx` | ✅ `PhotoGrid.module.css` | **Migrated** |
| PhotosToolbar | `src/App/PhotosList/PhotosToolbar.jsx` | ✅ `PhotosToolbar.module.css` | **Migrated** |
| PhotoListContent | `src/App/PhotosList/PhotoListContent.jsx` | ❌ Uses global layout classes | Skipped |
| PhotoOption | `src/App/PhotosList/PhotoOption.jsx` | ✅ `PhotoOption.module.css` | **Migrated** |

**Additional Components (Not migrated - lower priority):**
- `DirectoryMenu.jsx` - Directory navigation
- `StatusBar.jsx` - Status bar component
- `PhotoDisplayWrapper.jsx` - Photo display wrapper
- `SideMenuWrapper.jsx` - Side menu wrapper
- `ListViewHeader.jsx` - List view header
- `GenericListView.jsx` - Generic list view
- `AlbumTab.jsx` - Album tab component
- `PhotoLoading.jsx` - Loading component

**PhotoOption Sub-Components:**
- `PhotoInfo.jsx` - Photo information panel (no CSS)
- `PhotoTags.jsx` | ✅ `PhotoTags.module.css` | **Migrated**
- `PhotoEditor.jsx` | ✅ `PhotoEditor.module.css` | **Migrated**
- `EditorControl.jsx` - Editor controls (no CSS)
- `CropTool.jsx` - Crop tool (no CSS)

**PhotosListMini Sub-Components:**
- `PhotosListMini.jsx` - Mini photo list
- `PhotoDisplay.jsx` - Photo display
- `ThumbnailItem.jsx` - Thumbnail item
- `HelpPanel.jsx` - Help panel
- `AlbumModeIndicator.jsx` - Album mode indicator

**DirectoryMenu Sub-Components:**
- `FilterTab.jsx` - Filter tab
- `SelectionTab.jsx` - Selection tab
- `tutorialContent.jsx` - Tutorial content

#### Current CSS Files (Global):
- `src/App/PhotosList.css` - Main PhotosList styles
- `src/App/PhotosList/PhotoOption.css` - PhotoOption styles
- `src/App/PhotosList/PhotoOption/PhotoTags.css` - PhotoTags styles
- `src/App/PhotosList/PhotoOption/PhotoEditor.css` - PhotoEditor styles

### Next Steps to Implement
1. Install `classnames` library: `npm install classnames`
2. Add CSS Modules configuration to `vite.config.js`
3. Start with PhotoCard.jsx → PhotoCard.module.css
4. Migrate remaining components incrementally

---

## Background
- Currently using global CSS (`PhotosList.css`)
- Risk of style conflicts and naming collisions
- Difficult to determine which styles are actually used
- Hard to remove unused styles safely
- No type safety for class names

## Current Issues

### Problem 1: Global Namespace Pollution
- All CSS classes are global
- Risk of conflicts with other components
- Need to use long, prefixed class names (e.g., `photos-list-header-title`)

### Problem 2: No Dead Code Elimination
- Can't determine which CSS is actually used
- Afraid to remove old styles
- CSS file grows over time

### Problem 3: No Type Safety
- Typos in class names only caught at runtime
- Refactoring class names is risky
- No autocomplete for class names

### Problem 4: Coupling Between Files
- CSS and component are in separate files
- Easy to forget to update CSS when changing component
- Hard to see which styles belong to which component

## Proposed Solution

### CSS Modules Benefits
- **Scoped Styles**: Class names are scoped to component
- **Dead Code Elimination**: Unused styles can be detected
- **Type Safety**: Can use TypeScript or generate type definitions
- **Explicit Dependencies**: Import only the styles you need
- **Better Developer Experience**: Autocomplete, refactoring support

### Migration Strategy
Migrate to CSS Modules incrementally, one component at a time.

## Implementation Plan

### Step 1: Setup CSS Modules Support
CSS Modules should already be supported in Vite/Tauri. Verify:

**Check vite.config.js**:
```javascript
export default {
  css: {
    modules: {
      localsConvention: 'camelCase' // Allow both kebab-case and camelCase
    }
  }
}
```

### Step 2: Migrate PhotosList.jsx
**Create**: `PhotosList.module.css` (copy from `PhotosList.css`)

**Before**:
```javascript
// PhotosList.jsx
import './PhotosList.css';

return <div className="photos-list-container">...</div>;
```

**After**:
```javascript
// PhotosList.jsx
import styles from './PhotosList.module.css';

return <div className={styles.container}>...</div>;
```

**PhotosList.module.css**:
```css
.container {
  /* styles */
}

.header {
  /* styles */
}

.grid {
  /* styles */
}
```

### Step 3: Migrate Component CSS Files
For each component created in improvement #131:
- PhotoCard: `PhotoCard.module.css`
- PhotosGrid: `PhotosGrid.module.css`
- PhotosHeader: `PhotosHeader.module.css`
- PhotosToolbar: `PhotosToolbar.module.css`
- PhotoDetailPanel: `PhotoDetailPanel.module.css`

### Step 4: Handle Dynamic Class Names
Use `classnames` library for conditional classes:

```bash
npm install classnames
```

**Before**:
```javascript
<div className={`photo-card ${isSelected ? 'selected' : ''}`}>
```

**After**:
```javascript
import classNames from 'classnames';
import styles from './PhotoCard.module.css';

<div className={classNames(styles.photoCard, {
  [styles.selected]: isSelected
})}>
```

### Step 5: Handle CSS Variables
CSS Modules work well with CSS variables:

**PhotosList.module.css**:
```css
.container {
  background: var(--bg);
  color: var(--text);
}
```

**Global CSS Variables** (keep in global CSS):
```css
/* index.css or global.css */
:root {
  --bg: #1f2937;
  --text: #e4e4e4;
  --accent: #3b82f6;
}
```

### Step 6: Handle Global Styles
Some styles should remain global:

**Keep Global**:
- CSS reset/normalize
- CSS variables
- Typography defaults
- Global utility classes

**Move to Modules**:
- Component-specific styles
- Layout styles specific to a component
- Component state styles (hover, active, etc.)

### Step 7: Update Class Names
Convert from kebab-case to camelCase (optional but recommended):

**Before**:
```css
.photos-list-container { }
.photo-card-selected { }
```

**After**:
```css
.photosListContainer { }
.photoCardSelected { }
```

**Or use localsConvention**: Keep kebab-case in CSS, use camelCase in JS:
```javascript
// .photo-card in CSS
<div className={styles.photoCard}> // camelCase in JS
```

### Step 8: Remove Old CSS Files
After migrating to modules:
- Test thoroughly
- Verify all styles still work
- Delete old global CSS files
- Update imports

## Migration Checklist

### Phase 0: Setup
- [ ] Install `classnames` library
- [ ] Configure CSS Modules in `vite.config.js`

### Phase 1: Core Components (Priority)

#### PhotosList.jsx
- [ ] Create `PhotosList.module.css`
- [ ] Copy styles from `PhotosList.css`
- [ ] Update all className usages to `styles.*`
- [ ] Handle dynamic classes with `classnames`
- [ ] Test all view modes
- [ ] Delete old `PhotosList.css`

#### PhotoCard.jsx
- [ ] Create `PhotoCard.module.css`
- [ ] Extract relevant styles from `PhotosList.css`
- [ ] Update className usages
- [ ] Test photo display
- [ ] Test selection styles
- [ ] Test hover states

#### PhotoGrid.jsx
- [ ] Create `PhotoGrid.module.css`
- [ ] Extract grid layout styles from `PhotosList.css`
- [ ] Update className usages
- [ ] Test responsive grid
- [ ] Test different column counts

#### PhotosToolbar.jsx
- [ ] Create `PhotosToolbar.module.css`
- [ ] Extract toolbar styles from `PhotosList.css`
- [ ] Update className usages
- [ ] Test toolbar actions

#### PhotoListContent.jsx
- [ ] Create `PhotoListContent.module.css`
- [ ] Extract content styles from `PhotosList.css`
- [ ] Update className usages

### Phase 2: PhotoOption Components

#### PhotoOption.jsx
- [ ] Create `PhotoOption.module.css`
- [ ] Move styles from `PhotoOption.css`
- [ ] Update className usages
- [ ] Delete old `PhotoOption.css`

#### PhotoTags.jsx
- [ ] Create `PhotoTags.module.css`
- [ ] Move styles from `PhotoTags.css`
- [ ] Delete old `PhotoTags.css`

#### PhotoEditor.jsx
- [ ] Create `PhotoEditor.module.css`
- [ ] Move styles from `PhotoEditor.css`
- [ ] Delete old `PhotoEditor.css`

#### PhotoInfo.jsx
- [ ] Create `PhotoInfo.module.css` if needed
- [ ] Extract styles or share with PhotoOption

### Phase 3: Directory Menu & Other Components

#### DirectoryMenu.jsx
- [ ] Create `DirectoryMenu.module.css`
- [ ] Extract styles from `PhotosList.css`
- [ ] Update className usages

#### FilterTab.jsx
- [ ] Create `FilterTab.module.css` if needed

#### SelectionTab.jsx
- [ ] Create `SelectionTab.module.css` if needed

#### StatusBar.jsx
- [ ] Create `StatusBar.module.css`
- [ ] Extract styles from `PhotosList.css`

### Phase 4: PhotosListMini Components

#### PhotosListMini.jsx
- [ ] Create `PhotosListMini.module.css`
- [ ] Extract styles from `PhotosList.css`

#### PhotoDisplay.jsx
- [ ] Create `PhotoDisplay.module.css`

#### ThumbnailItem.jsx
- [ ] Create `ThumbnailItem.module.css`

### Phase 5: Utility Components

#### ListViewHeader.jsx
- [ ] Create `ListViewHeader.module.css` if needed

#### GenericListView.jsx
- [ ] Create `GenericListView.module.css` if needed

#### PhotoLoading.jsx
- [ ] Create `PhotoLoading.module.css` if needed

#### SideMenuWrapper.jsx
- [ ] Create `SideMenuWrapper.module.css` if needed

#### PhotoDisplayWrapper.jsx
- [ ] Create `PhotoDisplayWrapper.module.css` if needed

## Advanced: TypeScript Type Generation

### Option 1: Manual Type Definitions
Create `.d.ts` files for each module:

**PhotosList.module.css.d.ts**:
```typescript
export const container: string;
export const header: string;
export const grid: string;
export const photoCard: string;
export const selected: string;
```

### Option 2: Automated Type Generation
Use `typescript-plugin-css-modules`:

```bash
npm install -D typescript-plugin-css-modules
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-css-modules"
      }
    ]
  }
}
```

## Best Practices

### 1. Component-Scoped Styles
Each component should have its own CSS Module:
```
PhotoCard.jsx
PhotoCard.module.css
```

### 2. Composition
Use `composes` to share styles:

```css
/* Button.module.css */
.base {
  padding: 8px 16px;
  border-radius: 4px;
}

.primary {
  composes: base;
  background: var(--accent);
}

.secondary {
  composes: base;
  background: var(--bg-elevated);
}
```

### 3. Naming Conventions
- Use camelCase for class names in CSS Modules
- Use descriptive names: `photoCard`, not `card`
- Avoid abbreviations: `container`, not `cont`

### 4. Global Styles
Use `:global` for truly global styles:

```css
/* PhotosList.module.css */
:global(.tooltip) {
  /* global tooltip style */
}

.container :global(.highlight) {
  /* global .highlight only inside .container */
}
```

## Testing Strategy

### Visual Testing
- [ ] Test all components visually
- [ ] Compare before/after screenshots
- [ ] Test in different browsers
- [ ] Test responsive layouts
- [ ] Test dark theme (CSS variables still work)

### Functional Testing
- [ ] All styles apply correctly
- [ ] No style conflicts
- [ ] Hover/active states work
- [ ] Animations work
- [ ] CSS variables work

### Performance Testing
- [ ] Build size comparison
- [ ] Load time comparison
- [ ] CSS file size comparison

## Expected Results

### Before (Current State)
```javascript
// PhotosList.jsx (495 lines - as of 2025-01-13)
import './PhotosList.css'; // 366 lines, all global

<div className="photos-list-container">
  <div className="photos-list-header">
    <div className="photos-list-header-title">Photos</div>
  </div>
</div>
```

### After
```javascript
// PhotosList.jsx (495 lines)
import styles from './PhotosList.module.css'; // Scoped styles

<div className={styles.container}>
  <div className={styles.header}>
    <div className={styles.title}>Photos</div>
  </div>
</div>
```

### Benefits Achieved
- **No naming conflicts**: Class names are scoped
- **Smaller class names**: `.container` instead of `.photos-list-container`
- **Better refactoring**: IDE can track class name usage
- **Dead code detection**: Unused styles can be found
- **Better organization**: Each component has its own styles

## Success Criteria
- [ ] All components migrated to CSS Modules
- [ ] No global CSS conflicts
- [ ] All styles work correctly
- [ ] No visual regressions
- [ ] Build size not significantly increased
- [ ] Developer experience improved
- [ ] Easy to add new components with scoped styles

## Potential Issues & Solutions

### Issue 1: Global Styles Still Needed
**Solution**: Keep global.css for truly global styles (CSS vars, reset, typography)

### Issue 2: Third-party Component Styles
**Solution**: Use `:global()` wrapper or keep in global CSS

### Issue 3: Build Size Increase
**Solution**: CSS Modules don't significantly increase size; class names are minified in production

### Issue 4: Dynamic Class Names Verbose
**Solution**: Use `classnames` library for cleaner syntax

## Related Work
- **Improvement #131 (Component Splitting)**: Partially completed - PhotosList has been split into sub-components (PhotoCard, PhotoGrid, PhotosToolbar, etc.)
- Complements improvements #129, #130 (code organization)
- Improves maintainability and scalability
- **Prerequisite**: Component splitting is mostly done, CSS Modules migration can proceed

## Notes
- CSS Modules are supported out-of-the-box in most modern build tools (Vite, Webpack, etc.)
- Can be migrated incrementally - old global CSS and new modules can coexist
- Consider using SCSS/SASS modules for more features (nesting, mixins)
- TypeScript support is optional but recommended
- Start with one component, verify it works, then migrate the rest
