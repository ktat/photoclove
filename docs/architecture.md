# PhotoClove Architecture

## Overview

PhotoClove is a photo management application built with a desktop-native architecture using Tauri (Rust backend) and React (frontend). It provides fast photo importing, viewing, and management capabilities with local storage and database management.

## Technology Stack

### Frontend
- **React 18** - UI library with hooks
- **Vite** - Build tool and development server
- **Tauri API** - Native system integration
- **CSS3** - Custom styling with CSS Grid/Flexbox

### Backend
- **Rust** - System programming language for performance
- **Tauri** - Cross-platform desktop framework
- **SQLite** - Embedded database for metadata
- **tokio** - Async runtime for concurrent operations

### External Libraries
- **Firebase** - Authentication services
- **rexif** - EXIF data extraction
- **image_compressor** - Thumbnail generation
- **reqwest** - HTTP client for API calls

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │    App.jsx  │ │ PhotosList  │ │  Importer   │ │ Preferences │ │
│  │ (Main Shell)│ │   (View)    │ │ (Import UI) │ │  (Config)   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ PhotoOption │ │ PhotoEditor │ │  DateList   │ │  JobQueue   │ │
│  │   (Meta)    │ │   (Edit)    │ │ (Calendar)  │ │ (Background)│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        Tauri Bridge                             │
├─────────────────────────────────────────────────────────────────┤
│                      Backend (Rust)                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                  Domain Services                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │   │
│  │  │PhotoService │ │ FileService │ │  JobQueueService    │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                     Entities                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │   │
│  │  │    Photo    │ │   Config    │ │      Importer       │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   Repositories                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │   │
│  │  │   RepoDB    │ │   MetaDB    │ │      ConfigDB       │  │   │
│  │  │(Filesystem) │ │  (SQLite)   │ │      (JSON)         │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                         File System                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Import To   │ │ Export From │ │ Thumbnails  │ │   Trash     │ │
│  │   Photos    │ │   Sources   │ │    Cache    │ │    Bin      │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### Frontend Architecture

#### 1. Application Shell (App.jsx)
- **Purpose**: Main application container and state management
- **Key Features**:
  - Global state management (React hooks)
  - Menu event handling
  - View routing (Photos, Import, Preferences, etc.)
  - Footer message system
  - Tauri event listeners

#### 2. Photo Management Components
- **PhotosList.jsx**: Main photo grid view with filtering, sorting, pagination
- **PhotosListMini.jsx**: Full-screen photo viewer with navigation
- **PhotoOption.jsx**: Photo metadata and editing panel
- **PhotoEditor.jsx**: Image transformation and filter tools

#### 3. Import System Components
- **Importer.jsx**: Directory browsing and photo selection
- **SelectedPhotoInfo.jsx**: Batch import management
- **JobQueue.jsx**: Background job monitoring

#### 4. Configuration Components
- **Preferences.jsx**: Application settings management
- **FolderPicker.jsx**: Directory selection dialogs

### Backend Architecture

#### 1. Domain-Driven Design Structure

**Entities** (Core business objects):
- `Photo`: Represents a photo with metadata
- `Config`: Application configuration
- `Importer`: Import operation state
- `JobQueue`: Background job management

**Domain Services** (Business logic):
- `PhotoService`: Photo processing operations
- `FileService`: File system operations
- `JobQueueService`: Asynchronous job processing

**Repositories** (Data access):
- `RepoDB` (Directory): Filesystem-based photo storage
- `MetaDB` (SQLite): Metadata and search indices
- `ConfigDB` (JSON): Application settings

#### 2. Data Storage Strategy

**Filesystem Organization**:
```
import_to/
├── YYYY-MM-DD/
│   ├── [UUID]/
│   │   ├── photo1.jpg
│   │   ├── photo2.mp4
│   │   └── ...
│   └── ...
└── ...

thumbnail_store/
├── YYYY-MM-DD/
│   ├── [UUID]/
│   │   ├── photo1.jpg
│   │   ├── photo2.mp4.jpg
│   │   └── ...
│   └── ...
└── ...
```

**SQLite Database Schema**:
- `photos` - Photo metadata (path, EXIF, timestamps)
- `stars` - User ratings
- `comments` - User annotations
- `photo_styles` - CSS transformations
- `job_queue` - Background tasks
- `job_units` - Job groupings

## Key Features Implementation

### 1. Photo Import Process
1. User selects source directories
2. Frontend scans for image/video files
3. Background jobs created for each file
4. Rust backend processes imports:
   - Copy files to dated UUID directories
   - Extract EXIF metadata
   - Generate thumbnails
   - Update SQLite database

### 2. Photo Viewing & Management
1. Frontend requests photo list by date
2. Backend queries filesystem + SQLite metadata
3. Thumbnails served via Tauri file protocol
4. Full-size images loaded on demand
5. Metadata editing updates SQLite database

### 3. Photo Organization
- **Date-based**: Automatic organization by photo date
- **Filtering**: By star rating, comments, file type
- **Search**: Metadata-based search capabilities
- **Batch operations**: Multi-select for mass actions

### 4. State Management Architecture (Refactored)

#### Custom Hooks Architecture

The application uses a modular hook-based state management system:

```
┌─────────────────────────────────────────────────────────┐
│                 usePhotosListState                      │
│  ┌─────────────┬─────────────┬─────────────┐          │
│  │Display Hook │Filters Hook │Selection Hook│          │
│  └─────────────┴─────────────┴─────────────┘          │
└─────────────────────────────────────────────────────────┘
```

#### View Mode State Machine

Navigation is managed through a centralized state machine in UIContext:

```
HOME ──→ DATE ──→ ALBUM
  ↓       ↓        ↓
SEARCH  RECENT  IMPORT
  ↓               ↓
ADVANCED    PREFERENCES
```

#### Cache Service

Unified caching with automatic management:
- **LRU Eviction**: Memory-efficient caching
- **TTL Support**: 30-minute automatic expiration
- **Statistics**: Hit rate and performance monitoring

### 5. Performance Optimizations
- **Thumbnail caching**: PhotoCacheService with LRU eviction
- **Lazy loading**: Photos loaded as needed
- **Virtual scrolling**: Efficient large dataset rendering
- **Async operations**: Non-blocking file operations
- **Job queue**: Background processing for heavy tasks
- **Unified caching**: Centralized cache management across components

## Security Considerations

1. **File Access**: Sandboxed file access through Tauri APIs
2. **Path Validation**: Input sanitization for file paths
3. **Database**: Parameterized SQLite queries
4. **Authentication**: Firebase for cloud features (optional)
5. **Local Storage**: All data remains on user's machine

## Extension Points

1. **Plugin Architecture**: Additional domain services
2. **Database Backends**: Alternative to SQLite
3. **Cloud Storage**: Integration with cloud providers
4. **File Formats**: Additional image/video format support
5. **Export Formats**: Custom export functionality