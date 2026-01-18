//! Tag-based photo search handler.
//!
//! Handles retrieval of photos with specific tags.
//! Uses unified collection search for consistency with album handler.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;

/// Handle tag-based photo search request.
///
/// Retrieves all photos that have ALL of the specified tags (AND logic).
/// Uses the unified get_photos_by_collection_ids function for consistency.
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

    log::info!(target: "get_photos", "tag_request; tag_ids={:?}; sort_value={}", tag_ids, params.sort_value);

    // Use unified collection search function
    let mut photos_vec = ctx.meta_db
        .get_photos_by_collection_ids(&tag_ids, params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "tag_query_failed; error={}", e);
        })?;

    // Set has_thumbnail flag for each photo
    for p in photos_vec.iter_mut() {
        p.set_has_thumbnail();
    }

    let photos = photo::Photos {
        photos: photos_vec,
        has_next: false,
        has_prev: false,
    };

    log::info!(target: "get_photos", "tag_complete; count={}", photos.photos.len());
    Ok(photos.to_json())
}
