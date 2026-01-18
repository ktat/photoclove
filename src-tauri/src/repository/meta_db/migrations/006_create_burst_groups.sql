-- Burst Groups table for grouping photos taken in rapid succession
-- Groups are created automatically during import or manually by user

CREATE TABLE IF NOT EXISTS burst_groups (
    id TEXT PRIMARY KEY,
    is_manual INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient group queries
CREATE INDEX IF NOT EXISTS idx_burst_groups_is_manual ON burst_groups(is_manual);

-- Create composite index for camera-based grouping queries (exif_make + exif_model + exif_date_time_original)
CREATE INDEX IF NOT EXISTS idx_photo_camera_datetime ON photo_metadata(exif_make, exif_model, exif_date_time_original)
