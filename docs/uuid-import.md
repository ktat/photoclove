# UUID-Based Import System

This document describes the UUID-based import system implemented in PhotoClove to prevent filename conflicts when importing photos from different SD cards or sources.

## Overview

The UUID-based import system creates unique subdirectories for each source (SD card, USB drive, etc.) to prevent filename conflicts when importing photos. This ensures that photos with the same filename from different sources can coexist in the same date directory.

## How It Works

### 1. Source UUID Generation

When importing photos, PhotoClove:
1. Checks for a `.photoclove-uuid` file in the parent directory of the source files
2. If the file exists, reads the UUID from it
3. If the file doesn't exist, generates a new UUID and creates the file
4. Uses this UUID to create a unique subdirectory structure

### 2. Directory Structure

Photos are imported using the following structure:
```
import_to_directory/
├── 2025-01-15/
│   ├── abc123-def456-789/  # UUID subdirectory
│   │   ├── photo1.jpg
│   │   └── photo2.jpg
│   └── existing_photo.jpg  # Direct in date directory (legacy)
└── 2025-01-16/
    └── xyz789-uvw123-456/  # Different UUID for different source
        ├── photo1.jpg      # Same filename as above, no conflict
        └── photo3.jpg
```

### 3. UUID File Management

The `.photoclove-uuid` file:
- Contains a single UUID string (e.g., `abc123-def456-789`)
- Is created in the parent directory of the image file's directory
- For `/foo/bar/image.png`, the UUID file is created at `/foo/.photoclove-uuid`
- Persists across multiple import sessions from the same source
- Ensures consistent UUID assignment for the same SD card/source

Example file structure:
```
/media/user/SDCARD/
├── .photoclove-uuid        # Contains: abc123-def456-789
├── DCIM/
│   └── 100CANON/
│       ├── IMG_001.jpg     # UUID file is in /media/user/SDCARD/
│       └── IMG_002.jpg     # Not in /media/user/SDCARD/DCIM/
└── other_folder/
    └── more_photos.jpg     # UUID file is in /media/user/SDCARD/
```

## Technical Implementation

### Core Components

1. **UUID Generation Function**: `get_or_create_source_uuid()`
   - Manages UUID creation and retrieval
   - Places UUID files in the parent directory of the image file's directory
   - Handles file I/O for `.photoclove-uuid` files
   - Validates existing UUIDs

2. **Import Process Enhancement**
   - Determines source UUID before threading
   - Creates UUID subdirectories during import
   - Maintains backward compatibility with existing structure

3. **Photo Discovery Enhancement**
   - Recursively scans UUID subdirectories
   - Provides flat view of all photos in a date directory
   - Supports both legacy and UUID-based storage

### Directory Creation Logic

```rust
// Create the final destination path with UUID if available
let destination_path = if let Some(ref uuid) = source_uuid {
    let uuid_dir = destination_date_dir.join(uuid);
    if !uuid_dir.exists() {
        fs::create_dir_all(&uuid_dir)?;
    }
    uuid_dir.join(filename)
} else {
    // Fallback to original behavior
    destination_date_dir.join(filename)
};
```

### Recursive Photo Discovery

The `find_files()` function has been enhanced to:
- Scan files directly in date directories (legacy behavior)
- Recursively scan UUID subdirectories
- Validate directory names as UUIDs before scanning
- Combine results for flat display

## Benefits

### 1. Conflict Prevention
- Eliminates filename conflicts between different sources
- Allows importing photos with identical filenames
- Preserves original filename structure

### 2. Source Identification
- Each source gets a unique identifier
- Easy to track which photos came from which source
- Persistent identification across import sessions

### 3. Backward Compatibility
- Existing photos continue to work without changes
- Legacy import structure remains supported
- No data migration required

### 4. Performance
- Efficient UUID validation
- Minimal overhead during import
- Optimized directory scanning

## User Experience

### Import Process
1. Select photos to import (unchanged)
2. System automatically detects or creates source UUID
3. Photos are imported to UUID subdirectories
4. Photo display remains flat and unified

### Photo Display
- All photos from a date appear together
- No visible difference in photo browsing
- Unified view across legacy and UUID-based photos
- Consistent thumbnail and metadata handling

## Configuration

The UUID-based import system works automatically without configuration. However, administrators can:

### Manual UUID Management
- Create `.photoclove-uuid` files manually if needed
- Use custom UUIDs for specific sources
- Backup UUID files for source consistency

### Troubleshooting
- Check UUID file permissions if import fails
- Verify UUID format validity
- Ensure sufficient disk space for directory creation

## Migration from Legacy System

### Automatic Migration
- No manual migration required
- Existing photos continue to work
- New imports automatically use UUID system
- Gradual transition as new photos are imported

### Coexistence
- Legacy photos remain in date directories
- UUID-based photos in subdirectories
- Unified display combines both structures
- Consistent metadata handling

## File Structure Examples

### Before UUID System
```
/mnt/pictures/
├── 2025-01-15/
│   ├── IMG_001.jpg
│   ├── IMG_002.jpg
│   └── DSCF_001.jpg
└── 2025-01-16/
    └── IMG_001.jpg  # Potential conflict with different source
```

### After UUID System
```
/mnt/pictures/
├── 2025-01-15/
│   ├── abc123-def456-789/  # Canon camera
│   │   ├── IMG_001.jpg
│   │   └── IMG_002.jpg
│   ├── xyz789-uvw123-456/  # Fujifilm camera
│   │   └── DSCF_001.jpg
│   └── legacy_photo.jpg    # Pre-UUID import
└── 2025-01-16/
    └── abc123-def456-789/  # Same Canon camera
        └── IMG_001.jpg     # No conflict with 2025-01-15
```

## Security Considerations

### UUID Predictability
- UUIDs are generated using standard UUID v4 algorithm
- Cryptographically secure random generation
- No predictable patterns in subdirectory names

### File System Security
- Respects existing file permissions
- No elevation of privileges required
- Standard file system operations only

## Performance Impact

### Import Performance
- Minimal overhead for UUID generation
- Efficient directory creation
- Parallel import processing maintained

### Display Performance
- Recursive directory scanning optimized
- UUID validation cached
- Flat display performance preserved

## Future Enhancements

### Planned Features
- UUID-based photo search and filtering
- Source identification in metadata
- Bulk UUID management tools
- Import source statistics

### Compatibility
- Future versions will maintain UUID compatibility
- Import structure will remain stable
- Metadata format extensions may be added

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure write access to source directories
   - Check permissions on destination directories
   - Verify disk space availability

2. **UUID File Issues**
   - Corrupted UUID files will be regenerated
   - Invalid UUID format triggers new generation
   - Missing files are automatically created

3. **Directory Creation Failures**
   - Check destination directory permissions
   - Verify file system supports nested directories
   - Ensure sufficient disk space

### Debugging

Enable debug logging to troubleshoot UUID-related issues:
```bash
# Check UUID file contents
cat /media/user/SDCARD/.photoclove-uuid

# Verify directory structure
ls -la /mnt/pictures/2025-01-15/

# Check import logs
tail -f ~/.photoclove/logs/import.log
```

## Technical Dependencies

### Rust Crates
- `uuid` crate for UUID generation and validation
- `std::fs` for file system operations
- `std::path` for path manipulation

### File System Requirements
- Support for nested directories
- Unicode filename support
- Standard file permissions

## Version History

### v2.5 (Current)
- Initial UUID-based import implementation
- Automatic UUID file management
- Recursive photo discovery
- Backward compatibility with legacy structure

### Future Versions
- Enhanced UUID management tools
- Source identification features
- Import analytics and reporting