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
- **☁️ Cloud Integration**: Upload to Google Photos with progress tracking
- **🔄 Background Processing**: Asynchronous job queue for imports and thumbnail generation
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux

## 🏗️ Architecture

PhotoClove uses a modern desktop architecture:

- **Frontend**: React 18 with Vite for fast development and responsive UI
- **Backend**: Rust with Tauri for native performance and system integration
- **Database**: SQLite for fast metadata queries and search
- **Storage**: Local filesystem with organized directory structure

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

### Additional Documentation
- [Authentication](./docs/authentication.md) - OAuth flow for Google Photos integration
- [Database Schema](./docs/database-schema.md) - SQLite structure and EXIF fields
- [Job Queue System](./docs/job-queue-system.md) - Asynchronous background processing
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
- **File Types**: Filter by extension (JPG, MP4, PNG, etc.)
- **Camera Equipment**: Filter by camera model, lens, and technical specifications
- **Performance Optimized**: Database indexes for fast metadata queries
- **Filter Caching**: Cached filter options for improved search performance

### Access Methods
- Search icon in home page for quick access
- Search tab in PhotosList for detailed filtering
- Keyboard shortcuts for navigation

## 🔄 Background Processing

PhotoClove uses an advanced job queue system for:

- **Photo Import**: Copy files to organized structure
- **Thumbnail Generation**: Create preview images
- **Database Updates**: Index new photos and metadata
- **Cloud Uploads**: Upload to Google Photos (optional)

Monitor progress in the Job Queue interface (File → Job Queue).

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

### Current Focus
- [x] **Search Functionality**: Complete search interface with advanced filters
- [x] **Thumbnail Display**: Implement Display Window Algorithm for efficient thumbnail loading
- [x] **Crop Tool**: Complete the photo cropping functionality
- [ ] **Tag System**: Add taggable labels for better organization
- [ ] **Advanced Search**: EXIF-based filtering and search
- [ ] **Album Support**: Group photos into custom collections

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

**Import not working?**
- Verify source directories are configured in Preferences
- Check that target directory has write permissions
- Monitor Job Queue for error messages

**Performance issues?**
- Increase thumbnail parallel processing in Preferences
- Ensure SSD storage for import and thumbnail directories
- Check that no antivirus is scanning photo directories

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