# Album Support Implementation

## Overview
Add album functionality to group photos into custom collections, allowing users to organize photos beyond date-based structure.

## Problem
PhotoClove currently organizes photos by date only. Users need the ability to create custom collections (albums) like "Wedding 2024", "Tokyo Trip", "Family Portraits" that can contain photos from different dates and locations.

## Implementation Plan

### Database Changes
1. Create new tables in SQLite schema:
   - `albums` table: id, name, description, cover_photo_id, created_at, updated_at
   - `album_photos` table: album_id, photo_id, added_at, order_index (for custom ordering)
2. Add database migration for existing installations

### Backend Changes (Rust)
1. Add album-related database operations:
   - Create, read, update, delete albums
   - Add/remove photos from albums
   - Reorder photos within albums
   - Get all albums
   - Get photos in specific album
2. Add new Tauri commands:
   - `get_all_albums()`
   - `create_album(name, description)`
   - `update_album(id, name, description, cover_photo_id)`
   - `delete_album(id)`
   - `add_photo_to_album(album_id, photo_id)`
   - `remove_photo_from_album(album_id, photo_id)`
   - `reorder_album_photos(album_id, photo_order)`
   - `get_album_photos(album_id)`

### Frontend Changes (React)
1. Create album-related components:
   - `AlbumGrid.jsx` - Display albums as cards with cover photos
   - `AlbumView.jsx` - Show photos within a specific album
   - `AlbumEditor.jsx` - Create/edit album metadata
   - `AlbumSelector.jsx` - Multi-select for assigning photos to albums
   - `AlbumManager.jsx` - Manage all albums interface
2. Update existing components:
   - Add "Albums" tab to main navigation
   - Add album assignment to photo context menu
   - Integrate album filters in SearchInterface
   - Update PhotosList to support album view mode

### UI/UX Features
1. Album navigation:
   - Albums grid view with cover photos and photo counts
   - Breadcrumb navigation when viewing album contents
   - Quick album creation from selected photos
2. Photo management:
   - Drag-and-drop to add photos to albums
   - Multi-select photos for bulk album assignment
   - Visual indicators showing which albums contain a photo
3. Album customization:
   - Custom album covers (user selectable from album photos)
   - Album descriptions and metadata
   - Custom photo ordering within albums (drag-and-drop)
4. Smart albums (future enhancement):
   - Auto-generated albums based on criteria (date range, tags, etc.)
   - Dynamic albums that update based on rules

### Integration with Existing Features
1. Search integration:
   - Search within specific albums
   - Filter search results by album membership
   - Album-based search suggestions
2. Tag integration:
   - Albums can have tags for better organization
   - Smart album creation based on tag combinations
3. Export integration:
   - Export entire albums to folders
   - Maintain album structure in exports

### Performance Considerations
1. Index album_photos table for fast queries
2. Lazy load album covers and metadata
3. Implement pagination for albums with many photos
4. Cache album statistics (photo count, last updated)

## Files to Modify
- `src-tauri/src/database.rs` - Add album-related database operations
- `src-tauri/src/main.rs` - Add new Tauri commands
- `src/App.jsx` - Add Albums navigation tab
- `src/components/PhotosList.jsx` - Support album view mode
- `src/components/SearchInterface.jsx` - Add album filtering
- `src/components/Preferences.jsx` - Add album settings
- `docs/database-schema.md` - Update with new tables

## Testing Plan
1. Unit tests for album database operations
2. Integration tests for photo-album relationships
3. UI tests for album creation and management
4. Performance tests with large albums

## Migration Strategy
1. Add database migration script for existing users
2. Provide album import from folder structure
3. Ensure photos can exist in multiple albums
4. Maintain backward compatibility with date-based navigation

## Future Enhancements
1. Album sharing and collaboration
2. Album templates for common use cases
3. Album slideshow mode
4. Album-based cloud sync preferences

keep context