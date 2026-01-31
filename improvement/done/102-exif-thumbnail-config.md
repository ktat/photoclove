# Improvement #102: Add EXIF thumbnail extraction option for import mode

## Overview
Add a configuration option to use EXIF embedded thumbnails instead of generating thumbnails from resized original images during import. This can significantly speed up thumbnail generation for photos that already have embedded thumbnails.

## Requirements

### 1. Add configuration option
- Add new config field: `use_exif_thumbnail` (boolean, default: false)
- Location: Config struct in Rust backend
- UI: Add checkbox in Settings/Configuration page

### 2. Modify thumbnail generation logic for import mode
- **IMPORTANT**: Use the existing import mode thumbnail generation logic as-is
- Location: `get_resized_image` function in `src-tauri/src/lib.rs`
- Behavior when `use_exif_thumbnail` is true:
  1. Try to extract EXIF embedded thumbnail from the photo
  2. If EXIF thumbnail exists and is valid:
     - Save it as the thumbnail cache file (same path as current logic)
     - Return success
  3. If EXIF thumbnail doesn't exist or extraction fails:
     - Fall back to current resize logic (resize original image)
  4. Use the same cache path generation logic (hash-based filename with import directory UUID)

### 3. Technical considerations
- EXIF thumbnail extraction library: Use existing EXIF parsing capabilities or add appropriate crate
- Image format support: JPEG files commonly have EXIF thumbnails, other formats may not
- Performance: EXIF extraction should be faster than image resizing
- Cache compatibility: Generated cache files should work with existing cache lookup logic
- Error handling: Gracefully fall back to resize if EXIF extraction fails

## Implementation notes

### Backend changes
- **Config**: Add `use_exif_thumbnail: bool` field
- **get_resized_image**: Add EXIF thumbnail extraction branch
  - Check config flag
  - Extract EXIF thumbnail if enabled
  - Save to cache using existing path logic
  - Fall back to resize on failure

### Frontend changes
- **Settings UI**: Add checkbox for "Use EXIF thumbnails when available"
- **No changes to import flow**: Existing import logic should work as-is

## Benefits
- Faster thumbnail generation during import (no image processing needed)
- Reduced CPU usage during import
- Better battery life on laptops
- Smaller thumbnail files in some cases (EXIF thumbnails are often pre-optimized)

## Testing checklist
- [ ] Config option saves and loads correctly
- [ ] EXIF thumbnail extraction works for JPEG files with embedded thumbnails
- [ ] Fallback to resize works when EXIF thumbnail is not available
- [ ] Cache files are created with correct filenames (hash-based with import UUID)
- [ ] Thumbnails display correctly in import mode
- [ ] Performance improvement is measurable
- [ ] Works with existing cache lookup logic
