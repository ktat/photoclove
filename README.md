# PhotoClove

> A fast, modern photo management application built with Rust and React

PhotoClove is a desktop photo manager designed for speed and simplicity. Built with Tauri (Rust backend) and React (frontend), it provides lightning-fast photo importing, viewing, and basic editing capabilities while keeping your photos organized locally.

## ✨ Key Features

- **🚀 Lightning Fast**: Optimized for handling large photo collections with minimal lag
- **📥 Smart Import**: Unified import system using PhotosList components with directory navigation, progress tracking, and JobQueue integration
- **🎨 Non-Destructive Editing**: CSS-based image transformations with real-time preview and crop functionality
- **📅 Date Organization**: Automatic photo organization by date with enhanced navigation features:
  - Hierarchical tree view with collapsible year/month structure
  - Year/month filter controls for quick navigation
  - List/Tree view mode toggle
  - Recent Photos quick access (60 most recent)
  - Optimized with date_summary table for ~10x faster loading
- **🎯 Infinite Scroll**: Smooth photo browsing with batch loading (50 photos per batch) and configuration limit detection
- **⭐ Metadata Management**: Star ratings, comments, and searchable metadata with EXIF data extraction
- **🔍 Advanced Search**: Comprehensive search interface with EXIF filters, saved searches, search history, and database optimization
- **📊 Debug Logging**: Real-time log viewer with frontend/backend correlation for troubleshooting (Ctrl+Shift+L)
- **📷 RAW & HEIC/AVIF Support**: Full support for RAW formats (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, 3FR) and HEIC/HEIF/AVIF (iPhone) with progressive loading, EXIF extraction, AI tagging, face detection, persistent decoded cache, and Share/Collage support
- **🎬 Video Support**: View and manage MP4/WebM videos with thumbnail generation
- **☁️ Google Photos Integration**: Secure OAuth authentication with automatic token refresh and seamless photo uploads
- **☁️ S3 Cloud Backup**: Backup photos to Amazon S3 or S3-compatible storage (Wasabi, MinIO, Cloudflare R2, DigitalOcean Spaces, iDrive e2) with auto-sync on import, custom region support, and provider-specific credentials
- **🤖 AI Auto-Tagging**: Automatic photo classification using MobileNet (fast, 32 categories), OpenCLIP, or SigLIP models with customizable labels
- **👤 Face Detection**: Detect and recognize faces in photos with person assignment, similarity matching, and batch operations for Unknown Faces management
- **🔄 Background Processing**: Advanced job queue with immediate retry, progress tracking, and comprehensive logging
- **🔐 Secure Authentication**: Platform-native keyring storage for OAuth tokens with external service integration
- **📚 Album Management**: Create custom photo collections with descriptions, cover photos, and custom ordering
- **🏷️ Tag System**: Color-coded tags for photo categorization with search integration and bulk operations
- **💡 Tutorial System**: Context-aware help tooltips for new users
- **📤 Share & Collage**: Share photos with watermarks, create multi-photo collages (2-9 photos), copy to clipboard or save as file with PNG copyright metadata
- **🎨 Theme Support**: Dark/Light (Slate Blue) application themes with customizable photo grid themes (Film Strip, Slide Mount, Light Box, 35mm Slide)
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux

## 🏗️ Architecture

PhotoClove uses a modern desktop architecture:

- **Frontend**: React 18 with Vite for fast development and responsive UI
- **Backend**: Rust with Tauri 2.0 for native performance and system integration
- **Database**: SQLite with optimized indexes for fast metadata queries and search
- **Storage**: Local filesystem with date-based organization and UUID conflict prevention
- **State Management**: Domain-Driven Design with ViewMode value object for centralized view state management
- **Navigation**: View mode state machine with transition validation and UI display conditions
- **Caching**: Unified cache service with LRU eviction and automatic cleanup
- **Domain Model**: Domain-Driven Design with Photo, PhotoCollection, and ImportState entities

## 📦 Releases

Pre-built installers are available on the [GitHub Releases page](https://github.com/ktat/photoclove/releases).

| OS | Installer |
|---|---|
| Windows | `.msi` or `.exe` |
| macOS (Apple Silicon) | `aarch64.dmg` |
| macOS (Intel) | `x64.dmg` |
| Linux (Debian/Ubuntu) | `.deb` |
| Linux (other) | `.AppImage` |

> **Note on AI Auto-Tagging**: The default MobileNet model (`mobilenet-v3-large.onnx`) is bundled with release builds. For OpenCLIP or SigLIP models, download them separately via Preferences → AI Auto-Tagging. The ONNX Runtime library must also be installed separately — see `src-tauri/models/README.md` for details.

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org/))
- **pnpm** (package manager): `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`
- **Rust** 1.84.1+ via [rustup](https://rustup.rs/): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **FFmpeg** and **GStreamer** (for video support)
- **CMake** and **libnuma-dev** (for HEIC/AVIF support via libheif)
- **libwebkit2gtk-4.1-dev** (Linux only — Tauri WebView renderer)
- **libsecret-1-dev** (Linux only — required for OAuth and S3 credential storage)

#### Ubuntu/Debian Setup
```bash
# Core Tauri dependencies
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev

# Video support
sudo apt install gstreamer1.0-plugins-bad gstreamer1.0-plugins-good \
  gstreamer1.0-libav ffmpeg libgstreamer1.0-dev

# HEIC/AVIF support (libheif)
sudo apt install cmake libnuma-dev

# Keyring support (for OAuth and S3 credentials)
sudo apt install libsecret-1-dev
```

### Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Building

For the AI Auto-Tagging feature, download the ONNX model and runtime before building.
See `src-tauri/models/README.md` for details.

```bash
# Linux x64 only — downloads ONNX model and ONNX Runtime library
make setup-ai
```

> **Note**: `make setup-ai` is Linux x64 only. On macOS and Windows, the ONNX Runtime must be installed separately. The app builds without this step, but AI tagging will not work at runtime.

```bash
# Build for production (Linux)
make build-linux
```

#### WSL2 Build (Ubuntu 22.04)
```bash
# Update WSL first
wsl --update && wsl --shutdown

# Install build dependencies (same as Ubuntu/Debian Setup above, plus patchelf)
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-good gstreamer1.0-libav \
  ffmpeg libgstreamer1.0-dev cmake libnuma-dev libsecret-1-dev patchelf

# Build with clean environment (strips Windows paths from PATH)
rm -rf src-tauri/target
make build-wsl
```

### macOS Build

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install cmake ffmpeg libheif

# Build
make build-macos
```

> **Note**: `make setup-ai` does not support macOS. Download the ONNX Runtime for macOS from the [ONNX Runtime releases](https://github.com/microsoft/onnxruntime/releases) and set `ORT_DYLIB_PATH` accordingly.

### Windows Build

Prerequisites:
- [Microsoft Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload required)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (usually pre-installed on Windows 11)
- [CMake](https://cmake.org/download/) (required to compile libheif from source)
- [NASM](https://www.nasm.us/) (required for libheif codec support)
- [vcpkg](https://github.com/microsoft/vcpkg) (for native library dependencies)

#### vcpkg Setup

```powershell
# Clone vcpkg (e.g. to C:\Users\<user>\source\repos\vcpkg)
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# Install required libraries
.\vcpkg install openssl:x64-windows-static-md

# Set environment variables (add to your profile for persistence)
$env:VCPKG_ROOT = "C:\Users\<user>\source\repos\vcpkg"
$env:PATH += ";$env:VCPKG_ROOT"
```

#### Build

```powershell
pnpm tauri build
```

> **Note**: `make setup-ai` does not support Windows. Download the ONNX Runtime for Windows from [ONNX Runtime releases](https://github.com/microsoft/onnxruntime/releases) and set `ORT_DYLIB_PATH` to `onnxruntime.dll`.

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

### Core Documentation
- **[Architecture Overview](./docs/architecture.md)** - System design and technology stack
- **[Feature Documentation Index](./docs/feature-documentation-index.md)** - Quick reference for finding relevant docs
- **[Feature Quick Reference](./docs/feature-quick-reference.md)** - Find documentation by feature/component
- **[API Reference](./docs/api-reference.md)** - Backend commands and implementation guides
- **[Source Tree](./docs/source-tree.md)** - Complete codebase organization guide
- **[Terms Reference](./docs/terms.md)** - Mapping between features, concepts, and source code

### Technical Guides
- **[Feature Sequences](./docs/feature-sequences.md)** - Frontend/backend interaction flows
- **[Component Structure](./docs/component-structure.md)** - React component hierarchy and HTML structure
- **[Database Schema](./docs/database-schema.md)** - SQLite structure and EXIF fields
- **[Screen Transition Diagram](./docs/screen-transition-diagram.md)** - Visual navigation flow
- **[PhotosList Modes](./docs/photoslist-modes-operations.md)** - Photo view modes and operations

### Implementation Guides
- **[State Management Guide](./docs/guides/state-management-guide.md)** - Custom hooks architecture with React Query-like implementation
- **[OAuth Token Management](./docs/guides/oauth-token-management.md)** - Secure token storage, automatic refresh, and testing tools
- **[Configuration Guide](./docs/guides/configuration.md)** - Application settings and preferences
- **[Image Editor](./docs/guides/image-editor.md)** - CSS-based photo editing features
- **[Troubleshooting Guide](./docs/guides/troubleshooting-guide.md)** - Debug common issues

### Feature-Specific Documentation
- **[Google Photos Integration](./docs/google-photos-integration.md)** - OAuth flow and upload features
- **[Job Queue System](./docs/job-queue-system.md)** - Asynchronous background processing with enhanced retry

## 🎯 Use Cases

PhotoClove is perfect for:

- **Photographers** managing large collections of JPEG, PNG, RAW (CR2, NEF, ARW, DNG, etc.), and HEIC/AVIF images
- **Content Creators** organizing photos and videos from multiple cameras/phones (including iPhone HEIC)
- **Families** importing and organizing photos from various devices
- **Anyone** wanting fast, local photo management without cloud dependency

## 🔧 Configuration

PhotoClove uses a YAML configuration file located at `~/.photoclove.yml`. On first run, it will create this file with default settings.

### Configuration Options

Copy the example configuration file and adjust settings as needed:

```bash
cp photoclove.yml.example ~/.photoclove.yml
```

Key configuration options include:

#### Directory Paths
- `import_to`: Where imported photos are stored (default: `~/.photoclove/import/`)
- `export_from`: Source directories for importing (default: `["/"]`)
- `trash_path`: Directory for deleted photos (default: `~/.photoclove/trash/`)
- `thumbnail_store`: Thumbnail cache location (default: `~/.photoclove/thumbnail/`)

#### Performance Settings
- `max_photos_per_fetch`: Maximum number of photos to load at once (default: `1000`)
  - Higher values: More photos loaded simultaneously, better for large collections
  - Lower values: Reduced memory usage, better for resource-constrained systems
- `copy_parallel`: Number of parallel file operations (default: `2`)
- `thumbnail_parallel`: Number of parallel thumbnail generations (default: `1`)

#### Thumbnail Generation
- `thumbnail_ratio`: Size ratio for thumbnails (default: `0.05`)
- `thumbnail_compression_quality`: JPEG compression quality (default: `0.5`)
- `thumbnail_ignore_file_size`: Skip thumbnails for files smaller than this size in bytes (default: `1048576` = 1MB)

#### Appearance Settings
- `app_theme`: Application color theme - `dark` (default) or `light`
- `photo_grid_theme`: Photo grid visual style - `default`, `filmstrip`, `slide-mount`, `lightbox`, or `slide-35mm`

On first run, configure these essential settings:

1. **Import To**: Where organized photos will be stored
2. **Export From**: Source directories to import from
3. **Thumbnail Store**: Cache location for fast preview generation
4. **Parallel Processing**: Number of concurrent operations for imports

## 📂 File Organization

PhotoClove organizes photos using a date-based structure with UUID conflict prevention:

```
import_to/
├── 2024-12-25/
│   ├── abc123-def456/     # UUID from source SD card/device
│   │   ├── IMG_001.jpg
│   │   └── IMG_002.mp4
│   └── xyz789-uvw012/     # Different source device
│       ├── IMG_001.jpg    # Same name, different device - no conflict
│       └── IMG_003.jpg
└── 2024-12-26/
    └── ...
```

## 🎨 Photo Editing

- **Non-Destructive**: All edits are CSS-based transformations
- **Real-Time Preview**: See changes instantly
- **Save Options**: Save styles to database or export new image file
- **Transform Controls**: Brightness, contrast, saturation, hue, rotation, scaling

## 📤 Share & Collage

PhotoClove includes powerful sharing and collage creation features:

### Share
- **Single Photo Export**: Share individual photos with optional watermarks
- **Clipboard Copy**: Copy photos directly to clipboard for quick pasting
- **File Save**: Save as PNG with embedded copyright metadata and timestamped filenames
- **Watermarks**: PhotoClove logo watermark and/or custom text watermark with configurable color, opacity, and position
- **Format Support**: Works with JPEG, PNG, RAW, and HEIC/AVIF files

### Collage
- **Multi-Photo Layouts**: Combine 2-9 selected photos into grid layouts (2x1, 2x2, 3x3, etc.)
- **Smart Layouts**: Automatic layout selection based on photo count
- **Customization**: Background color, padding, corner radius, and spacing controls
- **Watermark Support**: Apply watermarks to the final collage

## 📚 Albums & Tags

PhotoClove provides powerful organization features for managing your photo collections:

### Album Management
- **Create Albums**: Organize photos into named collections with descriptions
- **Cover Photos**: Set representative images for each album
- **Custom Ordering**: Arrange photos within albums as desired
- **Multi-Album Support**: Photos can belong to multiple albums
- **Album Navigation**: Browse photos by album in PhotosList

### Tag System
- **Color-Coded Tags**: Create tags with custom colors for visual organization
- **Bulk Operations**: Assign or remove tags from multiple photos at once
- **Tag Management**: Edit tag names and colors in Preferences
- **Search Integration**: Filter photos by tags in advanced search
- **Visual Indicators**: Tags displayed on photo thumbnails

## 🤖 AI Auto-Tagging

PhotoClove includes AI-powered automatic photo tagging with multiple model options:

### Model Options
- **MobileNet** (Default): Fast classification with 32 predefined categories (animals, landscapes, events, etc.) - ~15MB model
- **OpenCLIP**: Flexible tagging with custom labels and person detection - ~350MB model
- **SigLIP**: Improved CLIP variant with better accuracy - ~400MB model

### Features
- **Auto-tag on Import**: Automatically tag photos during the import process
- **Confidence Threshold**: Adjustable threshold with model-specific normalization for intuitive 0-100% scale
- **Category Filtering**: Enable/disable specific categories for MobileNet
- **Custom Labels**: Define your own detection labels for CLIP-based models (e.g., "birthday party", "family dinner")
- **Batch Processing**: Tag multiple photos via background job queue
- **High Accuracy Mode**: Use full-resolution images instead of EXIF thumbnails for better results
- **Format Support**: Works with JPEG, PNG, RAW, HEIC/HEIF, and AVIF files

### Configuration
Configure AI tagging in Preferences → AI Auto-Tagging. Models are downloaded on first use.

## 👤 Face Detection

PhotoClove includes AI-powered face detection and recognition:

### Detection Features
- **Face Detection**: Detect faces in photos using neural network models
- **High Accuracy Mode**: Optional full-resolution processing for better detection of small faces
- **Confidence Scoring**: Each detected face includes a confidence percentage
- **Bounding Box Display**: Visual indicators show detected face locations on photos

### Person Management
- **Person Assignment**: Name detected faces and create person profiles
- **Similarity Matching**: Automatically suggest matching persons based on face similarity
- **Face Thumbnails**: Cached face thumbnails for fast browsing
- **Person Gallery**: View all photos of a specific person

### Unknown Faces Management
- **Unknown Faces List**: Browse all unassigned faces across your photo collection
- **Batch Operations**: Delete or assign multiple faces at once
- **Photo Viewer Integration**: Click any unknown face to view the source photo
- **Selection Mode**: Multi-select with Shift/Ctrl for bulk operations

### Configuration
Configure Face Detection in Preferences → Face Detection. Download required models on first use.

## ☁️ S3 Cloud Backup

PhotoClove supports backing up photos to S3-compatible cloud storage:

### Supported Providers
- **Amazon S3**: Full AWS integration with credential profiles (13 regions)
- **Wasabi**: Hot Cloud Storage with S3 compatibility (15 regions as of 2026)
- **MinIO**: Self-hosted S3-compatible storage
- **Cloudflare R2**: S3-compatible object storage
- **DigitalOcean Spaces**: S3-compatible object storage (13 regions as of 2026)
- **iDrive e2**: S3-compatible cloud storage (16 regions across US, Canada, Europe, Asia)
- **Custom Endpoints**: Any S3-compatible storage with custom region support

### Features
- **Auto-sync on Import**: Automatically upload photos after import
- **Full Sync**: Upload all unsynced photos
- **Incremental Sync**: Upload only new photos since last sync
- **Date-based Sync**: Sync photos from specific dates
- **Sync Status Tracking**: Per-photo sync status with provider information
- **Database Backup**: Option to backup SQLite database to S3
- **Custom Region Support**: Manual region code input for new or unlisted regions
- **Provider-Specific Credentials**: Secure keyring storage per provider
- **Enhanced UI**: Emoji icons for better visual organization and maintenance operations

### Authentication
- **AWS Credentials**: Use profiles from ~/.aws/credentials
- **IAM Role**: For EC2/ECS deployments
- **Access Keys**: Manual key entry for non-AWS providers

Configure S3 backup in Preferences → S3 Backup.

## 🔍 Search & Filtering

PhotoClove includes a comprehensive search system with advanced features:

### Advanced Search Interface
- **Dedicated Search Page**: Full-featured search interface accessible from home page
- **EXIF-based Filtering**: Search by camera equipment, technical settings, and metadata
- **Date Range Filtering**: Flexible date selection with calendar interface
- **Manual Search Execution**: Optimized search performance with explicit search execution

### Search Management
- **Saved Searches**: Save and manage frequently used search queries with import/export
- **Search History**: Enhanced history tracking with filters, sort options, and result counts
- **Recent Photos**: Quick access to latest imported photos from DateList (60 most recent)

### Filter Options
- **Star Ratings**: 1-5 star rating system with searchable ratings
- **Comments**: Searchable text annotations and comment filtering
- **Tag Filters**: Filter by assigned tags with color-coded display
- **File Types**: Filter by extension (JPG, MP4, PNG, etc.)
- **Camera Equipment**: Filter by camera model, lens, and technical specifications
- **Performance Optimized**: Database indexes for fast metadata queries
- **Filter Caching**: Cached filter options for improved search performance

### Access Methods
- Search icon in home page for quick access
- Search tab in PhotosList for detailed filtering
- Keyboard shortcuts for navigation

## 🔄 Background Processing

PhotoClove uses an advanced job queue system with enhanced capabilities:

### Job Types
- **Photo Import**: Copy files to organized structure with progress tracking (JPEG, RAW, HEIC/AVIF)
- **Thumbnail Generation**: Create preview images with batch processing
- **Database Updates**: Index new photos and metadata efficiently
- **Google Photos Upload**: Secure cloud uploads with automatic token refresh
- **AI Tagging**: Automatic photo classification with configurable models
- **Face Detection**: Batch face detection and embedding generation
- **Face Thumbnail Regeneration**: Regenerate all face thumbnail crops
- **S3 Sync**: Upload photos to S3-compatible cloud storage
- **Burst Group Recalculation**: Recalculate burst photo groups
- **Photography Insights**: Generate statistics and analytics

### Enhanced Features
- **Immediate Retry**: Manual job retry executes instantly instead of waiting for next startup
- **Comprehensive Logging**: Structured logging with correlation IDs for debugging
- **Progress Monitoring**: Real-time job status and progress tracking
- **Error Handling**: Detailed error reporting with recovery suggestions

Monitor progress in the Job Queue interface (File → Job Queue).

## 🔐 Google Photos Integration

PhotoClove provides seamless Google Photos integration with enterprise-grade security:

### Authentication
- **Secure OAuth Flow**: External service handles credentials, client never stores secrets
- **Platform-Native Storage**: Tokens stored in system keyring (Linux Secret Service, macOS Keychain, Windows Credential Manager)
- **Automatic Refresh**: Tokens refreshed automatically 5 minutes before expiration
- **Zero-Maintenance**: No manual token management required

### Upload Features
- **Background Processing**: Upload jobs integrated with job queue system
- **Progress Tracking**: Real-time upload progress with detailed status
- **Error Recovery**: Comprehensive error handling with automatic retry
- **API Error Detection**: Proper handling of Google Photos API failures

### Security
- **No Client Secrets**: OAuth credentials never stored on client device
- **Encrypted Storage**: Platform-native keyring encryption for token security
- **Secure Refresh**: External service handles token refresh securely
- **Debug Tools**: Comprehensive testing and debugging utilities for development

## 🔍 Debug Logging

PhotoClove includes a comprehensive logging system for troubleshooting and development:

- **Structured Logging**: Frontend and backend logs with consistent format
- **Real-time Monitoring**: LogViewer interface accessible via `Ctrl+Shift+L` or Help menu
- **Cross-boundary Correlation**: Link frontend actions with backend operations using correlation IDs
- **Advanced Filtering**: Filter logs by level, component, source, time range, and keywords
- **Export Functionality**: Download logs as JSON for external analysis
- **Performance Tracking**: Monitor search performance and system operations
- **Log Storage**: Backend logs stored in `~/.local/share/photoclove/logs/` (Linux) or equivalent platform directory

Access LogViewer from any page using the keyboard shortcut or Help → "Show log" menu.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Workflow

PhotoClove uses a structured development workflow with the `improvement/` directory for task management. See [`CLAUDE.md`](./CLAUDE.md) for AI-assisted development guidelines.

### Code Guidelines
- Follow existing code patterns and conventions
- Use structured logging (logger service in frontend, log macros in backend)
- Maintain Domain-Driven Design principles
- Keep files under 1000 lines
- Add tests for new features

## 📋 Roadmap

### Recently Completed ✅
- [x] **CSS Design System**: Comprehensive design tokens with CSS variables for colors, spacing, typography, and theming
- [x] **Theme Support**: Dark/Light application themes with 5 photo grid themes (Default, Film Strip, Slide Mount, Light Box, 35mm Slide)
- [x] **Logging Standards Compliance**: Backend and frontend logging standardized using structured log service
- [x] **Error Handling Improvements**: Improved Rust error handling patterns following idiomatic practices
- [x] **CSS Modules Migration (Phase 1-4)**: PhotoCard, PhotoGrid, PhotosToolbar, PhotoOption, and Tag components migrated to CSS Modules for better style isolation
- [x] **Major Code Refactoring**: Extracted reusable hooks, reduced file sizes significantly (PhotosList -54%, PhotosListMini -45%, DirectoryMenu operations extracted)
- [x] **Backend Modularization**: Split photo_commands.rs and search.rs into focused handler modules for better maintainability
- [x] **Async Operation Cancellation**: Photo loading now supports cancellation for improved responsiveness
- [x] **Code Quality Improvements**: Reduced compiler warnings from 99 to 16, removed unused code across frontend and backend
- [x] **Album/Tag System Bug Fixes**: Fixed collection photo count, tag display in grid view, bulk operations, and preserved associations on file moves
- [x] **State Management Refactoring**: Complete overhaul with custom hooks architecture, view mode state machine, and React Query-like data fetching
- [x] **Google Photos Integration**: Complete OAuth flow with token refresh, API error detection, and secure credential management
- [x] **Advanced Search System**: Complete search interface with EXIF-based filtering, saved searches, and search history
- [x] **Logging & Debug System**: Real-time LogViewer with configurable logging levels and systematic debugging approach
- [x] **Album & Tag Support**: Create custom photo collections with descriptions, cover photos, color-coded tags, and bulk management
- [x] **Crop Tool**: Complete the photo cropping functionality with real-time preview
- [x] **Thumbnail Display**: Display Window Algorithm for efficient thumbnail loading
- [x] **Database Migrations**: Automatic schema updates on app startup with versioned migration system
- [x] **AI Auto-Tagging**: Multi-model support (MobileNet, OpenCLIP, SigLIP) with customizable labels and auto-tag on import
- [x] **S3 Cloud Backup**: Amazon S3 and S3-compatible storage backup with auto-sync, incremental sync, and per-photo tracking
- [x] **S3 Enhanced Support**: iDrive e2 integration, updated region lists (Wasabi 15, DigitalOcean 13, iDrive e2 16), custom region input, provider-specific credentials, and emoji-enhanced UI
- [x] **Face Detection**: AI-powered face detection with person assignment, similarity matching, Unknown Faces batch operations, and face thumbnail caching
- [x] **Slideshow Mode**: Full-screen photo presentation with background music, configurable speed, and shuffle mode
- [x] **Internationalization**: Multi-language support (7 languages: English, Japanese, German, French, Spanish, Chinese Simplified/Traditional)
- [x] **RAW File Support**: CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, 3FR with progressive loading and EXIF extraction
- [x] **HEIC/HEIF/AVIF Support**: iPhone/modern camera format support via libheif-rs with full AI tagging and face detection
- [x] **Custom React Dialogs**: Native dialog replacement with themed React components
- [x] **Relative Path Storage**: Cross-OS NAS support with relative paths in database
- [x] **Notification Center**: Notification bell with aggregated errors, warnings, and system events
- [x] **Photography Insights**: Analytics dashboard with camera settings, equipment stats, and shooting time patterns
- [x] **Achievements System**: Gamification with unlockable achievements for photo management milestones
- [x] **Crop Tool**: Interactive crop with move, resize, edge-drag, and aspect ratio presets
- [x] **Share & Collage**: Photo sharing with watermarks, multi-photo collage creation (2-9 photos), clipboard copy, and file save with PNG copyright metadata
- [x] **Persistent RAW/HEIC Cache**: Decoded images cached in thumbnail_store for faster re-access across restarts
- [x] **Light Theme Redesign**: Slate Blue color scheme for improved readability and visual consistency

### Current Focus 🎯
- [ ] **Performance Optimization**: Further optimize large collection handling and memory management
- [ ] **Advanced Editing**: More sophisticated photo editing tools (filters, adjustments, layers)

### Future Plans
- [ ] **Amazon Photos Integration**: Direct upload to Amazon Photos service

See [`CHANGES.md`](./CHANGES.md) for detailed version history and recent updates.

## 🐛 Troubleshooting

### Common Issues

**Photos not displaying?**
- Check that the import directory is accessible
- Verify thumbnail generation completed (Job Queue)
- Ensure file permissions allow read access
- Use LogViewer (Ctrl+Shift+L) to inspect application logs

**Import not working?**
- Verify source directories are configured in Preferences
- Check that target directory has write permissions
- Monitor Job Queue for error messages
- Enable debug logging in Preferences for detailed information

**Search not working?**
- Check LogViewer for search-related errors
- Ensure search index is properly built
- Verify advanced search filters are correctly configured
- Check tag filters if searching by tags

**Albums or Tags not showing?**
- Ensure database migration completed (check logs)
- Verify album/tag tables exist in SQLite database
- Try restarting the application to trigger migrations

**HEIC/AVIF photos not showing?**
- Ensure `cmake` and `libnuma-dev` are installed (build dependencies for libheif)
- HEIC/AVIF thumbnails are generated during import — re-import or use Maintenance → Regenerate Thumbnails
- Check LogViewer for HEIC decode errors

**Face Detection not working?**
- Ensure models are downloaded in Preferences → Face Detection
- Check that the photo file is accessible (supports JPEG, PNG, RAW, HEIC/AVIF)
- Try "High Accuracy" mode for small or distant faces
- Check LogViewer for detection errors

**Performance issues?**
- Increase thumbnail parallel processing in Preferences
- Ensure SSD storage for import and thumbnail directories
- Check that no antivirus is scanning photo directories
- Adjust max_photos_per_fetch in configuration for optimal performance

### Getting Help

1. Check the [documentation](./docs/) for detailed guides
2. Search [existing issues](https://github.com/ktat/photoclove/issues)
3. Create a [new issue](https://github.com/ktat/photoclove/issues/new) with:
   - Operating system and version
   - PhotoClove version
   - Detailed steps to reproduce
   - Error messages or logs

## 📄 License

This project is licensed under the MIT License. Copyright (c) 2023 Atsushi Kato - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Tauri Team](https://tauri.app)** for the excellent desktop framework
- **[React Team](https://react.dev)** for the robust UI library
- **[Rust Community](https://www.rust-lang.org)** for the amazing ecosystem
- **[Contributors](https://github.com/ktat/photoclove/contributors)** who help make PhotoClove better
- **All open source libraries** that make this project possible

---

<div align="center">

**[⬆ Back to Top](#photoclove-)**

Made with ❤️ by [ktat](https://github.com/ktat) and [contributors](https://github.com/ktat/photoclove/contributors)

</div>
