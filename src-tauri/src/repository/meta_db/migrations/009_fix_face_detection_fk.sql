-- Fix Face Detection Table: Remove Foreign Key Constraints
-- Migration 009: Recreate detected_faces table without foreign keys

-- Drop old table and indexes
DROP INDEX IF EXISTS idx_faces_photo_path;
DROP INDEX IF EXISTS idx_faces_person_id;
DROP INDEX IF EXISTS idx_faces_cluster_id;
DROP TABLE IF EXISTS detected_faces;

-- Recreate detected faces table without foreign keys
CREATE TABLE IF NOT EXISTS detected_faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_path TEXT NOT NULL,               -- Reference to photo_metadata.path
    -- Bounding box (normalized 0-1 coordinates)
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_width REAL NOT NULL,
    bbox_height REAL NOT NULL,
    -- Detection metadata
    confidence REAL NOT NULL,               -- Detection confidence (0-1)
    -- Face embedding (512-dim ArcFace vector as JSON array)
    embedding TEXT,                         -- JSON array of floats
    -- Person association
    person_id INTEGER,                      -- NULL until clustered/identified
    -- Clustering metadata
    cluster_id INTEGER,                     -- Temporary cluster ID before person assignment
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    -- Note: Foreign keys removed to avoid SQLite foreign key mismatch issues
    -- Referential integrity is handled at application level
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_faces_photo_path ON detected_faces(photo_path);
CREATE INDEX IF NOT EXISTS idx_faces_person_id ON detected_faces(person_id);
CREATE INDEX IF NOT EXISTS idx_faces_cluster_id ON detected_faces(cluster_id);
