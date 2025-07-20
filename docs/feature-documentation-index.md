# PhotoClove Feature Documentation Index

This reverse index helps you quickly find the relevant documentation when working on specific features or trying to understand particular aspects of the codebase.

## Quick Reference by Feature

### 🏠 Application Startup & Navigation
**When you need to understand**: App initialization, routing, menu system
- **Architecture**: [System Architecture](architecture.md#system-architecture) → Frontend Architecture → Application Shell
- **Sequences**: [Application Startup Sequence](feature-sequences.md#application-startup-sequence)
- **Components**: [Main Application Container](component-structure.md#main-application-container), [Left Menu](component-structure.md#left-menu-and-date-list)
- **Related Files**: `src/App.jsx`, `src/main.jsx`, `src-tauri/src/lib.rs`

### 📸 Photo Import System
**When you need to understand**: File importing, directory scanning, batch processing
- **Architecture**: [Key Features → Photo Import Process](architecture.md#1-photo-import-process)
- **Sequences**: [Photo Import Feature](feature-sequences.md#photo-import-feature)
- **Components**: [Import Interface](component-structure.md#import-interface)
- **Related Files**: `src/App/Importer.jsx`, `src/App/Importer/SelectedPhotoInfo.jsx`, `src-tauri/src/domain_service/job_queue_service.rs`

### 🖼️ Photo Viewing & Grid Display
**When you need to understand**: Photo galleries, thumbnails, infinite scroll, filtering
- **Architecture**: [Key Features → Photo Viewing & Management](architecture.md#2-photo-viewing--management)
- **Sequences**: [Photo Viewing Feature](feature-sequences.md#photo-viewing-feature)
- **Components**: [Photo Grid View](component-structure.md#photo-grid-view), [Full-Screen Photo Display](component-structure.md#full-screen-photo-display)
- **Features**: Infinite scroll pagination, batch loading (50 photos), configuration limit detection, smooth browsing experience
- **Related Files**: `src/App/PhotosList.jsx`, `src/App/PhotosList/PhotosListMini.jsx`, `src/App/PhotosList/PhotoDisplay.jsx`

### 🎨 Photo Editing & Transformations
**When you need to understand**: Image filters, cropping, CSS transformations, save-as-copy
- **Architecture**: [Key Features → Photo Organization](architecture.md#3-photo-organization)
- **Sequences**: [Photo Editing Feature](feature-sequences.md#photo-editing-feature)
- **Components**: [Photo Editor Panel](component-structure.md#photo-editor-panel)
- **Related Files**: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`, `src-tauri/src/lib.rs` (save_styled_copy_from_frontend)

### 📅 Date-Based Organization & Recent Photos
**When you need to understand**: Calendar navigation, date filtering, photo organization by date, recent photos access
- **Architecture**: [Data Storage Strategy](architecture.md#2-data-storage-strategy) → Filesystem Organization
- **Sequences**: [Date List Loading](feature-sequences.md#1-date-list-loading), [Recent Photos Navigation](feature-sequences.md#recent-photos-navigation)
- **Components**: [Left Menu and Date List](component-structure.md#left-menu-and-date-list)
- **Features**: Calendar-based navigation, Recent Photos quick access (60 most recent), optimized database queries
- **Related Files**: `src/App/DateList.jsx`, `src-tauri/src/value/date.rs`, `src/context/PhotoContext.jsx`

### ⚙️ Configuration Management
**When you need to understand**: App settings, preferences, directory configuration
- **Architecture**: [Core Components → Configuration Components](architecture.md#4-configuration-components)
- **Sequences**: [Configuration Management](feature-sequences.md#configuration-management)
- **Components**: [Preferences Screen](component-structure.md#preferences-screen)
- **Related Files**: `src/App/Preferences.jsx`, `src/FolderPicker.jsx`, `src-tauri/src/entity/config.rs`

### 🐛 Debug Logging & Log Viewer
**When you need to understand**: Application debugging, log viewing, correlation tracking
- **Architecture**: [Data Flow → Cross-Component Communication](architecture.md#cross-component-communication)
- **Components**: [Debug Log Viewer](component-structure.md#debug-log-viewer)
- **Access Methods**: Help menu → "Show log", Keyboard shortcut `Ctrl+Shift+L`
- **Features**: Frontend/backend log correlation, structured logging, real-time viewing, export functionality
- **Related Files**: `src/App/LogViewer.jsx`, `src/services/LoggerService.js`, `src-tauri/src/domain_service/logging_service.rs`

### 🔄 Background Job Processing
**When you need to understand**: Async operations, job queues, progress tracking
- **Architecture**: [Performance Optimizations](architecture.md#4-performance-optimizations) → Job Queue
- **Sequences**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **Components**: [Job Queue Interface](component-structure.md#job-queue-interface)
- **Related Files**: `src/App/JobQueue.jsx`, `src-tauri/src/domain_service/job_queue_service.rs`, `src-tauri/src/entity/job_queue.rs`

### 🗄️ Database Operations
**When you need to understand**: SQLite operations, metadata storage, database creation
- **Architecture**: [Data Storage Strategy](architecture.md#2-data-storage-strategy) → SQLite Database Schema
- **Sequences**: [Database Management](feature-sequences.md#database-management)
- **Related Files**: `src-tauri/src/repository/meta_db/sqlite.rs`, `src-tauri/src/entity/photo_meta.rs`

### 📝 Logging & Debugging System
**When you need to understand**: Application logging, LogViewer, debug information, bug investigation
- **Architecture**: Structured logging with frontend LoggerService and backend log macros
- **Components**: LogViewer component (`src/App/LogViewer.jsx`), configurable logging in Preferences
- **Features**: Toggle logging on/off, configurable log levels, structured logging format, daily log files
- **Access**: Ctrl+Shift+L to open LogViewer, Preferences panel for logging settings
- **Storage**: Frontend logs in memory, backend logs in `~/.local/share/photoclove/logs/`
- **Bug Investigation**: Systematic debugging approach documented in `CLAUDE.md`
- **Related Files**: `src/App/LogViewer.jsx`, `src/services/LoggerService.js`, `src-tauri/src/domain_service/logging_service.rs`, `CLAUDE.md`

### 🔍 Advanced Search & Filtering
**When you need to understand**: Advanced search interface, EXIF filters, saved searches, search history, recent photos
- **Architecture**: [Key Features → Advanced Search System](architecture.md#6-advanced-search-system)
- **Sequences**: [Advanced Search Feature](feature-sequences.md#advanced-search-feature)
- **Components**: [Search Tools](component-structure.md#search-tools), [Directory Menu](component-structure.md#directory-menu-when-no-photo-selected)
- **Features**: EXIF-based filtering, saved searches with import/export, search history, database optimization
- **Access Methods**: Search icon in home page, Search tab in PhotosList, Keyboard shortcut navigation
- **Important**: Filter structure consistency between frontend and backend (has_comment vs has_comments, star_rating vs min_rating)
- **Related Files**: `src/components/SearchTools.jsx`, `src/components/SearchBar.jsx`, `src/components/AdvancedFilters.jsx`, `src/components/SavedSearches.jsx`, `src/hooks/useSearch.js`, `src-tauri/src/lib.rs` (search commands)

## Quick Reference by Technology

### 🦀 Rust Backend (Tauri)
**When working on backend features**:
- **Architecture**: [Backend Architecture](architecture.md#backend-architecture)
- **Command Handlers**: `src-tauri/src/lib.rs` (all #[tauri::command] functions)
- **Domain Services**: `src-tauri/src/domain_service/`
- **Entities**: `src-tauri/src/entity/`
- **Repositories**: `src-tauri/src/repository/`

### ⚛️ React Frontend
**When working on UI components**:
- **Architecture**: [Frontend Architecture](architecture.md#frontend-architecture)
- **Component Structure**: [Component Hierarchy](component-structure.md#component-hierarchy)
- **Main Components**: `src/App/` directory
- **Utilities**: `src/services/`, `src/storage/`

### 🗃️ SQLite Database
**When working with metadata**:
- **Schema**: [SQLite Database Schema](architecture.md#sqlite-database-schema)
- **Operations**: `src-tauri/src/repository/meta_db/sqlite.rs`
- **Entities**: `src-tauri/src/entity/photo_meta.rs`

### 📁 File System
**When working with file operations**:
- **Organization**: [Filesystem Organization](architecture.md#filesystem-organization)
- **Services**: `src-tauri/src/domain_service/file_service.rs`
- **Directory Operations**: `src-tauri/src/repository/dir.rs`

## Feature Implementation Guides

### Adding a New Photo Filter
1. **Frontend**: Add filter control in [Directory Menu](component-structure.md#directory-menu-when-no-photo-selected)
2. **Backend**: Extend `get_photos_with_filter` command in `src-tauri/src/lib.rs`
3. **Database**: Add filter logic in `src-tauri/src/repository/db/directory.rs`
4. **Reference**: [Search & Filtering](#-search--filtering)

### Troubleshooting Display Issues
1. **Check component visibility conditions** in parent components (App.jsx)
2. **Verify state management** Context values and prop passing
3. **Review useEffect dependencies** for data loading triggers
4. **Follow bug investigation guide** in `CLAUDE.md` for systematic debugging
5. **Use LogViewer** (Ctrl+Shift+L) to inspect frontend state and backend responses

### Adding a New Photo Transformation
1. **Frontend**: Add control in [Photo Editor Panel](component-structure.md#photo-editor-panel)
2. **CSS**: Extend transformation logic in `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
3. **Backend**: Update `save_css_style` and `save_styled_copy_from_frontend` commands
4. **Reference**: [Photo Editing & Transformations](#-photo-editing--transformations)

### Adding a New Background Job Type
1. **Entity**: Define job type in `src-tauri/src/entity/job_queue.rs`
2. **Service**: Implement in `src-tauri/src/domain_service/job_queue_service.rs`
3. **Frontend**: Add monitoring in [Job Queue Interface](component-structure.md#job-queue-interface)
4. **Reference**: [Background Job Processing](#-background-job-processing)

### Adding a New Configuration Option
1. **Entity**: Add field to `src-tauri/src/entity/config.rs`
2. **Frontend**: Add control in [Preferences Screen](component-structure.md#preferences-screen)
3. **Persistence**: Update save/load logic in config entity
4. **Reference**: [Configuration Management](#-configuration-management)

### Adding a New Import Source
1. **Frontend**: Extend directory picker in `src/App/Importer.jsx`
2. **Backend**: Update `show_importer` command logic
3. **Configuration**: Add to export_from array in config
4. **Reference**: [Photo Import System](#-photo-import-system)

## Error Debugging Guides

### Import Not Working
**Check these areas**:
- **Job Queue**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **File Permissions**: [File System Operations](architecture.md#file-system)
- **Configuration**: [Configuration Management](#-configuration-management)
- **Logs**: Background processing in `src-tauri/src/domain_service/job_queue_service.rs`

### Photos Not Displaying
**Check these areas**:
- **Database**: [Database Operations](#-database-operations)
- **Thumbnails**: [Performance Optimizations](architecture.md#4-performance-optimizations)
- **File Paths**: [Filesystem Organization](architecture.md#filesystem-organization)
- **Sequences**: [Photo Viewing Feature](feature-sequences.md#photo-viewing-feature)

**Recent Bug Fixes**:
- **Thumbnail List Not Updating After Deletion** (Fixed: DEL key deletion now properly removes photos from thumbnail list in all viewing modes)
- **Date Dependencies in Multi-Mode Views** (Fixed: Recent Photos and Search modes now work independently of currentDate, with proper pagination and thumbnail generation)

### Performance Issues
**Optimization areas**:
- **Lazy Loading**: [Performance Optimization Strategies](feature-sequences.md#performance-optimization-strategies)
- **Background Processing**: [Background Job Processing](#-background-job-processing)
- **Caching**: [Lazy Loading and Caching](feature-sequences.md#1-lazy-loading-and-caching)
- **Database Indexing**: [SQLite Database Schema](architecture.md#sqlite-database-schema)

### UI Layout Issues
**Check these areas**:
- **Component Structure**: [HTML Element IDs and Structure](component-structure.md#html-element-ids-and-structure)
- **CSS Classes**: [CSS Classes and Styling](component-structure.md#css-classes-and-styling)
- **Layout Components**: [Layout Classes](component-structure.md#layout-classes)

## API Reference by Use Case

### Getting Photo Data
- **Command**: `get_photos_with_filter`
- **Sequence**: [Photo Grid Display](feature-sequences.md#2-photo-grid-display)
- **Frontend**: `src/App/PhotosList.jsx` → `getPhotos()`
- **Backend**: `src-tauri/src/lib.rs` → `get_photos_with_filter`

### Saving Photo Metadata
- **Commands**: `save_star`, `save_comment`, `save_css_style`
- **Sequence**: [Photo Editing Feature](feature-sequences.md#photo-editing-feature)
- **Frontend**: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- **Backend**: `src-tauri/src/lib.rs` → metadata save commands

### Managing Background Jobs
- **Commands**: `import_photos`, `get_job_progress`, `get_all_jobs`
- **Sequence**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **Frontend**: `src/App/JobQueue.jsx`
- **Backend**: `src-tauri/src/domain_service/job_queue_service.rs`

### Configuration Operations
- **Commands**: `get_config`, `save_config`
- **Sequence**: [Preferences Update](feature-sequences.md#1-preferences-update)
- **Frontend**: `src/App/Preferences.jsx`
- **Backend**: `src-tauri/src/entity/config.rs`

## File Location Quick Reference

| What you're looking for | File Path |
|-------------------------|-----------|
| Main App Component | `src/App.jsx` |
| Photo Grid Display | `src/App/PhotosList.jsx` |
| Full Screen Photo Viewer | `src/App/PhotosList/PhotosListMini.jsx` |
| Photo Editor | `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` |
| Search Tools Container | `src/components/SearchTools.jsx` |
| Search Input Bar | `src/components/SearchBar.jsx` |
| Advanced Filters | `src/components/AdvancedFilters.jsx` |
| Saved Searches | `src/components/SavedSearches.jsx` |
| Search Hook | `src/hooks/useSearch.js` |
| Debug Log Viewer | `src/App/LogViewer.jsx` |
| Logger Service | `src/services/LoggerService.js` |
| Import Interface | `src/App/Importer.jsx` |
| Preferences Panel | `src/App/Preferences.jsx` |
| Job Queue Monitor | `src/App/JobQueue.jsx` |
| Date Calendar & Recent Photos | `src/App/DateList.jsx` |
| Tauri Commands | `src-tauri/src/lib.rs` |
| Job Queue Service | `src-tauri/src/domain_service/job_queue_service.rs` |
| Logging Service | `src-tauri/src/domain_service/logging_service.rs` |
| Photo Processing | `src-tauri/src/domain_service/photo_service.rs` |
| Database Operations | `src-tauri/src/repository/meta_db/sqlite.rs` |
| Configuration Entity | `src-tauri/src/entity/config.rs` |
| Photo Entity | `src-tauri/src/entity/photo.rs` |

This index should help you quickly navigate to the right documentation and code files when working on specific features or debugging issues in PhotoClove.