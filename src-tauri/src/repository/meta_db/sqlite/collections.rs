use crate::entity::{config, photo};
use crate::repository::meta_db::sqlite::SQLite;
use crate::value::file;
use rusqlite::{params, Result};

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

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

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
                    (SELECT COUNT(*) FROM photo_collection_items WHERE collection_id = photo_collections.id) as photo_count
             FROM photo_collections WHERE type = ?1 ORDER BY name".to_string(),
            vec![Box::new(ctype.to_string())]
        ),
        None => (
            "SELECT id, type, name, color, description, cover_photo_path, settings, created_at, updated_at,
                    (SELECT COUNT(*) FROM photo_collection_items WHERE collection_id = photo_collections.id) as photo_count
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

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

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

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get the next order_index for albums
    let order_index: i32 = conn.query_row(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM photo_collection_items WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get(0)
    ).unwrap_or(0);

    conn.execute(
        "INSERT OR IGNORE INTO photo_collection_items (collection_id, photo_path, order_index, added_at) VALUES (?1, ?2, ?3, ?4)",
        params![collection_id, photo_path, order_index, now],
    ).map_err(|e| format!("Failed to add photo to collection: {}", e))?;

    Ok(())
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
            let _photo_date: String = row.get("photo_date")?;
            let star: i32 = row.get("star")?;
            let comment: String = row.get("comment")?;

            // Create a file from the path
            let file = file::File::new(path);

            // Create photo with the file and no config
            let mut photo = photo::Photo::new(file, None);

            // Set the star and comment from database
            photo.star = if star > 0 { Some(star) } else { None };
            photo.comment = if !comment.is_empty() {
                Some(comment)
            } else {
                None
            };

            Ok(photo)
        })
        .map_err(|e| format!("Failed to query collection photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect collection photos: {}", e))?;

    Ok(photos)
}
