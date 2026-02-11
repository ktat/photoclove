#!/bin/bash
#
# Migrate PhotoClove database paths from absolute to relative.
#
# Converts paths like "/mnt/nas/photos/2024-01-15/uuid/photo.jpg"
# to relative paths like "2024-01-15/uuid/photo.jpg" by stripping the import_to prefix.
#
# Usage:
#   ./migrate-to-relative-paths.sh <db_file> <import_to_path>
#
# Example:
#   ./migrate-to-relative-paths.sh /mnt/nas/photos/.photoclove/meta.db /mnt/nas/photos
#
# Tables updated:
#   - photo_metadata.path (PRIMARY KEY)
#   - photo_collection_items.photo_path
#   - photo_collections.cover_photo_path
#
# A backup (.bak) is created automatically before migration.

set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Usage: $0 <db_file> <import_to_path>"
    echo ""
    echo "  db_file        Path to the SQLite database file"
    echo "  import_to_path The import_to path prefix to strip (e.g., /mnt/nas/photos)"
    exit 1
fi

DB_FILE="$1"
IMPORT_TO="$2"

# Validate inputs
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file not found: $DB_FILE"
    exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
    echo "Error: sqlite3 command not found. Please install sqlite3."
    exit 1
fi

# Normalize import_to: ensure it ends with /
IMPORT_TO_NORMALIZED="${IMPORT_TO%/}/"

# Also handle Windows-style paths (backslashes)
IMPORT_TO_WIN=$(echo "$IMPORT_TO_NORMALIZED" | sed 's|/|\\\\|g')

echo "=== PhotoClove Path Migration ==="
echo "Database: $DB_FILE"
echo "Import path to strip: $IMPORT_TO_NORMALIZED"
echo ""

# Create backup
BACKUP_FILE="${DB_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$DB_FILE" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"
echo ""

# Count affected rows before migration
echo "--- Pre-migration counts ---"
TOTAL_PHOTOS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM photo_metadata WHERE path LIKE '${IMPORT_TO_NORMALIZED}%' OR path LIKE '${IMPORT_TO_WIN}%';")
TOTAL_ITEMS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM photo_collection_items WHERE photo_path LIKE '${IMPORT_TO_NORMALIZED}%' OR photo_path LIKE '${IMPORT_TO_WIN}%';")
TOTAL_COVERS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM photo_collections WHERE cover_photo_path LIKE '${IMPORT_TO_NORMALIZED}%' OR cover_photo_path LIKE '${IMPORT_TO_WIN}%';")

echo "photo_metadata paths to migrate: $TOTAL_PHOTOS"
echo "photo_collection_items paths to migrate: $TOTAL_ITEMS"
echo "photo_collections cover paths to migrate: $TOTAL_COVERS"
echo ""

if [ "$TOTAL_PHOTOS" -eq 0 ] && [ "$TOTAL_ITEMS" -eq 0 ] && [ "$TOTAL_COVERS" -eq 0 ]; then
    echo "No paths found with prefix '$IMPORT_TO_NORMALIZED'. Nothing to migrate."
    echo "Paths may already be relative, or the import_to path is incorrect."
    # Show sample paths for debugging
    echo ""
    echo "Sample paths in database:"
    sqlite3 "$DB_FILE" "SELECT path FROM photo_metadata LIMIT 3;"
    exit 0
fi

# Calculate length of prefix to strip
PREFIX_LEN=${#IMPORT_TO_NORMALIZED}

echo "--- Running migration ---"

# Run all updates in a single transaction for atomicity
sqlite3 "$DB_FILE" <<EOF
BEGIN TRANSACTION;

-- Disable foreign key checks during migration (we're updating PKs)
PRAGMA foreign_keys = OFF;

-- Step 1: Update photo_collection_items.photo_path (FK references photo_metadata.path)
UPDATE photo_collection_items
SET photo_path = REPLACE(REPLACE(photo_path, '${IMPORT_TO_NORMALIZED}', ''), '\\', '/')
WHERE photo_path LIKE '${IMPORT_TO_NORMALIZED}%';

-- Also handle Windows-style paths
UPDATE photo_collection_items
SET photo_path = REPLACE(REPLACE(photo_path, '${IMPORT_TO_WIN}', ''), '\\', '/')
WHERE photo_path LIKE '${IMPORT_TO_WIN}%';

-- Step 2: Update photo_collections.cover_photo_path
UPDATE photo_collections
SET cover_photo_path = REPLACE(REPLACE(cover_photo_path, '${IMPORT_TO_NORMALIZED}', ''), '\\', '/')
WHERE cover_photo_path LIKE '${IMPORT_TO_NORMALIZED}%';

UPDATE photo_collections
SET cover_photo_path = REPLACE(REPLACE(cover_photo_path, '${IMPORT_TO_WIN}', ''), '\\', '/')
WHERE cover_photo_path LIKE '${IMPORT_TO_WIN}%';

-- Step 3: Update photo_metadata.path (PRIMARY KEY)
UPDATE photo_metadata
SET path = REPLACE(REPLACE(path, '${IMPORT_TO_NORMALIZED}', ''), '\\', '/')
WHERE path LIKE '${IMPORT_TO_NORMALIZED}%';

UPDATE photo_metadata
SET path = REPLACE(REPLACE(path, '${IMPORT_TO_WIN}', ''), '\\', '/')
WHERE path LIKE '${IMPORT_TO_WIN}%';

-- Normalize any remaining backslashes to forward slashes
UPDATE photo_metadata SET path = REPLACE(path, '\\', '/') WHERE path LIKE '%\\%';
UPDATE photo_collection_items SET photo_path = REPLACE(photo_path, '\\', '/') WHERE photo_path LIKE '%\\%';
UPDATE photo_collections SET cover_photo_path = REPLACE(cover_photo_path, '\\', '/') WHERE cover_photo_path LIKE '%\\%';

-- Strip any leading slashes from relative paths
UPDATE photo_metadata SET path = LTRIM(path, '/') WHERE path LIKE '/%';
UPDATE photo_collection_items SET photo_path = LTRIM(photo_path, '/') WHERE photo_path LIKE '/%';
UPDATE photo_collections SET cover_photo_path = LTRIM(cover_photo_path, '/') WHERE cover_photo_path IS NOT NULL AND cover_photo_path LIKE '/%';

PRAGMA foreign_keys = ON;

COMMIT;
EOF

echo ""
echo "--- Post-migration verification ---"

# Verify no absolute paths remain
REMAINING_ABS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM photo_metadata WHERE path LIKE '/%' OR path LIKE '\\%';")
echo "Remaining absolute paths in photo_metadata: $REMAINING_ABS"

# Show sample migrated paths
echo ""
echo "Sample migrated paths:"
sqlite3 "$DB_FILE" "SELECT path FROM photo_metadata LIMIT 5;"

echo ""
if [ "$REMAINING_ABS" -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "WARNING: $REMAINING_ABS paths still appear absolute. Please verify manually."
fi

echo ""
echo "Backup file: $BACKUP_FILE"
echo "To restore: cp '$BACKUP_FILE' '$DB_FILE'"
