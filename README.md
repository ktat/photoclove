# PhotoClove 🦀📸

> A fast, modern photo management application built with Rust and React

PhotoClove is a desktop photo manager designed for speed and simplicity. Built with Tauri (Rust backend) and React (frontend), it provides lightning-fast photo importing, viewing, and basic editing capabilities while keeping your photos organized locally.

## ✨ Key Features

- **🚀 Lightning Fast**: Optimized for handling large photo collections with minimal lag
- **📥 Smart Import**: Batch photo import with UUID-based organization to prevent conflicts
- **🎨 Non-Destructive Editing**: CSS-based image transformations with real-time preview
- **📅 Date Organization**: Automatic photo organization by date with calendar navigation and Recent Photos access
- **🎯 Infinite Scroll**: Smooth photo browsing with batch loading and configuration limit detection
- **⭐ Metadata Management**: Star ratings, comments, and searchable metadata
- **🔍 Advanced Search**: Comprehensive search interface with EXIF filters, saved searches, search history, and database optimization
- **🔍 Debug Logging**: Real-time log viewer with frontend/backend correlation for troubleshooting
- **🎬 Video Support**: View and manage MP4/WebM videos with thumbnail generation
- **☁️ Google Photos Integration**: Secure OAuth authentication with automatic token refresh and seamless photo uploads
- **🔄 Background Processing**: Advanced job queue with immediate retry, progress tracking, and comprehensive logging
- **🔐 Secure Authentication**: Platform-native keyring storage for OAuth tokens with external service integration
- **📚 Album Management**: Create custom photo collections with descriptions, cover photos, and custom ordering
- **🏷️ Tag System**: Color-coded tags for photo categorization with search integration
- **💡 Tutorial System**: Context-aware help tooltips for new users
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux

## 🏗️ Architecture

PhotoClove uses a modern desktop architecture:

- **Frontend**: React 18 with Vite for fast development and responsive UI
- **Backend**: Rust with Tauri for native performance and system integration
- **Database**: SQLite for fast metadata queries and search
- **Storage**: Local filesystem with organized directory structure
- **State Management**: Custom hooks architecture with React Query-like data fetching
- **Navigation**: View mode state machine for consistent UI transitions
- **Caching**: Unified cache service with LRU eviction and automatic cleanup

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and **pnpm**
- **Rust** 1.84+ (for building)
- **FFmpeg** and **GStreamer** (for video support)

#### Ubuntu/Debian Setup
```bash
sudo apt install gstreamer1.0-plugins-bad ffmpeg librsvg2-dev libgstreamer1.0-dev
```

### Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Building

```bash
# Build for production
pnpm tauri build
```

#### WSL2 Build (Ubuntu 22.04)
```bash
# Update WSL first
wsl --update && wsl --shutdown

# Install build dependencies
sudo apt install librsvg2-dev libgstreamer1.0-dev patchelf

# Build with clean environment
rm -rf src-tauri/target
env PATH=$(echo $PATH | perl -p -e 's{:/mnt/c.+:}{:}g') pnpm tauri build
```

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Architecture Overview](./docs/architecture.md)** - System design and technology stack
- **[Feature Sequences](./docs/feature-sequences.md)** - Frontend/backend interaction flows
- **[Component Structure](./docs/component-structure.md)** - React component hierarchy and HTML structure
- **[Source Tree](./docs/source-tree.md)** - Complete codebase organization guide
- **[Feature Documentation Index](./docs/feature-documentation-index.md)** - Quick reference for finding relevant docs
- **[Terms Reference](./docs/terms.md)** - Mapping between features, concepts, and source code

### Additional Documentation
- [State Management Guide](./docs/state-management-guide.md) - Custom hooks architecture with React Query-like implementation
- [Authentication](./docs/authentication.md) - OAuth flow for Google Photos integration
- [OAuth Token Management](./docs/oauth-token-management.md) - Secure token storage, automatic refresh, and testing tools
- [Database Schema](./docs/database-schema.md) - SQLite structure and EXIF fields
- [Job Queue System](./docs/job-queue-system.md) - Asynchronous background processing with enhanced retry
- [Image Editor](./docs/image-editor.md) - CSS-based photo editing features

## 🎯 Use Cases

PhotoClove is perfect for:

- **Photographers** managing large collections of JPEG, PNG, and GIF images
- **Content Creators** organizing photos and videos from multiple cameras/phones
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
- **Photo Import**: Copy files to organized structure with progress tracking
- **Thumbnail Generation**: Create preview images with batch processing
- **Database Updates**: Index new photos and metadata efficiently
- **Google Photos Upload**: Secure cloud uploads with automatic token refresh

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

## 📋 Roadmap

### Recently Completed ✅
- [x] **State Management Refactoring**: Complete overhaul with custom hooks architecture, view mode state machine, and React Query-like data fetching
- [x] **React Query Integration**: Custom implementation with automatic caching, background refetching, mutation support, and retry logic
- [x] **Performance Optimization**: Unified cache service with LRU eviction, automatic cleanup, and comprehensive statistics
- [x] **Navigation Improvements**: View mode state machine with validated transitions and history tracking
- [x] **Google OAuth Token Management**: Secure platform-native token storage with automatic refresh and external service integration
- [x] **Enhanced Job Queue**: Immediate manual retry, comprehensive logging, and improved error handling
- [x] **Google Photos Integration**: Complete OAuth flow with token refresh, API error detection, and secure credential management
- [x] **Bug Fixes**: Fixed thumbnail list not updating after DEL key deletion in Recent Photos and Search modes
- [x] **Architecture Improvement**: Removed date dependencies from PhotosList components, improving reliability across viewing modes
- [x] **Advanced Search System**: Complete search interface with EXIF-based filtering, saved searches, and search history
- [x] **Logging & Debug System**: Real-time LogViewer with configurable logging levels and systematic debugging approach
- [x] **Infinite Scroll**: Smooth photo browsing with batch loading and configuration limit detection
- [x] **Search Functionality**: Complete search interface with advanced filters
- [x] **Thumbnail Display**: Implement Display Window Algorithm for efficient thumbnail loading
- [x] **Crop Tool**: Complete the photo cropping functionality
- [x] **Album Support**: Create custom photo collections with descriptions, cover photos, and ordering
- [x] **Tag System**: Color-coded taggable labels with search integration and bulk management

### Current Focus
- [ ] **Enhanced Error Handling**: Improve user feedback for failed operations
- [ ] **Performance Optimization**: Further optimize large collection handling

### Future Plans
- [ ] **Cloud Storage**: Amazon Photos integration
- [ ] **Slide Show**: Full-screen photo presentation mode
- [ ] **Internationalization**: Multi-language support
- [ ] **Advanced Editing**: More sophisticated photo editing tools

See [`CHANGES.md`](./CHANGES.md) for detailed version history and recent updates.

## 🐛 Troubleshooting

### Common Issues

**Photos not displaying?**
- Check that the import directory is accessible
- Verify thumbnail generation completed (Job Queue)
- Ensure file permissions allow read access
- Use LogViewer (Ctrl+Shift+L) to inspect application logs
- **Recent Fix**: Thumbnail lists now update properly after photo deletion across all viewing modes (Recent Photos, Search, Date view)

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tauri Team** for the excellent desktop framework
- **React Team** for the robust UI library
- **Rust Community** for the amazing ecosystem
- **Contributors** who help make PhotoClove better

---

<div align="center">

**[⬆ Back to Top](#photoclove-)**

Made with ❤️ by [ktat](https://github.com/ktat) and [contributors](https://github.com/ktat/photoclove/contributors)

</div>