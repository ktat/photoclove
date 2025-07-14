# PhotoClove

PhotoClove is a photo manager application written in Rust & JavaScript(React) with tauri.

## Motivation

Photo viewer/importer applications tends to be slow when you have a lot of photos.
I try to use some free/paid applications, but they don't much my usecase and they all are very slow.

- I don't need a rich editor.
- I require the features to import fastly and to view photos fastly.

So, I decided to create this by myself.

## Dependency

### nodejs, pnpm

- nodejs v23.8.0
- pnpm

### ffmpeg, gstreamer

On Ubuntu, install the following package to watch mp4 file and to create movie thumbnail.

```
sudo apt install gstreamer1.0-plugins-bad ffmpeg
```

## how to run

```sh
pnpm tauri dev
```

## how to build

### on Windows

```sh
pnpm tauri build
```

### on WSL2 (Ubuntu 22.04)

#### Update WSL

```sh
wsl --update
wsl --shutdown
```

#### install required packages

```sh
sudo apt install librsvg2-dev libgstreamer1.0-dev patchelf
```

#### Build app

```sh
rm -rf src-tauri/target
env PATH=$(echo $PATH | perl -p -e 's{:/mnt/c.+:}{:}g') pnpm tauri build
```

## Recent Updates

### CSS-Based Image Editor (v2.7)
- **Non-Destructive Editing**: CSS-based image transformations with real-time preview
- **Comprehensive Controls**: Rotation, brightness, contrast, saturation, hue rotation, and scaling
- **Database Storage**: CSS styles stored in `css_style` column for persistent transformations
- **User Interface**: Intuitive editor tab with range sliders and live preview
- **Apply/Reset System**: Save transformations or reset to original state
- **Future-Ready**: Framework for save-as-copy and download functionality

### EXIF Data Storage (v2.7)
- **Complete EXIF Support**: All EXIF metadata fields stored in database for fast searching
- **Camera Information**: Make, model, lens details stored for equipment tracking
- **Technical Settings**: ISO, aperture, shutter speed, focal length, and exposure data
- **Image Quality**: Resolution, orientation, and processing information
- **Date Tracking**: Original capture date and modification timestamps
- **Search Ready**: EXIF data immediately available for filtering and organization

### Google Photos Integration (v2.7)
- **Seamless Upload**: Direct upload to Google Photos with URL tracking
- **Batch Operations**: Upload multiple selected photos simultaneously
- **URL Storage**: Google Photos URLs stored in database for reference
- **Authentication**: OAuth2 integration with token management
- **Progress Tracking**: Real-time upload progress and status updates
- **Error Handling**: Robust error recovery and user feedback

### Enhanced Database Schema (v2.7)
- **Updated Timestamp**: Added `updated_at` column for tracking record modifications
- **Migration System**: Automatic database migration with column existence checks
- **Comprehensive Schema**: Full EXIF fields and integration columns
- **Performance Optimized**: Proper indexing and query optimization
- **Future-Proof**: Extensible schema design for new features

### Job Queue Management Interface (v2.7)
- **Visual Management**: Dedicated job queue interface for monitoring background tasks
- **Job Operations**: Retry failed jobs, delete completed jobs, and cleanup operations
- **Status Tracking**: Real-time job status, progress, and error information
- **Bulk Operations**: Cleanup completed jobs and manage job units
- **User Control**: Full visibility and control over background processing

### Asynchronous Job Queue System (v2.6)
- **Background Processing**: Complete rewrite of import system using asynchronous job queue for non-blocking operations
- **Job Types**: Support for Import, Thumbnail creation, and Database creation jobs with individual progress tracking
- **Real-time Progress**: Live progress updates and status monitoring via event system
- **Error Recovery**: Automatic recovery of interrupted jobs on application restart
- **Concurrent Execution**: Configurable concurrent job processing for optimal performance
- **Database Persistence**: Job status and progress persisted in SQLite database (`job_unit` and `job_queue` tables)
- **Event-driven UI**: Frontend receives real-time updates via `job_completed`, `job_failed`, and progress events
- **Breaking Change**: Import API now returns job unit ID immediately instead of blocking until completion

### Database Schema Enhancement (v2.6)
- **Created At Tracking**: Added `created_at` column to `photo_metadata` table for timestamp tracking
- **Automatic Migration**: Seamless migration of existing databases with default timestamp values
- **Job Queue Tables**: New database schema for job management and progress tracking
- **Enhanced Metadata**: Better tracking of when photos were imported and processed

### TSV Support Removed (v2.6)
- **Breaking Change**: TSV file format support completely removed in favor of SQLite-only approach
- **Migration Required**: Users must migrate to SQLite before upgrading (see migration documentation)
- **Performance Benefits**: Simplified codebase and improved performance with single database backend
- **UI Cleanup**: Removed TSV migration interface from application menu

### UUID-Based Import Directory Structure (v2.5)
- **Conflict Prevention**: Implemented UUID-based subdirectory structure to prevent filename conflicts when importing from different SD cards
- **Automatic UUID Management**: Creates `.photoclove-uuid` files in source directories to track unique source identifiers
- **Hierarchical Storage**: Photos are now imported to `YYYY-MM-DD/UUID/` directory structure (e.g., `2025-01-15/abc123-def456-789/photo.jpg`)
- **Flat Display**: Photos from both date directories and UUID subdirectories are displayed together in a unified view
- **Recursive Photo Discovery**: Updated photo scanning to recursively find files in UUID subdirectories
- **Backward Compatibility**: Existing photos in date directories continue to work alongside new UUID-based imports
- **Enhanced Import Logic**: Improved directory creation and file organization during import process

### Database Deletion on Trash (v2.4)
- **Automatic Cleanup**: Photos moved to trash are now automatically removed from the database
- **Data Integrity**: Prevents orphaned database entries when photos are deleted from the filesystem
- **Metadata Synchronization**: Ensures metadata consistency between filesystem and database state

### SQLite Database Improvements (v2.4)
- **Enhanced initialization**: Fixed SQLite database initialization for edge cases where database files exist without schemas
- **Robust table detection**: Improved table existence checking using `sqlite_master` query instead of `PRAGMA table_info`
- **Directory handling**: Automatic creation of parent directories for database files to prevent path errors
- **Fallback improvements**: Complete index creation in fallback initialization paths for better reliability
- **Edge case handling**: Better support for corrupted or incomplete database files

### Import Page & Photo Date Improvements (v2.3)
- **Import page layout**: Reduced excessive spacing between selection buttons and photo grid for better visual flow
- **Smart photo dating**: When EXIF data is missing or cannot be parsed, the application now uses file creation/modification datetime instead of fallback default dates
- **Better date accuracy**: Photos without EXIF data now display meaningful dates based on file system timestamps rather than placeholder values like "0000/00/00" or "1970/01/01"

### UI Layout Improvements (v2.2)
- **Grid layout**: Replaced flex layout with CSS Grid for photo list display, providing better responsive design
- **Auto-responsive columns**: Grid automatically adjusts column count based on available space (200px minimum width, 150px on mobile)
- **Improved spacing**: Consistent 10px gap between photo items with better padding
- **Animated scroll indicators**: Replaced image-based scroll indicators with animated text ("⬆ scroll to load more ⬆" / "⬇ scroll to load more ⬇")
- **Enhanced scroll behavior**: Fixed scroll limits to prevent scrolling beyond load indicators, ensuring proper scroll-to-load functionality
- **Dynamic dummy items**: Smart grid filler items that adjust based on photo count to maintain consistent scroll experience
- **Visual feedback**: Bounce animations provide clear indication of scroll-to-load areas

### Photo Display Improvements (v2.1)
- **Responsive photo sizing**: Fixed photo display sizing issues for resizable app windows
- **Dynamic expansion**: Images now properly expand when app window is resized larger
- **Improved first load**: Fixed bug where images appeared as small icons on first photo selection from thumbnails
- **Better margins**: Added proper spacing around photos (20px sides, 40px bottom) for better visual presentation
- **Enhanced navigation**: Preserved photo dimensions during photo navigation to prevent sizing loss
- **CSS-based approach**: Replaced complex JavaScript calculations with responsive CSS for more reliable sizing

### Extension Filter Enhancements
- **Grouped filtering**: Organized extension filters into Image and Movie categories with group checkboxes
- **Better UI**: Improved checkbox layout with proper labeling and hierarchical structure
- **Combined extensions**: JPEG files now handled as single filter for both .jpg and .jpeg extensions

### SQLite Database Migration (v2.0+)
- **Performance improvements**: Migrated from TSV files to SQLite database for better performance
- **Automatic migration**: Seamless upgrade from old TSV format to new SQLite schema
- **Optimized queries**: GROUP BY aggregation for efficient photo counting
- **Better date handling**: Proper SQLite date functions for reliable comparisons
- **Access via File menu**: TSV to SQLite migration available in File → "Migrate TSV to SQLite"
- **Enhanced initialization**: Fixed database initialization for edge cases with schema-less databases
- **Robust error handling**: Better support for corrupted or incomplete database files

### Photo Navigation Fixes
- **Timing improvements**: Fixed photo navigation timing issues for better user experience
- **Button state management**: Corrected next/previous button disable logic
- **Smoother transitions**: Enhanced photo loading and transition animations

## Featurs to be ipmlemented

Just a plan, currentrly a few features are only implemented.

- [x] Fast photo viewer
  - [x] Fast when using NFS
  - [x] Allow photos over network drive(NFS/SMB mount on Linux. assign Network drive on Windows)
- [x] Fast importer
  - [ ] only check duplication for the files which has same name prefix and different size.
  - [ ] import files created after last import file timestamp in directories.
  - [x] different SD card and same file name (UUID-based directory structure)
  - [x] filter import targets by date
  - [x] importing in background (asynchronous job queue system)
  - [x] Thumbnail creation
     - [x] Thumbnail creation in background (asynchronous job processing)
  - [x] Real-time progress tracking and event notifications
  - [x] Error recovery and job resumption
- [ ] Provide very simple editor
  - [ ] rotation
  - [ ] crop
- [ ] Additional photo data
  - [x] Star
  - [x] Comment/Note
  - [ ] Tag
  - [ ] Album(low priority)
- [ ] Search/Filter
  - [x] Star
  - [x] Comment/Note
  - [x] File extension (jpg, mp4 etc.) with UI filter
  - [ ] Camera
  - [ ] Tag
- [ ] Upload to cloud services
  - [x] Google Photos (works. but in progress)
  - [ ] Amazon Photos
- [x] Preferences editor(low priority)
  - [x] directories(import from)
  - [x] directory(import to)
  - [x] num of parralel when copying photos
  - [x] thumbnail settings
  - [ ] directory date format(currentry, yyyy-mm-dd only)
- [x] Welcome tutorial
- [x] Playing movies(mp4, webm) ... not good, but works
- [ ] Slide Show(low priority)
- [ ] i18n(low priority)
- [ ] trashbox management
- [ ] redo/undo
- [ ] Show photos imported recently
- [ ] Crop photo and search with Google

## Recent Improvements

### Data Storage Migration (SQLite)

The application has been migrated from TSV file storage to SQLite database for improved performance and data integrity:

- **Better Performance**: SQLite provides faster queries and data access compared to reading/writing multiple TSV files
- **Data Integrity**: ACID compliance ensures photo metadata consistency
- **Scalability**: Better handling of large photo collections with efficient indexing
- **Concurrent Access**: Improved support for multiple operations on photo metadata

### Enhanced User Interface

- **Extension Filter**: Added a comprehensive extension filter system with grouped checkboxes for Image and Movie categories, allowing users to filter photos by file extensions (e.g., jpg,png,mp4)
- **Photo Display**: Implemented responsive photo sizing that automatically adapts to window resizing and provides consistent image display across different screen sizes
- **Improved Navigation**: Enhanced photo navigation with better timing and state management for smoother user experience
