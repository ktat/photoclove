# Improvement #85: Refactor lib.rs - Extract Command Modules

## Current Status
- File: `src-tauri/src/lib.rs`
- Lines: **2,906 lines** (exceeds 1000 line limit by ~3x)
- Tauri commands: **75 commands** in single file
- Complexity: Extremely high - mixing all backend functionality

## Problem
lib.rs violates Single Responsibility Principle:
- Photo commands (get_photos_unified, get_next_photo, save_star, save_comment, etc.)
- Album commands (get_albums, create_album, update_album, delete_album, etc.)
- Tag commands (get_all_tags, create_tag, add_tag_to_photo, etc.)
- Search commands (search_photos, get_filter_options, etc.)
- Import commands (import_photos, get_import_progress, etc.)
- Google Photos commands (store_google_tokens, etc.)
- System commands (create_db, get_logs, etc.)
- Image commands (get_resized_image, cleanup_cache, etc.)

All mixed in one file makes:
- Hard to navigate and find specific commands
- Difficult to maintain and test
- Poor code organization
- Merge conflicts more likely

## Goal
Split lib.rs into logical command modules by domain, keeping only app initialization in lib.rs.

## Implementation Plan

### Step 1: Create command module structure
```
src-tauri/src/
  commands/
    mod.rs              # Module exports
    photo_commands.rs   # Photo CRUD operations
    album_commands.rs   # Album operations
    tag_commands.rs     # Tag operations
    search_commands.rs  # Search and filter
    import_commands.rs  # Photo import
    google_commands.rs  # Google Photos integration
    system_commands.rs  # System operations
    image_commands.rs   # Image processing (resize, thumbnails)
```

### Step 2: Extract photo commands to `commands/photo_commands.rs`
Move these commands (~500 lines):
- `get_photos_unified` - Main photo fetching endpoint
- `get_next_photo` - Navigation
- `get_photo_info` - Photo metadata
- `save_star` - Star rating
- `save_comment` - Comment text
- `save_css_style` - Photo editor styles
- `get_css_style` - Load saved styles
- `update_photo_path` - Path updates
- `delete_photos` - Photo deletion

### Step 3: Extract album commands to `commands/album_commands.rs`
Move these commands (~400 lines):
- `get_albums` - List all albums
- `get_album_photos` - Photos in album
- `create_album` - Create new album
- `update_album` - Update album metadata
- `delete_album` - Delete album
- `add_photos_to_album` - Add photos
- `remove_photos_from_album` - Remove photos
- `update_album_cover` - Set cover photo
- `reorder_album_photos` - Change photo order

### Step 4: Extract tag commands to `commands/tag_commands.rs`
Move these commands (~300 lines):
- `get_all_tags` - List all tags
- `get_all_tags_with_photo_count` - Tags with counts
- `create_tag` - Create new tag
- `delete_tag` - Delete tag
- `update_tag` - Update tag metadata
- `add_tag_to_photo` - Tag photo
- `remove_tag_from_photo` - Untag photo
- `get_photos_by_tag` - Filter by tag

### Step 5: Extract search commands to `commands/search_commands.rs`
Move these commands (~400 lines):
- `search_photos` - Full-text search
- `get_filter_options` - Available filters
- `get_cameras_list` - Camera metadata
- `get_lenses_list` - Lens metadata
- `get_extensions_list` - File extensions
- Advanced search with filters

### Step 6: Extract import commands to `commands/import_commands.rs`
Move these commands (~300 lines):
- `import_photos` - Import from external source
- `get_import_progress` - Progress tracking
- `cancel_import` - Cancel operation
- `get_import_sources` - Available sources

### Step 7: Extract Google commands to `commands/google_commands.rs`
Move these commands (~200 lines):
- `store_google_tokens` - Token storage
- `get_google_tokens` - Token retrieval
- `refresh_google_token` - Token refresh
- Google Photos API integration

### Step 8: Extract system commands to `commands/system_commands.rs`
Move these commands (~200 lines):
- `create_db` - Database initialization
- `get_logs` - Log retrieval
- `get_config` - Configuration
- `save_config` - Save configuration
- `check_lock` - Lock status
- `run_background_processing` - Background jobs

### Step 9: Extract image commands to `commands/image_commands.rs`
Move these commands (~200 lines):
- `get_resized_image` - EXIF thumbnail extraction
- `cleanup_cache` - LRU cache cleanup
- Image processing utilities

### Step 10: Update lib.rs
- Remove all command implementations
- Import command modules
- Register all commands in `.invoke_handler()`
- Keep only:
  - AppState struct
  - App initialization
  - Menu setup
  - Command registration

## Expected Results
- lib.rs reduced from 2,906 lines to ~200-300 lines
- Each command module: 200-500 lines
- Clear domain separation
- Easier to find and maintain commands
- Better testability
- Reduced merge conflicts

## Testing
- Verify all 75 commands still work after extraction
- Test each domain:
  - Photo operations
  - Album management
  - Tag operations
  - Search functionality
  - Import process
  - Google Photos integration
  - System operations
  - Image processing
- Run `cargo check` to verify compilation
- Integration tests for critical paths

## Related Files
- `src-tauri/src/lib.rs` (will be heavily modified)
- `src-tauri/src/commands/` (new directory)
- All existing entity and repository modules (dependencies)

## Notes
- This is a pure code organization refactor
- No functional changes
- Should be done carefully with thorough testing
- Consider doing in smaller PRs per module
