# PhotoClove Change Log

This document tracks all notable changes to PhotoClove across versions.

## Version 2.10 - S3 Enhanced Support & UI Improvements

### ☁️ S3 Cloud Backup Enhancements
- **iDrive e2 Integration**: Added full support for iDrive e2 S3-compatible storage (16 regions across US, Canada, Europe, Asia)
- **Updated Region Lists**: Refreshed region data for all providers with official documentation sources
  - Wasabi: 15 regions (added San Jose, Milan, London-2)
  - DigitalOcean Spaces: 13 regions (added NYC1, NYC2, SFO2, LON1, TOR1, BLR1, ATL1)
  - iDrive e2: 16 regions (complete list with proper endpoint URLs)
  - AWS S3: 13 regions maintained
- **Custom Region Input**: Manual region code input field for new or unlisted regions
  - Automatic detection of unlisted regions from existing configurations
  - Flexible fallback for provider updates without code changes
- **Provider-Specific Credentials**: Separate keyring storage for each S3 provider
  - Credentials stored as `s3_credentials_{provider}` in system keyring
  - Independent credential management per provider (AWS S3, Wasabi, MinIO, etc.)
  - Preview display showing masked Access Key ID per provider

### 🎨 S3 Backup UI Improvements
- **Bucket Configuration Split**: Separated Bucket URI into "Bucket Name" and "Prefix (optional)" fields for better usability
- **Enhanced Placeholders**: Clearer placeholder text with example values shown as helper text below inputs
- **Max File Size Layout**: Improved description positioning below dropdown with better readability
- **Region Selection**: Provider-specific region dropdowns with custom region input option
- **Documentation Links**: Added official source URLs as comments in region lists for future maintenance

### 🎭 Visual Enhancements
- **Maintenance Tab Icons**: Added emoji icons to all maintenance operations for better visual clarity
  - 🗄️ (re)Create database of the date
  - 📅 Move files according to Exif date
  - 🖼️ Make thumbnails
  - 🔄 Recalculate Groups of the date
  - 🤖 Run AI Tagging
  - 👤 Run Face Detection
  - ☁️ Sync to S3
- **Advanced Tab Icons**: Enhanced Advanced preferences with emoji icons
  - 📤 Google Photos section
  - 🔄 Re-authentication option
  - 📚 Tutorial section
  - 👋 Welcome tutorial
  - 💡 Tab instruction tooltips
- **Grouping Tab Icons**: Added icons to recalculate groups section (🔄/⏳)
- **List Styling**: Removed bullet points from maintenance operations, added proper padding for emoji visibility

### 🔧 Technical Improvements
- **Endpoint Configuration**: Fixed `hasEndpoint` flags for Wasabi and DigitalOcean (both use default endpoint patterns)
- **Region Validation**: Automatic region existence check with custom region fallback
- **CSS Design System**: Consistent use of CSS variables for spacing and typography
- **Code Documentation**: Added source URLs for all provider region lists for easier future updates

## Version 2.9 - Search Functionality & Display Window Algorithm

### 🔍 Advanced Search Interface
- **Comprehensive Search**: Complete search interface with advanced filters and search history
- **Saved Searches**: Save and manage frequently used search queries
- **Search History**: Track and revisit previous search queries
- **Advanced Filters**: Filter by date range, rating, comments, and file type
- **Real-time Results**: Instant search results as you type
- **Search Context**: Dedicated search page with optimized layout

### 🖼️ Display Window Algorithm
- **Efficient Thumbnail Loading**: Implement Display Window Algorithm for optimal thumbnail display
- **Performance Optimization**: Load only visible thumbnails to improve performance
- **Smooth Scrolling**: Enhanced scroll experience with proper thumbnail loading
- **Memory Management**: Reduced memory usage for large photo collections
- **Responsive Display**: Thumbnails adapt to different screen sizes and orientations

### 🎨 Enhanced Photo Editing
- **Crop Tool Completion**: Fully functional crop tool with proper overlay targeting
- **CSS Style Persistence**: Improved CSS style loading and synchronization
- **Editor UI Improvements**: Better controlled React components for editor controls
- **Visual Feedback**: Enhanced crop overlay with proper photo targeting
- **Reset Functionality**: Individual reset buttons for all editor controls

### 🏗️ Component Architecture Improvements
- **Component Separation**: Split PhotoOption and PhotoEditor for better organization
- **Context Integration**: PhotoContext and UIContext for better state management
- **Error Boundaries**: Comprehensive error handling with global error boundaries
- **Compatibility Layer**: PhotosList compatibility layer to maintain backward compatibility
- **Props Migration**: Migrate components from props to context-based architecture

### 🎯 UI/UX Enhancements
- **Vertical Tabs**: Convert DirectoryMenu to vertical tabs with close functionality
- **Improved Layout**: Better padding and visual balance across components
- **Right Column Design**: Enhanced right column layout with improved visual hierarchy
- **Date Loading**: Fix race conditions in date loading for consistent state
- **Promise Handling**: Improved Promise handling for Tauri event listeners

## Version 2.8 - Enhanced CSS-Based Image Editor

### 🎨 Advanced Photo Editing
- **Non-Destructive Editing**: CSS-based image transformations with real-time preview
- **Comprehensive Controls**: Rotation, brightness, contrast, saturation, hue rotation, and scaling
- **Enhanced UI**: Optimized tabbed interface with individual reset buttons and inline label layout
- **Rotation Shortcuts**: Quick 90-degree rotation buttons (left/right) positioned below rotation slider
- **Smart Value Handling**: Rotation 360° automatically converts to 0° for consistency

### 📥 Robust Download System
- **Advanced Image Processing**: Canvas-based rendering with manual pixel manipulation for accurate color transformations
- **Cross-Browser Compatibility**: Reliable download functionality that works consistently across different browsers
- **Configurable Downloads**: Download directory configurable through preferences
- **Notification System**: System notifications and clickable footer messages for downloads
- **Click-to-Open**: Downloaded files open automatically when notification is clicked

### 💾 Persistent Styling
- **Database Storage**: CSS styles stored in `css_style` column for persistent transformations
- **Apply/Reset System**: Save transformations or reset to original state
- **Optimized Layout**: Compact controls that fit properly within the right panel without scrollbars

## Version 2.7 - EXIF Data & Google Photos Integration

### 📊 Complete EXIF Support
- **Comprehensive Metadata**: All EXIF metadata fields stored in database for fast searching
- **Camera Information**: Make, model, lens details stored for equipment tracking
- **Technical Settings**: ISO, aperture, shutter speed, focal length, and exposure data
- **Image Quality**: Resolution, orientation, and processing information
- **Date Tracking**: Original capture date and modification timestamps
- **Search Ready**: EXIF data immediately available for filtering and organization

### ☁️ Google Photos Integration
- **Seamless Upload**: Direct upload to Google Photos with URL tracking
- **Batch Operations**: Upload multiple selected photos simultaneously
- **URL Storage**: Google Photos URLs stored in database for reference
- **Authentication**: OAuth2 integration with token management
- **Progress Tracking**: Real-time upload progress and status updates
- **Error Handling**: Robust error recovery and user feedback

### 🗄️ Enhanced Database Schema
- **Updated Timestamp**: Added `updated_at` column for tracking record modifications
- **Migration System**: Automatic database migration with column existence checks
- **Comprehensive Schema**: Full EXIF fields and integration columns
- **Performance Optimized**: Proper indexing and query optimization
- **Future-Proof**: Extensible schema design for new features

### 👁️ Job Queue Management Interface
- **Visual Management**: Dedicated job queue interface for monitoring background tasks
- **Job Operations**: Retry failed jobs, delete completed jobs, and cleanup operations
- **Status Tracking**: Real-time job status, progress, and error information
- **Bulk Operations**: Cleanup completed jobs and manage job units
- **User Control**: Full visibility and control over background processing

## Version 2.6 - Asynchronous Job Queue System

### 🔄 Background Processing Revolution
- **Complete Rewrite**: Import system rebuilt using asynchronous job queue for non-blocking operations
- **Job Types**: Support for Import, Thumbnail creation, and Database creation jobs with individual progress tracking
- **Real-time Progress**: Live progress updates and status monitoring via event system
- **Error Recovery**: Automatic recovery of interrupted jobs on application restart
- **Concurrent Execution**: Configurable concurrent job processing for optimal performance

### 💾 Database Persistence
- **Job Tracking**: Job status and progress persisted in SQLite database (`job_unit` and `job_queue` tables)
- **Event-driven UI**: Frontend receives real-time updates via `job_completed`, `job_failed`, and progress events
- **Breaking Change**: Import API now returns job unit ID immediately instead of blocking until completion

### 📅 Database Schema Enhancement
- **Created At Tracking**: Added `created_at` column to `photo_metadata` table for timestamp tracking
- **Automatic Migration**: Seamless migration of existing databases with default timestamp values
- **Enhanced Metadata**: Better tracking of when photos were imported and processed

### 🗑️ TSV Support Removal
- **Breaking Change**: TSV file format support completely removed in favor of SQLite-only approach
- **Migration Required**: Users must migrate to SQLite before upgrading (see migration documentation)
- **Performance Benefits**: Simplified codebase and improved performance with single database backend
- **UI Cleanup**: Removed TSV migration interface from application menu

## Version 2.5 - UUID-Based Import Directory Structure

### 🎯 Conflict Prevention System
- **UUID Directories**: Implemented UUID-based subdirectory structure to prevent filename conflicts when importing from different SD cards
- **Automatic UUID Management**: Creates `.photoclove-uuid` files in source directories to track unique source identifiers
- **Hierarchical Storage**: Photos now imported to `YYYY-MM-DD/UUID/` directory structure (e.g., `2025-01-15/abc123-def456-789/photo.jpg`)

### 📂 Enhanced File Discovery
- **Flat Display**: Photos from both date directories and UUID subdirectories displayed together in unified view
- **Recursive Scanning**: Updated photo scanning to recursively find files in UUID subdirectories
- **Backward Compatibility**: Existing photos in date directories continue to work alongside new UUID-based imports
- **Enhanced Import Logic**: Improved directory creation and file organization during import process

## Version 2.4 - Database Cleanup & SQLite Improvements

### 🗑️ Automatic Database Cleanup
- **Trash Integration**: Photos moved to trash are now automatically removed from the database
- **Data Integrity**: Prevents orphaned database entries when photos are deleted from the filesystem
- **Metadata Synchronization**: Ensures metadata consistency between filesystem and database state

### 🔧 SQLite Robustness
- **Enhanced Initialization**: Fixed SQLite database initialization for edge cases where database files exist without schemas
- **Robust Table Detection**: Improved table existence checking using `sqlite_master` query instead of `PRAGMA table_info`
- **Directory Handling**: Automatic creation of parent directories for database files to prevent path errors
- **Fallback Improvements**: Complete index creation in fallback initialization paths for better reliability
- **Edge Case Handling**: Better support for corrupted or incomplete database files

## Version 2.3 - Import UX & Photo Date Improvements

### 📥 Import Interface Enhancement
- **Layout Optimization**: Reduced excessive spacing between selection buttons and photo grid for better visual flow
- **Improved UX**: More intuitive import workflow with better visual hierarchy

### 📅 Smart Photo Dating
- **EXIF Fallback**: When EXIF data is missing or cannot be parsed, application now uses file creation/modification datetime
- **Better Date Accuracy**: Photos without EXIF data now display meaningful dates based on file system timestamps
- **No More Placeholder Dates**: Eliminated placeholder values like "0000/00/00" or "1970/01/01"

## Version 2.2 - UI Layout Revolution

### 🎨 Grid Layout System
- **CSS Grid Migration**: Replaced flex layout with CSS Grid for photo list display, providing better responsive design
- **Auto-Responsive Columns**: Grid automatically adjusts column count based on available space (200px minimum width, 150px on mobile)
- **Improved Spacing**: Consistent 10px gap between photo items with better padding

### 📜 Enhanced Scroll Experience
- **Animated Scroll Indicators**: Replaced image-based scroll indicators with animated text ("⬆ scroll to load more ⬆" / "⬇ scroll to load more ⬇")
- **Fixed Scroll Behavior**: Enhanced scroll limits to prevent scrolling beyond load indicators, ensuring proper scroll-to-load functionality
- **Dynamic Grid Fillers**: Smart dummy grid items that adjust based on photo count to maintain consistent scroll experience
- **Visual Feedback**: Bounce animations provide clear indication of scroll-to-load areas

## Version 2.1 - Photo Display Improvements

### 🖼️ Responsive Photo Display
- **Window Resizing**: Fixed photo display sizing issues for resizable app windows
- **Dynamic Expansion**: Images now properly expand when app window is resized larger
- **First Load Fix**: Fixed bug where images appeared as small icons on first photo selection from thumbnails

### 🎯 Enhanced Visual Presentation
- **Better Margins**: Added proper spacing around photos (20px sides, 40px bottom) for better visual presentation
- **Navigation Preservation**: Preserved photo dimensions during photo navigation to prevent sizing loss
- **CSS-Based Approach**: Replaced complex JavaScript calculations with responsive CSS for more reliable sizing

### 🔍 Extension Filter Enhancements
- **Grouped Filtering**: Organized extension filters into Image and Movie categories with group checkboxes
- **Better UI**: Improved checkbox layout with proper labeling and hierarchical structure
- **Combined Extensions**: JPEG files now handled as single filter for both .jpg and .jpeg extensions

## Version 2.0+ - SQLite Database Migration

### 🚀 Performance Revolution
- **SQLite Migration**: Migrated from TSV files to SQLite database for dramatically better performance
- **Automatic Migration**: Seamless upgrade from old TSV format to new SQLite schema
- **Optimized Queries**: GROUP BY aggregation for efficient photo counting
- **Better Date Handling**: Proper SQLite date functions for reliable comparisons

### 🔧 Migration Tools
- **Menu Integration**: TSV to SQLite migration available in File → "Migrate TSV to SQLite"
- **Enhanced Initialization**: Fixed database initialization for edge cases with schema-less databases
- **Robust Error Handling**: Better support for corrupted or incomplete database files

### 🎮 Navigation Improvements
- **Timing Fixes**: Fixed photo navigation timing issues for better user experience
- **Button State Management**: Corrected next/previous button disable logic
- **Smoother Transitions**: Enhanced photo loading and transition animations

## Earlier Versions - Foundation Features

### Core Features Established
- **Fast Photo Viewer**: Optimized for large collections with network drive support
- **Smart Importer**: Fast batch import with conflict detection
- **Basic Editor**: Rotation, brightness, contrast adjustments
- **Metadata System**: Star ratings and comment support
- **Filter System**: Basic filtering by star rating and file extension
- **Preferences**: Configuration management for directories and settings
- **Welcome Tutorial**: First-time user onboarding
- **Video Support**: MP4 and WebM playback with basic controls

### Infrastructure
- **Tauri Framework**: Desktop application foundation with Rust backend
- **React Frontend**: Modern UI with component-based architecture
- **Cross-Platform**: Windows, macOS, and Linux support
- **Local Storage**: File-based organization with metadata tracking

---

## Migration Notes

### Upgrading from v2.5 and Earlier
- **TSV Users**: Must migrate to SQLite before upgrading to v2.6+
- **Database Schema**: Automatic migrations handle schema updates
- **File Structure**: UUID directories are backward compatible with existing date-only structure

### Breaking Changes
- **v2.6**: TSV support completely removed
- **v2.6**: Import API changed to return job IDs instead of blocking
- **v2.0**: Migration from TSV to SQLite required for optimal performance

## Development History

PhotoClove has evolved from a simple photo viewer to a comprehensive photo management system:

1. **Foundation** (v1.x): Basic viewing and import capabilities
2. **Performance** (v2.0+): SQLite migration for speed improvements
3. **User Experience** (v2.1-2.3): UI/UX enhancements and responsive design
4. **Reliability** (v2.4-2.5): Database integrity and conflict prevention
5. **Scalability** (v2.6): Asynchronous processing and job queue system
6. **Integration** (v2.7): Cloud services and comprehensive metadata
7. **Advanced Editing** (v2.8): Sophisticated photo editing capabilities

Each version builds upon the previous foundation while maintaining backward compatibility where possible and providing clear migration paths for breaking changes.