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

### HEIC/HEIF/AVIF Format Support
**Added 2026-02-12**: Full HEIC/HEIF/AVIF format support using libheif-rs with `compile-libheif` feature.
- **Import**: HEIC/AVIF files are now scanned and imported with JPEG thumbnail generation
- **Display**: Progressive loading (EXIF thumbnail → full decode) for HEIC/AVIF in PhotoViewer
- **EXIF**: Metadata extraction from HEIC/AVIF files via libheif
- **AI Tagging**: HEIC/AVIF files work with all AI models (MobileNet, OpenCLIP, SigLIP)
- **Face Detection**: HEIC/AVIF files work with face detection and face thumbnail generation
- **Maintenance**: Thumbnail regeneration supports HEIC/AVIF files
- **Key files**: `src-tauri/src/utils/heic_decode.rs` (new), `src-tauri/src/utils/raw_file.rs` (is_heic_or_avif)

### HEIC/AVIF Thumbnail Not Generated During Import
**Fixed 2026-02-12**: HEIC files imported but thumbnails not created. Import pipeline was generating `.preview.jpg` instead of `{filename}.heic.jpg` that `set_has_thumbnail()` expects.
- **Fix**: Changed import.rs to generate thumbnail at the correct path matching thumbnail store convention

### HEIC/AVIF Maintenance Thumbnail Regeneration
**Fixed 2026-02-12**: Maintenance tab "Regenerate Thumbnails" skipped HEIC/AVIF files. `process_raw_thumbnails` in photo_service.rs only checked `is_raw_file()`.
- **Fix**: Added `is_heic_or_avif()` check alongside `is_raw_file()` in photo_service.rs

### HEIC/AVIF Face Detection and AI Tagging
**Fixed 2026-02-12**: Face Detection and AI Tagging failed for HEIC/AVIF files because 4 locations used `image::open()` which doesn't support HEIC.
- **Fix**: Added `heic_decode::decode_heic_to_image()` routing in face_detection/service.rs, face_thumbnail_service.rs, ai_tagging/backend/onnx.rs, ai_tagging/backend/clip_common.rs

### AI Tag Confidence Display Normalization
**Fixed 2026-02-12**: PhotoTags.jsx displayed raw cosine similarity values (e.g., 31%) instead of normalized scale matching the slider. A clear cat photo showed 31% instead of a meaningful percentage.
- **Fix**: Added `parseConfidence()` with `MODEL_THRESHOLD_RANGES` normalization in PhotoTags.jsx

### OpenCLIP Threshold Range Calibration
**Fixed 2026-02-12**: OpenCLIP `MODEL_THRESHOLD_RANGES` max was set to 0.40 but real-world data shows max scores around 0.31. Calibrated from 878 actual AI tag samples: observed max ~0.314, P99 ~0.29. Changed to max: 0.33 for accurate confidence display.

### HEIC/RAW Face Thumbnail Display Failure
**Fixed 2026-02-15**: Face detection worked for HEIC images but face thumbnails failed to display. Backend `face_thumbnail_service.rs` decoded HEIC directly instead of using persistent cache, and frontend fallback tried browser-side HEIC decoding which isn't supported.
- **Fix**: Backend now checks `{thumbnail_store}/decoded/{hash}.jpg` persistent cache first. Frontend fallback uses `get_resized_image` command for HEIC/RAW files instead of browser decode.

### Persistent RAW/HEIC Decoded Cache
**Added 2026-02-15**: RAW/HEIC decoded images were stored in `~/.cache/` which was cleared on startup, requiring re-decode on every restart. Moved to `{thumbnail_store}/decoded/` for persistence across restarts.

### Share/Collage HEIC/RAW Support
**Fixed 2026-02-14**: Share and Collage features failed for HEIC/RAW images because `ImageProcessingUtils.js` tried to load non-native formats directly in the browser.
- **Fix**: Added backend decode routing for non-native formats via `get_resized_image` command.

### PNG Copyright Metadata in Share
**Added 2026-02-14**: Share save now embeds copyright metadata (XMP dc:rights) in PNG files and uses timestamped filenames.

### Light Theme Redesign to Slate Blue
**Added 2026-02-13**: Redesigned Light Theme with Slate Blue color scheme for improved readability. Added theme change achievement.

### Selection Tab Preview Display Issues
**Fixed 2026-02-11**: Selection tab preview images had display and layout issues in PhotoOption panel.

### Light Theme Visibility on Film Background
**Fixed 2026-02-11**: Several UI components were invisible or hard to read when using Light Theme with film background surfaces. Fixed DateList, LeftMenu, PhotosList, NotificationBell, and VerticalTabBar styles.

### Crop Tool Move, Resize, and Edge-Drag
**Added 2026-02-10**: Added interactive move, resize, and edge-drag interactions to the Crop tool in PhotoEditor. Users can now drag crop area edges and corners.

### Menu Bar Reorganization with System Menu
**Added 2026-02-07**: Reorganized menu bar with System menu, keyboard shortcuts, and emojis for better usability.

### Relative Path Storage for Cross-OS NAS Support
**Added 2026-02-05**: Store relative paths in database instead of absolute paths, enabling cross-OS NAS support. Photos can be accessed from different operating systems sharing the same NAS storage.

### Custom React Dialogs
**Added 2026-02-04**: Replaced native Tauri dialogs (`window.confirm`, `window.alert`) with custom React dialog components (`AppDialog.jsx`) for consistent cross-platform appearance. Added CLI Quick View mode for directory-based viewing.

### NEV File Import Support
**Added 2026-02-04**: Added NEV file format to the import pipeline with unsupported format placeholder display.

### RAW File Support (3FR)
**Added 2026-02-03**: Added comprehensive RAW file support including 3FR thumbnail extraction and subdirectory scanning. Progressive RAW image loading with EXIF thumbnail → full decode pipeline.

### Notification Center
**Added 2026-02-03**: Added notification center with bell icon in left sidebar. Notifications aggregate errors, warnings, and system events with read/unread status.

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

### Date Mode Selection Not Unified Across Dates
**Fixed 2026-02-02**: In Date ViewMode, photo selection was stored separately for each date. Selecting photos on one date and switching to another date would lose the selection.

**Solution**:
- Changed `getSelectionKey()` in ViewMode.js to return just `'DATE'` instead of `DATE:${date}`
- All dates now share a unified selection state, allowing users to select photos across multiple dates

### Sort Selection Has No Effect (Cache Showed Old Order)
**Fixed 2026-05-04**: Choosing a different sort in the toolbar didn't reorder the grid. The view-cache key omitted `sortOfPhotos`, so the lookup hit the previously-cached array (with the old sort) and `useViewModeSync` returned early before the sort change could trigger a backend refetch.

**Solution**:
- `getViewKey()` (`src/utils/ViewKey.js`) now appends `|sort:<n>` to every key, partitioning the LRU cache per sort.
- Switching sort produces a cache miss → backend fetch with the new ORDER BY. Returning to a previous sort hits the cached entry instantly within LRU limits.

### PhotoDisplay Jumps to First Photo After Delete
**Fixed 2026-05-04**: Opening a photo, navigating prev/next inside PhotoDisplay, then deleting jumped back to the photo originally opened from the grid (often photo #0) instead of staying at the next surviving photo.

**Solution**:
- `usePhotoNavigation` only updated `photosListMiniCurrentIndex`, leaving `currentPhotoIndex` (set once by `displayPhoto`) stale. The bulk + single removal helpers were using the stale `currentPhotoIndex` to compute the new target.
- Both helpers now use `photosListMiniCurrentIndex` — the single source of truth for "the photo currently shown in PhotoDisplay" — so deletion stays at the next photo (or steps back from the end).

### Save as Copy Crashes the Photo Viewer
**Fixed 2026-05-04**: PhotoEditor's "Save as Copy" inserted the new photo with field-name mismatches (`css_style` vs `cssStyle`, `metaData` vs `meta_data`) and without a `configData` payload. `Photo.fromJSON` then threw `requires config parameter` from inside `PhotosListMini`'s map, taking down the whole component.

**Solution**:
- `addPhotoToList` augments the new photo with `configData` derived from `appConfig` before splicing into all three state slots (grid, mini, View Cache).
- `photoExportUtils.saveStyledCopy` now writes field names that match `Photo.fromJSON`'s expectations.

### Closing PhotoDisplay Shows "Loading your photos..."
**Fixed 2026-05-04 (Phase 2)**: Closing PhotoDisplay always called `refreshPhotos()`, forcing a 500ms minimum loading screen for routine actions like star/comment/tag edits.

**Solution**:
- All in-PhotoDisplay edits now mutate `allPhotosForCurrentFetch`, `photosListMiniAllPhotos`, and the View Cache atomically via dedicated helpers (`updatePhotoTags`, `updatePhotoCssStyle`, `addPhotoToList`, `handlePhotoRemovalNavigationBulk`, etc.).
- `closePhotoDisplay` no longer calls `refreshPhotos`. Only when star edits invalidated a star sort does it run a local re-sort via the shared comparator in `src/utils/PhotoSort.js`.

### Stale Backend Load Overwrites Newly-Cached View
**Fixed 2026-05-07**: Picking view A (slow backend load), then switching mid-load to view B (cache hit) would briefly show B's photos and then have A's late response replace them. Affected every view mode (date, album, tag, ...).

**Solution**:
- `usePhotoLoader` exposes `cancelInFlightLoad` (the cancellation hook's `cancelAll`).
- `useViewModeSync`'s cache-hit branch and non-loadable-mode early return both call it, bumping the request-id counter so any pending load's response is dropped on arrival.

### Selection Sidebar Preview Stuck Showing a Broken Image
**Fixed 2026-05-07**: Clicking a file name in the right-sidebar selection list shows a small preview. Deselecting that photo (or any earlier photo in the list) left the preview pointing at a stale or shifted slot — a broken `<img>` plus the "Enlarge preview" link both stayed visible.

**Solution**:
- Track the previewed photo by **path**, not by index. Render the preview block only when the path is still in `photoSelection`. Both the `<img>` and the "Enlarge preview" link are hidden together when the previewed photo leaves the selection.

### Right-Sidebar Selection File Names Appeared White (Dark Theme)
**Fixed 2026-05-06**: `.rightMenu a { color: var(--color-film-link); }` and `.rightMenu { color: var(--color-film-text); }` — both variables were defined only in the `[data-theme="light"]` block. In the default dark theme the variables were undefined and the rules effectively cleared themselves, so links inherited the body color (`#e4e4e4`) and looked unreachable.

**Solution**:
- `:root` (dark default) now also defines `--color-film-link: #4a9eff`, `--color-film-text: #e4e4e4`, and `--color-bg-film-light: #1e293b`.

### Date Sidebar Navigation Broke Under Non-English Locale
**Fixed 2026-05-04**: The date sidebar emitted locale-formatted date strings as click keys (e.g., `2022年12月1日`), which the backend couldn't parse.

**Solution**:
- `data-date` on every date sidebar link and on `#photoList` is now ISO (`YYYY-MM-DD`) regardless of locale. The locale-formatted version remains as the visible label only.