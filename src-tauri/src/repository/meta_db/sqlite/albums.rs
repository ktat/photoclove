use crate::entity::{config, photo};
use crate::value::file;
use rusqlite::params;

use super::SQLite;

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
    let mut photo_count = 0;
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

    photo_count = photos.len();
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
