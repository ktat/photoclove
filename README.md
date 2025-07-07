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
  - [ ] different SD card and same file name
  - [x] filter import targets by date
  - [x] importing in background
  - [x] Thumbnail creation
     - [x] Thumbnail creation in background
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
