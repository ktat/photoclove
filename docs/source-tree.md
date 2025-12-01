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
│       ├── 📄 PhotosListMini.jsx    # Full-screen photo viewer
│       ├── 📄 PhotoGrid.jsx         # Photo grid display component
│       │
│       ├── 📁 PhotoOption/
│       │   ├── 📄 PhotoEditor.jsx   # Image editing controls (980 lines)
│       │   ├── 📄 PhotoInfo.jsx     # Photo metadata display with external app launcher
│       │   │
│       │   └── 📁 PhotoEditor/      # PhotoEditor utility modules
│       │       ├── 📄 cssUtils.js   # CSS parsing/generation (218 lines)
│       │       ├── 📄 cropUtils.js  # Crop calculations (144 lines)
│       │       └── 📄 styleUtils.js # Style application (199 lines)
│       │
│       └── 📁 PhotosListMini/
│           ├── 📄 PhotoDisplay.jsx  # Individual photo display
│           ├── 📄 photoUtils.js     # Thumbnail display calculations (128 lines)
│           └── 📄 useKeyboardShortcuts.js # Keyboard navigation hook (124 lines)
│
├── 📁 hooks/                   # Custom React hooks
│   ├── 📄 useAppConfig.js           # Application configuration hook
│   ├── 📄 useDateNavigation.js      # Date navigation logic
│   ├── 📄 useImportModeLifecycle.js # Import mode lifecycle management
│   ├── 📄 useInfiniteScroll.js      # Infinite scroll pagination
│   ├── 📄 usePhotoDataLoader.js     # Photo data loading logic
│   ├── 📄 usePhotoDataSync.js       # Photo data synchronization
│   ├── 📄 usePhotoDisplay.js        # Photo display state management
│   ├── 📄 usePhotoMetadata.js       # Photo metadata operations
│   ├── 📄 usePhotoOperations.js     # Photo operations (510 lines: album, trash, list management)
│   ├── 📄 usePhotoSelection.js      # Photo selection logic
│   ├── 📄 usePhotosListDisplay.js   # PhotosList display state
│   ├── 📄 usePhotosListFilters.js   # Filter state management
│   ├── 📄 usePhotosListSelection.js # PhotosList selection operations
│   ├── 📄 usePhotosListState.js     # Main PhotosList state hook
│   ├── 📄 usePhotosQuery.js         # Photo query logic
│   ├── 📄 usePhotosState.js         # Photos state management
│   ├── 📄 useSearch.js              # Search functionality
│   ├── 📄 useSearchHistory.js       # Search history management
│   ├── 📄 useThumbnailGeneration.js # Thumbnail generation logic
│   ├── 📄 useTutorial.js            # Tutorial state management
│   ├── 📄 useViewMode.js            # View mode state machine
│   ├── 📄 useViewModeObject.js      # ViewMode DDD value object integration
│   └── 📄 useViewModeSync.js        # ViewMode synchronization
│
├── 📁 services/                # External service integrations
│   ├── 📄 LoggerService.js     # Structured logging service
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
- **`PhotosList.jsx`**: Main photo grid with filtering, sorting, pagination, and selection
- **`PhotoGrid.jsx`**: Photo grid display component with thumbnail rendering
- **`PhotosListMini.jsx`**: Full-screen photo viewer with navigation and editing capabilities (735 lines)
  - **`photoUtils.js`**: Thumbnail display calculations and border styles (128 lines)
  - **`useKeyboardShortcuts.js`**: Keyboard navigation hook for photo browsing (124 lines)
- **`PhotoDisplay.jsx`**: Individual photo rendering with transformation support
- **`PhotoOption.jsx`**: Right sidebar panel for photo metadata and actions
- **`PhotoEditor.jsx`**: Image editing interface with filters, transforms, and crop tools (980 lines)
  - **`cssUtils.js`**: CSS parsing and generation utilities (218 lines)
  - **`cropUtils.js`**: Crop calculation utilities and aspect ratio presets (144 lines)
  - **`styleUtils.js`**: Style application utilities for DOM elements (199 lines)
- **`PhotoInfo.jsx`**: Photo metadata display with EXIF data and external app launcher (🚀 button)

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
│   │
│   ├── 📄 entity.rs            # Domain entities module declaration
│   ├── 📁 entity/              # Business domain entities
│   │   ├── 📄 config.rs        # Application configuration entity
│   │   ├── 📄 google_photos.rs # Google Photos integration entity
│   │   ├── 📄 importer.rs      # Import operation state entity
│   │   ├── 📄 job_queue.rs     # Background job entities
│   │   ├── 📄 photo.rs         # Photo entity with metadata
│   │   ├── 📄 photo_meta.rs    # Photo metadata entities
│   │   └── 📄 trash.rs         # Trash/recycle bin entity
│   │
│   ├── 📄 domain_service.rs    # Domain services module declaration
│   ├── 📁 domain_service/      # Business logic services
│   │   ├── 📄 dir_service.rs   # Directory operation services
│   │   ├── 📄 file_service.rs  # File operation services
│   │   ├── 📄 job_queue_service.rs # Background job processing
│   │   ├── 📄 photo_service.rs # Photo processing services
│   │   └── 📄 repository_dir_service.rs # Repository directory services
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
│   │   │   ├── 📄 directory.rs # Filesystem-based repository
│   │   │   └── 📄 sqlite.rs    # SQLite database operations
│   │   │
│   │   └── 📁 meta_db/         # Metadata database implementations
│   │       └── 📄 sqlite.rs    # SQLite metadata operations
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
- **`meta_db/sqlite.rs`**: SQLite database for metadata, unified collections, and search indices
- **`config/json.rs`**: JSON-based configuration file management

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