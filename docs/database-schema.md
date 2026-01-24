# Database Schema Documentation

PhotoClove uses SQLite for metadata storage. The main table is `photo_metadata` which stores all information about imported photos.

## Photo Metadata Table Structure

### Core Fields
- `path` (TEXT PRIMARY KEY): Full path to the photo file
- `photo_date` (TEXT NOT NULL): Date when the photo was taken/imported
- `star` (INTEGER NOT NULL DEFAULT 0): Star rating (0-5) 
- `comment` (TEXT NOT NULL DEFAULT ''): User comment
- `created_at` (TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'): Record creation timestamp
- `updated_at` (TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'): Record last update timestamp

### Integration Fields
- `google_photos_url` (TEXT): URL of the photo in Google Photos (if uploaded)
- `css_style` (TEXT): CSS styling for image editor transformations

### EXIF Data Fields
All EXIF fields are stored as TEXT and can be NULL:

#### Camera Information
- `exif_make`: Camera manufacturer
- `exif_model`: Camera model
- `exif_lens_make`: Lens manufacturer
- `exif_lens_model`: Lens model

#### Exposure Settings
- `exif_iso`: ISO sensitivity
- `exif_fnumber`: F-number/aperture
- `exif_exposure_time`: Shutter speed
- `exif_shutter_speed_value`: Shutter speed value
- `exif_exposure_mode`: Exposure mode

#### Technical Details
- `exif_focal_length`: Focal length
- `exif_focal_length_in35mm_film`: 35mm equivalent focal length
- `exif_digital_zoom_ratio`: Digital zoom ratio
- `exif_white_balance_mode`: White balance mode
- `exif_orientation`: Image orientation

#### Resolution and Quality
- `exif_xresolution`: Horizontal resolution
- `exif_yresolution`: Vertical resolution
- `exif_resolution_unit`: Resolution unit

#### Date and Copyright
- `exif_date_time`: Last modification date
- `exif_date_time_original`: Original capture date
- `exif_copyright`: Copyright information

## Database Migration

The database schema automatically migrates when new columns are added. Migration steps:

1. Check existing column structure
2. Create new table with updated schema
3. Copy data from old table to new table
4. Drop old table and rename new table
5. Recreate indexes

## Job Queue Tables

See [Job Queue System Documentation](job-queue-system.md) for job queue related tables.

## Unified Collection System (Albums & Tags)

PhotoClove uses a unified collection system that treats albums and tags as different types of collections.

### Photo Collections Table
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique collection identifier
- `type` (TEXT NOT NULL): Collection type ('album' or 'tag')
- `name` (TEXT NOT NULL): Collection name
- `description` (TEXT): Description (albums only)
- `color` (TEXT): Hex color code (tags only)
- `cover_photo_path` (TEXT): Path to cover photo (albums only)
- `settings` (TEXT): JSON settings object
- `created_at` (TEXT NOT NULL): Creation timestamp
- `updated_at` (TEXT NOT NULL): Last update timestamp

### Photo Collection Items Table (Many-to-Many Relationship)
- `collection_id` (INTEGER): Foreign key to photo_collections.id
- `photo_path` (TEXT): Foreign key to photo_metadata.path
- `order_index` (INTEGER): Display order (albums only)
- `added_at` (TEXT NOT NULL): Timestamp when photo was added
- Primary key: (collection_id, photo_path)
- Cascading deletes: When collection or photo is deleted, associations are automatically removed

### Date Summary Table (Performance Optimization)
- `date` (TEXT PRIMARY KEY): Date in YYYY-MM-DD format
- `photo_count` (INTEGER NOT NULL): Number of photos for this date
- `created_at` (TEXT NOT NULL): Creation timestamp
- `updated_at` (TEXT NOT NULL): Last update timestamp

## Legacy Tables (Backward Compatibility)

### Tags Table (Legacy)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique tag identifier
- `name` (TEXT NOT NULL UNIQUE): Tag name (e.g., "vacation", "family")
- `color` (TEXT): Optional hex color code for visual organization
- `created_at` (TEXT NOT NULL): Timestamp when tag was created

### Photo Tags Table (Legacy)
- `photo_path` (TEXT): Foreign key to photo_metadata.path
- `tag_id` (INTEGER): Foreign key to tags.id
- `created_at` (TEXT NOT NULL): Timestamp when tag was assigned
- Primary key: (photo_path, tag_id)

### Albums Table (Legacy)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique album identifier
- `name` (TEXT NOT NULL): Album name
- `description` (TEXT): Album description
- `cover_photo_path` (TEXT): Path to album cover photo
- `created_at` (TEXT NOT NULL): Creation timestamp
- `updated_at` (TEXT NOT NULL): Last update timestamp

### Album Photos Table (Legacy)
- `album_id` (INTEGER): Foreign key to albums.id
- `photo_path` (TEXT): Foreign key to photo_metadata.path
- `order_index` (INTEGER): Display order in album
- `added_at` (TEXT NOT NULL): Timestamp when photo was added
- Primary key: (album_id, photo_path)

## Recovery Queue Table

The recovery queue stores operations that failed and can be retried later by the user.

### Recovery Queue Fields
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique identifier
- `operation_type` (TEXT NOT NULL): Type of failed operation ('move_to_trash', 'restore', 'import', 'permanently_delete')
- `target_path` (TEXT NOT NULL): Target path (meaning varies by operation type)
- `error_reason` (TEXT NOT NULL): Description of why the operation failed
- `failed_at` (TEXT NOT NULL): Timestamp when the operation failed
- `retry_count` (INTEGER DEFAULT 0): Number of retry attempts
- `last_retry_at` (TEXT): Timestamp of last retry attempt
- `status` (TEXT DEFAULT 'pending'): Current status ('pending', 'resolved', 'discarded')
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP): Record creation timestamp
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP): Record last update timestamp

### Recovery Queue Indexes
- `idx_recovery_queue_status`: Index on status for filtering by operation state
- `idx_recovery_queue_operation`: Index on operation_type for filtering by operation type

## Burst Groups Table

Burst groups track photos taken in rapid succession. Groups can be created automatically during import based on camera metadata or manually by the user.

### Burst Groups Fields
- `id` (TEXT PRIMARY KEY): Unique group identifier
- `is_manual` (INTEGER DEFAULT 0): Whether the group was manually created (0 = automatic, 1 = manual)
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP): Group creation timestamp

### Burst Groups Indexes
- `idx_burst_groups_is_manual`: Index on is_manual for filtering automatic vs manual groups
- `idx_photo_camera_datetime`: Composite index on photo_metadata(exif_make, exif_model, exif_date_time_original) for efficient camera-based grouping queries

## Storage Sync Column

The `storage_sync` column in photo_metadata tracks synchronization status across multiple storage providers.

### Storage Sync Field
- `storage_sync` (TEXT DEFAULT NULL): JSON data containing sync status for various storage providers (e.g., Google Photos, cloud backups)

### Storage Sync Index
- `idx_storage_sync`: Index on storage_sync for efficient queries on synced photos

## Indexes

### Performance Indexes
- `idx_photo_date`: Index on photo_date column for fast date-based queries
- `idx_collection_type`: Index on photo_collections.type for fast collection type filtering
- `idx_collection_items_photo`: Index on photo_collection_items.photo_path for fast photo lookups
- `idx_collection_items_collection`: Index on photo_collection_items.collection_id for fast collection lookups
- `idx_recovery_queue_status`: Index on recovery_queue.status for filtering by operation state
- `idx_recovery_queue_operation`: Index on recovery_queue.operation_type for filtering by operation type
- `idx_burst_groups_is_manual`: Index on burst_groups.is_manual for filtering automatic vs manual groups
- `idx_photo_camera_datetime`: Composite index for camera-based burst grouping queries
- `idx_storage_sync`: Index on photo_metadata.storage_sync for synced photo queries
