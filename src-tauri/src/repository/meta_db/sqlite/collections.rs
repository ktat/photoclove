use crate::entity::{config, photo};
use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::meta_db::sqlite::tags;
use crate::value::{date, file};
use rusqlite::{params, Connection, Result};

/// Get the next order_index for a collection
fn get_next_order_index(conn: &Connection, collection_id: i32) -> i32 {
    conn.query_row(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM photo_collection_items WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

pub(super) fn create_collection(
    sqlite: &SQLite,
    collection_type: &str,
    name: &str,
    description: Option<&str>,
    color: Option<&str>,
) -> Result<i32, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = date::DateTime::now().to_db_string();

    conn.execute(
        "INSERT INTO photo_collections (type, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![collection_type, name, description, color, now, now],
    ).map_err(|e| format!("Failed to create collection: {}", e))?;

    let collection_id = conn.last_insert_rowid() as i32;
    Ok(collection_id)
}

pub(super) fn get_all_collections(
    sqlite: &SQLite,
    collection_type: Option<&str>,
    config: config::Config,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match collection_type {
        Some(ctype) => (
            "SELECT id, type, name, color, description, cover_photo_path, settings, created_at, updated_at,
                    (SELECT COUNT(*) FROM photo_collection_items pci
                     JOIN photo_metadata pm ON pci.photo_path = pm.path
                     WHERE pci.collection_id = photo_collections.id
                       AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)) as photo_count
             FROM photo_collections WHERE type = ?1 ORDER BY name".to_string(),
            vec![Box::new(ctype.to_string())]
        ),
        None => (
            "SELECT id, type, name, color, description, cover_photo_path, settings, created_at, updated_at,
                    (SELECT COUNT(*) FROM photo_collection_items pci
                     JOIN photo_metadata pm ON pci.photo_path = pm.path
                     WHERE pci.collection_id = photo_collections.id
                       AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)) as photo_count
             FROM photo_collections ORDER BY type, name".to_string(),
            vec![]
        )
    };

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Clone config outside the closure for proper capture
    let config_for_closure = config.clone();

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let collection_id: i32 = row.get(0)?;
        let collection_name: String = row.get(2)?;
        let cover_photo_path: Option<String> = row.get(5)?;

        log::debug!(target: "photo_collections", "get_all_collections_row; id={}; name={}; cover_photo_path={:?}",
            collection_id, collection_name, cover_photo_path);

        // Create Photo entity for cover photo if path exists
        let cover_photo_json = if let Some(path) = cover_photo_path {
            log::debug!(target: "photo_collections", "creating_cover_photo; id={}; path={}", collection_id, path);

            let file = file::File::new(path.clone());
            let mut photo = photo::Photo::new(file, Some(config_for_closure.clone()));
            photo.set_has_thumbnail();

            // Get thumbnail path for the cover photo
            let thumbnail_path = if photo.has_thumbnail {
                photo.get_thumbnail_path()
            } else {
                None
            };

            log::debug!(target: "photo_collections", "cover_photo_created; id={}; has_thumbnail={}; thumbnail_path={:?}",
                collection_id, photo.has_thumbnail, thumbnail_path);

            // Create JSON with thumbnail_path field
            let mut photo_json = serde_json::to_value(&photo).unwrap_or_else(|e| {
                log::error!(target: "photo_collections", "photo_json_serialize_failed; id={}; error={}", collection_id, e);
                serde_json::json!({})
            });
            if let Some(obj) = photo_json.as_object_mut() {
                obj.insert("thumbnail_path".to_string(), serde_json::json!(thumbnail_path));
            }

            Some(photo_json)
        } else {
            log::debug!(target: "photo_collections", "no_cover_photo; id={}", collection_id);
            None
        };

        Ok(serde_json::json!({
            "id": row.get::<_, i32>(0)?,
            "type": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "color": row.get::<_, Option<String>>(3)?,
            "description": row.get::<_, Option<String>>(4)?,
            "coverPhoto": cover_photo_json,
            "settings": row.get::<_, String>(6).unwrap_or("{}".to_string()),
            "createdAt": row.get::<_, String>(7)?,
            "updatedAt": row.get::<_, String>(8)?,
            "photoCount": row.get::<_, i32>(9)?
        }))
    }).map_err(|e| format!("Failed to query collections: {}", e))?;

    let mut collections = Vec::new();
    for row in rows {
        collections.push(row.map_err(|e| format!("Failed to process row: {}", e))?);
    }

    Ok(collections)
}

pub(super) fn update_collection(
    sqlite: &SQLite,
    id: i32,
    name: Option<&str>,
    description: Option<&str>,
    color: Option<&str>,
    cover_photo_path: Option<&str>,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = date::DateTime::now().to_db_string();

    // Build separate updates for each field to avoid borrow checker issues
    if let Some(n) = name {
        conn.execute(
            "UPDATE photo_collections SET name = ?, updated_at = ? WHERE id = ?",
            &[&n as &dyn rusqlite::ToSql, &now, &id],
        )
        .map_err(|e| format!("Failed to update collection name: {}", e))?;
    }

    if let Some(d) = description {
        conn.execute(
            "UPDATE photo_collections SET description = ?, updated_at = ? WHERE id = ?",
            &[&d as &dyn rusqlite::ToSql, &now, &id],
        )
        .map_err(|e| format!("Failed to update collection description: {}", e))?;
    }

    if let Some(c) = color {
        conn.execute(
            "UPDATE photo_collections SET color = ?, updated_at = ? WHERE id = ?",
            &[&c as &dyn rusqlite::ToSql, &now, &id],
        )
        .map_err(|e| format!("Failed to update collection color: {}", e))?;
    }

    if let Some(cp) = cover_photo_path {
        conn.execute(
            "UPDATE photo_collections SET cover_photo_path = ?, updated_at = ? WHERE id = ?",
            &[&cp as &dyn rusqlite::ToSql, &now, &id],
        )
        .map_err(|e| format!("Failed to update collection cover photo: {}", e))?;
    }

    Ok(())
}

pub(super) fn delete_collection(sqlite: &SQLite, id: i32) -> Result<bool, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let rows_affected = conn
        .execute("DELETE FROM photo_collections WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete collection: {}", e))?;

    Ok(rows_affected > 0)
}

pub(super) fn add_photo_to_collection(
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

pub(super) fn add_photos_to_collection_bulk(
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
                format!("(?{}, ?{}, ?{}, ?{})", base + 1, base + 2, base + 3, base + 4)
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

        let rows_affected = conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("Failed to bulk insert photos: {}", e))?;

        total_inserted += rows_affected;

        log::debug!(target: "collections", "bulk_insert_batch; collection_id={}; batch={}; batch_size={}; rows_affected={}",
            collection_id, batch_idx, chunk.len(), rows_affected);
    }

    log::info!(target: "collections", "bulk_insert_complete; collection_id={}; total_inserted={}", collection_id, total_inserted);

    Ok(total_inserted)
}

pub(super) fn remove_photo_from_collection(
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

pub(super) fn get_collection_photos(
    sqlite: &SQLite,
    collection_id: i32,
    ordered: bool,
    config: Option<config::Config>,
) -> Result<Vec<photo::Photo>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let order_clause = if ordered {
        "ORDER BY pci.order_index ASC, pci.added_at ASC"
    } else {
        "ORDER BY pci.added_at DESC"
    };

    let query = format!(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.created_at, pm.updated_at,
                pm.google_photos_url, pm.exif_iso, pm.exif_fnumber, pm.exif_date_time,
                pm.exif_date_time_original, pm.exif_lens_model, pm.exif_make, pm.exif_lens_make,
                pm.exif_model, pm.exif_xresolution, pm.exif_yresolution, pm.exif_resolution_unit,
                pm.exif_copyright, pm.exif_exposure_time, pm.exif_shutter_speed_value,
                pm.exif_focal_length, pm.exif_focal_length_in35mm_film, pm.exif_digital_zoom_ratio,
                pm.exif_exposure_mode, pm.exif_white_balance_mode, pm.exif_orientation, pm.css_style,
                pci.order_index, pci.added_at
         FROM photo_collection_items pci
         JOIN photo_metadata pm ON pci.photo_path = pm.path
         WHERE pci.collection_id = ?1
         {}",
        order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let photos = stmt
        .query_map(params![collection_id], |row| {
            let path: String = row.get("path")?;
            let photo_date: String = row.get("photo_date")?;
            let star: i32 = row.get("star")?;
            let comment: String = row.get("comment")?;
            let exif_orientation: Option<String> = row.get("exif_orientation")?;
            let css_style: Option<String> = row.get("css_style")?;

            // Create a file from the path
            let file = file::File::new(path.clone());

            // Create photo with the file and config
            let mut photo = photo::Photo::new(file, config.clone());

            // Set photo time from database
            photo.set_time(photo_date);

            // Set the star and comment from database
            photo.star = if star > 0 { Some(star) } else { None };
            photo.comment = if !comment.is_empty() {
                Some(comment)
            } else {
                None
            };

            // Set orientation from database
            if let Some(ref orientation) = exif_orientation {
                if !orientation.is_empty() {
                    photo.meta_data.orientation = orientation.clone();
                }
            }

            // Set CSS style from database
            photo.css_style = css_style;

            Ok((photo, path))
        })
        .map_err(|e| format!("Failed to query collection photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect collection photos: {}", e))?;

    // Fetch all tags in one query (bulk operation for performance)
    log::debug!(target: "photo_collections", "get_collection_photos_fetching_tags_bulk; collection_id={}; photo_count={}", collection_id, photos.len());

    let photo_paths: Vec<String> = photos.iter().map(|(_, path)| path.clone()).collect();
    let tags_map = tags::get_tags_for_photos_bulk(sqlite, &photo_paths)
        .map_err(|e| {
            log::error!(target: "photo_collections", "get_collection_photos_bulk_tags_error; error={}", e);
            e
        })?;

    log::debug!(target: "photo_collections", "get_collection_photos_tags_fetched_bulk; photos_with_tags={}", tags_map.len());

    // Add tags to each photo
    let mut photos_with_tags = Vec::new();
    for (mut photo, path) in photos {
        if let Some(photo_tags) = tags_map.get(&path) {
            if !photo_tags.is_empty() {
                // Convert tuple format to PhotoTag objects
                let tags: Vec<photo::PhotoTag> = photo_tags.iter()
                    .map(|(id, name, color)| photo::PhotoTag::new(*id, name.clone(), color.clone()))
                    .collect();
                photo.tags = Some(tags);
                log::debug!(target: "photo_collections", "get_collection_photos_tags_set; photo_path={}; tag_count={}", path, photo_tags.len());
            }
        }
        photos_with_tags.push(photo);
    }

    log::debug!(target: "photo_collections", "get_collection_photos_tags_complete; collection_id={}; photos_with_tags_count={}", collection_id, photos_with_tags.len());
    Ok(photos_with_tags)
}

/// Unified function to get photos by one or more collection IDs.
/// For multiple IDs, uses AND logic (photos must be in ALL specified collections).
///
/// # Arguments
/// * `sqlite` - Database connection
/// * `collection_ids` - One or more collection IDs to search
/// * `sort_value` - Sort order (0=PhotoTimeDesc, 1=PhotoTimeAsc, etc.)
/// * `config` - Optional app config for thumbnail checking
///
/// # Returns
/// Vector of Photo entities with tags populated
pub(super) fn get_photos_by_collection_ids(
    sqlite: &SQLite,
    collection_ids: &[i32],
    sort_value: i32,
    config: Option<config::Config>,
) -> Result<Vec<photo::Photo>, String> {
    if collection_ids.is_empty() {
        return Ok(Vec::new());
    }

    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let order_clause = crate::repository::sort_to_order_by_clause(sort_value, "pm");

    let placeholders = collection_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let collection_count = collection_ids.len() as i32;

    // Query: get photos that are in ALL specified collections (AND logic)
    let query = format!(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style,
                pm.google_photos_url, pm.exif_orientation, pm.burst_group_id
         FROM photo_metadata pm
         WHERE pm.path IN (
             SELECT pci.photo_path
             FROM photo_collection_items pci
             WHERE pci.collection_id IN ({})
             GROUP BY pci.photo_path
             HAVING COUNT(DISTINCT pci.collection_id) = ?
         ) AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
         {}",
        placeholders, order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Build params: collection_ids + collection_count
    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = collection_ids
        .iter()
        .map(|id| Box::new(*id) as Box<dyn rusqlite::ToSql>)
        .collect();
    query_params.push(Box::new(collection_count));

    let params_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();

    let photos_data = stmt
        .query_map(params_refs.as_slice(), |row| {
            let path: String = row.get("path")?;
            let photo_date: String = row.get("photo_date")?;
            let star: i32 = row.get("star")?;
            let comment: Option<String> = row.get("comment")?;
            let css_style: Option<String> = row.get("css_style")?;
            let exif_orientation: Option<String> = row.get("exif_orientation")?;
            let burst_group_id: Option<String> = row.get("burst_group_id")?;

            Ok((path, photo_date, star, comment, css_style, exif_orientation, burst_group_id))
        })
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    // Fetch tags in bulk
    let photo_paths: Vec<String> = photos_data.iter().map(|(path, ..)| path.clone()).collect();
    let tags_map = tags::get_tags_for_photos_bulk(sqlite, &photo_paths)
        .map_err(|e| format!("Failed to fetch tags: {}", e))?;

    // Build Photo entities
    let mut photos = Vec::new();
    for (path, photo_date, star, comment, css_style, exif_orientation, burst_group_id) in photos_data {
        let file = file::File::new(path.clone());
        let mut photo = photo::Photo::new(file, config.clone());

        photo.set_time(photo_date);
        photo.star = if star > 0 { Some(star) } else { None };
        photo.comment = comment.filter(|c| !c.is_empty());
        photo.css_style = css_style;
        photo.burst_group_id = burst_group_id;

        if let Some(ref orientation) = exif_orientation {
            if !orientation.is_empty() {
                photo.meta_data.orientation = orientation.clone();
            }
        }

        if let Some(photo_tags) = tags_map.get(&path) {
            if !photo_tags.is_empty() {
                let tags: Vec<photo::PhotoTag> = photo_tags.iter()
                    .map(|(id, name, color)| photo::PhotoTag::new(*id, name.clone(), color.clone()))
                    .collect();
                photo.tags = Some(tags);
            }
        }

        photos.push(photo);
    }

    log::info!(target: "photo_collections", "get_photos_by_collection_ids; ids={:?}; sort={}; count={}",
        collection_ids, sort_value, photos.len());

    Ok(photos)
}

/// Reorder items within a collection by updating their order_index values
pub(super) fn reorder_collection_items(
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

/// Get all collections (albums or tags) associated with a photo
///
/// # Arguments
/// * `sqlite` - Database connection
/// * `photo_path` - Path to the photo
/// * `collection_type` - Optional filter: "album", "tag", or None for all
///
/// # Returns
/// Vector of (id, name, color) tuples
pub(super) fn get_collections_for_photo(
    sqlite: &SQLite,
    photo_path: &str,
    collection_type: Option<&str>,
) -> Result<Vec<(i32, String, Option<String>)>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let collections: Vec<(i32, String, Option<String>)> = match collection_type {
        Some(t) => {
            let mut stmt = conn
                .prepare(
                    "SELECT pc.id, pc.name, pc.color FROM photo_collections pc
                     JOIN photo_collection_items pci ON pc.id = pci.collection_id
                     WHERE pci.photo_path = ?1 AND pc.type = ?2
                     ORDER BY pc.name",
                )
                .map_err(|e| format!("Failed to prepare query: {}", e))?;

            let result = stmt.query_map(params![photo_path, t], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| format!("Failed to query collections: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect results: {}", e))?;
            result
        }
        None => {
            let mut stmt = conn
                .prepare(
                    "SELECT pc.id, pc.name, pc.color FROM photo_collections pc
                     JOIN photo_collection_items pci ON pc.id = pci.collection_id
                     WHERE pci.photo_path = ?1
                     ORDER BY pc.name",
                )
                .map_err(|e| format!("Failed to prepare query: {}", e))?;

            let result = stmt.query_map(params![photo_path], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| format!("Failed to query collections: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect results: {}", e))?;
            result
        }
    };

    Ok(collections)
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
pub(super) fn remove_all_collections_from_photo(
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
