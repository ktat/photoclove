# Tag System Implementation

## Overview
Implement a comprehensive tagging system to allow users to organize photos with custom labels and improve searchability.

## Problem
Currently, PhotoClove only supports star ratings and comments for metadata. Users need a more flexible way to categorize photos with custom tags like "vacation", "family", "nature", "work", etc.

## Implementation Plan

### Database Changes
1. Create new tables in SQLite schema:
   - `tags` table: id, name, color (optional), created_at
   - `photo_tags` table: photo_id, tag_id (many-to-many relationship)
2. Add database migration for existing installations

### Backend Changes (Rust)
1. Add tag-related database operations:
   - Create, read, update, delete tags
   - Assign/remove tags from photos
   - Get all tags for a photo
   - Get all photos with specific tags
2. Add new Tauri commands:
   - `get_all_tags()`
   - `create_tag(name, color)`
   - `add_tag_to_photo(photo_id, tag_id)`
   - `remove_tag_from_photo(photo_id, tag_id)`
   - `search_photos_by_tags(tag_ids)`

### Frontend Changes (React)
1. Create tag-related components:
   - `TagInput.jsx` - For creating new tags
   - `TagChip.jsx` - Display individual tags with color
   - `TagSelector.jsx` - Multi-select for assigning tags
   - `TagManager.jsx` - Bulk tag management interface
2. Update existing components:
   - Add tag display to photo cards in PhotosList
   - Add tag editing to photo detail view
   - Integrate tag filters in SearchInterface
   - Add tag management to Preferences

### UI/UX Features
1. Tag display:
   - Color-coded tag chips below photo thumbnails
   - Tag count indicators
   - Quick tag assignment via right-click context menu
2. Tag management:
   - Dedicated tag management interface in preferences
   - Bulk tag operations (assign/remove tags from multiple photos)
   - Tag autocomplete when typing
3. Search integration:
   - Tag-based filtering in search interface
   - Ability to search for photos with multiple tags (AND/OR logic)
   - Quick filter buttons for frequently used tags

### Performance Considerations
1. Index photo_tags table for fast lookups
2. Cache popular tags for autocomplete
3. Lazy load tag data to avoid performance impact
4. Implement tag usage statistics for relevance sorting

## Files to Modify
- `src-tauri/src/database.rs` - Add tag-related database operations
- `src-tauri/src/main.rs` - Add new Tauri commands
- `src/components/PhotosList.jsx` - Add tag display to photo cards
- `src/components/SearchInterface.jsx` - Add tag filtering
- `src/components/Preferences.jsx` - Add tag management
- `docs/database-schema.md` - Update with new tables

## Testing Plan
1. Unit tests for tag database operations
2. Integration tests for tag assignment/removal
3. UI tests for tag search functionality
4. Performance tests with large tag datasets

## Migration Strategy
1. Add database migration script for existing users
2. Provide tag import from photo filenames or EXIF keywords
3. Ensure backward compatibility with existing photo metadata

keep context