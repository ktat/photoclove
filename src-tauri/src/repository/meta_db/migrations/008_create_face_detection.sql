-- Face Detection Tables
-- Migration 008: Create tables for face detection and person management

-- Persons table: Master table for identified people
CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,                              -- User-assigned name (nullable until identified)
    representative_face_id INTEGER,         -- Best face for this person (set later)
    photo_count INTEGER DEFAULT 0,          -- Cached count of photos with this person
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Detected faces table: Individual face detections in photos
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

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_faces_photo_path ON detected_faces(photo_path);
CREATE INDEX IF NOT EXISTS idx_faces_person_id ON detected_faces(person_id);
CREATE INDEX IF NOT EXISTS idx_faces_cluster_id ON detected_faces(cluster_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
