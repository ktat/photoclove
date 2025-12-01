# PhotoClove API Reference

This document provides API reference organized by use case for PhotoClove's backend commands and frontend integration.

## API Reference by Use Case

### Getting Photo Data
- **Command**: `get_photos_with_filter`
- **Sequence**: [Photo Grid Display](feature-sequences.md#2-photo-grid-display)
- **Frontend**: `src/App/PhotosList.jsx` → `getPhotos()`
- **Backend**: `src-tauri/src/lib.rs` → `get_photos_with_filter`

### Saving Photo Metadata
- **Commands**: `save_star`, `save_comment`, `save_css_style`
- **Sequence**: [Photo Editing Feature](feature-sequences.md#photo-editing-feature)
- **Frontend**: `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
- **Backend**: `src-tauri/src/lib.rs` → metadata save commands

### Managing Background Jobs
- **Commands**: `import_photos`, `get_job_progress`, `get_all_jobs`
- **Sequence**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **Frontend**: `src/App/JobQueue.jsx`
- **Backend**: `src-tauri/src/domain_service/job_queue_service.rs`

### Configuration Operations
- **Commands**: `get_config`, `save_config`
- **Sequence**: [Preferences Update](feature-sequences.md#1-preferences-update)
- **Frontend**: `src/App/Preferences.jsx`
- **Backend**: `src-tauri/src/entity/config.rs`

### Unified Collection System (Albums & Tags)
- **Commands**: `create_collection`, `get_all_collections`, `update_collection`, `delete_collection`
- **Collection Management**: `add_photo_to_collection`, `remove_photo_from_collection`, `get_collection_photos`
- **Album Operations**: `add_photo_to_album`, `remove_photo_from_album` (unified collections backend)
- **Frontend**:
  - `src/domain/UnifiedPhotoCollection.js`, `src/services/UnifiedCollectionService.js`
  - `src/hooks/usePhotoOperations.js` - Centralized photo operations (510 lines)
- **Backend**: `src-tauri/src/entity/photo_collection.rs`, unified database tables (`photo_collections`, `photo_collection_items`)
- **Legacy Support**: Legacy album/tag commands still supported for backward compatibility

### Photo Trash Operations
- **Commands**: `move_to_trash`, `restore_from_trash`
- **Purpose**: Non-destructive photo deletion with restore capability
- **Frontend**: `src/hooks/usePhotoOperations.js`
  - `moveToTrash()`: Move photo to trash, update date counts and thumbnails
  - `restorePhoto()`: Restore photo from trash
  - `permanentlyDeletePhoto()`: Permanent deletion (enhanced with confirmation)
- **Backend**: `src-tauri/src/domain_service/file_service.rs`
- **Features**:
  - Automatic date count updates
  - Thumbnail list synchronization
  - Smart navigation after deletion
  - Trash mode detection (permanent delete vs move to trash)

## Feature Implementation Guides

### Adding a New Photo Filter
1. **Frontend**: Add filter control in [Directory Menu](component-structure.md#directory-menu-when-no-photo-selected)
2. **Backend**: Extend `get_photos_with_filter` command in `src-tauri/src/lib.rs`
3. **Database**: Add filter logic in `src-tauri/src/repository/db/directory.rs`
4. **Reference**: [Search & Filtering](feature-quick-reference.md#-advanced-search--filtering-enhanced)

### Adding a New Photo Transformation
1. **Frontend**: Add control in [Photo Editor Panel](component-structure.md#photo-editor-panel)
2. **CSS**: Extend transformation logic in `src/App/PhotosList/PhotoOption/PhotoEditor.jsx`
3. **Backend**: Update `save_css_style` and `save_styled_copy_from_frontend` commands
4. **Reference**: [Photo Editing & Transformations](feature-quick-reference.md#-photo-editing--transformations)

### Adding a New Background Job Type
1. **Entity**: Define job type in `src-tauri/src/entity/job_queue.rs`
2. **Service**: Implement in `src-tauri/src/domain_service/job_queue_service.rs`
3. **Frontend**: Add monitoring in [Job Queue Interface](component-structure.md#job-queue-interface)
4. **Reference**: [Background Job Processing](feature-quick-reference.md#-background-job-processing)

### Adding a New Configuration Option
1. **Entity**: Add field to `src-tauri/src/entity/config.rs`
2. **Frontend**: Add control in [Preferences Screen](component-structure.md#preferences-screen)
3. **Persistence**: Update save/load logic in config entity
4. **Reference**: [Configuration Management](feature-quick-reference.md#-configuration-management)

### Adding a New Import Source
1. **Frontend**: Extend directory picker in `src/App/Importer.jsx`
2. **Backend**: Update `show_importer` command logic
3. **Configuration**: Add to export_from array in config
4. **Reference**: [Photo Import System](feature-quick-reference.md#-photo-import-system)