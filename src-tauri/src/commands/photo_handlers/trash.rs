//! Trash photos handler.
//!
//! Handles retrieval of photos that have been moved to trash.

use super::HandlerContext;
use crate::entity::photo;

/// Handle trash photos retrieval request.
///
/// Retrieves all photos that are marked as deleted (in trash).
///
/// # Arguments
/// * `ctx` - Handler context with database connections
///
/// # Returns
/// JSON string containing photos array from trash
pub async fn handle(ctx: &HandlerContext<'_>) -> Result<String, ()> {
    let config = ctx.config.clone();
    log::info!(target: "get_photos", "trash_request; config_trash_path={}", config.trash_path);

    // Get trash photos from database
    let conn = ctx.meta_db.get_connection().map_err(|e| {
        log::error!(target: "get_photos", "trash_db_connection_failed; error={}", e);
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url,
                    GROUP_CONCAT(c.id || ':' || c.name || ':' || COALESCE(c.color, '')) as tags
             FROM photo_metadata pm
             LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
             LEFT JOIN photo_collections c ON pci.collection_id = c.id AND c.type = 'tag'
             WHERE pm.delete_flg = 1
             GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url
             ORDER BY pm.updated_at DESC",
        )
        .map_err(|e| {
            log::error!(target: "get_photos", "trash_prepare_failed; error={}", e);
        })?;

    log::debug!(target: "get_photos", "trash_query_prepared; executing_query");

    let photo_iter = stmt
        .query_map([], |row| {
            let photo_path = row.get::<_, String>("path").unwrap_or_default();

            // photo_path is relative (e.g., "2024-01-15/uuid/photo.jpg")
            // For trash photos, check if file exists in trash path
            // Try new structure first (trash_path/relative_path), fall back to old deep structure
            let trash_file_path = if !config.trash_path.is_empty() {
                let trash_path = config.trash_path.trim_end_matches('/');
                let trimmed_path = photo_path.trim_start_matches('/');
                let new_path = format!("{}/{}", trash_path, trimmed_path);
                if std::path::Path::new(&new_path).exists() {
                    new_path
                } else {
                    // Fallback to old structure: trash_path/abs_path_without_leading_slash
                    let abs_path = crate::value::file::to_absolute_path(&photo_path, &config.import_to);
                    let old_path = format!("{}/{}", trash_path, abs_path.trim_start_matches('/'));
                    old_path
                }
            } else {
                photo_path.clone()
            };

            // Check if file exists in trash
            let trash_file_result =
                crate::value::file::File::new_if_exists(trash_file_path.clone());
            if trash_file_result.is_none() {
                return Err(rusqlite::Error::InvalidPath(trash_file_path.into()));
            }

            // Create Photo entity from relative path (DB path)
            let file = crate::value::file::File::from_relative(photo_path.clone());
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

            // Process tags from concatenated string
            let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
            p.set_tags_from_string(tags_string);

            Ok(p)
        })
        .map_err(|e| {
            log::error!(target: "get_photos", "trash_query_failed; error={}", e);
        })?;

    let mut photos = photo::Photos::new();
    for photo_result in photo_iter {
        match photo_result {
            Ok(p) => photos.photos.push(p),
            Err(e) => {
                log::error!(target: "get_photos", "trash_photo_error; error={}", e);
            }
        }
    }

    log::info!(target: "get_photos", "trash_complete; count={}; first_photo_debug={:?}",
               photos.photos.len(),
               photos.photos.first().map(|p| format!("path={}, has_thumbnail={}", p.file.path, p.has_thumbnail)));
    let json_result = photos.to_json();
    log::debug!(target: "get_photos", "trash_json_response; response_length={}", json_result.len());
    Ok(json_result)
}
