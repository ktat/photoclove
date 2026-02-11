//! Collection query operations (get photos, search collections)

use crate::entity::{config, photo};
use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::meta_db::sqlite::tags;
use crate::value::file;
use rusqlite::params;

pub(crate) fn get_collection_photos(
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

            // Create a file from the relative path (from DB)
            let file = file::File::from_relative(path.clone());

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
pub(crate) fn get_photos_by_collection_ids(
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
        let file = file::File::from_relative(path.clone());
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

/// Get all collections (albums or tags) associated with a photo
///
/// # Arguments
/// * `sqlite` - Database connection
/// * `photo_path` - Path to the photo
/// * `collection_type` - Optional filter: "album", "tag", or None for all
///
/// # Returns
/// Vector of (id, name, color) tuples
pub(crate) fn get_collections_for_photo(
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
