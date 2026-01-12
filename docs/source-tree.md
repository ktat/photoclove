# PhotoClove Source Tree Structure

This document provides a complete overview of the PhotoClove source code organization with explanations for each directory and key files.

## Project Root Structure

```
photoclove/
├── 📁 src/                     # React frontend source code
├── 📁 src-tauri/               # Rust backend source code
├── 📁 docs/                    # Documentation files
├── 📁 public/                  # Static assets served by frontend
├── 📁 example/                 # Sample data and test files
├── 📁 improvement/             # Development workflow tasks
├── 📁 node_modules/            # NPM dependencies (auto-generated)
├── 📄 package.json             # Frontend dependencies and scripts
├── 📄 pnpm-lock.yaml          # Package lock file
├── 📄 vite.config.js          # Vite build configuration
├── 📄 index.html              # Main HTML entry point
├── 📄 CLAUDE.md               # Development workflow instructions
├── 📄 README.md               # Project documentation
└── 📄 LICENSE                 # Project license

## File Location Quick Reference

| What you're looking for | File Path |
|-------------------------|-----------|
```

## Frontend Source Code (`src/`)

```
src/
├── 📄 main.jsx                 # React app entry point
├── 📄 App.jsx                  # Main application component
├── 📄 App.css                  # Global application styles
├── 📄 style.css                # Additional global styles
├── 📄 scrollable.css           # Scrolling component styles
├── 📄 wdyr.js                  # Why Did You Render debugging tool
├── 📄 Welcome.jsx              # First-time user welcome screen
├── 📄 WelcomeImage.jsx         # Welcome screen image provider
├── 📄 FolderPicker.jsx         # Directory selection component
├── 📄 PathUtil.jsx             # File path utility functions
├── 📄 Scrollable.jsx           # Custom scrollable container
│
├── 📁 App/                     # Main application components
│   ├── 📄 DateList.jsx         # Calendar/date navigation sidebar
│   ├── 📄 Footer.jsx           # Application footer with messages
│   ├── 📄 Home.jsx             # Home/dashboard screen
│   ├── 📄 ImgCacheContext.jsx  # React context for image caching
│   ├── 📄 Importer.jsx         # Photo import interface
│   ├── 📄 JobQueue.jsx         # Background job monitoring
│   ├── 📄 Login.jsx            # Authentication (Google login)
│   ├── 📄 PhotosList.jsx       # Main photo grid view
│   ├── 📄 Preferences.jsx      # Application settings
│   │
│   ├── 📁 Footer/
│   │   └── 📄 RandomMessages.jsx    # Random footer messages
│   │
│   ├── 📁 Importer/
│   │   └── 📄 SelectedPhotoInfo.jsx # Import batch information
│   │
│   └── 📁 PhotosList/          # Photo viewing components
│       ├── 📄 DirectoryMenu.jsx     # Right sidebar menu
│       ├── 📄 PhotoLoading.jsx      # Loading indicator
│       ├── 📄 PhotoOption.jsx       # Photo metadata panel
│       ├── 📄 PhotosListMini.jsx    # Full-screen photo viewer (475 lines, refactored)
│       ├── 📄 PhotoGrid.jsx         # Photo grid display component
│       ├── 📄 PhotoCard.jsx         # Individual photo card component
│       ├── 📄 PhotoListContent.jsx  # Photo list content wrapper
│       ├── 📄 PhotoDisplayWrapper.jsx # Photo display wrapper
│       ├── 📄 PhotosToolbar.jsx     # Toolbar for photo actions
│       ├── 📄 SideMenuWrapper.jsx   # Side menu wrapper component
│       ├── 📄 StatusBar.jsx         # Status bar component
│       ├── 📄 ListViewHeader.jsx    # List view header
│       ├── 📄 GenericListView.jsx   # Generic list view component
│       ├── 📄 AlbumTab.jsx          # Album tab component
│       │
│       ├── 📁 DirectoryMenu/
│       │   ├── 📄 FilterTab.jsx          # Filter options tab
│       │   ├── 📄 SelectionTab.jsx       # Selection operations tab
│       │   ├── 📄 tutorialContent.jsx    # Tutorial content
│       │   ├── 📄 collectionOperations.js # Collection operations
│       │   ├── 📄 dateOperations.js      # Date operations
│       │   └── 📄 photoOperations.js     # Photo operations
│       │
│       ├── 📁 PhotoOption/
│       │   ├── 📄 PhotoEditor.jsx   # Image editing controls
│       │   ├── 📄 PhotoInfo.jsx     # Photo metadata display with external app launcher
│       │   ├── 📄 PhotoTags.jsx     # Photo tag management
│       │   ├── 📄 CropTool.jsx      # Crop tool component
│       │   ├── 📄 EditorControl.jsx # Editor control component
│       │   │
│       │   └── 📁 PhotoEditor/      # PhotoEditor utility modules
│       │       ├── 📄 cssUtils.js   # CSS parsing/generation
│       │       ├── 📄 cropUtils.js  # Crop calculations
│       │       ├── 📄 styleUtils.js # Style application
│       │       └── 📄 imageProcessing.js # Image processing utilities
│       │
│       └── 📁 PhotosListMini/
│           ├── 📄 PhotoDisplay.jsx  # Individual photo display
│           ├── 📄 ThumbnailItem.jsx # Thumbnail item component
│           ├── 📄 HelpPanel.jsx     # Help panel component
│           ├── 📄 AlbumModeIndicator.jsx # Album mode indicator
│           ├── 📄 photoUtils.js     # Thumbnail display calculations
│           ├── 📄 useKeyboardShortcuts.js # Keyboard navigation hook
│           ├── 📄 useDeletionOperations.js # Deletion operations hook
│           ├── 📄 usePhotoMetadataOperations.js # Photo metadata operations
│           ├── 📄 usePhotoNavigation.js # Photo navigation hook
│           └── 📄 useStarOperations.js # Star rating operations hook
│
├── 📁 hooks/                   # Custom React hooks
│   ├── 📄 useAppConfig.js           # Application configuration hook
│   ├── 📄 useCollectionManagement.js # Collection (album/tag) management
│   ├── 📄 useDataSynchronization.js # Data synchronization logic
│   ├── 📄 useDateNavigation.js      # Date navigation logic
│   ├── 📄 useFilteredPhotos.js      # Photo filtering logic (extracted from PhotosList)
│   ├── 📄 useImportModeLifecycle.js # Import mode lifecycle management
│   ├── 📄 useInfiniteScroll.js      # Infinite scroll pagination
│   ├── 📄 useModalState.js          # Modal state management
│   ├── 📄 usePageState.js           # Page state management
│   ├── 📄 usePhotoDataLoader.js     # Photo data loading logic
│   ├── 📄 usePhotoDataSync.js       # Photo data synchronization
│   ├── 📄 usePhotoDisplay.js        # Photo display state management
│   ├── 📄 usePhotoListHelpers.js    # PhotosList helper functions
│   ├── 📄 usePhotoListStateGroups.js # PhotosList state groups
│   ├── 📄 usePhotoLoader.js         # Photo loading logic
│   ├── 📄 usePhotoMetadata.js       # Photo metadata operations
│   ├── 📄 usePhotoOperationFlow.js  # Photo operation flow management
│   ├── 📄 usePhotoOperations.js     # Photo operations (album, trash, list)
│   ├── 📄 usePhotoSelection.js      # Photo selection logic
│   ├── 📄 usePhotosListDisplay.js   # PhotosList display state
│   ├── 📄 usePhotosListEffects.js   # PhotosList side effects (extracted)
│   ├── 📄 usePhotosListFilters.js   # Filter state management
│   ├── 📄 usePhotosListHandlers.js  # PhotosList event handlers (extracted)
│   ├── 📄 usePhotosListSelection.js # PhotosList selection operations
│   ├── 📄 usePhotosListState.js     # Main PhotosList state hook
│   ├── 📄 usePhotosQuery.js         # Photo query logic
│   ├── 📄 usePhotosState.js         # Photos state management
│   ├── 📄 useSearch.js              # Search functionality
│   ├── 📄 useSearchAndFilterManagement.jsx # Search and filter management
│   ├── 📄 useSearchHistory.js       # Search history management
│   ├── 📄 useSearchInitialization.js # Search initialization
│   ├── 📄 useTabManagement.js       # Tab management logic
│   ├── 📄 useThumbnailGeneration.js # Thumbnail generation logic
│   ├── 📄 useTrashOperations.js     # Trash operations hook
│   ├── 📄 useTutorial.js            # Tutorial state management
│   ├── 📄 useViewMode.js            # View mode state machine
│   ├── 📄 useViewModeFactory.js     # ViewMode factory (extracted)
│   ├── 📄 useViewModeHelpers.js     # ViewMode helper functions
│   ├── 📄 useViewModeObject.js      # ViewMode DDD value object integration
│   └── 📄 useViewModeSync.js        # ViewMode synchronization
│
├── 📁 services/                # External service integrations
│   ├── 📄 LoggerService.js     # Structured logging service
│   ├── 📄 TauriService.js      # Tauri backend communication service
│   └── 📁 firebase/            # Firebase authentication
│       ├── 📄 app.js           # Firebase app configuration
│       ├── 📄 auth.js          # Authentication methods
│       └── 📄 index.js         # Firebase service exports
│
├── 📁 storage/                 # Client-side storage
│   └── 📄 forage.js            # LocalForage configuration
│
└── 📁 assets/                  # Static frontend assets
    └── 📄 react.svg            # React logo
```

### Frontend Component Explanations

#### Core Application Components
- **`main.jsx`**: React application bootstrap, renders App component into DOM
- **`App.jsx`**: Root component managing global state, routing, and Tauri event listeners
- **`Welcome.jsx`**: Onboarding experience for new users with tutorial steps
- **`Home.jsx`**: Default dashboard view showing welcome image and basic information

#### Photo Management Components
- **`PhotosList.jsx`**: Main photo grid with filtering, sorting, pagination, and selection (496 lines, refactored)
- **`PhotoGrid.jsx`**: Photo grid display component with thumbnail rendering
- **`PhotoCard.jsx`**: Individual photo card component with selection and tag display
- **`PhotoListContent.jsx`**: Photo list content wrapper component
- **`PhotosListMini.jsx`**: Full-screen photo viewer with navigation and editing capabilities (475 lines, refactored)
  - **`PhotoDisplay.jsx`**: Individual photo display with transformation support
  - **`ThumbnailItem.jsx`**: Thumbnail item component
  - **`HelpPanel.jsx`**: Help panel component with keyboard shortcuts
  - **`AlbumModeIndicator.jsx`**: Album mode indicator component
  - **`photoUtils.js`**: Thumbnail display calculations and border styles
  - **`useKeyboardShortcuts.js`**: Keyboard navigation hook for photo browsing
  - **`useDeletionOperations.js`**: Deletion operations hook
  - **`usePhotoMetadataOperations.js`**: Photo metadata operations hook
  - **`usePhotoNavigation.js`**: Photo navigation hook
  - **`useStarOperations.js`**: Star rating operations hook
- **`PhotoOption.jsx`**: Right sidebar panel for photo metadata and actions
- **`PhotoEditor.jsx`**: Image editing interface with filters, transforms, and crop tools
  - **`CropTool.jsx`**: Crop tool component
  - **`EditorControl.jsx`**: Editor control component
  - **`cssUtils.js`**: CSS parsing and generation utilities
  - **`cropUtils.js`**: Crop calculation utilities and aspect ratio presets
  - **`styleUtils.js`**: Style application utilities for DOM elements
  - **`imageProcessing.js`**: Image processing utilities
- **`PhotoInfo.jsx`**: Photo metadata display with EXIF data and external app launcher (🚀 button)
- **`PhotoTags.jsx`**: Photo tag management component

#### Import System Components
- **`Importer.jsx`**: Directory browser and photo selection interface
- **`SelectedPhotoInfo.jsx`**: Batch import management and progress tracking
- **`JobQueue.jsx`**: Background job monitoring and control panel

#### Navigation and Utility Components
- **`DateList.jsx`**: Calendar-style date navigation for photo organization
- **`DirectoryMenu.jsx`**: Right sidebar with filters, maintenance, and selection tools
- **`FolderPicker.jsx`**: Cross-platform directory selection dialog
- **`Scrollable.jsx`**: Custom scrollable container with lazy loading support

#### Custom React Hooks
- **State Management Hooks**:
  - **`usePhotosListState.js`**: Main PhotosList state management
  - **`usePhotosState.js`**: Photos state management
  - **`useViewMode.js`**: View mode state machine
  - **`useViewModeObject.js`**: ViewMode DDD value object integration
  - **`useViewModeSync.js`**: ViewMode synchronization
- **Photo Operation Hooks**:
  - **`usePhotoOperations.js`**: Centralized photo operations (510 lines)
    - Album operations: `handleAddToAlbum`, `removePhotoFromAlbum`
    - Trash operations: `moveToTrash`, `restorePhoto`, `permanentlyDeletePhoto`
    - List management: `removePhotoFromList`
  - **`usePhotoSelection.js`**: Photo selection logic
  - **`usePhotoMetadata.js`**: Photo metadata operations
  - **`usePhotoDisplay.js`**: Photo display state management
- **Data Management Hooks**:
  - **`usePhotoDataLoader.js`**: Photo data loading logic
  - **`usePhotoDataSync.js`**: Photo data synchronization
  - **`usePhotosQuery.js`**: Photo query logic
  - **`useInfiniteScroll.js`**: Infinite scroll pagination
- **Feature-Specific Hooks**:
  - **`useImportModeLifecycle.js`**: Import mode lifecycle management
  - **`useSearch.js`**: Search functionality
  - **`useSearchHistory.js`**: Search history management
  - **`useDateNavigation.js`**: Date navigation logic
  - **`useThumbnailGeneration.js`**: Thumbnail generation logic
  - **`useTutorial.js`**: Tutorial state management
  - **`useAppConfig.js`**: Application configuration hook
- **PhotosList Sub-Hooks**:
  - **`usePhotosListDisplay.js`**: PhotosList display state
  - **`usePhotosListFilters.js`**: Filter state management
  - **`usePhotosListSelection.js`**: PhotosList selection operations

#### Services
- **`LoggerService.js`**: Structured logging service for frontend and backend correlation

## Backend Source Code (`src-tauri/`)

```
src-tauri/
├── 📄 Cargo.toml               # Rust project configuration
├── 📄 Cargo.lock               # Dependency lock file
├── 📄 build.rs                 # Build script
├── 📄 tauri.conf.json          # Tauri app configuration
│
├── 📁 src/                     # Rust source code
│   ├── 📄 main.rs              # Application entry point
│   ├── 📄 lib.rs               # Main library with Tauri commands
│   ├── 📄 app_state.rs         # Application state management
│   ├── 📄 error.rs             # Error types and handling
│   ├── 📄 utils.rs             # Utility functions
│   │
│   ├── 📁 commands/            # Tauri command handlers (refactored)
│   │   ├── 📄 mod.rs           # Commands module declaration
│   │   ├── 📄 album_commands.rs    # Album management commands
│   │   ├── 📄 collection_commands.rs # Collection commands
│   │   ├── 📄 config_commands.rs   # Configuration commands
│   │   ├── 📄 database_commands.rs # Database commands
│   │   ├── 📄 google_commands.rs   # Google Photos commands
│   │   ├── 📄 image_commands.rs    # Image processing commands
│   │   ├── 📄 import_commands.rs   # Import commands
│   │   ├── 📄 job_queue_commands.rs # Job queue commands
│   │   ├── 📄 logging_commands.rs  # Logging commands
│   │   ├── 📄 photo_commands.rs    # Main photo commands
│   │   ├── 📄 search_commands.rs   # Search commands
│   │   ├── 📄 style_commands.rs    # Style commands
│   │   ├── 📄 tag_commands.rs      # Tag commands
│   │   ├── 📄 trash_commands.rs    # Trash commands
│   │   ├── 📄 utility_commands.rs  # Utility commands
│   │   │
│   │   └── 📁 photo_handlers/  # Photo command handlers (split)
│   │       ├── 📄 mod.rs       # Photo handlers module
│   │       ├── 📄 album.rs     # Album photo handlers
│   │       ├── 📄 collections.rs # Collection photo handlers
│   │       ├── 📄 date.rs      # Date-based photo handlers
│   │       ├── 📄 navigation.rs # Photo navigation handlers
│   │       ├── 📄 recent.rs    # Recent photos handlers
│   │       ├── 📄 search.rs    # Search handlers
│   │       ├── 📄 tag.rs       # Tag handlers
│   │       └── 📄 trash.rs     # Trash handlers
│   │
│   ├── 📄 entity.rs            # Domain entities module declaration
│   ├── 📁 entity/              # Business domain entities
│   │   ├── 📄 config.rs        # Application configuration entity
│   │   ├── 📄 google_photos.rs # Google Photos integration entity
│   │   ├── 📄 importer.rs      # Import operation state entity
│   │   ├── 📄 job_queue.rs     # Background job entities
│   │   ├── 📄 photo.rs         # Photo entity with metadata
│   │   ├── 📄 photo_collection.rs # Unified collection entity
│   │   ├── 📄 photo_meta.rs    # Photo metadata entities
│   │   └── 📄 trash.rs         # Trash/recycle bin entity
│   │
│   ├── 📄 domain_service.rs    # Domain services module declaration
│   ├── 📁 domain_service/      # Business logic services
│   │   ├── 📄 dir_service.rs   # Directory operation services
│   │   ├── 📄 file_service.rs  # File operation services
│   │   ├── 📄 job_queue_service.rs # Background job processing
│   │   ├── 📄 logging_service.rs # Structured logging service
│   │   ├── 📄 photo_service.rs # Photo processing services
│   │   ├── 📄 repository_dir_service.rs # Repository directory services
│   │   ├── 📄 thumbnail_service.rs # Thumbnail generation service
│   │   ├── 📄 token_storage_service.rs # OAuth token management
│   │   │
│   │   └── 📁 job_queue/       # Job queue subsystem
│   │       ├── 📄 mod.rs       # Job queue module
│   │       ├── 📄 executor.rs  # Job executor
│   │       ├── 📄 manager.rs   # Job manager
│   │       ├── 📄 submission.rs # Job submission
│   │       │
│   │       ├── 📁 handlers/    # Job handlers
│   │       │   ├── 📄 mod.rs   # Handlers module
│   │       │   ├── 📄 create_db.rs # Database creation handler
│   │       │   ├── 📄 google_photos.rs # Google Photos handler
│   │       │   ├── 📄 import.rs # Import handler
│   │       │   └── 📄 thumbnail.rs # Thumbnail handler
│   │       │
│   │       └── 📁 utils/       # Job queue utilities
│   │           ├── 📄 mod.rs   # Utils module
│   │           ├── 📄 date_extractor.rs # Date extraction
│   │           └── 📄 events.rs # Event handling
│   │
│   ├── 📄 repository.rs        # Repository pattern interfaces
│   ├── 📁 repository/          # Data access layer
│   │   ├── 📄 db.rs            # Database abstraction
│   │   ├── 📄 dir.rs           # Directory-based storage
│   │   ├── 📄 meta_db.rs       # Metadata database interface
│   │   │
│   │   ├── 📁 config/          # Configuration storage
│   │   │   └── 📄 json.rs      # JSON-based config storage
│   │   │
│   │   ├── 📁 db/              # Database implementations
│   │   │   └── 📄 directory.rs # Filesystem-based repository
│   │   │
│   │   └── 📁 meta_db/         # Metadata database (refactored)
│   │       ├── 📄 mod.rs       # SQLite module
│   │       ├── 📄 albums.rs    # Album operations
│   │       ├── 📄 collections.rs # Collection operations
│   │       ├── 📄 counts.rs    # Count operations
│   │       ├── 📄 date_summary.rs # Date summary operations
│   │       ├── 📄 dates.rs     # Date operations
│   │       ├── 📄 exif.rs      # EXIF operations
│   │       ├── 📄 job_queue.rs # Job queue operations
│   │       ├── 📄 photo_crud.rs # Photo CRUD operations
│   │       ├── 📄 photo_metadata.rs # Photo metadata operations
│   │       ├── 📄 search.rs    # Search operations
│   │       ├── 📄 tags.rs      # Tag operations
│   │       ├── 📄 utils.rs     # SQLite utilities
│   │       │
│   │       └── 📁 migrations/  # Database migrations
│   │           ├── 📄 mod.rs   # Migrations module
│   │           ├── 📄 001_initial_schema.sql
│   │           ├── 📄 002_create_date_summary.sql
│   │           ├── 📄 003_create_collections.sql
│   │           └── 📄 004_create_job_queue.sql
│   │
│   ├── 📄 value.rs             # Value objects module declaration
│   ├── 📁 value/               # Domain value objects
│   │   ├── 📄 comment.rs       # User comment value object
│   │   ├── 📄 date.rs          # Date handling value object
│   │   ├── 📄 exif.rs          # EXIF data value object
│   │   ├── 📄 file.rs          # File information value object
│   │   └── 📄 star.rs          # Star rating value object
│   │
│   └── 📁 bin/                 # Additional binary targets
│
├── 📁 capabilities/            # Tauri security capabilities
│   └── 📄 migrated.json        # Security capability definitions
│
├── 📁 gen/                     # Generated files
│   └── 📁 schemas/             # Generated schema files
│       ├── 📄 acl-manifests.json
│       ├── 📄 capabilities.json
│       ├── 📄 desktop-schema.json
│       ├── 📄 linux-schema.json
│       └── 📄 windows-schema.json
│
├── 📁 icons/                   # Application icons for different platforms
│   ├── 📄 icon.ico             # Windows icon
│   ├── 📄 icon.icns            # macOS icon
│   ├── 📄 icon.png             # Default icon
│   └── ... (various platform-specific icons)
│
├── 📁 target/                  # Rust build artifacts (auto-generated)
├── 📁 tmp/                     # Temporary files
│
└── 📁 tests/                   # Test files
    └── 📁 assets/              # Test assets
        └── 📁 files/           # Sample test files
            ├── 📄 a.jpg
            ├── 📄 b.jpg
            └── 📄 c.jpg
```

### Backend Architecture Explanations

#### Domain-Driven Design Structure

**Entities** (`entity/`): Core business objects that represent the main concepts
- **`config.rs`**: Application configuration settings and preferences
- **`photo.rs`**: Photo object with file information, EXIF data, and metadata
- **`photo_meta.rs`**: Photo metadata like ratings, comments, and user annotations
- **`photo_collection.rs`**: Unified collection entity for albums and tags
- **`importer.rs`**: Import operation state and progress tracking
- **`job_queue.rs`**: Background job definitions and status tracking
- **`google_photos.rs`**: Google Photos integration entity
- **`trash.rs`**: Deleted photo management

**Domain Services** (`domain_service/`): Business logic operations
- **`photo_service.rs`**: Photo processing (thumbnails, EXIF extraction, transformations)
- **`file_service.rs`**: File system operations (copy, move, delete)
- **`job_queue_service.rs`**: Asynchronous job processing and queue management
- **`token_storage_service.rs`**: OAuth token management with keyring storage
- **`logging_service.rs`**: Structured logging service with correlation tracking
- **`dir_service.rs`**: Directory scanning and organization

**Repositories** (`repository/`): Data access and persistence
- **`db/directory.rs`**: Filesystem-based photo storage and retrieval
- **`meta_db/sqlite/`**: SQLite database modules (refactored into separate files):
  - `mod.rs`: Main SQLite module
  - `albums.rs`: Album CRUD operations
  - `collections.rs`: Unified collection operations
  - `counts.rs`: Count queries
  - `dates.rs`: Date-related queries
  - `exif.rs`: EXIF data operations
  - `photo_crud.rs`: Photo CRUD operations
  - `photo_metadata.rs`: Photo metadata operations
  - `search.rs`: Search functionality
  - `tags.rs`: Tag operations
  - `utils.rs`: SQLite utilities
- **`meta_db/migrations/`**: Database migration SQL files
- **`config/json.rs`**: JSON-based configuration file management

**Commands** (`commands/`): Tauri command handlers (refactored from lib.rs)
- Modular command structure with separate files for each feature area
- **`photo_handlers/`**: Photo command handlers split into focused modules:
  - `album.rs`, `collections.rs`, `date.rs`, `navigation.rs`, `recent.rs`, `search.rs`, `tag.rs`, `trash.rs`

**Value Objects** (`value/`): Immutable data types
- **`date.rs`**: Date parsing, formatting, and comparison utilities
- **`exif.rs`**: EXIF data extraction and processing
- **`file.rs`**: File information and path utilities
- **`star.rs`**: Star rating value object (1-5 stars)
- **`comment.rs`**: User comment text with validation

#### Core System Files
- **`main.rs`**: Application entry point, calls lib.rs run function
- **`lib.rs`**: Main application logic with all Tauri command handlers and app setup
- **`Cargo.toml`**: Rust dependencies and project configuration

## Documentation (`docs/`)

```
docs/
├── 📄 architecture.md          # System architecture overview
├── 📄 feature-sequences.md     # Frontend/backend interaction sequences
├── 📄 component-structure.md   # React component hierarchy and HTML structure
├── 📄 feature-documentation-index.md # Reverse index for finding documentation
├── 📄 source-tree.md           # This file - source code organization
├── 📁 guides/                  # Step-by-step guides and tutorials
├── 📄 database-schema.md       # SQLite database schema
├── 📄 google-photos-integration.md # Google Photos API integration
├── 📄 job-queue-system.md      # Background job processing
└── 📄 terms.md                 # Feature terminology and mappings
```

## Static Assets and Configuration

### Public Assets (`public/`)
```
public/
├── 📄 bird.jpg                 # Sample welcome images
├── 📄 img_error.png            # Error placeholder image
├── 📄 kamikochi.jpg            # Sample welcome images
├── 📄 midagahara.jpg           # Sample welcome images
├── 📄 monkey.jpg               # Sample welcome images
├── 📄 mountain.jpg             # Sample welcome images
└── 📄 raityou.jpg              # Sample welcome images
```

### Example Data (`example/`)
```
example/
├── 📁 export_from/             # Sample source photos for import testing
├── 📁 import_to/               # Sample organized photo structure
│   ├── 📁 2008-12-30/          # Date-organized directories
│   ├── 📁 2018-01-31/
│   └── ...
├── 📁 thumbnail/               # Sample thumbnail cache structure
└── 📁 trash/                   # Sample trash/recycle bin
```

### Development Workflow (`improvement/`)
```
improvement/
└── 📁 done/                    # Completed development tasks
    ├── 📄 1.md                 # Individual task files
    ├── 📄 2.md
    └── ... (numbered task files)
```

## Configuration Files

### Frontend Configuration
- **`package.json`**: NPM dependencies, scripts, and project metadata
- **`vite.config.js`**: Vite build tool configuration for development and production
- **`index.html`**: HTML entry point with root div for React mounting

### Backend Configuration
- **`Cargo.toml`**: Rust dependencies, features, and build configuration
- **`tauri.conf.json`**: Tauri-specific configuration (app metadata, security, build settings)
- **`build.rs`**: Custom build script for compilation-time setup

### Development Tools
- **`CLAUDE.md`**: Development workflow instructions for AI-assisted development
- **`pnpm-lock.yaml`**: Package manager lock file for reproducible builds

## Key Design Patterns

### Frontend Patterns
1. **Component Composition**: Complex UIs built from smaller, reusable components
2. **React Hooks**: State management using useState, useEffect, and custom hooks
3. **Context API**: Global state sharing (ImgCacheContext, AllPhotosContext)
4. **Event-Driven Architecture**: Tauri event listeners for backend communication

### Backend Patterns
1. **Domain-Driven Design**: Clear separation of entities, services, and repositories
2. **Repository Pattern**: Abstract data access layer with multiple implementations
3. **Command Pattern**: Tauri commands as entry points for frontend requests
4. **Job Queue Pattern**: Background processing with status tracking and retry logic

### Data Flow Patterns
1. **Unidirectional Data Flow**: React → Tauri Commands → Rust Services → Repositories
2. **Event Streaming**: Background jobs emit progress events to frontend
3. **Caching Strategy**: Multiple layers (browser, filesystem thumbnails, database indices)
4. **Lazy Loading**: Photos and thumbnails loaded on-demand

| Main App Component | `src/App.jsx` |
| Photo Grid Display | `src/App/PhotosList.jsx` |
| Full Screen Photo Viewer | `src/App/PhotosList/PhotosListMini.jsx` |
| Photo Editor | `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` |
| Tag Components | `src/components/Tag*.jsx` |
| Unified Collection Service | `src/services/UnifiedCollectionService.js` |
| Unified Photo Collection Domain | `src/domain/UnifiedPhotoCollection.js` |
| Search Tools Container | `src/components/SearchTools.jsx` |
| Advanced Filters | `src/components/AdvancedFilters.jsx` |
| ViewMode DDD Value Object | `src/domain/ViewMode.js` |
| ViewMode React Hook | `src/hooks/useViewModeObject.js` |
| PhotosList State Hooks | `src/hooks/usePhotosListState.js` |
| Debug Log Viewer | `src/App/LogViewer.jsx` |
| Logger Service | `src/services/LoggerService.js` |
| Photo Cache Service | `src/services/PhotoCacheService.js` |
| Date Calendar & Recent Photos | `src/App/DateList.jsx` |
| Tauri Commands | `src-tauri/src/lib.rs` |
| Unified Collection Entity | `src-tauri/src/entity/photo_collection.rs` |
| Job Queue Service | `src-tauri/src/domain_service/job_queue_service.rs` |
| OAuth Token Management | `src-tauri/src/domain_service/token_storage_service.rs` |
| Google Photos Integration | `src-tauri/src/entity/google_photos.rs` |
| Logging Service | `src-tauri/src/domain_service/logging_service.rs` |
| Database Operations | `src-tauri/src/repository/meta_db/sqlite.rs` |
| Configuration Entity | `src-tauri/src/entity/config.rs` |
| Photo Entity | `src-tauri/src/entity/photo.rs` |

This source tree structure reflects a well-organized, scalable application with clear separation of concerns and modern development practices including unified collection system, Domain-Driven Design, and comprehensive logging. The codebase is designed for maintainability, testability, and extensibility.