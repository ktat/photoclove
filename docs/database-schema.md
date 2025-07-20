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

## Tag Tables

PhotoClove includes a comprehensive tagging system for organizing and categorizing photos.

### Tags Table
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique tag identifier
- `name` (TEXT NOT NULL UNIQUE): Tag name (e.g., "vacation", "family")
- `color` (TEXT): Optional hex color code for visual organization
- `created_at` (TEXT NOT NULL): Timestamp when tag was created

### Photo Tags Table (Many-to-Many Relationship)
- `photo_path` (TEXT): Foreign key to photo_metadata.path
- `tag_id` (INTEGER): Foreign key to tags.id
- `created_at` (TEXT NOT NULL): Timestamp when tag was assigned
- Primary key: (photo_path, tag_id)
- Cascading deletes: When photo or tag is deleted, associations are automatically removed

## Indexes

- `idx_photo_date`: Index on photo_date column for fast date-based queries
- `idx_photo_tags_photo_path`: Index on photo_tags.photo_path for fast tag lookups by photo
- `idx_photo_tags_tag_id`: Index on photo_tags.tag_id for fast photo lookups by tag