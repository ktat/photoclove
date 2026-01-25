-- Migration 010: Add photo_id to photo_metadata and create face mapping table
-- This normalizes the relationship between photos and detected faces

-- Step 1: Create new photo_metadata table with id column
CREATE TABLE IF NOT EXISTS photo_metadata_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
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
    delete_flg INTEGER NOT NULL DEFAULT 0
);

-- Step 2: Copy data from old table
INSERT INTO photo_metadata_new (
    path, photo_date, star, comment, created_at, updated_at,
    google_photos_url, exif_iso, exif_fnumber, exif_date_time,
    exif_date_time_original, exif_lens_model, exif_make, exif_lens_make,
    exif_model, exif_xresolution, exif_yresolution, exif_resolution_unit,
    exif_copyright, exif_exposure_time, exif_shutter_speed_value,
    exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio,
    exif_exposure_mode, exif_white_balance_mode, exif_orientation,
    css_style, delete_flg
)
SELECT
    path, photo_date, star, comment, created_at, updated_at,
    google_photos_url, exif_iso, exif_fnumber, exif_date_time,
    exif_date_time_original, exif_lens_model, exif_make, exif_lens_make,
    exif_model, exif_xresolution, exif_yresolution, exif_resolution_unit,
    exif_copyright, exif_exposure_time, exif_shutter_speed_value,
    exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio,
    exif_exposure_mode, exif_white_balance_mode, exif_orientation,
    css_style, delete_flg
FROM photo_metadata;

-- Step 3: Drop old table and rename new one
DROP TABLE IF EXISTS photo_metadata;
ALTER TABLE photo_metadata_new RENAME TO photo_metadata;

-- Step 4: Recreate indexes for photo_metadata
CREATE INDEX IF NOT EXISTS idx_photo_path ON photo_metadata(path);
CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date);
CREATE INDEX IF NOT EXISTS idx_exif_date_time_original ON photo_metadata(exif_date_time_original);
CREATE INDEX IF NOT EXISTS idx_star ON photo_metadata(star);
CREATE INDEX IF NOT EXISTS idx_search_composite ON photo_metadata(exif_date_time_original, star, photo_date);
CREATE INDEX IF NOT EXISTS idx_photo_date_delete_flg ON photo_metadata(photo_date, delete_flg);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_delete_flg ON photo_metadata(delete_flg);

-- Step 5: Create photo_detected_faces mapping table
CREATE TABLE IF NOT EXISTS photo_detected_faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    detected_face_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(photo_id, detected_face_id)
);

-- Step 6: Migrate existing face-photo relationships
INSERT INTO photo_detected_faces (photo_id, detected_face_id)
SELECT pm.id, df.id
FROM detected_faces df
JOIN photo_metadata pm ON df.photo_path = pm.path;

-- Step 7: Create new detected_faces table without photo_path
CREATE TABLE IF NOT EXISTS detected_faces_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Bounding box (normalized 0-1 coordinates)
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_width REAL NOT NULL,
    bbox_height REAL NOT NULL,
    -- Detection metadata
    confidence REAL NOT NULL,
    -- Face embedding (512-dim ArcFace vector as JSON array)
    embedding TEXT,
    -- Person association
    person_id INTEGER,
    -- Clustering metadata
    cluster_id INTEGER,
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 8: Copy face data (preserving id)
INSERT INTO detected_faces_new (id, bbox_x, bbox_y, bbox_width, bbox_height, confidence, embedding, person_id, cluster_id, created_at)
SELECT id, bbox_x, bbox_y, bbox_width, bbox_height, confidence, embedding, person_id, cluster_id, created_at
FROM detected_faces;

-- Step 9: Drop old detected_faces and rename
DROP INDEX IF EXISTS idx_faces_photo_path;
DROP INDEX IF EXISTS idx_faces_person_id;
DROP INDEX IF EXISTS idx_faces_cluster_id;
DROP TABLE IF EXISTS detected_faces;
ALTER TABLE detected_faces_new RENAME TO detected_faces;

-- Step 10: Recreate indexes for detected_faces
CREATE INDEX IF NOT EXISTS idx_faces_person_id ON detected_faces(person_id);
CREATE INDEX IF NOT EXISTS idx_faces_cluster_id ON detected_faces(cluster_id);

-- Step 11: Create indexes for mapping table
CREATE INDEX IF NOT EXISTS idx_photo_faces_photo_id ON photo_detected_faces(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_faces_face_id ON photo_detected_faces(detected_face_id);
