# Improvement #131: Component Splitting for PhotosList.jsx

## Goal
Split PhotosList.jsx into smaller, focused React components to improve maintainability and reduce file complexity.

## Background
- Current status: PhotosList.jsx ~1253 lines (after improvement #130)
- Improvement #130 extracted hooks, but the component itself is still large
- Component splitting is complementary to hook extraction

## Current Issues
- PhotosList.jsx contains too many responsibilities
- JSX is complex and hard to navigate
- Component reusability is limited
- Testing individual UI sections is difficult

## Proposed Solution
Split PhotosList.jsx into the following sub-components:

### 1. PhotosGrid Component
**File**: `src/components/PhotosGrid.jsx`
**Responsibility**: Render grid of photo thumbnails
**Props**:
- `photos`: Array of photo objects
- `onPhotoClick`: Handler for photo selection
- `selectedPhotos`: Set of selected photo paths
- `viewMode`: Current view mode
- `sortOfPhotos`: Current sort setting

**Benefits**:
- Isolated photo grid rendering logic
- Easier to optimize rendering performance
- Testable in isolation

### 2. PhotoCard Component
**File**: `src/components/PhotoCard.jsx`
**Responsibility**: Render individual photo thumbnail with metadata
**Props**:
- `photo`: Photo object
- `isSelected`: Boolean
- `onClick`: Click handler
- `showMetadata`: Boolean (show star, date, etc.)

**Benefits**:
- Reusable photo card component
- Consistent photo rendering across app
- Easy to add hover effects, animations

### 3. PhotosHeader Component
**File**: `src/components/PhotosHeader.jsx`
**Responsibility**: Render header with title, sort selector, view controls
**Props**:
- `title`: Header title
- `sortValue`: Current sort
- `onSortChange`: Sort change handler
- `viewMode`: Current view mode
- `photoCount`: Number of photos

**Benefits**:
- Isolated header UI logic
- Consistent header across different views
- Easier to add new header controls

### 4. PhotosToolbar Component
**File**: `src/components/PhotosToolbar.jsx`
**Responsibility**: Render toolbar with selection actions
**Props**:
- `selectedCount`: Number of selected photos
- `onSelectAll`: Select all handler
- `onClearSelection`: Clear selection handler
- `onDelete`: Delete handler
- `onAddToAlbum`: Add to album handler

**Benefits**:
- Isolated toolbar logic
- Reusable across different views
- Easy to add new bulk operations

### 5. PhotoDetailPanel Component
**File**: `src/components/PhotoDetailPanel.jsx`
**Responsibility**: Render right panel with photo details
**Props**:
- `photo`: Currently displayed photo
- `onClose`: Close panel handler
- `onNext`: Next photo handler
- `onPrev`: Previous photo handler

**Benefits**:
- Isolated detail panel UI
- Reusable for different photo display contexts
- Easy to enhance with more metadata

## Implementation Plan

### Step 1: Extract PhotoCard (Smallest, safest first)
- Create `src/components/PhotoCard.jsx`
- Move photo thumbnail rendering logic
- Update PhotosList to use PhotoCard
- Test in all view modes

### Step 2: Extract PhotosGrid
- Create `src/components/PhotosGrid.jsx`
- Move grid layout and photo mapping logic
- Update PhotosList to use PhotosGrid
- Test grid rendering in different modes

### Step 3: Extract PhotosHeader
- Create `src/components/PhotosHeader.jsx`
- Move header rendering logic
- Update PhotosList to use PhotosHeader
- Test header in different view modes

### Step 4: Extract PhotosToolbar
- Create `src/components/PhotosToolbar.jsx`
- Move toolbar rendering logic
- Update PhotosList to use PhotosToolbar
- Test selection operations

### Step 5: Extract PhotoDetailPanel
- Create `src/components/PhotoDetailPanel.jsx`
- Move photo detail panel rendering
- Update PhotosList to use PhotoDetailPanel
- Test photo navigation

## Expected Results

| Component | Lines Moved | Remaining in PhotosList |
|-----------|-------------|-------------------------|
| Current | - | ~1253 |
| PhotoCard | ~80 | ~1173 |
| PhotosGrid | ~120 | ~1053 |
| PhotosHeader | ~100 | ~953 |
| PhotosToolbar | ~80 | ~873 |
| PhotoDetailPanel | ~150 | ~723 |

**Final Target**: **~700-750 lines** in PhotosList.jsx

## Testing Strategy
- Test each component in isolation with Storybook (if available) or manual testing
- Verify all view modes work: Date, Recent, Import, Trash, Album, Tag, Search
- Test photo selection in different modes
- Test photo navigation (next/prev)
- Test responsive layout
- Check performance (no regression)

## Success Criteria
- [ ] PhotosList.jsx reduced to ~700-750 lines
- [ ] All functionality preserved
- [ ] No visual regression
- [ ] No performance degradation
- [ ] Each component has single responsibility
- [ ] Components are reusable
- [ ] Code is more testable

## Related Work
- Builds on improvement #130 (hook extraction)
- Complements DDD architecture principles
- Enables future improvements (virtualization, lazy loading)

## Notes
- Start with smallest component (PhotoCard) first to minimize risk
- Commit each component extraction separately
- Run full regression testing after each step
- Consider adding PropTypes or TypeScript types for better type safety
