# PhotoClove Component and HTML Structure

This document provides an overview of PhotoClove's React component hierarchy. For detailed HTML structure and CSS references, see the linked documents below.

## 📚 Documentation Index

- **[HTML Structure - Main Screens](html-structure/main-screens.md)** - Welcome, Home, Photo Grid, Full-Screen Display, Footer
- **[HTML Structure - Photo Editor & Info](html-structure/photo-editor.md)** - PhotoEditor panel, PhotoInfo panel
- **[HTML Structure - Sidebar Panels](html-structure/sidebar-panels.md)** - DirectoryMenu, Log Viewer
- **[HTML Structure - Import & Preferences](html-structure/import-preferences.md)** - Import interface, Preferences, Job Queue
- **[CSS Reference](css-reference.md)** - Complete CSS class reference

## Component Hierarchy

```
App (root)
├── Welcome (first-time users)
│   ├── WelcomeImage
│   └── Tutorial steps
├── Home (main dashboard)
│   ├── WelcomeImage
│   └── Home Search Box
├── PhotosList (main photo view & search results)
│   ├── PhotosListMini (full-screen viewer)
│   │   └── PhotoDisplay
│   ├── PhotoLoading
│   ├── DirectoryMenu (with search tools tab)
│   │   ├── SearchTools (search tab content)
│   │   │   ├── SearchBar
│   │   │   ├── AdvancedFilters
│   │   │   └── SavedSearches
│   │   ├── Filter Tab
│   │   ├── Maintenance Tab
│   │   └── Selection Tab
│   └── Back to HOME Button (in search mode)
├── PhotoOption (photo metadata panel)
│   ├── PhotoEditor (image editing)
│   └── PhotoInfo (metadata display)
├── Importer (photo import interface)
│   └── SelectedPhotoInfo
├── Preferences (settings)
│   └── FolderPicker (multiple instances)
├── JobQueue (background jobs)
├── DateList (calendar sidebar)
└── Footer
    └── RandomMessages
```

## Component Details by Screen

### Main Screens
**See**: [html-structure/main-screens.md](html-structure/main-screens.md)

- **Main Application Container** - Layout structure with left/center/right panels
- **Welcome Screen** - First-time user onboarding
- **Home Screen** - Dashboard with search box
- **Left Menu and Date List** - Calendar navigation sidebar
- **Photo Grid View** - Infinite scroll photo gallery
- **Full-Screen Photo Display** - PhotosListMini component with navigation
- **Footer** - Status messages and random quotes

### Photo Editor & Info Panels
**See**: [html-structure/photo-editor.md](html-structure/photo-editor.md)

- **Photo Editor Panel** - Image editing controls (brightness, contrast, crop, etc.)
  - Refactored from 1,292 → 980 lines
  - Utility modules: `cssUtils.js`, `cropUtils.js`, `styleUtils.js`
- **Photo Info Panel** - EXIF metadata, star rating, comments
  - Features: 📋 copy path, 🚀 open in external app

### Sidebar Panels
**See**: [html-structure/sidebar-panels.md](html-structure/sidebar-panels.md)

- **Directory Menu** - Right sidebar with 4 tabs (Search, Filter, Maintenance, Selection)
  - Search tab: Advanced filters, saved searches
  - Filter tab: Star rating, comments, tags, file types
  - Maintenance tab: Database and thumbnail operations
  - Selection tab: Bulk operations on selected photos
- **Debug Log Viewer** - Global log viewer (Ctrl+Shift+L)

### Import, Preferences & Job Queue
**See**: [html-structure/import-preferences.md](html-structure/import-preferences.md)

- **Import Interface** - Directory navigation and photo selection
- **Preferences Screen** - Application settings and configuration
- **Job Queue Interface** - Background job monitoring and control

### CSS Classes
**See**: [css-reference.md](css-reference.md)

Complete reference of all CSS classes organized by:
- Layout classes (container, sidebars, panels)
- Component-specific classes (photo grid, editor, search)
- State classes (selected, active, status)
- Functional classes (scroll, checkbox, progress)

## Recent Technical Improvements

### PhotosList & PhotosListMini Component Fixes

**Thumbnail Update Bug Fix (DEL Key Deletion)**:
- **Issue**: Thumbnail list wasn't updating when photos were deleted using DEL key in Recent Photos, Search Results, or single photo viewing modes
- **Root Cause**: Date restriction (`date_with_slash === compatProps.currentDate`) prevented thumbnail updates in multi-date viewing modes
- **Solution**: Removed date restriction and fixed React state mutation by creating new arrays instead of mutating existing ones
- **Files Modified**: `src/App/PhotosList.jsx:650-678`, state management in `moveToTrashCan` function

**Date Dependencies Removal**:
- **Issue**: Components were tightly coupled to `currentDate`, causing issues in Recent Photos and Search modes where photos span multiple dates
- **Root Cause**: Pagination logic, thumbnail generation, and state management assumed single-date contexts
- **Solution**:
  - Added mode-aware pagination keys: `recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : currentDate)`
  - Changed thumbnail generation to always extract dates from photo paths instead of using `currentDate` fallback
  - Added `getDateKey()` helper function in PhotosListMini for consistent date key management
- **Files Modified**: `src/App/PhotosList.jsx:928,1019-1020,1081-1088`, `src/App/PhotosList/PhotosListMini.jsx:21,48-50,355-362,429,611`

**Benefits**:
- **Improved Reliability**: Thumbnail updates work consistently across all viewing modes
- **Better Architecture**: Components are now properly decoupled from date-specific assumptions
- **Enhanced User Experience**: DEL key deletion now provides immediate visual feedback in all contexts

## Component Refactoring

### PhotoEditor.jsx (Improvement #88)
**Refactored**: 1,292 → 980 lines (-312 lines, 24% reduction)

**Extracted Modules**:
- `PhotoEditor/cssUtils.js` (218 lines) - CSS parsing and generation
- `PhotoEditor/cropUtils.js` (144 lines) - Crop calculations and presets
- `PhotoEditor/styleUtils.js` (199 lines) - Style application utilities

### PhotosListMini.jsx (Improvement #90)
**Refactored**: 833 → 735 lines (-98 lines, 12% reduction)

**Extracted Modules**:
- `PhotosListMini/photoUtils.js` (128 lines) - Thumbnail display calculations
- `PhotosListMini/useKeyboardShortcuts.js` (124 lines) - Keyboard navigation hook

### Photo Operations (Improvement #84)
**Enhanced**: `usePhotoOperations.js` hook (219 → 510 lines)

**New Operations**:
- Album: `handleAddToAlbum`, `removePhotoFromAlbum`
- Trash: `moveToTrash`, `restorePhoto`, `permanentlyDeletePhoto`
- List: `removePhotoFromList` with smart navigation
