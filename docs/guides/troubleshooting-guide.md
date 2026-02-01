# PhotoClove Troubleshooting Guide

This document provides comprehensive troubleshooting guidance for common issues in PhotoClove.

## Error Debugging Guides

### Import Not Working
**Check these areas**:
- **Job Queue**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **File Permissions**: [File System Operations](architecture.md#file-system)
- **Configuration**: [Configuration Management](feature-quick-reference.md#-configuration-management)
- **Logs**: Background processing in `src-tauri/src/domain_service/job_queue_service.rs`

### Photos Not Displaying
**Check these areas**:
- **Database**: [Database Operations](feature-quick-reference.md#-database-operations)
- **Thumbnails**: [Performance Optimizations](architecture.md#4-performance-optimizations)
- **File Paths**: [Filesystem Organization](architecture.md#filesystem-organization)
- **Sequences**: [Photo Viewing Feature](feature-sequences.md#photo-viewing-feature)

### Troubleshooting Display Issues
1. **Check component visibility conditions** in parent components (App.jsx)
2. **Verify state management** Context values and prop passing, especially UIContext initial states
3. **Review useEffect dependencies** for data loading triggers
4. **Common startup issues**: Ensure UIContext showPhotosList starts as false to prevent "No Photo Found!" at startup
5. **Follow bug investigation guide** in `CLAUDE.md` for systematic debugging
6. **Use LogViewer** (Ctrl+Shift+L) to inspect frontend state and backend responses

### Performance Issues
**Optimization areas**:
- **Lazy Loading**: [Performance Optimization Strategies](feature-sequences.md#performance-optimization-strategies)
- **Background Processing**: [Background Job Processing](feature-quick-reference.md#-background-job-processing)
- **Caching**: [Lazy Loading and Caching](feature-sequences.md#1-lazy-loading-and-caching)
- **Database Indexing**: [SQLite Database Schema](architecture.md#sqlite-database-schema)

### UI Layout Issues
**Check these areas**:
- **Component Structure**: [HTML Element IDs and Structure](component-structure.md#html-element-ids-and-structure)
- **CSS Classes**: [CSS Classes and Styling](component-structure.md#css-classes-and-styling)
- **Layout Components**: [Layout Classes](component-structure.md#layout-classes)

## Recent Bug Fixes

### Import Functionality Integration 
**Fixed 2025-07-26**: Complete integration of import functionality using PhotosList/PhotosListMini with ImportState entity, eliminated separate Importer.jsx component

### ViewMode Display Condition Methods
**Fixed 2025-07-26**: Added comprehensive display condition methods to ViewMode class for DirectoryMenu, centralizing UI logic and improving maintainability

### DirectoryMenu ViewMode Refactoring
**Fixed 2025-07-26**: Replaced all const mode checks with ViewMode object methods, improved code consistency and reduced prop drilling

### ViewMode DDD Architecture Implementation
**Fixed 2025-07-26**: Complete refactoring to Domain-Driven Design with ViewMode value object, eliminated 60+ boolean variables, fixed photo navigation bugs

### Single Photo Mode Transition
**Fixed 2025-07-26**: Photo click from list to full-screen view broken due to display key inconsistencies, resolved with unified ViewMode methods

### Tag Navigation Issues
**Fixed 2025-07-26**: Tag icon not working from Album mode, tag list clicks not changing pages, resolved with ViewMode synchronization

### Photo Display Key Mismatches
**Fixed 2025-07-26**: Multiple display key calculation inconsistencies causing photo view failures, standardized with ViewMode.getDataAttribute()

### Filter System Enhancement
**Fixed 2025-07-26**: Improved filter UI/UX with "Has Tag" filter, enhanced filter popover, active filter summaries

### First-Click Photo Loading Bug
**Fixed 2025-07-20**: Null reference error in PhotosList.jsx logging code prevented photo state updates on first date/Recent Photos click after startup. Fixed with optional chaining in logging code

### Recent Photos Not Displaying
**Fixed 2025-12-23**: Recent Photos feature was broken due to two issues:
1. **Wrong table name**: SQL query used `photo_collection` (singular) instead of `photo_collections` (plural), causing "no such table" errors
2. **Lost sort order**: PhotoMetas used HashMap which doesn't preserve insertion order, causing photos to appear in random order instead of by `created_at DESC`

**Solution**:
- Changed PhotoMetas from HashMap to IndexMap to preserve SQL query order
- Fixed SQL table name in JOIN clause from `photo_collection` to `photo_collections`
- Added error logging for metadata retrieval failures

### Startup State Issue
**Fixed**: Changed UIContext showPhotosList initial state from true to false, prevents "No Photo Found!" at startup, properly shows Welcome/Home screen

### Date List Performance
**Fixed**: Implemented date_summary table optimization with smart rebuild logic for ~10x faster date loading

### Thumbnail List Not Updating After Deletion
**Fixed**: DEL key deletion now properly removes photos from thumbnail list in all viewing modes

### Date Dependencies in Multi-Mode Views
**Fixed**: Recent Photos and Search modes now work independently of currentDate, with proper pagination and thumbnail generation

### Photo Display State Management
**Fixed**: Implemented DDD architecture with Photo entity to handle display paths correctly across normal and trash modes

### Trash Photos Disappearing on Scroll
**Fixed**: Properly handle trash photo paths in infinite scroll mode to prevent photos from disappearing

### Permanent Delete with Thumbnails
**Fixed**: Implemented complete permanent delete that removes both original files and cached thumbnails from all locations

### EXIF Orientation Correction for Album/Tag Thumbnails
**Fixed 2025-01-13**: Photos in album/tag GridView were not applying EXIF orientation correction, causing photos to appear rotated incorrectly. Added `src/utils/orientationUtils.js` utility and fixed PhotoCard, PhotoGrid, and PhotoListContent components

### Preferences Save Not Persisting
**Fixed 2025-01-13**: Preferences changes were not being saved to the config file due to issues in config_commands.rs and entity/config.rs. Fixed configuration entity and command handler

### Album Mode Tag Display
**Fixed 2025-01-13**: Tags were not displaying correctly in album mode and tag loading was slow. Optimized tag loading with batch queries and fixed display logic

### Move Files by EXIF Date
**Fixed 2025-01-13**: "Move files according to EXIF date" feature was not working correctly. Fixed date calculation in photo.rs, photo_meta.rs, and directory.rs

### Collection Photo Count Display
**Fixed 2025-01-13**: Album/tag collection photo counts were not displaying correctly. Fixed backend dynamic count calculation in UnifiedPhotoCollection.js

### Tag Display Refresh in Grid View
**Fixed 2025-01-13**: Tags were not updating in grid view when added/removed. Fixed refresh mechanism in PhotoCard.jsx and PhotoTags.jsx with proper event propagation

### Trash Navigation Links
**Fixed 2025-01-13**: Navigation links in trash mode were not working correctly. Fixed in StatusBar.jsx and PhotoDisplayWrapper.jsx

### Bulk Insert for Album/Tag Assignments
**Fixed 2025-01-13**: Added bulk insert capability for album/tag photo assignments to improve performance when adding multiple photos to collections

### Trash Mode Image Display
**Fixed 2025-01-14**: Photos in trash mode were not displaying correctly due to path handling issues. Fixed in PhotosListMini.jsx to properly resolve trash photo paths

### TutorialTooltip Styling Issues
**Fixed 2025-01-14**: TutorialTooltip component had styling inconsistencies. Improved CSS styling and positioning for better visibility

### Logging Standards Violations
**Fixed 2025-01-14**: Replaced `println!` statements with proper `log` macro usage in backend Rust code (counts.rs, dates.rs). Frontend console.log calls in debugStorage.js replaced with structured logger. Memory safety improved in PhotoDisplay.jsx with optional chaining

### Backend Error Handling Improvements
**Fixed 2025-01-14**: Improved error handling patterns in dir_service.rs following Rust idioms (`?` operator, `if let` patterns) instead of `is_none()` checks with `unwrap()`

### Theme Settings Not Persisting (Appearance Tab)
**Fixed 2025-01-14**: Color theme and photo grid theme settings in Preferences > Appearance tab were not saved after restart. Backend Config struct was missing `color_theme` and `photo_grid_theme` fields. Added fields to `src-tauri/src/entity/config.rs` with proper serde defaults

### CSS Modules Class Name Issues in PhotoViewer Tabs
**Fixed 2025-01-14**: PhotoViewer mode tabs were appearing horizontally instead of vertically due to CSS Modules class name mismatch. JSX was using camelCase (`styles.verticalTabs`) but CSS used kebab-case (`.vertical-tabs`). Fixed by using bracket notation: `styles['vertical-tabs']` in PhotoOption.jsx, PhotoTags.jsx, and PhotoEditor.jsx

### Preferences CSS Modules Migration
**Fixed 2025-01-14**: Migrated Preferences component from global CSS to CSS Modules (`Preferences.module.css`). Added `:global()` wrappers for PickFolderSingle's row2/row3 classes that are used as global classes

### PhotoEditor Memory Leak Fix
**Fixed 2025-01-14**: PhotoEditor had event listener memory leaks. Fixed by extracting photo export utilities to `photoExportUtils.js` and proper cleanup in useEffect hooks. File split improves maintainability

### PhotoCollection Domain Object Split
**Fixed 2025-01-14**: PhotoCollection.js exceeded 700 lines. Extracted fetch methods to `PhotoCollectionFetchers.js` (430 lines), reducing PhotoCollection.js to 309 lines while maintaining cohesion

### Scroll Indicator Visibility on Light Themes
**Fixed 2025-01-14**: Scroll indicator was not visible on light background grid themes (slide-mount, lightbox). Fixed by using theme-aware colors and proper text inheritance in PhotoGrid.jsx and PhotosList.css

### PhotoGrid Empty State Display
**Fixed 2025-01-14**: PhotoGrid was showing empty theme background when no photos available. Fixed by hiding PhotoGrid component when photo count is zero in PhotoListContent.jsx

### Privacy Policy and Terms of Use Menu Not Working
**Fixed 2025-01-14**: Clicking Privacy Policy or Terms of Use in the Help (?) menu did nothing. Two issues:
1. **Missing event handlers**: Menu items were defined in `lib.rs` but `on_menu_event` handler was missing cases for `privacy_policy` and `terms_of_use`
2. **Tailwind CSS not installed**: DocumentViewer component used Tailwind CSS classes but PhotoClove doesn't use Tailwind, causing the modal to be invisible

**Solution**:
- Added event handlers for `privacy_policy` and `terms_of_use` in `src-tauri/src/lib.rs`
- Migrated DocumentViewer to CSS Modules (`DocumentViewer.module.css`) using PhotoClove's design system variables
- Fixed markdown parser to properly handle consecutive list items and remove extra `<br/>` tags around `<ul>` elements

### Face Deletion Confirm Dialog Showing After Deletion
**Fixed 2025-01-31**: Face deletion in PhotoViewer and Unknown Faces batch operations showed confirm dialog after the face was already deleted. Caused by `window.confirm` being synchronous but not properly blocking in Tauri environment.

**Solution**:
- Replaced `window.confirm` with `@tauri-apps/plugin-dialog` `confirm` function
- Used async/await for proper dialog handling
- Applied fix to both PhotoFaces.jsx and SelectionTab.jsx

### IMPORT Mode Error with Unified API
**Fixed 2026-02-01**: Clicking photos in IMPORT mode caused error "IMPORT mode uses ImportState.changeDirectory(), not get_photos_unified".

**Solution**:
- Added `!viewMode.isImportMode()` check to `needsUnifiedAPI` condition in `usePhotoLoader.js`
- IMPORT mode now correctly uses its own loading mechanism via ImportState

### Language Selection Screen Layout Issues
**Fixed 2026-02-01**: First-time startup language selection screen had layout issues - title cut off, globe icon overlapping with title.

**Solution**:
- Adjusted CSS padding and margins in `Welcome.css`
- Fixed h1 display logic to prevent "PhotoClove へようこそ!" appearing during language selection
- Added separate `.language-title` class for proper styling

### PhotoOption Operations Not Working in PhotoViewer
**Fixed 2026-02-01**: PhotoViewer Selection tab operations (Add to Album, Add Tags, etc.) did nothing when clicked.

**Solution**:
- Created `usePhotoOptionOperations` hook for shared operations
- Created `SharedModals` component for unified modal rendering
- Updated PhotoOption to receive operations via props from PhotosList.jsx
- Modal state is now lifted to PhotosList.jsx and shared between PhotoOption and DirectoryMenu