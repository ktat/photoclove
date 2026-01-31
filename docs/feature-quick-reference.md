# PhotoClove Feature Quick Reference

This document helps you quickly find the relevant documentation when working on specific features or trying to understand particular aspects of the codebase.

## Quick Reference by Feature

### 🏠 Application Startup & Navigation
**When you need to understand**: App initialization, routing, menu system, startup state management, screen transitions
- **Architecture**: [System Architecture](architecture.md#system-architecture) → Frontend Architecture → Application Shell
- **Navigation Flow**: [Screen Transition Diagram](screen-transition-diagram.md) - Complete visual guide to all screen transitions and navigation flows
- **Sequences**: [Application Startup Sequence](feature-sequences.md#application-startup-sequence)
- **Components**: [Main Application Container](component-structure.md#main-application-container), [Left Menu](component-structure.md#left-menu-and-date-list)
- **Startup Behavior**: Welcome screen for first-time users (useCount ≤ 2), Home component for returning users, proper state management prevents "No Photo Found!" at startup
- **Navigation Patterns**: Left Column Menu as primary navigation, dual search entry points, PhotosList component multi-mode behavior
- **Related Files**: `src/App.jsx`, `src/context/UIContext.jsx`, `src/main.jsx`, `src-tauri/src/lib.rs`

### 📸 Photo Import System
**When you need to understand**: File importing, directory scanning, batch processing
- **Architecture**: [Key Features → Photo Import Process](architecture.md#1-photo-import-process) 
- **Sequences**: [Photo Import Feature](feature-sequences.md#photo-import-feature)
- **Components**: [Import Interface](component-structure.md#import-interface)
- **Implementation**: Unified import system using PhotosList/PhotosListMini components with ImportState entity
- **Design Pattern**: PhotoCollection domain object abstraction for data sources, VIEW_MODES.IMPORT for mode management
- **Features**: 
  - Directory navigation with parent directory traversal
  - Import path dropdown for multiple source selection  
  - Import progress tracking via JobQueue events
  - File filtering and batch import operations
  - Integrated with PhotosList for consistent UI/UX
- **Architecture Components**:
  - `ImportState` entity for centralized import state management
  - `PhotoCollection` for unified data abstraction across all modes
  - `useFetchConfig` hook for separated fetch configuration logic
  - ViewMode integration for proper mode transitions and display conditions
- **Related Files**: `src/domain/ImportState.js`, `src/domain/PhotoCollection.js`, `src/hooks/useFetchConfig.js`, `src/App/PhotosList.jsx`, `src/App/PhotosList/DirectoryMenu.jsx`, `src-tauri/src/domain_service/job_queue_service.rs`

### 🖼️ Photo Viewing & Grid Display
**When you need to understand**: Photo galleries, thumbnails, infinite scroll, filtering
- **Architecture**: [Key Features → Photo Viewing & Management](architecture.md#2-photo-viewing--management)
- **Sequences**: [Photo Viewing Feature](feature-sequences.md#photo-viewing-feature)
- **Components**: [Photo Grid View](component-structure.md#photo-grid-view), [Full-Screen Photo Display](component-structure.md#full-screen-photo-display)
- **Features**: Infinite scroll pagination, batch loading (50 photos), configuration limit detection, smooth browsing experience
- **Full-Screen Viewer**: Refactored modular architecture (Improvement #90)
  - **PhotosListMini.jsx** (735 lines, reduced from 833 lines)
  - **Utility Modules**:
    - `photoUtils.js` (128 lines): Thumbnail display calculations, border styles
    - `useKeyboardShortcuts.js` (124 lines): Keyboard navigation hook (arrows, c/s/d/i/f, Del, Ctrl+0)
- **Photo Operations**: Centralized in usePhotoOperations hook (Improvement #84)
  - Album operations: Add to album, remove from album
  - Trash operations: Move to trash, restore, permanent delete
  - List management: Remove from list with proper navigation
- **PhotoGrid Reload Button**: Refresh photo grid after external changes (file additions/deletions outside the app)
  - Located in StatusBar component
  - Triggers full photo list reload
- **Related Files**:
  - `src/App/PhotosList.jsx`
  - `src/App/PhotosList/PhotosListMini.jsx`
  - `src/App/PhotosList/PhotosListMini/photoUtils.js`
  - `src/App/PhotosList/PhotosListMini/useKeyboardShortcuts.js`
  - `src/App/PhotosList/PhotoDisplay.jsx`
  - `src/App/PhotosList/StatusBar.jsx`
  - `src/hooks/usePhotoOperations.js` (510 lines)

### 📷 Burst Photo Grouping
**When you need to understand**: Burst mode detection, photo grouping, rapid succession photos
- **Purpose**: Group photos taken in rapid succession (burst mode) for better organization
- **UI Components**:
  - Grouping options in PhotosList for viewing grouped/ungrouped photos
  - GroupingTab in Preferences for configuration settings
- **Backend**: `burst_groups` table for storing group relationships, `burst_group_commands.rs` for command handlers
- **Key Operations**:
  - Auto-detect bursts based on timestamp proximity
  - Manual grouping and ungrouping of photos
  - Recalculate groups when settings change
- **Configuration**: Adjustable time threshold for burst detection
- **Related Files**: `src/App/Preferences/GroupingTab.jsx`, `src-tauri/src/commands/burst_group_commands.rs`, `src-tauri/src/repository/meta_db/burst_groups.rs`

### 🎨 Photo Editing & Transformations
**When you need to understand**: Image filters, cropping, CSS transformations, save-as-copy
- **Architecture**: [Key Features → Photo Organization](architecture.md#3-photo-organization)
- **Sequences**: [Photo Editing Feature](feature-sequences.md#photo-editing-feature)
- **Components**: [Photo Editor Panel](component-structure.md#photo-editor-panel)
- **Implementation**: Refactored modular architecture (Improvement #88)
  - **PhotoEditor.jsx** (980 lines, reduced from 1,292 lines)
  - **Utility Modules**:
    - `cssUtils.js` (218 lines): CSS parsing/generation, default values
    - `cropUtils.js` (144 lines): Crop calculations, 8 aspect ratio presets
    - `styleUtils.js` (199 lines): Style application to DOM elements
- **Related Files**:
  - `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
  - `src/App/PhotosList/PhotoOption/PhotoEditor/cssUtils.js`
  - `src/App/PhotosList/PhotoOption/PhotoEditor/cropUtils.js`
  - `src/App/PhotosList/PhotoOption/PhotoEditor/styleUtils.js`
  - `src-tauri/src/lib.rs` (save_styled_copy_from_frontend)

### 📅 Date-Based Organization & Recent Photos
**When you need to understand**: Calendar navigation, date filtering, photo organization by date, recent photos access
- **Architecture**: [Data Storage Strategy](architecture.md#2-data-storage-strategy) → Filesystem Organization
- **Sequences**: [Date List Loading](feature-sequences.md#1-date-list-loading), [Recent Photos Navigation](feature-sequences.md#recent-photos-navigation)
- **Components**: [Left Menu and Date List](component-structure.md#left-menu-and-date-list)
- **Performance**: Optimized with pre-computed date_summary table for ~10x faster date list loading, smart rebuild logic, graceful fallback to GROUP BY queries
- **Features**: 
  - Calendar-based navigation with hierarchical tree view
  - Year/month filter controls with compact dropdown design
  - List/Tree view mode toggle for different navigation preferences
  - Recent Photos quick access (60 most recent) positioned at top
  - Collapsible year/month structure for large photo collections
  - Fixed controls outside scroll area for constant accessibility
  - Optimized database queries with date_summary table caching
- **UI/UX Improvements**:
  - Compact filter controls with emoji icons (📅 year, 🗓️ month)
  - Clean hierarchical view with expand/collapse functionality
  - Improved scrollable area height management
  - Centered controls for better visual organization
- **Related Files**: `src/App/DateList.jsx`, `src-tauri/src/repository/meta_db/sqlite.rs`, `src-tauri/src/value/date.rs`, `src/context/PhotoContext.jsx`

### ⚙️ Configuration Management
**When you need to understand**: App settings, preferences, directory configuration
- **Architecture**: [Core Components → Configuration Components](architecture.md#4-configuration-components)
- **Sequences**: [Configuration Management](feature-sequences.md#configuration-management)
- **Components**: [Preferences Screen](component-structure.md#preferences-screen)
- **Related Files**: `src/App/Preferences.jsx`, `src/FolderPicker.jsx`, `src-tauri/src/entity/config.rs`

### 🔄 State Management & ViewMode DDD Architecture
**When you need to understand**: React state, Context APIs, component state patterns, state debugging, custom hooks, Domain-Driven Design
- **Guide**: [State Management Guide](state-management-guide.md) - Comprehensive guide to refactored state management architecture
- **DDD Architecture**: Domain-Driven Design approach with ViewMode value object for view state management
- **ViewMode System**: 
  - `ViewMode` - Immutable DDD value object encapsulating view mode logic (60+ methods)
  - `useViewModeObject` - React hook for ViewMode integration with legacy compatibility
  - `VIEW_MODES` - Centralized constants eliminating magic strings
  - Factory methods: `ViewMode.home()`, `ViewMode.album(id)`, `ViewMode.search(query)`, etc.
  - Built-in validation, type safety, and error handling
  - **UI Display Conditions**: ViewMode now includes display condition methods for DirectoryMenu
    - Tab visibility: `shouldShowDirectoryTab()`, `shouldShowSelectionTab()`
    - Operation groups: `shouldShowImportOperations()`, `shouldShowAlbumOperations()`, `shouldShowStandardOperations()`
    - Section display: `shouldShowPhotoSelection()`, `shouldShowAlbumSelection()`, `shouldShowTagSelection()`
    - Individual operations: `showImportSelected()`, `showRemoveFromAlbum()`, `showUploadToGooglePhotos()`, etc.
- **Custom Hooks**:
  - **State Management**: `usePhotosListState`, `usePhotosState`, `useViewMode`, `useViewModeObject`, `useViewModeSync`
  - **Photo Display**: `usePhotosListDisplay`, `usePhotoDisplay`
  - **Filtering & Selection**: `usePhotosListFilters`, `usePhotosListSelection`, `usePhotoSelection`
  - **Photo Operations** (510 lines): `usePhotoOperations` - Centralized photo operations
    - Album: `handleAddToAlbum`, `removePhotoFromAlbum`
    - Trash: `moveToTrash`, `restorePhoto`, `permanentlyDeletePhoto`
    - List: `removePhotoFromList` with smart navigation
  - **Metadata**: `usePhotoMetadata`
  - **Data Management**: `usePhotoDataLoader`, `usePhotoDataSync`, `usePhotosQuery`, `useInfiniteScroll`
  - **Import Mode**: `useImportModeLifecycle` - Import mode lifecycle management
  - **Search**: `useSearch`, `useSearchHistory`
  - **Other**: `useDateNavigation`, `useThumbnailGeneration`, `useTutorial`, `useAppConfig`
- **React Query Hooks**:
  - `usePhotosQuery` - Custom React Query implementation with caching
  - `usePhotosWithFilter` - Photo fetching with automatic caching
  - `usePhotoTags` - Tag fetching with cache management
  - `useAlbumPhotos` - Album photo fetching
  - `useUpdatePhotoStar` - Star rating mutation with cache invalidation
  - `useUpdatePhotoComment` - Comment mutation with cache invalidation
  - `useUpdatePhotoTags` - Tag mutation with cache invalidation
- **Contexts**: PhotoContext, UIContext (refactored with view mode), ErrorContext, ImportContext
- **Cache Service**: PhotoCacheService for unified cache management
- **Patterns**: State machine navigation, hook composition, cache-first data fetching, domain value objects
- **Migration**: Gradual migration support with backward compatibility
- **Benefits**: Single source of truth, eliminated 60+ boolean variables, centralized mode logic, improved maintainability
- **Related Files**: 
  - Domain: `src/domain/ViewMode.js`, `src/constants/viewModes.js`
  - Hooks: `src/hooks/usePhotosListState.js`, `src/hooks/usePhotosListDisplay.js`, `src/hooks/usePhotosListFilters.js`, `src/hooks/usePhotosListSelection.js`, `src/hooks/useViewMode.js`, `src/hooks/useViewModeObject.js`, `src/hooks/usePhotosQuery.js`
  - Services: `src/services/PhotoCacheService.js`
  - Contexts: `src/context/*.jsx`
  - Components: `src/App/PhotosList.jsx` (with React Query integration)
  - Documentation: `docs/photoslist-modes-operations.md`

### 🐛 Debug Logging & Log Viewer
**When you need to understand**: Application debugging, log viewing, correlation tracking
- **Architecture**: [Data Flow → Cross-Component Communication](architecture.md#cross-component-communication)
- **Components**: [Debug Log Viewer](component-structure.md#debug-log-viewer)
- **Access Methods**: Help menu → "Show log", Keyboard shortcut `Ctrl+Shift+L`
- **Features**: Frontend/backend log correlation, structured logging, real-time viewing, export functionality
- **Related Files**: `src/App/LogViewer.jsx`, `src/services/LoggerService.js`, `src-tauri/src/domain_service/logging_service.rs`

### 🔄 Background Job Processing
**When you need to understand**: Async operations, job queues, progress tracking, manual job retry, job resume/stop
- **Architecture**: [Performance Optimizations](architecture.md#4-performance-optimizations) → Job Queue
- **Sequences**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **Components**: [Job Queue Interface](component-structure.md#job-queue-interface)
- **Features**: Background processing, progress tracking, immediate manual retry, job resume/stop, comprehensive logging with correlation IDs
- **Job Types**: Photo import, Google Photos upload, thumbnail generation, face detection, face thumbnail regeneration, AI tagging, S3 sync
- **Enhanced Features**:
  - Manual job retry executes immediately instead of waiting for next app startup
  - Job resume: Continue interrupted jobs from last processed item
  - Job stop: Stop running jobs gracefully
  - Progress persistence: `processed_count` and `last_processed_id` saved to database
- **Related Files**: `src/App/JobQueue.jsx`, `src-tauri/src/domain_service/job_queue/`, `src-tauri/src/entity/job_queue.rs`

### 🔄 Recovery Queue
**When you need to understand**: Failed operation tracking, retry mechanisms, error recovery
- **Purpose**: Track and retry failed operations (file moves, deletions, etc.) that couldn't complete due to errors
- **UI Components**: RecoveryQueueModal accessible from application menu
- **Backend**: `recovery_queue` table for persistent storage, `recovery_queue_commands.rs` for command handlers
- **Key Operations**:
  - View pending items awaiting retry
  - Retry failed items manually or automatically
  - Discard items that are no longer needed
- **Features**: Persistent tracking across app restarts, detailed error information, batch retry support
- **Related Files**: `src/App/RecoveryQueueModal.jsx`, `src-tauri/src/repository/meta_db/recovery_queue.rs`, `src-tauri/src/commands/recovery_queue_commands.rs`

### 🔐 Google OAuth Token Management
**When you need to understand**: Google Photos authentication, token storage, automatic refresh, secure credential management
- **Documentation**: [OAuth Token Management](oauth-token-management.md)
- **Architecture**: Platform-native keyring storage with external service integration
- **Features**: Secure token storage, automatic refresh, external OAuth proxy, debug tools
- **Security**: Platform-native keyring (Linux Secret Service, macOS Keychain, Windows Credential Manager)
- **Token Lifecycle**: Automatic refresh 5 minutes before expiration, graceful error handling
- **Testing Tools**: Built-in debug commands, Python keyring scripts, comprehensive test utilities
- **Integration**: Seamless Google Photos API authentication with transparent token management
- **Related Files**: `src-tauri/src/domain_service/token_storage_service.rs`, `src/services/firebase/auth.js`, `src-tauri/src/bin/test_keyring.rs`

### 🗄️ Database Operations
**When you need to understand**: SQLite operations, metadata storage, database creation, performance optimizations
- **Architecture**: [Data Storage Strategy](architecture.md#2-data-storage-strategy) → SQLite Database Schema
- **Sequences**: [Database Management](feature-sequences.md#database-management)
- **Performance Features**: date_summary table for pre-computed photo counts, smart rebuild logic, graceful fallback mechanisms
- **Optimization**: Date queries optimized with dedicated summary table, ~10x performance improvement for large libraries
- **Database Migration**: Automatic table creation for new features (albums, album_photos) with proper existence checking
- **Related Files**: `src-tauri/src/repository/meta_db/sqlite.rs`, `src-tauri/src/entity/photo_meta.rs`

### 📝 Logging & Debugging System
**When you need to understand**: Application logging, LogViewer, debug information, bug investigation, structured logging
- **Architecture**: Comprehensive structured logging system with frontend LoggerService and backend log macros
- **Implementation**: Complete replacement of eprintln! with structured logging across all Rust modules
- **Components**: LogViewer component (`src/App/LogViewer.jsx`), configurable logging in Preferences
- **Features**: Toggle logging on/off, configurable log levels, structured logging format, daily log files, correlation ID tracking
- **Format**: Structured key=value pairs with correlation IDs for request tracing and debugging
- **Access**: Ctrl+Shift+L to open LogViewer, Preferences panel for logging settings
- **Storage**: Frontend logs in memory, backend logs in `~/.local/share/photoclove/logs/`
- **Bug Investigation**: Systematic debugging approach documented in `CLAUDE.md`
- **Improvements**: Enhanced error handling, proper context propagation, empty string validation in date processing
- **Related Files**: `src/App/LogViewer.jsx`, `src/services/LoggerService.js`, `src-tauri/src/domain_service/logging_service.rs`, `CLAUDE.md`

### 🏷️ Unified Collection System (Albums & Tags)
**When you need to understand**: Photo organization, albums, tags, collection management, unified data architecture
- **Database**: [Unified Collection System](database-schema.md#unified-collection-system-albums--tags) - photo_collections and photo_collection_items tables with unified architecture
- **Legacy Support**: [Legacy Tables](database-schema.md#legacy-tables-backward-compatibility) - Original tag/album tables maintained for backward compatibility
- **Backend**: 
  - **Unified Commands**: `create_collection`, `get_all_collections`, `update_collection`, `delete_collection`, `add_photo_to_collection`, `remove_photo_from_collection`
  - **Legacy Commands**: Original tag/album commands still supported (`create_tag`, `add_tag_to_photo`, `create_album`, etc.)
- **Frontend Architecture**:
  - **Domain Layer**: `UnifiedPhotoCollection.js` - Main domain entity for both albums and tags
  - **Service Layer**: `UnifiedCollectionService.js` - Cached service with CRUD operations
  - **Components**: Unified components supporting both albums and tags:
    - TagChip/AlbumChip: Display with color/cover photo support
    - TagInput/AlbumCreation: Create new collections with proper validation
    - TagSelector/AlbumSelector: Multi-select interfaces with unified behavior
    - TagManager: Bulk management in Preferences (migrated to unified system)
- **Key Features**: 
  - **Type Discrimination**: Albums support descriptions, cover photos, ordering; Tags support colors
  - **Performance Optimization**: Single database query for all collection types, cached service layer
  - **Cache Management**: Automatic cache invalidation on CRUD operations
  - **Backward Compatibility**: Legacy APIs continue to work during migration period
- **Migration Benefits**: Eliminated code duplication, improved performance, unified UX patterns
- **Related Files**: `src/domain/UnifiedPhotoCollection.js`, `src/services/UnifiedCollectionService.js`, `src/components/Tag*.jsx`, `src-tauri/src/entity/photo_collection.rs`, `src-tauri/src/repository/meta_db/sqlite.rs`

### 🔍 Advanced Search & Filtering (Enhanced)
**When you need to understand**: Advanced search interface, EXIF filters, saved searches, search history, recent photos, tag filtering, enhanced UI/UX
- **Architecture**: [Key Features → Advanced Search System](architecture.md#6-advanced-search-system)
- **Sequences**: [Advanced Search Feature](feature-sequences.md#advanced-search-feature)
- **Components**: [Search Tools](component-structure.md#search-tools), [Directory Menu](component-structure.md#directory-menu-when-no-photo-selected)
- **Enhanced Features**: 
  - EXIF-based filtering with improved UI components
  - Tag-based filtering with "Has Tag" filter option
  - Enhanced filter popover with better visual design
  - Active filter summary with clear filter buttons
  - Improved filter state management and persistence
  - Star rating filter, comment filter, extension filter
  - Filter count indicators for better UX
- **Filter System**: 
  - Unified filter application across all viewing modes
  - Frontend filtering for real-time updates
  - Filter options caching for performance
  - Consistent filter UI across photo list and search modes
- **Access Methods**: Search icon in home page, Search tab in PhotosList, Keyboard shortcut navigation, Filter button in photo list
- **Important**: Filter structure consistency between frontend and backend (has_comment vs has_comments, star_rating vs min_rating)
- **Bug Fixes**: 
  - Fixed first-click photo loading bug where null reference in logging prevented photo display (2025-07-20)
  - Fixed ViewMode synchronization issues causing filter state inconsistencies
  - Resolved photo display key mismatches in filtered views
- **Related Files**: `src/components/SearchTools.jsx`, `src/components/SearchBar.jsx`, `src/components/AdvancedFilters.jsx`, `src/components/SavedSearches.jsx`, `src/components/FilterPopover.jsx`, `src/hooks/useSearch.js`, `src-tauri/src/lib.rs` (search commands)

### ☁️ Google Photos Integration
**When you need to understand**: Google Photos upload, cloud storage sync, OAuth authentication, API error handling
- **Documentation**: [OAuth Token Management](oauth-token-management.md) for authentication details
- **Features**: Photo upload to Google Photos, automatic token refresh, job queue integration, comprehensive error handling
- **Authentication**: Secure OAuth flow with external service, automatic token management
- **Upload Process**: Integrated with job queue system for background uploads with progress tracking
- **Error Handling**: Proper API error detection and job failure handling, structured logging
- **Token Management**: Automatic refresh using external service, secure keyring storage
- **Related Files**: `src-tauri/src/entity/google_photos.rs`, `src-tauri/src/domain_service/token_storage_service.rs`, `src/services/firebase/auth.js`

### ☁️ S3 Backup
**When you need to understand**: Cloud backup to S3-compatible storage, sync status, multi-provider support
- **Purpose**: Backup photos to S3-compatible cloud storage providers for offsite backup and redundancy
- **Supported Providers**:
  - AWS S3
  - Wasabi
  - MinIO
  - Cloudflare R2
  - DigitalOcean Spaces
- **UI Components**:
  - S3BackupTab in Preferences for configuration (credentials, bucket, endpoint)
  - Sync status indicator in PhotoInfo panel
- **Backend**: `s3_service.rs` for S3 operations, `s3_commands.rs` for Tauri commands, `storage_sync` column for tracking sync status
- **Key Operations**:
  - Full sync: Upload all photos to S3
  - Incremental sync: Upload only new/modified photos
  - Auto-sync on import: Automatically backup newly imported photos
  - **Thumbnail backup**: Option to backup photo thumbnails alongside originals
- **Configuration**: Provider selection, credentials, bucket name, endpoint URL, sync preferences, thumbnail backup toggle
- **Related Files**: `src/App/Preferences/tabs/S3BackupTab.jsx`, `src-tauri/src/domain_service/s3_service.rs`, `src-tauri/src/commands/s3_commands.rs`

### 🤖 AI Auto-Tagging
**When you need to understand**: Automatic photo tagging using AI/ML models, image classification
- **Purpose**: Automatic photo tagging using AI models for content recognition and classification
- **Supported Models**:
  - MobileNet: Fast, lightweight classification
  - OpenCLIP: Open-source CLIP model for zero-shot classification with pre-computed text embeddings
  - SigLIP: Google's improved vision-language model with pre-computed text embeddings
- **UI Components**: AITaggingTab in Preferences for model selection and configuration
- **Backend**: AI tagging service for model inference, `ai_model_commands.rs` for Tauri commands
- **Key Features**:
  - Auto-tag on import: Automatically tag newly imported photos
  - Batch tagging: Tag existing photos in bulk
  - Single photo tagging: AI Tag button in PhotoViewer menu
  - Custom labels: Define custom tag categories for classification
  - EXIF thumbnail optimization: Use embedded thumbnails for faster processing
  - High accuracy mode: Use full-resolution images for better accuracy
  - Pre-computed embeddings: Faster inference with OpenCLIP/SigLIP using cached text embeddings
- **Configuration**: Model selection, confidence threshold (0-100%), EXIF thumbnail usage, high accuracy mode, custom label definitions, auto-tag preferences
- **Related Files**: `src/App/Preferences/AITaggingTab.jsx`, `src/App/PhotoViewer/PhotoMenu.jsx`, `src-tauri/src/domain_service/ai_tagging/`, `src-tauri/src/commands/ai_model_commands.rs`

### 👤 Face Detection & Recognition
**When you need to understand**: Face detection in photos, person management, face browsing, unknown faces management
- **Purpose**: Detect faces in photos and organize them by person for easy browsing and searching
- **UI Components**:
  - Faces ViewMode (VIEW_MODES.FACE_LIST): Browse all detected persons with face thumbnails
  - Person ViewMode (VIEW_MODES.PERSON): View all photos of a specific person
  - Unknown Faces Tab: Browse unassigned faces with infinite scroll pagination
  - Unknown Faces Photo Viewer (VIEW_MODES.UNKNOWN_FACES): View photos containing unknown faces
  - Face detection menu: Single photo face detection from PhotoViewer
  - Selection UI: Checkbox selection for bulk operations (delete, assign, rename)
- **Key Features**:
  - Automatic face detection using SCRFD + ArcFace models
  - Person name assignment and management
  - Face thumbnail display with proper cropping (square aspect ratio)
  - **Face Thumbnail Cache**: Pre-generated thumbnails stored in `{thumbnail_store}/faces/` for fast display
  - EXIF thumbnail optimization for faster detection
  - SessionStorage-based selection state persistence
  - Face count and photo count statistics
  - Person deletion (removes name but keeps face detections)
  - **Unknown Faces Management**:
    - Unknown tab in Faces list with pagination (50 faces per page)
    - Batch operations: Delete multiple faces, Assign to new/existing person
    - Individual face operations in PhotoViewer Faces tab
    - Auto-refresh after batch operations
- **Architecture**:
  - Face detection backend service with SCRFD (detector) + ArcFace (embedder)
  - Person database with face_count and photo_count
  - FaceThumbnail shared component with cache-first loading
  - Face thumbnail service for cache management and regeneration
  - GenericListView for unified UI pattern (Albums/Tags/Faces)
  - ViewMode-aware selection management
  - Batch API using SQL IN clause for efficient operations
- **Related Files**:
  - Frontend: `src/App/PhotosList/PhotoListContent.jsx`, `src/App/PhotosList/FacesList.jsx`, `src/App/PhotosList/UnknownFacesList.jsx`, `src/App/PhotoViewer/PhotoMenu.jsx`, `src/components/FaceThumbnail.jsx`, `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`
  - Backend: `src-tauri/src/domain_service/face_detection/`, `src-tauri/src/domain_service/face_thumbnail_service.rs`, `src-tauri/src/commands/face_detection_commands.rs`, `src-tauri/src/commands/face_batch_commands.rs`
  - Hooks: `src/hooks/usePhotoOperations.js`, `src/hooks/usePhotosState.js`
  - Services: `src/services/FaceDetectionService.js`

### 🎨 UI Theme & Dark Mode
**When you need to understand**: Application theming, dark mode implementation, UI consistency, color management
- **Architecture**: Dark theme as primary design system with CSS variables for consistency
- **Guidelines**: Comprehensive theme guidelines documented in `CLAUDE.md` with strict color usage rules
- **Implementation**: CSS variables (`--bg`, `--bg-elevated`, `--text`, `--border`, `--accent`) used throughout application
- **Components**: All UI components follow dark theme patterns with proper contrast and accessibility
- **Fixes**: Fixed white backgrounds in tag selectors, album modals, search inputs, and album tiles
- **Restrictions**: Light colors prohibited for large areas, only allowed for small accents and highlights
- **Related Files**: `src/style.css`, `src/components/TagSelector.css`, `src/components/AlbumSelectorModal.css`, `CLAUDE.md`

### 🏛️ Domain-Driven Design (DDD) Architecture
**When you need to understand**: Photo entity management, domain models, business logic encapsulation
- **Architecture**: Domain-Driven Design approach with entity objects and domain services
- **Entities**:
  - `Photo` entity with business logic methods (`displayPath()`, `thumbnailPath()`)
  - `PhotoCollection` for managing photo collections
- **Services**: `PhotoService` for domain operations and transformations
- **Implementation**: Centralized business logic prevents ad-hoc fixes and ensures consistent behavior
- **Benefits**:
  - Proper handling of trash bin vs normal photo paths
  - Consistent photo display across all viewing modes
  - Encapsulated domain logic separate from UI concerns
- **Related Files**: `src/domain/Photo.js`, `src/domain/PhotoCollection.js`, `src/services/PhotoService.js`

### ℹ️ Licenses/About Screen
**When you need to understand**: Open source license display, third-party attributions, about information
- **Purpose**: Display open source licenses for all third-party dependencies used in the application
- **UI Components**: LicensesView accessible from Help menu
- **Features**:
  - Displays licenses for frontend (npm) and backend (Rust) dependencies
  - Searchable license list
  - Full license text viewing
- **Access**: Help menu → "Licenses" or "About"
- **Related Files**: `src/App/LicensesView.jsx`

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