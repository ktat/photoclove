-- Initial schema for photo_metadata table
CREATE TABLE IF NOT EXISTS photo_metadata (
    path TEXT PRIMARY KEY,
    photo_date TEXT NOT NULL,
    star INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    google_photos_url TEXT,
    exif_iso TEXT,
    exif_fnumber TEXT,
    exif_date_time TEXT,
    exif_date_time_original TEXT,
    exif_lens_model TEXT,
    exif_make TEXT,
    exif_lens_make TEXT,
    exif_model TEXT,
    exif_xresolution TEXT,
    exif_yresolution TEXT,
    exif_resolution_unit TEXT,
    exif_copyright TEXT,
    exif_exposure_time TEXT,
    exif_shutter_speed_value TEXT,
    exif_focal_length TEXT,
    exif_focal_length_in35mm_film TEXT,
    exif_digital_zoom_ratio TEXT,
    exif_exposure_mode TEXT,
    exif_white_balance_mode TEXT,
    exif_orientation TEXT,
    css_style TEXT,
    delete_flg INTEGER NOT NULL DEFAULT 0,
    burst_group_id TEXT,
    storage_sync TEXT
);

-- Create indexes for photo_metadata
CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date);
CREATE INDEX IF NOT EXISTS idx_exif_date_time_original ON photo_metadata(exif_date_time_original);
CREATE INDEX IF NOT EXISTS idx_star ON photo_metadata(star);
CREATE INDEX IF NOT EXISTS idx_search_composite ON photo_metadata(exif_date_time_original, star, photo_date);
CREATE INDEX IF NOT EXISTS idx_photo_date_delete_flg ON photo_metadata(photo_date, delete_flg);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_delete_flg ON photo_metadata(delete_flg);
CREATE INDEX IF NOT EXISTS idx_burst_group_id ON photo_metadata(burst_group_id);
CREATE INDEX IF NOT EXISTS idx_storage_sync ON photo_metadata(storage_sync);
