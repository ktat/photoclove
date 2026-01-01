-- Create photo_collections table (unified albums/tags)
CREATE TABLE IF NOT EXISTS photo_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('album', 'tag')),
    name TEXT NOT NULL,
    color TEXT,
    description TEXT,
    cover_photo_path TEXT,
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type),
    FOREIGN KEY (cover_photo_path) REFERENCES photo_metadata(path) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_type ON photo_collections(type);
CREATE INDEX IF NOT EXISTS idx_collections_name ON photo_collections(name);

-- Create photo_collection_items table
CREATE TABLE IF NOT EXISTS photo_collection_items (
    collection_id INTEGER,
    photo_path TEXT,
    order_index INTEGER DEFAULT 0,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (collection_id, photo_path),
    FOREIGN KEY (collection_id) REFERENCES photo_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_path) REFERENCES photo_metadata(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON photo_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_photo_path ON photo_collection_items(photo_path);
CREATE INDEX IF NOT EXISTS idx_collection_items_order ON photo_collection_items(collection_id, order_index);
