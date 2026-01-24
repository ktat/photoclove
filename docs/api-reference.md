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
- **Commands**: `move_to_trash_batch`, `restore_from_trash_batch`, `delete_permanently_batch`
- **Purpose**: Non-destructive photo deletion with restore capability
- **Frontend**: `src/hooks/usePhotoOperations.js`, `src/App/PhotosList/DirectoryMenu.jsx`
  - `moveToTrash()`: Move photo to trash, update date counts and thumbnails
  - `restorePhoto()`: Restore photo from trash
  - `permanentlyDeletePhoto()`: Permanent deletion (enhanced with confirmation)
  - Batch operations for efficient multi-photo deletion/restore
- **Backend**: `src-tauri/src/lib.rs`, `src-tauri/src/domain_service/file_service.rs`
  - `move_to_trash_batch`: Batch move with date_summary updates
  - `restore_from_trash_batch`: Batch restore with proper date handling
  - `delete_permanently_batch`: Permanent batch deletion
- **Features**:
  - Automatic date_summary updates (batched for efficiency)
  - Thumbnail list synchronization
  - Smart navigation after deletion
  - Trash mode detection (permanent delete vs move to trash)
  - Trash-specific UI (Editor/Tags/Maintenance tabs hidden)
  - Proper metadata retrieval for trashed photos (uses trash path)

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

## Tauri Command Reference

### Recovery Queue Commands

Commands for managing failed operations that can be retried.

| Command | Parameters | Return Type | Description |
|---------|-----------|-------------|-------------|
| `get_recovery_pending_count` | None | `Result<i32, String>` | Get count of pending recovery items |
| `get_recovery_pending_items` | None | `Result<String, String>` | Get all pending recovery items as JSON array |
| `get_recovery_all_items` | None | `Result<String, String>` | Get all recovery items including resolved and discarded |
| `discard_recovery_item` | `id: i64` | `Result<(), String>` | Mark a recovery item as discarded |
| `delete_recovery_item` | `id: i64` | `Result<(), String>` | Delete a recovery item completely |
| `retry_recovery_item` | `id: i64` | `Result<String, String>` | Retry a single recovery item; returns `{"success": true}` on success |
| `retry_all_recovery_items` | None | `Result<String, String>` | Retry all pending items; returns `{"total", "succeeded", "failed"}` |
| `cleanup_recovery_items` | None | `Result<usize, String>` | Cleanup old resolved/discarded items; returns count of cleaned items |

- **Frontend**: `src/App/RecoveryQueue.jsx`
- **Backend**: `src-tauri/src/commands/recovery_queue_commands.rs`

### Burst Group Commands

Commands for managing burst photo groups (consecutive shots grouping).

| Command | Parameters | Return Type | Description |
|---------|-----------|-------------|-------------|
| `create_burst_group` | `photo_paths: Vec<String>` | `Result<String, String>` | Create a manual burst group from selected photos (minimum 2); returns group ID |
| `remove_from_burst_group` | `photo_paths: Vec<String>` | `Result<(), String>` | Remove photos from their burst groups; auto-dissolves groups with <2 photos |
| `recalculate_grouping` | `threshold_seconds: u32`, `min_group_size: u32` | `Result<String, String>` | Recalculate auto burst groups globally; returns job unit ID |
| `recalculate_grouping_in_date` | `date_str: String`, `threshold_seconds: u32`, `min_group_size: u32` | `Result<u32, String>` | Recalculate burst groups for a specific date (YYYY-MM-DD); returns count of new groups |

- **Frontend**: `src/App/PhotosList/PhotoOption/BurstGroupPanel.jsx`
- **Backend**: `src-tauri/src/commands/burst_group_commands.rs`

### S3 Backup Commands

Commands for managing S3 cloud backup configuration and sync operations.

| Command | Parameters | Return Type | Description |
|---------|-----------|-------------|-------------|
| `list_aws_profiles` | None | `Result<String, String>` | List available AWS profiles from ~/.aws/credentials |
| `test_s3_connection` | None | `Result<String, String>` | Test S3 connection with current configuration; returns `{"success", "message"}` |
| `get_s3_config` | None | `Result<String, String>` | Get current S3 configuration as JSON |
| `save_s3_config` | `enabled: bool`, `storage_type: String`, `bucket_uri: String`, `region: String`, `auth_method: String`, `profile: Option<String>`, `custom_endpoint: Option<String>`, `auto_sync: bool`, `backup_db: bool`, `max_file_size_mb: Option<u32>` | `Result<String, String>` | Save S3 configuration |
| `get_s3_sync_stats` | None | `Result<String, String>` | Get sync statistics: `{"total_photos", "synced", "not_synced", "last_sync_at"}` |
| `enqueue_s3_incremental_sync` | None | `Result<String, String>` | Enqueue incremental sync (photos since last_sync_at); returns job info or `{"result": "no_photos_to_sync"}` |
| `enqueue_s3_full_sync` | None | `Result<String, String>` | Enqueue full sync (all unsynced photos); returns `{"result", "job_unit_id", "job_id", "to_sync"}` |
| `enqueue_s3_sync_by_date` | `date: String` | `Result<String, String>` | Enqueue sync for a specific date (YYYY-MM-DD or YYYY/MM/DD) |

**Storage Types**: `aws_s3`, `minio`, `wasabi`, `cloudflare_r2`, `digitalocean`, `custom`
**Auth Methods**: `aws_credentials`, `iam_role`, `access_key`

- **Frontend**: `src/App/Preferences/S3Backup.jsx`
- **Backend**: `src-tauri/src/commands/s3_commands.rs`

### AI Model Commands

Commands for managing AI models used in photo auto-tagging.

| Command | Parameters | Return Type | Description |
|---------|-----------|-------------|-------------|
| `get_ai_models` | None | `Result<String, String>` | Get list of all available AI models with status (ready, not_downloaded, downloading, failed) |
| `get_ai_model_info` | `model_id: String` | `Result<String, String>` | Get info about a specific model including status |
| `is_ai_model_downloaded` | `model_id: String` | `Result<bool, String>` | Check if a specific model is downloaded |
| `download_ai_model` | `model_id: String` | `Result<String, String>` | Download an AI model (blocking); returns `{"result": "success", "model_id"}` |
| `delete_ai_model` | `model_id: String` | `Result<String, String>` | Delete a downloaded AI model |
| `get_ai_models_dir` | None | `Result<String, String>` | Get the models directory path |
| `get_default_clip_labels` | None | `Result<String, String>` | Get default CLIP labels for OpenCLIP/SigLIP as JSON array |

**Model Status Values**: `ready`, `not_downloaded`, `downloading:{progress}`, `failed:{error}`

- **Frontend**: `src/App/Preferences/AITagging.jsx`
- **Backend**: `src-tauri/src/commands/ai_model_commands.rs`