# PhotosList/PhotosListMini Modes and Operations Documentation

This document provides comprehensive documentation of all viewing modes in PhotosList and PhotosListMini components, detailing available tabs and permitted operations in each mode.

## 📋 Overview

PhotoClove's photo viewing system consists of two main components:
- **PhotosList**: Main grid view component with thumbnail display
- **PhotosListMini**: Full-screen single photo display with navigation thumbnails

Both components support multiple viewing modes with different available operations and tabs.

## 🔄 View Modes

PhotoClove supports 11 distinct viewing modes, each with specific functionality and available operations:

1. **HOME** (`home`) - Welcome screen and dashboard
2. **DATE** (`date`) - Photos organized by date selection
3. **RECENT** (`recent`) - 60 most recently imported photos
4. **SEARCH** (`search`) - Basic text search results
5. **ADVANCED_SEARCH** (`advanced_search`) - Advanced filtering results
6. **ALBUM_LIST** (`album_list`) - Grid of all available albums
7. **ALBUM** (`album`) - Photos within a specific album
8. **TAG_LIST** (`tag_list`) - Grid of all available tags
9. **TAG** (`tag`) - Photos with a specific tag
10. **IMPORT** (`import`) - Browse and import external photos
11. **TRASH** (`trash`) - Soft-deleted photos

### 1. HOME Mode (`home`)
**Description**: Initial application state showing welcome screen or home dashboard

**PhotosList State**:
- Not active (shows welcome screen instead)
- No photo operations available

**PhotosListMini State**:
- Not accessible
- No tabs available

---

### 2. DATE Mode (`date`)
**Description**: Display photos organized by specific date selection

**PhotosList State**:
- ✅ Grid view with date-filtered photos
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ All batch operations available

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ All tabs available

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Move to trash
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

### 3. RECENT Mode (`recent`)
**Description**: Display 60 most recently imported photos

**PhotosList State**:
- ✅ Grid view with recent photos (max 60)
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ All batch operations available

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails  
- ✅ All tabs available

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Move to trash
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

### 4. SEARCH Mode (`search`)
**Description**: Display photos matching search query with basic search

**PhotosList State**:
- ✅ Grid view with search results
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ All batch operations available
- ✅ Search tools sidebar visible

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ All tabs available

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Search Operations**:
- ✅ Clear search
- ✅ Modify query

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Move to trash
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

### 5. ADVANCED_SEARCH Mode (`advanced_search`)
**Description**: Display photos with advanced filtering (EXIF, tags, ratings, etc.)

**PhotosList State**:
- ✅ Grid view with filtered results
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ All batch operations available
- ✅ Advanced search tools visible

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ All tabs available

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Filter Operations**:
- ✅ Apply/modify advanced filters
- ✅ Save searches

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Move to trash
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

### 6. ALBUM_LIST Mode (`album_list`)
**Description**: Display grid of all available albums

**PhotosList State**:
- ✅ Album grid view (not photo grid)
- ✅ Album creation supported
- ✅ Album selection/management
- ❌ Photo operations not available

**PhotosListMini State**:
- ❌ Not accessible (no individual photos to display)

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Album selection and bulk management
  - ✅ View selected albums list with photo counts
  - ✅ Delete Selected Albums (with confirmation)
  - ✅ Clear Album Selection
  - ✅ Bulk Management (multi-select albums)
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no individual photos)

**Album Management Operations**:
- ✅ Create new album
- ✅ View album details
- ✅ Navigate to album

---

### 7. ALBUM Mode (`album`)
**Description**: Display photos within a specific album

**PhotosList State**:
- ✅ Grid view with album photos
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ Album-specific operations available

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ **All tabs including Album tab**

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and album-specific batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ **Remove from Current Album** (unique to album mode)
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ✅ **Album Tab** (right sidebar): Album management and operations
  - ✅ View album information (name, description, photo count, creation date)
  - ✅ Edit album name and description
  - ✅ Set current photo as album cover
  - ✅ Delete album (keeps photos in library)
  - ✅ View album statistics
- ❌ **Selection Tab**: Not available (single photo focus)

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Remove from album (with confirmation for permanent delete)

---

### 8. TAG_LIST Mode (`tag_list`)
**Description**: Display grid of all available tags

**PhotosList State**:
- ✅ Tag grid view (not photo grid)
- ✅ Tag creation supported
- ✅ Tag selection/management
- ❌ Photo operations not available

**PhotosListMini State**:
- ❌ Not accessible (no individual photos to display)

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Tag selection and bulk management
  - ✅ View selected tags list with photo counts and colors
  - ✅ Delete Selected Tags (with confirmation)
  - ✅ Clear Tag Selection
  - ✅ Bulk Management (multi-select tags)
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no individual photos)

**Tag Management Operations**:
- ✅ Create new tag
- ✅ View tag details
- ✅ Navigate to tag photos

---

### 9. TAG Mode (`tag`)
**Description**: Display photos with a specific tag

**PhotosList State**:
- ✅ Grid view with tagged photos
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ All batch operations available

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ All tabs available

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection and batch operations
  - ✅ Select All Photos
  - ✅ Create Album
  - ✅ Add to Existing Album
  - ✅ Upload to Google Photos
  - ✅ Delete Files
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management (with current tag highlighted)
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo (including current tag)
  - ✅ Add additional tags
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ✅ **DEL**: Move to trash
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

### 10. IMPORT Mode (`import`)
**Description**: Browse and import photos from external directories

**PhotosList State**:
- ✅ Grid view with importable photos from external directory
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ Import-specific operations available
- ✅ Directory navigation in DirectoryTab

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ Limited tabs available (no editing operations)

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Directory Tab** (right sidebar): Directory navigation and import source management
  - ✅ Import source dropdown selection (multiple configured paths)
  - ✅ Current directory path display with parent navigation
  - ✅ Folder list with scrollable navigation
  - ✅ Parent directory navigation (↩️ icon)
  - ✅ Import filter text input for file filtering
- ✅ **Selection Tab** (left sidebar): Photo selection with import-specific operations
  - ✅ Select All Photos in Page
  - ✅ Select All in Current Directory
  - ✅ **Import Selected Photos** (unique to import mode)
  - ✅ Unselect All
  - ✅ Clear Selection
  - ✅ Import progress tracking with real-time updates
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (external photos, not yet in library)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Limited photo information
  - ✅ File path and basic information
  - ✅ File size and basic metadata
  - ❌ Star rating, comments, EXIF (not available for external files)
- ❌ **Editor Tab**: Not available (external photos cannot be edited)
- ❌ **Tags Tab**: Not available (external photos cannot be tagged)
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Import Operations**:
- ✅ Browse external directories
- ✅ Navigate parent/child directories
- ✅ Filter files by name/extension
- ✅ Select individual or batch photos
- ✅ Import to PhotoClove library with JobQueue integration
- ✅ Real-time import progress tracking
- ✅ Switch between configured import sources

**Directory Navigation**:
- ✅ Dropdown selection of configured import paths
- ✅ Folder browsing with click navigation
- ✅ Parent directory traversal (↩️ button)
- ✅ Current path normalization and display
- ✅ Scrollable folder list in DirectoryTab

**Import Progress Tracking**:
- ✅ Real-time progress percentage
- ✅ Current file being processed
- ✅ Job queue integration with correlation IDs
- ✅ Error reporting and status updates

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ❌ **DEL**: Not available (cannot delete external files)
- ✅ **C**: Select/unselect current photo
- ❌ **F**: Not available (no star rating for external files)

**Architecture Components**:
- **ImportState Entity**: Centralized import state management with path normalization
- **PhotoCollection**: Unified data abstraction for import sources
- **JobQueue Integration**: Background import processing with progress events
- **ViewMode Integration**: Proper mode transitions and display condition management

---

### 11. TRASH Mode (`trash`)
**Description**: Display photos in trash bin (soft deleted)

**PhotosList State**:
- ✅ Grid view with trash photos
- ✅ Infinite scroll enabled
- ✅ Photo selection supported
- ✅ Trash-specific operations available

**PhotosListMini State**:
- ✅ Single photo display
- ✅ Navigation thumbnails
- ✅ All tabs available
- ⚠️ **Special path handling** (uses trash_path for display)

**Available Tabs in PhotosList (Grid View)**:
- ✅ **Selection Tab** (left sidebar): Photo selection with trash-specific operations
  - ✅ Select All Photos
  - ✅ Bulk Restore Photos
  - ✅ Bulk Permanent Delete
  - ✅ Clear Selection
- ❌ **Info/Editor/Tags/Album Tabs**: Not available (no single photo selected)

**Available Tabs in PhotosListMini (Full-Screen View)**:
- ✅ **Info Tab** (right sidebar): Photo metadata and rating
  - ✅ Star rating (1-5 stars)
  - ✅ Comment editing
  - ✅ EXIF data viewing
  - ✅ Copy file path/photo information
- ✅ **Editor Tab** (right sidebar): Full photo editing capabilities
- ✅ **Tags Tab** (right sidebar): Tag assignment and management
  - ✅ View assigned tags
  - ✅ Add existing tags
  - ✅ Create new tags
  - ✅ Remove tags from photo
- ❌ **Album Tab**: Not available (not in album mode)
- ❌ **Selection Tab**: Not available (single photo focus)

**Individual Photo Operations**:
- ✅ Restore photo
- ✅ Permanent delete

**Navigation Operations**:
- ✅ Previous/next photo (arrow keys)
- ✅ Thumbnail navigation
- ✅ ESC to close full-screen view

**Keyboard Controls (PhotosListMini)**:
- ✅ **Arrow Keys**: Navigate between photos
- ✅ **ESC**: Close full-screen view
- ⚠️ **DEL**: Permanently deletes (context-aware)
- ✅ **C**: Select/unselect current photo
- ✅ **F**: Select photo and increase star rating

---

## 🔄 State Management

### Context Integration
- **PhotoContext**: Manages current photo data, date selection, album state
- **UIContext**: Manages view mode transitions and current selection with ViewMode DDD architecture
- **ErrorContext**: Handles error states across all modes

### ViewMode DDD Architecture
- **ViewMode Value Object**: Immutable domain object encapsulating view mode logic and display conditions
- **Display Condition Methods**: Centralized UI logic with methods like `shouldShowDirectoryTab()`, `shouldShowImportOperations()`
- **State Machine**: Transition validation and navigation management with `useViewMode` hook
- **Mode Detection**: Clean mode checking with methods like `isImportMode()`, `isAlbumMode()`

### Import Mode State Management
- **ImportState Entity**: Centralized import state management with path normalization and JobQueue integration
- **PhotoCollection**: Unified data abstraction for import sources and library photos
- **useFetchConfig Hook**: Separated fetch configuration logic for better maintainability

### Data Fetching
- **Unified API**: All modes use `get_photos_with_filter` with different parameters
- **Import Mode**: Uses `list_directory` command for external directory browsing
- **Infinite Scroll**: Implemented in all grid views with 50-photo batches
- **Caching**: Photo metadata cached in `imgCacheMap`

---

## 🚫 Operation Restrictions

### Mode-Specific Restrictions
- **Album Tab**: Only available in Album Mode
- **Directory Tab**: Only available in Import Mode
- **Remove from Album**: Only available in Album Mode selections
- **Import Operations**: Only available in Import Mode (Import Selected, Select All in Directory)
- **Trash Operations**: Only available in Trash Mode (Restore, Permanent Delete)
- **Search Operations**: Only available in Search/Advanced Search modes
- **Edit Operations**: Not available in Import Mode (external files cannot be edited)
- **Tag Operations**: Not available in Import Mode (external files cannot be tagged)

### Component Restrictions  
- **PhotosListMini**: Not accessible in ALBUM_LIST, TAG_LIST modes (no individual photos)
- **Tab Operations**: All tabs require a selected photo (`currentPhotoPath`)
- **External File Limitations**: Import Mode photos cannot be edited, tagged, or rated until imported

---

## 🔍 Technical Implementation

### Component Architecture
```
PhotosList (Main Container)
├── PhotoOption (Tab Panel)
│   ├── PhotoInfo (Info Tab)
│   ├── PhotoEditor (Editor Tab - not in Import Mode)  
│   ├── PhotoTags (Tags Tab - not in Import Mode)
│   └── AlbumTab (Album Tab - Album Mode only)
├── DirectoryMenu (Selection Operations & Directory Navigation)
│   ├── Directory Tab (Import Mode only)
│   │   ├── Import Source Dropdown
│   │   ├── Current Path Display
│   │   ├── Parent Directory Navigation (↩️)
│   │   ├── Folder List (Scrollable)
│   │   └── Import Filter Input
│   └── Selection Tab
│       ├── Standard Operations (non-Import modes)
│       ├── Import Operations (Import Mode only)
│       ├── Album Operations (Album Mode only)
│       └── Import Progress Display (Import Mode)
├── PhotosListMini (Full-Screen View)
│   └── PhotoDisplay (Single Photo Renderer)
└── SearchTools (Search Interface - conditional)
```

### Mode Detection Logic
```javascript
// ViewMode DDD approach in PhotosList.jsx
// Use ViewMode value object for clean mode detection
const viewModeObj = useViewModeObject(viewMode, modeData);

// Modern approach with ViewMode methods:
viewModeObj.isImportMode()     // instead of viewMode === 'import'
viewModeObj.isAlbumMode()      // instead of viewMode === 'album'
viewModeObj.isTrashMode()      // instead of viewMode === 'trash'

// Display condition methods:
viewModeObj.shouldShowDirectoryTab()      // Import Mode only
viewModeObj.shouldShowImportOperations()  // Import-specific operations
viewModeObj.shouldShowAlbumOperations()   // Album-specific operations
viewModeObj.shouldShowStandardOperations() // Standard operations (non-import)

// Legacy compatibility still supported:
// viewMode === 'date', 'search', 'album', 'import', 'trash', etc.
```

### Path Resolution
```javascript
// Path handling for different modes using PhotoCollection
const getDisplayPath = (photo) => {
    // Trash Mode: Use trash_path prefix
    if (viewModeObj.isTrashMode() && config?.trash_path) {
        const trashPath = config.trash_path.replace(/\/$/, '');
        const normalizedPath = photo.path.startsWith('/') ? photo.path : '/' + photo.path;
        return trashPath + normalizedPath;
    }
    
    // Import Mode: Use original external path
    if (viewModeObj.isImportMode()) {
        return photo.file?.path || photo.path;
    }
    
    // Standard modes: Use library path
    return photo.path;
};
```

### Import Mode Data Flow
```javascript
// Import Mode uses different data structure and API
const fetchImportPhotos = async (importPath) => {
    // Use list_directory command instead of get_photos_with_filter
    const response = await invoke('list_directory', { 
        path: importPath,
        filter: importFilter 
    });
    
    // Normalize data structure to match standard photo format
    return response.map(item => ({
        file: { path: item.path, name: item.name },
        // No metadata available for external files
    }));
};

// ImportState entity manages directory navigation
class ImportState {
    changeDirectory(newPath) { /* Path normalization and validation */ }
    getParentDirectory() { /* Parent path calculation */ }
    importPhotos(selectedPaths) { /* JobQueue integration */ }
}
```

This documentation provides a complete reference for understanding and working with PhotosList/PhotosListMini modes and operations in PhotoClove.