# PhotoClove Terms and Source Code Reference

This document provides a mapping between PhotoClove features, concepts, and their implementation locations in the source code.

## UI Components

### Main Application
- **Term**: App Shell
- **Implementation**: `src/App.jsx`
- **Description**: Main application container with routing and state management

### Photo Display
- **Term**: PhotosList
- **Implementation**: `src/App/PhotosList.jsx`
- **Description**: Grid view component for displaying photo thumbnails

- **Term**: PhotosListMini
- **Implementation**: `src/App/PhotosList/PhotosListMini.jsx`
- **Description**: Full-screen photo viewer with navigation

- **Term**: PhotoDisplay
- **Implementation**: `src/App/PhotosList/PhotoDisplay.jsx`
- **Description**: Individual photo display component

### Navigation
- **Term**: DateList
- **Implementation**: `src/App/DateList.jsx`
- **Description**: Calendar navigation and Recent Photos access

- **Term**: Home
- **Implementation**: `src/App/Home.jsx`
- **Description**: Home screen with quick actions

- **Term**: Welcome
- **Implementation**: `src/App/Welcome.jsx`
- **Description**: First-time user onboarding screen

### Photo Management
- **Term**: Importer
- **Implementation**: `src/App/Importer.jsx`
- **Description**: Photo import interface with batch selection

- **Term**: PhotoEditor
- **Implementation**: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- **Description**: CSS-based photo editing panel

- **Term**: PhotoTags
- **Implementation**: `src/App/PhotosList/PhotoOption/PhotoTags.jsx`
- **Description**: Tag management panel for photos

### Search & Filtering
- **Term**: SearchTools
- **Implementation**: `src/components/SearchTools.jsx`
- **Description**: Container for search interface

- **Term**: SearchBar
- **Implementation**: `src/components/SearchBar.jsx`
- **Description**: Text input for search queries

- **Term**: AdvancedFilters
- **Implementation**: `src/components/AdvancedFilters.jsx`
- **Description**: EXIF-based and metadata filters

- **Term**: SavedSearches
- **Implementation**: `src/components/SavedSearches.jsx`
- **Description**: Management interface for saved search queries

### Configuration
- **Term**: Preferences
- **Implementation**: `src/App/Preferences.jsx`
- **Description**: Application settings and configuration

- **Term**: FolderPicker
- **Implementation**: `src/FolderPicker.jsx`
- **Description**: Directory selection component

### System Components
- **Term**: JobQueue
- **Implementation**: `src/App/JobQueue.jsx`
- **Description**: Background job monitoring interface

- **Term**: LogViewer
- **Implementation**: `src/App/LogViewer.jsx`
- **Description**: Debug log viewing interface

### Tag Components
- **Term**: TagChip
- **Implementation**: `src/components/TagChip.jsx`
- **Description**: Individual tag display with optional remove

- **Term**: TagInput
- **Implementation**: `src/components/TagInput.jsx`
- **Description**: Tag creation with color picker

- **Term**: TagSelector
- **Implementation**: `src/components/TagSelector.jsx`
- **Description**: Multi-select tag assignment interface

## Backend Services

### Core Services
- **Term**: PhotoService
- **Implementation**: `src-tauri/src/domain_service/photo_service.rs`
- **Description**: Photo processing and management

- **Term**: JobQueueService
- **Implementation**: `src-tauri/src/domain_service/job_queue_service.rs`
- **Description**: Background task processing

- **Term**: LoggingService
- **Implementation**: `src-tauri/src/domain_service/logging_service.rs`
- **Description**: Structured logging with daily rotation

- **Term**: TokenStorageService
- **Implementation**: `src-tauri/src/domain_service/token_storage_service.rs`
- **Description**: Secure OAuth token management

### Entities
- **Term**: PhotoMeta
- **Implementation**: `src-tauri/src/entity/photo_meta.rs`
- **Description**: Photo metadata structure

- **Term**: Config
- **Implementation**: `src-tauri/src/entity/config.rs`
- **Description**: Application configuration

- **Term**: JobQueue
- **Implementation**: `src-tauri/src/entity/job_queue.rs`
- **Description**: Background job definitions

- **Term**: GooglePhotos
- **Implementation**: `src-tauri/src/entity/google_photos.rs`
- **Description**: Google Photos integration types

### Repositories
- **Term**: MetaDB
- **Implementation**: `src-tauri/src/repository/meta_db/sqlite.rs`
- **Description**: SQLite database operations

- **Term**: DirectoryRepo
- **Implementation**: `src-tauri/src/repository/dir.rs`
- **Description**: File system operations

## Frontend Services

### JavaScript Services
- **Term**: LoggerService
- **Implementation**: `src/services/LoggerService.js`
- **Description**: Frontend structured logging

- **Term**: FirebaseAuth
- **Implementation**: `src/services/firebase/auth.js`
- **Description**: OAuth authentication flow

### React Hooks
- **Term**: useSearch
- **Implementation**: `src/hooks/useSearch.js`
- **Description**: Search functionality hook

- **Term**: usePhotos
- **Implementation**: `src/hooks/usePhotos.js`
- **Description**: Photo data management hook

### React Contexts
- **Term**: PhotoContext
- **Implementation**: `src/context/PhotoContext.jsx`
- **Description**: Global photo state management

- **Term**: UIContext
- **Implementation**: `src/context/UIContext.jsx`
- **Description**: UI state and navigation

## Common Patterns

### UI State Toggles
- Pattern: `toggle*()` functions
- Examples: `toggleEditMode()`, `toggleFullScreen()`, `toggleTagSelector()`
- Description: Functions that switch UI states

### React Hooks
- Pattern: `use*()` functions
- Examples: `useSearch()`, `usePhotos()`, `useState()`, `useEffect()`
- Description: React hooks for state and side effects

### Tauri Commands
- Pattern: `#[tauri::command]` decorated functions
- Location: `src-tauri/src/lib.rs`
- Description: Backend API endpoints

### Job Types
- Photo Import: `JOB_TYPE_COPY`
- Thumbnail Generation: `JOB_TYPE_THUMBNAIL`
- Google Photos Upload: `JOB_TYPE_GOOGLE_PHOTOS_UPLOAD`

## Database Tables

### Core Tables
- `photo_metadata`: Main photo information
- `photo_collections`: Album/Tag definitions with colors
- `photo_collection_items`: Photo-album/tag relationships
- `date_summary`: Pre-computed photo counts by date
- `job_queue`: Background job tracking
- `saved_searches`: Stored search queries

## File Organization

### Photo Storage
- Import Directory: `~/.photoclove/import/`
- Structure: `YYYY-MM-DD/device-uuid/filename`
- Example: `2024-12-25/abc123-def456/IMG_001.jpg`

### Configuration
- Config File: `~/.photoclove.yml`
- Thumbnails: `~/.photoclove/thumbnail/`
- Trash: `~/.photoclove/trash/`
- Logs: `~/.local/share/photoclove/logs/`

## Viewing Modes

### PhotosList Modes
- **Date View**: Shows photos from a specific date
- **Recent Photos**: Shows 60 most recent imports
- **Search Results**: Shows filtered photos
- **Album View**: Shows photos in an album

### Fetch Methods
- `date`: Fetch by specific date
- `recent`: Fetch recent photos
- `search`: Fetch search results
- `album`: Fetch album photos

## Keyboard Shortcuts

### Global
- `Ctrl+Shift+L`: Open LogViewer
- `Escape`: Close dialogs/fullscreen

### Photo Navigation
- Arrow keys: Navigate between photos
- `Enter`: Open photo in fullscreen
- `Delete`: Move photo to trash

## API Endpoints

### Photo Operations
- `get_photos_with_filter`: Retrieve photos with filters
- `save_star`: Save star rating
- `save_comment`: Save photo comment
- `save_css_style`: Save CSS transformations
- `delete_photos`: Move photos to trash

### Search Operations
- `search_photos`: Execute photo search
- `get_saved_searches`: Retrieve saved searches
- `save_search`: Store search query
- `delete_saved_search`: Remove saved search

### Tag Operations
- `get_all_tags`: List all tags
- `create_tag`: Create new tag
- `add_tag_to_photo`: Assign tag to photo
- `remove_tag_from_photo`: Remove tag from photo

### Album Operations
- `get_albums`: List all albums
- `create_album`: Create new album
- `add_photos_to_album`: Add photos to album
- `remove_photos_from_album`: Remove photos from album

### Google Photos
- `google_photos_upload`: Upload photo to Google Photos
- `refresh_google_token`: Refresh OAuth token
- `clear_google_auth`: Remove stored credentials

## Error Handling

### Common Error Patterns
- Null reference errors: Use optional chaining (`?.`)
- State initialization: Check UIContext defaults
- Async operations: Handle Promise rejections
- File operations: Check permissions and paths

### Debugging Tools
- LogViewer: Real-time log inspection
- Structured logging: Correlation IDs for tracing
- Test commands: `test_keyring` for OAuth debugging