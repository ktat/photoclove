# Improvement #86: Refactor meta_db/sqlite.rs - Split Repository Methods

## Current Status
- File: `src-tauri/src/repository/meta_db/sqlite.rs`
- Lines: **3,829 lines** (exceeds 1000 line limit by ~4x)
- Public methods: **54 methods** in single impl block
- Complexity: Extremely high - database operations for all entities

## Problem
sqlite.rs is the largest file in the codebase and handles all database operations:
- Photo metadata CRUD (path, date, star, comment, EXIF)
- Tag management (create, delete, update, photo_tags junction)
- Album management (create, delete, update, album_photos junction)
- Date summary aggregations
- Search and filtering queries
- Job queue operations
- Migration logic

This violates Single Responsibility Principle and makes:
- Hard to find specific database operations
- Difficult to test individual features
- Risk of merge conflicts
- Hard to optimize specific query patterns

## Goal
Split SQLite repository into focused repository modules by entity/domain.

## Implementation Plan

### Step 1: Create repository module structure
```
src-tauri/src/repository/meta_db/
  mod.rs                    # Module exports
  sqlite.rs                 # Main connection and init (keep)
  photo_repository.rs       # Photo metadata operations
  tag_repository.rs         # Tag operations
  album_repository.rs       # Album operations
  date_repository.rs        # Date summary operations
  search_repository.rs      # Search queries
  job_repository.rs         # Job queue operations
  migration.rs              # Database migrations
```

### Step 2: Extract photo repository to `photo_repository.rs`
Move these methods (~800 lines):
- `record_photo_metas` - Batch insert/update
- `record_photo_meta` - Single photo insert/update
- `get_photo_meta_data` - Get by path
- `get_photo_meta_data_in_date` - Filter by date
- `get_photos_in_date_range` - Date range query
- `update_photo_path` - Path changes
- `delete_photo_meta` - Delete metadata
- `get_all_photos` - Full scan
- EXIF field operations
- CSS style save/load
- Star/comment operations

### Step 3: Extract tag repository to `tag_repository.rs`
Move these methods (~400 lines):
- `get_all_tags` - List all tags
- `get_all_tags_with_photo_count` - With counts
- `create_tag` - Create new tag
- `delete_tag` - Delete tag
- `update_tag` - Update tag metadata
- `add_tag_to_photo` - Junction table insert
- `remove_tag_from_photo` - Junction table delete
- `get_photos_by_tag` - Filter by tag
- `get_tags_for_photo` - Photo's tags

### Step 4: Extract album repository to `album_repository.rs`
Move these methods (~500 lines):
- `get_all_albums` - List all albums
- `get_album_by_id` - Get by ID
- `create_album` - Create new album
- `update_album` - Update metadata
- `delete_album` - Delete album
- `add_photos_to_album` - Junction table batch insert
- `remove_photos_from_album` - Junction table delete
- `get_album_photos` - Photos in album
- `update_album_cover` - Set cover photo
- `reorder_album_photos` - Update order_index
- `get_albums_containing_photo` - Photo's albums

### Step 5: Extract date repository to `date_repository.rs`
Move these methods (~300 lines):
- `get_date_list` - Date summary list
- `get_date_num` - Photo counts by date
- `update_date_summary` - Recalculate counts
- `rebuild_date_summary` - Full rebuild
- `get_dates_in_range` - Date range
- Date aggregation queries

### Step 6: Extract search repository to `search_repository.rs`
Move these methods (~500 lines):
- `search_photos` - Full-text search
- `search_photos_with_filters` - Advanced search
- `get_cameras_list` - Camera metadata
- `get_lenses_list` - Lens metadata
- `get_extensions_list` - File type list
- Complex WHERE clause building
- Filter combination logic

### Step 7: Extract job repository to `job_repository.rs`
Move these methods (~400 lines):
- `enqueue_job` - Add job
- `get_pending_jobs` - Job queue
- `update_job_status` - Status change
- `delete_completed_jobs` - Cleanup
- `get_job_by_id` - Get job
- Job-related queries

### Step 8: Extract migrations to `migration.rs`
Move these functions (~400 lines):
- `init_db` - Database initialization
- `get_full_schema` - Schema definition
- Table creation logic
- Index creation
- Migration checks
- Schema versioning (if added)

### Step 9: Update sqlite.rs (main connection)
Keep only (~200 lines):
- `SQLite` struct definition
- `new()` constructor
- `connect()` method
- Connection management
- Transaction utilities
- Common helper methods
- Trait implementations that delegate to sub-repositories

### Step 10: Create trait-based architecture
Define traits for each repository:
```rust
// In repository/meta_db/mod.rs
pub trait PhotoRepository {
    fn record_photo_meta(&self, photo: &Photo) -> Result<(), String>;
    fn get_photo_meta_data(&self, path: &str) -> Result<Option<PhotoMeta>, String>;
    // ... other photo methods
}

pub trait TagRepository {
    fn get_all_tags(&self) -> Result<Vec<Tag>, String>;
    fn create_tag(&self, name: &str, color: Option<&str>) -> Result<i32, String>;
    // ... other tag methods
}

// etc for Album, Date, Search, Job
```

Implement traits:
```rust
impl PhotoRepository for SQLite {
    // Delegate to photo_repository module functions
    fn record_photo_meta(&self, photo: &Photo) -> Result<(), String> {
        photo_repository::record_photo_meta(&self.get_connection()?, photo)
    }
}
```

## Expected Results
- sqlite.rs reduced from 3,829 lines to ~200 lines
- Each repository module: 300-500 lines
- Clear separation by entity/domain
- Easier to find database operations
- Better testability (can mock individual repositories)
- Improved code organization
- Reduced merge conflicts

## Testing
- Unit tests for each repository module
- Integration tests for complex queries
- Verify all database operations still work
- Test migrations on fresh database
- Test migrations on existing database
- Run full test suite
- Performance testing (ensure no regression)

## Migration Strategy
1. Create new repository files with extracted methods
2. Keep original methods in sqlite.rs but have them call new modules
3. Update tests to use new modules
4. Once stable, remove delegating methods from sqlite.rs
5. Update callers to use trait-based interface

## Related Files
- `src-tauri/src/repository/meta_db/sqlite.rs` (will be split)
- `src-tauri/src/repository/meta_db/` (new module structure)
- All command files that use MetaDB (will need updates)
- Test files (will need updates)

## Notes
- This is the largest refactoring task
- Should be done in multiple phases/PRs
- Requires careful testing
- Consider database transaction patterns
- May need connection pooling strategy
