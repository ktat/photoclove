//! Tag-based photo search handler.
//!
//! Handles retrieval of photos with specific tags.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;

/// Handle tag-based photo search request.
///
/// Retrieves all photos that have ALL of the specified tags (AND logic).
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including comma-separated tag IDs in query
///
/// # Returns
/// JSON string containing photos array that have all specified tags
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    // Parse tag IDs from query parameter (comma-separated)
    let tag_ids_str = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "missing_tag_ids_query");
    })?;

    let tag_ids: Result<Vec<i32>, _> = tag_ids_str
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse::<i32>())
        .collect();

    let tag_ids = tag_ids.map_err(|e| {
        log::error!(target: "get_photos", "invalid_tag_ids; error={}", e);
    })?;

    if tag_ids.is_empty() {
        log::warn!(target: "get_photos", "empty_tag_ids");
        return Ok(photo::Photos::new().to_json());
    }

    log::info!(target: "get_photos", "tag_request; tag_ids={:?}", tag_ids);

    // Get photos with tags from database with Photo entities
    let conn = ctx.meta_db.get_connection().map_err(|e| {
        log::error!(target: "get_photos", "tag_db_connection_failed; error={}", e);
    })?;

    // Build dynamic query for unified collections (tags)
    log::info!(target: "get_photos", "tag_request_using_unified_collections; tag_ids={:?}", tag_ids);
    let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query_sql = format!(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_orientation,
                GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags
         FROM photo_metadata pm
         LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
         LEFT JOIN photo_collections pc ON pci.collection_id = pc.id AND pc.type = 'tag'
         WHERE pm.path IN (
             SELECT DISTINCT pci2.photo_path FROM photo_collection_items pci2
             INNER JOIN photo_collections pc2 ON pci2.collection_id = pc2.id
             WHERE pc2.id IN ({}) AND pc2.type = 'tag'
             GROUP BY pci2.photo_path
             HAVING COUNT(DISTINCT pci2.collection_id) = ?
         ) AND pm.delete_flg = 0
         GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_orientation
         ORDER BY pm.photo_date DESC",
        placeholders
    );

    let mut stmt = conn.prepare(&query_sql).map_err(|e| {
        log::error!(target: "get_photos", "tag_prepare_failed; error={}", e);
    })?;

    let mut query_params: Vec<&dyn rusqlite::ToSql> = tag_ids
        .iter()
        .map(|id| id as &dyn rusqlite::ToSql)
        .collect();
    let tag_count = tag_ids.len() as i32;
    query_params.push(&tag_count);

    let config = ctx.config.clone();
    let photo_iter = stmt
        .query_map(query_params.as_slice(), |row| {
            let photo_path = row.get::<_, String>("path").unwrap_or_default();

            // Create Photo entity from file path
            let file_result = crate::value::file::File::new_if_exists(photo_path.clone());
            if file_result.is_none() {
                return Err(rusqlite::Error::InvalidPath(photo_path.into()));
            }
            let file = file_result.unwrap();

            // Get config for thumbnail checking
            let mut p = photo::Photo::new(file, Some(config.clone()));

            // Set thumbnail status
            p.set_has_thumbnail();

            // Set metadata from database
            let star = row.get::<_, i32>("star").unwrap_or(0);
            p.set_star(star);

            let comment = row
                .get::<_, Option<String>>("comment")
                .unwrap_or_default()
                .unwrap_or_default();
            p.set_comment(comment);

            // Set CSS style
            if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
                p.set_css_style(css_style);
            }

            // Set orientation from database
            if let Ok(Some(orientation)) = row.get::<_, Option<String>>("exif_orientation") {
                if !orientation.is_empty() {
                    p.meta_data.orientation = orientation;
                }
            }

            // Process tags from concatenated string
            let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
            p.set_tags_from_string(tags_string);

            Ok(p)
        })
        .map_err(|e| {
            log::error!(target: "get_photos", "tag_query_failed; error={}", e);
        })?;

    let mut photos = photo::Photos::new();
    for photo_result in photo_iter {
        match photo_result {
            Ok(p) => photos.photos.push(p),
            Err(e) => {
                log::error!(target: "get_photos", "tag_photo_error; error={}", e);
            }
        }
    }

    log::info!(target: "get_photos", "tag_complete; count={}", photos.photos.len());
    Ok(photos.to_json())
}
