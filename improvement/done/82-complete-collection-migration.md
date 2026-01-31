# Complete Collection System Migration - Remove Legacy Tags/Albums

## Overview
The codebase currently has both legacy (tags/albums) and unified (collections) systems running in parallel. This creates maintenance burden, confusion, and potential bugs. We need to complete the migration to the unified collection system and remove all legacy code.

## Current State
- **Legacy System**: Fully functional with 16+ API commands, 4 database tables
- **Unified System**: Implemented with 7 API commands but not fully integrated
- **Migration**: Partially implemented but not executed
- **Frontend**: Mixed usage of both systems

## Migration Plan

### Phase 1: Database Migration
1. **Backup existing data**
   - Export all tags/albums data before migration
   
2. **Execute migration script**
   - Convert all tags to collections with type="tag"
   - Convert all albums to collections with type="album"
   - Migrate photo_tags → collection_photos
   - Migrate album_photos → collection_photos
   
3. **Verify data integrity**
   - Ensure all relationships are preserved
   - Validate photo counts match

### Phase 2: Backend API Updates
1. **Update `get_photos_unified` command**
   - Replace `"all_albums"` → query collections where type="album"
   - Replace `"all_tags"` → query collections where type="tag"
   - Replace `"all_tags_with_count"` → query collections with counts where type="tag"

2. **Create compatibility layer (temporary)**
   - Map old API calls to new collection APIs:
     ```rust
     // Example mapping
     create_tag → create_collection(type="tag")
     create_album → create_collection(type="album")
     add_tag_to_photo → add_photo_to_collection
     // etc...
     ```

3. **Fix missing command**
   - Implement `remove_all_tags_from_photo` → remove photo from all collections where type="tag"

### Phase 3: Frontend Migration
1. **Update ViewMode.js**
   - Change Albums mode to use collections API with type filter
   - Change Tags mode to use collections API with type filter

2. **Update components systematically**:
   - TagSelector → CollectionSelector (filter by type="tag")
   - TagManager → CollectionManager (filter by type="tag")
   - AlbumSelectorModal → CollectionSelector (filter by type="album")
   - AlbumTab → CollectionTab
   - PhotoTags → PhotoCollections (filter by type="tag")

3. **Update hooks**:
   - usePhotosQuery: Replace all tag/album API calls
   - usePhotoOperations: Update bulk operations

4. **Update DirectoryMenu**
   - Replace album/tag specific operations with collection operations

### Phase 4: Remove Legacy Code
1. **Remove backend legacy code**:
   - Remove all tag/album specific commands from main.rs
   - Remove tag/album methods from repository.rs
   - Remove tag/album SQL queries from sqlite.rs
   
2. **Drop legacy database tables** (after verification):
   ```sql
   DROP TABLE IF EXISTS tags;
   DROP TABLE IF EXISTS albums;
   DROP TABLE IF EXISTS photo_tags;
   DROP TABLE IF EXISTS album_photos;
   ```

3. **Remove frontend legacy code**:
   - Remove CollectionMigrationUtils.js (no longer needed)
   - Remove any tag/album specific logic

### Phase 5: Optimization
1. **Update indexes** for collection queries:
   ```sql
   CREATE INDEX idx_collections_type ON collections(type);
   CREATE INDEX idx_collection_photos_collection_type ON collection_photos(collection_id, type);
   ```

2. **Optimize collection queries** for type-specific operations

3. **Update documentation** to reflect unified system

## Implementation Order
1. Fix broken `remove_all_tags_from_photo` command (critical bug)
2. Complete database migration
3. Update backend with compatibility layer
4. Migrate frontend components one by one
5. Test thoroughly
6. Remove compatibility layer
7. Drop legacy tables
8. Clean up code

## Benefits
- Single unified system for both tags and albums
- Reduced code complexity
- Better maintainability
- Consistent API
- Future extensibility for new collection types

## Risks & Mitigation
- **Data Loss**: Backup before migration, test migration script thoroughly
- **Breaking Changes**: Use compatibility layer during transition
- **Performance**: Add proper indexes for collection queries
- **User Experience**: Ensure UI remains unchanged from user perspective

## Testing Plan
1. Unit tests for migration script
2. Integration tests for all collection operations
3. UI tests for all tag/album workflows
4. Performance tests for large datasets
5. Rollback plan if issues arise

## Estimated Effort
- Phase 1: 2-3 hours (database migration)
- Phase 2: 3-4 hours (backend updates)
- Phase 3: 6-8 hours (frontend migration)
- Phase 4: 2-3 hours (cleanup)
- Phase 5: 2-3 hours (optimization)
- Testing: 4-5 hours

**Total: ~20-28 hours**