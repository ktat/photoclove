//! Collection query operations (get photos, search collections)

use crate::entity::{config, photo};
use crate::repository::meta_db::sqlite::SQLite;
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
                pm.burst_group_id, pci.order_index, pci.added_at
         FROM photo_collection_items pci
         JOIN photo_metadata pm ON pci.photo_path = pm.path
         WHERE pci.collection_id = ?1
         {}",
        order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let photos_data = stmt
        .query_map(
            params![collection_id],
            super::super::utils::PhotoRowData::from_row,
        )
        .map_err(|e| format!("Failed to query collection photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect collection photos: {}", e))?;

    let photos = super::super::utils::photos_from_row_data(sqlite, photos_data, &config);

    log::debug!(target: "photo_collections", "get_collection_photos_tags_complete; collection_id={}; photos_count={}", collection_id, photos.len());
    Ok(photos)
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

    let placeholders = collection_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
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
        .query_map(
            params_refs.as_slice(),
            super::super::utils::PhotoRowData::from_row,
        )
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    let photos = super::super::utils::photos_from_row_data(sqlite, photos_data, &config);

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

            let result = stmt
                .query_map(params![photo_path, t], |row| {
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

            let result = stmt
                .query_map(params![photo_path], |row| {
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
