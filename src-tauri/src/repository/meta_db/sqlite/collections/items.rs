//! Collection item operations (add/remove photos, reorder, bulk operations)

use crate::repository::meta_db::sqlite::SQLite;
use crate::value::date;
use rusqlite::{params, Connection};

/// Get the next order_index for a collection
pub(crate) fn get_next_order_index(conn: &Connection, collection_id: i32) -> i32 {
    conn.query_row(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM photo_collection_items WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

pub(crate) fn add_photo_to_collection(
    sqlite: &SQLite,
    collection_id: i32,
    photo_path: &str,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = date::DateTime::now().to_db_string();
    let order_index = get_next_order_index(&conn, collection_id);

    conn.execute(
        "INSERT OR IGNORE INTO photo_collection_items (collection_id, photo_path, order_index, added_at) VALUES (?1, ?2, ?3, ?4)",
        params![collection_id, photo_path, order_index, now],
    ).map_err(|e| format!("Failed to add photo to collection: {}", e))?;

    Ok(())
}

/// Bulk insert photos to a collection
/// SQLite has a limit of 999 variables per query (SQLITE_LIMIT_VARIABLE_NUMBER)
/// Each row needs 4 variables, so we batch at 200 rows to be safe
const BULK_INSERT_BATCH_SIZE: usize = 200;

pub(crate) fn add_photos_to_collection_bulk(
    sqlite: &SQLite,
    collection_id: i32,
    photo_paths: &[String],
) -> Result<usize, String> {
    if photo_paths.is_empty() {
        return Ok(0);
    }

    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    // 1. Get existing photos in this collection
    let mut existing_stmt = conn
        .prepare("SELECT photo_path FROM photo_collection_items WHERE collection_id = ?1")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let existing_paths: std::collections::HashSet<String> = existing_stmt
        .query_map(params![collection_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query existing photos: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    log::debug!(target: "collections", "bulk_insert_existing_check; collection_id={}; existing_count={}; requested_count={}",
        collection_id, existing_paths.len(), photo_paths.len());

    // 2. Filter out already existing photos
    let new_paths: Vec<&String> = photo_paths
        .iter()
        .filter(|p| !existing_paths.contains(*p))
        .collect();

    if new_paths.is_empty() {
        log::info!(target: "collections", "bulk_insert_all_exist; collection_id={}; all photos already in collection", collection_id);
        return Ok(0);
    }

    log::info!(target: "collections", "bulk_insert_filtered; collection_id={}; new_count={}; skipped_count={}",
        collection_id, new_paths.len(), photo_paths.len() - new_paths.len());

    // 3. Get the starting order_index
    let start_order_index = get_next_order_index(&conn, collection_id);

    let now = date::DateTime::now().to_db_string();
    let mut total_inserted = 0;

    // 4. Batch insert
    for (batch_idx, chunk) in new_paths.chunks(BULK_INSERT_BATCH_SIZE).enumerate() {
        // Build INSERT statement with multiple VALUES
        let placeholders: Vec<String> = chunk
            .iter()
            .enumerate()
            .map(|(i, _)| {
                let base = i * 4;
                format!(
                    "(?{}, ?{}, ?{}, ?{})",
                    base + 1,
                    base + 2,
                    base + 3,
                    base + 4
                )
            })
            .collect();

        let sql = format!(
            "INSERT OR IGNORE INTO photo_collection_items (collection_id, photo_path, order_index, added_at) VALUES {}",
            placeholders.join(", ")
        );

        // Build params
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        for (i, path) in chunk.iter().enumerate() {
            let order_index = start_order_index + (batch_idx * BULK_INSERT_BATCH_SIZE + i) as i32;
            params_vec.push(Box::new(collection_id));
            params_vec.push(Box::new((*path).clone()));
            params_vec.push(Box::new(order_index));
            params_vec.push(Box::new(now.clone()));
        }

        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let rows_affected = conn
            .execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("Failed to bulk insert photos: {}", e))?;

        total_inserted += rows_affected;

        log::debug!(target: "collections", "bulk_insert_batch; collection_id={}; batch={}; batch_size={}; rows_affected={}",
            collection_id, batch_idx, chunk.len(), rows_affected);
    }

    log::info!(target: "collections", "bulk_insert_complete; collection_id={}; total_inserted={}", collection_id, total_inserted);

    Ok(total_inserted)
}

pub(crate) fn remove_photo_from_collection(
    sqlite: &SQLite,
    collection_id: i32,
    photo_path: &str,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    conn.execute(
        "DELETE FROM photo_collection_items WHERE collection_id = ?1 AND photo_path = ?2",
        params![collection_id, photo_path],
    )
    .map_err(|e| format!("Failed to remove photo from collection: {}", e))?;

    Ok(())
}

/// Reorder items within a collection by updating their order_index values
pub(crate) fn reorder_collection_items(
    sqlite: &SQLite,
    collection_id: i32,
    photo_order: Vec<String>,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = date::DateTime::now().to_db_string();

    // Update each photo's order_index based on position in the array
    for (index, photo_path) in photo_order.iter().enumerate() {
        conn.execute(
            "UPDATE photo_collection_items SET order_index = ?1 WHERE collection_id = ?2 AND photo_path = ?3",
            params![index as i32, collection_id, photo_path],
        )
        .map_err(|e| format!("Failed to update order for photo {}: {}", photo_path, e))?;
    }

    // Update the collection's updated_at timestamp
    conn.execute(
        "UPDATE photo_collections SET updated_at = ?1 WHERE id = ?2",
        params![now, collection_id],
    )
    .map_err(|e| format!("Failed to update collection timestamp: {}", e))?;

    log::info!(target: "collections", "reorder_complete; collection_id={}; items_reordered={}", collection_id, photo_order.len());

    Ok(())
}

/// Remove all collections of a specific type from a photo
///
/// # Arguments
/// * `sqlite` - Database connection
/// * `photo_path` - Path to the photo
/// * `collection_type` - Optional filter: "album", "tag", or None for all
///
/// # Returns
/// Number of collections removed
pub(crate) fn remove_all_collections_from_photo(
    sqlite: &SQLite,
    photo_path: &str,
    collection_type: Option<&str>,
) -> Result<i32, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let rows_affected = match collection_type {
        Some(t) => conn.execute(
            "DELETE FROM photo_collection_items
             WHERE photo_path = ?1
             AND collection_id IN (SELECT id FROM photo_collections WHERE type = ?2)",
            params![photo_path, t],
        ),
        None => conn.execute(
            "DELETE FROM photo_collection_items WHERE photo_path = ?1",
            params![photo_path],
        ),
    }
    .map_err(|e| format!("Failed to remove collections from photo: {}", e))?;

    log::info!(target: "collections", "remove_all_from_photo; photo={}; type={:?}; removed={}",
        photo_path, collection_type, rows_affected);

    Ok(rows_affected as i32)
}

/// Add a photo to a collection with optional metadata
///
/// # Arguments
/// * `sqlite` - Database connection
/// * `collection_id` - Collection ID
/// * `photo_path` - Path to the photo
/// * `metadata` - Optional JSON metadata string
pub(crate) fn add_photo_to_collection_with_metadata(
    sqlite: &SQLite,
    collection_id: i32,
    photo_path: &str,
    metadata: Option<String>,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = date::DateTime::now().to_db_string();
    let order_index = get_next_order_index(&conn, collection_id);

    // Use INSERT OR REPLACE to update metadata if photo already exists
    conn.execute(
        "INSERT INTO photo_collection_items (collection_id, photo_path, order_index, added_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(collection_id, photo_path) DO UPDATE SET metadata = ?5",
        params![collection_id, photo_path, order_index, now, metadata],
    )
    .map_err(|e| format!("Failed to add photo to collection with metadata: {}", e))?;

    log::debug!(target: "collections", "add_with_metadata; collection_id={}; photo={}; has_metadata={}",
        collection_id, photo_path, metadata.is_some());

    Ok(())
}
