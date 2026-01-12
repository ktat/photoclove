use crate::entity::{config, photo};
use crate::value::file;
use rusqlite::params;

use super::SQLite;

/// Get all albums with photo count
pub(super) fn get_all_albums(db: &SQLite) -> Result<Vec<(i32, String, String, Option<String>, i32)>, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.name, COALESCE(pc.description, '') as description, pc.cover_photo_path,
                    (SELECT COUNT(*) FROM photo_collection_items WHERE collection_id = pc.id) as photo_count
             FROM photo_collections pc
             WHERE pc.type = 'album'
             ORDER BY pc.name"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let albums = stmt
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let name: String = row.get(1)?;
            let description: String = row.get(2)?;
            let cover_photo_path: Option<String> = row.get(3)?;
            let count: i32 = row.get(4)?;
            Ok((id, name, description, cover_photo_path, count))
        })
        .map_err(|e| format!("Failed to query albums: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect albums: {}", e))?;

    Ok(albums)
}

/// Create a new album
pub(super) fn create_album(db: &SQLite, name: &str, description: &str) -> Result<i32, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO photo_collections (type, name, description, created_at, updated_at) VALUES ('album', ?1, ?2, ?3, ?4)",
        params![name, description, now, now],
    )
    .map_err(|e| format!("Failed to create album: {}", e))?;

    let album_id = conn.last_insert_rowid() as i32;
    Ok(album_id)
}

/// Update an album
pub(super) fn update_album(
    db: &SQLite,
    id: i32,
    name: &str,
    description: &str,
    cover_photo_path: Option<&str>,
) -> Result<bool, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let rows_affected = conn
        .execute(
            "UPDATE photo_collections SET name = ?1, description = ?2, cover_photo_path = ?3, updated_at = ?4 WHERE id = ?5 AND type = 'album'",
            params![name, description, cover_photo_path, now, id],
        )
        .map_err(|e| format!("Failed to update album: {}", e))?;

    Ok(rows_affected > 0)
}

/// Delete an album
pub(super) fn delete_album(db: &SQLite, id: i32) -> Result<bool, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    // First delete all photo-album associations
    conn.execute(
        "DELETE FROM photo_collection_items WHERE collection_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to delete album associations: {}", e))?;

    // Then delete the album itself
    let rows_affected = conn
        .execute(
            "DELETE FROM photo_collections WHERE id = ?1 AND type = 'album'",
            params![id],
        )
        .map_err(|e| format!("Failed to delete album: {}", e))?;

    Ok(rows_affected > 0)
}

/// Add a photo to an album
pub(super) fn add_photo_to_album(db: &SQLite, album_id: i32, photo_path: &str) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get the next order_index
    let order_index: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM photo_collection_items WHERE collection_id = ?1",
            params![album_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT OR IGNORE INTO photo_collection_items (collection_id, photo_path, order_index, added_at) VALUES (?1, ?2, ?3, ?4)",
        params![album_id, photo_path, order_index, now],
    )
    .map_err(|e| format!("Failed to add photo to album: {}", e))?;

    Ok(())
}

/// Remove a photo from an album
pub(super) fn remove_photo_from_album(db: &SQLite, album_id: i32, photo_path: &str) -> Result<bool, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let rows_affected = conn
        .execute(
            "DELETE FROM photo_collection_items WHERE collection_id = ?1 AND photo_path = ?2",
            params![album_id, photo_path],
        )
        .map_err(|e| format!("Failed to remove photo from album: {}", e))?;

    Ok(rows_affected > 0)
}

/// Get list of photo paths in an album
pub(super) fn get_album_photos(db: &SQLite, album_id: i32) -> Result<Vec<String>, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let mut stmt = conn
        .prepare("SELECT photo_path FROM album_photos WHERE album_id = ?1 ORDER BY order_index, added_at")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let photos = stmt
        .query_map(params![album_id], |row| {
            let path: String = row.get(0)?;
            Ok(path)
        })
        .map_err(|e| format!("Failed to query album photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect album photos: {}", e))?;

    Ok(photos)
}

/// Get album photos with full metadata and thumbnail information
pub(super) fn get_album_photos_with_metadata(
    db: &SQLite,
    album_id: i32,
    config: config::Config,
) -> Result<Vec<photo::Photo>, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    log::info!(target: "albums", "get_album_photos_with_metadata; album_id={}; import_to={}; thumbnail_store={}",
        album_id, config.import_to, config.thumbnail_store);

    let mut stmt = conn.prepare(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.created_at, pm.updated_at,
                pm.google_photos_url, pm.exif_iso, pm.exif_fnumber, pm.exif_date_time,
                pm.exif_date_time_original, pm.exif_lens_model, pm.exif_make, pm.exif_lens_make,
                pm.exif_model, pm.exif_xresolution, pm.exif_yresolution, pm.exif_resolution_unit,
                pm.exif_copyright, pm.exif_exposure_time, pm.exif_shutter_speed_value,
                pm.exif_focal_length, pm.exif_focal_length_in35mm_film, pm.exif_digital_zoom_ratio,
                pm.exif_exposure_mode, pm.exif_white_balance_mode, pm.exif_orientation, pm.css_style,
                ap.order_index, ap.added_at
         FROM album_photos ap
         JOIN photo_metadata pm ON ap.photo_path = pm.path
         WHERE ap.album_id = ?1
         ORDER BY ap.order_index, ap.added_at"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let config_clone = config.clone();
    let photos = stmt
        .query_map(params![album_id], |row| {
            let path: String = row.get("path")?;
            let _photo_date: String = row.get("photo_date")?;
            let star: i32 = row.get("star")?;
            let comment: String = row.get("comment")?;

            // Create a file from the path
            let file = file::File::new(path.clone());

            // Create photo with the file and config for thumbnail support
            let mut photo = photo::Photo::new(file, Some(config_clone.clone()));

            // Check if thumbnail exists and set has_thumbnail flag
            photo.set_has_thumbnail();

            log::debug!(target: "albums", "album_photo_created; path={}; has_thumbnail={}",
                path, photo.has_thumbnail);

            // Set the star and comment from database
            photo.star = if star > 0 { Some(star) } else { None };
            photo.comment = if !comment.is_empty() {
                Some(comment)
            } else {
                None
            };

            Ok(photo)
        })
        .map_err(|e| format!("Failed to query album photos with metadata: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect album photos with metadata: {}", e))?;

    let photo_count = photos.len();
    let thumbnail_count = photos.iter().filter(|p| p.has_thumbnail).count();
    log::info!(target: "albums", "get_album_photos_with_metadata_complete; album_id={}; total_photos={}; photos_with_thumbnails={}",
        album_id, photo_count, thumbnail_count);

    Ok(photos)
}

/// Reorder photos in an album
pub(super) fn reorder_album_photos(
    db: &SQLite,
    album_id: i32,
    photo_order: Vec<String>,
) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for (index, photo_path) in photo_order.iter().enumerate() {
        tx.execute(
            "UPDATE album_photos SET order_index = ?1 WHERE album_id = ?2 AND photo_path = ?3",
            params![index as i32, album_id, photo_path],
        )
        .map_err(|e| format!("Failed to update photo order: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}
