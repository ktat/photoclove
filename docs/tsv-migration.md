# TSV to SQLite Migration

This document describes the migration functionality added to PhotoClove to migrate photo metadata from TSV files to SQLite database.

## Overview

PhotoClove originally stored photo metadata in TSV (Tab-Separated Values) files located in each date directory as `.photoclove-dir-info.tsv`. To improve performance and data integrity, the application now uses SQLite database for metadata storage.

## Migration Features

### Automatic TSV Discovery
- Recursively scans directory tree for `.photoclove-dir-info.tsv` files
- Processes all found TSV files in a single migration operation

### Data Preservation
- Migrates all photo metadata: path, date, star rating, and comments
- Uses `INSERT OR REPLACE` to handle duplicate entries
- Maintains data integrity during migration process

### Error Handling
- Continues migration even if individual files fail to parse
- Reports errors for problematic files while completing successful migrations
- Provides detailed progress reporting

## TSV File Format

The original TSV files contain the following columns:
```
path	date	star	comment
```

Example:
```
/path/to/photo.jpg	2023/01/01 12:00:00	3	Beautiful sunset
```

## SQLite Schema

The migrated data is stored in the `photo_metadata` table with improved schema:

```sql
CREATE TABLE photo_metadata (
    path TEXT PRIMARY KEY,
    photo_date TEXT NOT NULL,
    star INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_photo_date ON photo_metadata(photo_date);
```

### Schema Improvements
- **Column rename**: `date` → `photo_date` to avoid conflict with SQLite's `date()` function
- **Date format**: Standardized to "yyyy-mm-dd hh:mm:ss" format (ISO 8601 compatible)
- **Automatic migration**: Existing databases are automatically upgraded to new schema
- **Index optimization**: Efficient date-based queries using `date(photo_date)` function

## Usage

### Frontend Interface
1. Open PhotoClove application
2. Click on the **"File"** menu in the menu bar
3. Select **"Migrate TSV to SQLite"** from the dropdown
4. Confirm the migration in the dialog
5. Wait for completion message with migration results

### Programmatic Usage
```rust
use crate::repository::meta_db::sqlite::SQLite;

let sqlite_db = SQLite::new("/path/to/data/directory".to_string());
match sqlite_db.migrate_from_tsv_files("/path/to/scan") {
    Ok(count) => println!("Migrated {} records", count),
    Err(e) => eprintln!("Migration failed: {}", e),
}
```

## Performance Benefits

After migration to SQLite:
- **Faster queries**: Indexed database queries vs. file system scans
- **Better concurrency**: SQLite handles concurrent access safely
- **ACID compliance**: Atomic operations ensure data consistency
- **Reduced I/O**: Single database file vs. multiple TSV files
- **Query capabilities**: SQL queries for complex filtering and searching
- **Optimized aggregation**: GROUP BY queries for efficient photo counts
- **Date handling**: Native date functions for reliable date comparisons

## Migration Statistics

Example migration from PhotoClove test data:
- **Source**: 8 TSV files across multiple date directories
- **Records migrated**: 411 photo metadata entries
- **Processing time**: Near-instantaneous for small datasets
- **Success rate**: 100% for well-formed TSV files

## Post-Migration

After successful migration:
1. The SQLite database is ready for use
2. Original TSV files remain unchanged (not deleted)
3. Application automatically uses SQLite for new metadata operations
4. Existing functionality works without changes

## Troubleshooting

### Common Issues
- **Permission errors**: Ensure write access to target directory
- **Disk space**: Verify sufficient space for SQLite database
- **Path issues**: Use absolute paths for reliability

### Verification
Check migration success by querying the database:
```bash
# Check total records
sqlite3 /path/to/photoclove.db "SELECT COUNT(*) FROM photo_metadata;"

# Check date format and sample data
sqlite3 /path/to/photoclove.db "SELECT DISTINCT date(photo_date) FROM photo_metadata ORDER BY photo_date LIMIT 5;"

# Verify photo counts per date
sqlite3 /path/to/photoclove.db "SELECT date(photo_date), COUNT(*) FROM photo_metadata GROUP BY date(photo_date);"
```

## Recent Improvements (v2.0)

### Database Schema Migration
- **Automatic upgrade**: Existing databases are automatically migrated from old schema
- **Zero downtime**: Migration happens transparently during application startup
- **Data preservation**: All existing metadata is preserved during schema upgrade
- **Format conversion**: Date formats are automatically converted from "yyyy/mm/dd" to "yyyy-mm-dd"

### Query Optimization
- **GROUP BY aggregation**: Photo count queries now use efficient GROUP BY instead of multiple individual queries
- **Single query execution**: All date counts retrieved in one database operation
- **Reduced overhead**: Eliminates N+1 query performance issues

### Error Handling & Initialization Improvements
- **Graceful degradation**: Fallback to basic table creation if migration fails
- **Comprehensive logging**: Detailed debug output for troubleshooting
- **Non-blocking errors**: Application continues even if database initialization has issues
- **Enhanced table detection**: Improved table existence checking using `sqlite_master` query instead of `PRAGMA table_info`
- **Directory creation**: Automatic creation of parent directories for database files
- **Schema-less database support**: Fixed initialization failures when SQLite files exist without schemas
- **Robust fallback**: Complete index creation in fallback initialization paths

## Technical Implementation

### Key Components
- `SQLite::migrate_from_tsv_files()`: Main migration function
- `SQLite::init_db()`: Database initialization and schema migration
- `find_tsv_files()`: Recursive file discovery
- `migrate_single_tsv_file()`: Individual file processing
- `get_photo_count_per_dates()`: Optimized GROUP BY query implementation
- `migrate_tsv_to_sqlite`: Tauri command for frontend access

### Dependencies
- `csv` crate for TSV parsing
- `rusqlite` for SQLite operations
- `std::fs` for file system operations
- `std::collections::HashMap` for efficient data mapping