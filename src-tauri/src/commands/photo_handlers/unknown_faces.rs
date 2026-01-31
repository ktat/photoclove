//! Unknown faces photo search handler.
//!
//! Handles retrieval of photos containing unknown (unassigned) faces.
//! Photos are grouped by path and sorted by most recent detection time.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;

/// Handle unknown faces photo search request.
///
/// Retrieves photos that contain unknown (unassigned) faces,
/// grouped by photo path and sorted by the most recent detection time.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters (query is not used for this handler)
///
/// # Returns
/// JSON string containing photos array with unknown faces
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    log::info!(target: "get_photos", "unknown_faces_request");

    // Get full photo objects for unknown faces
    let mut photos_vec = ctx.meta_db
        .get_photos_for_unknown_faces_full(params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "unknown_faces_photos_query_failed; error={}", e);
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

    log::info!(target: "get_photos", "unknown_faces_complete; count={}", photos.photos.len());
    Ok(photos.to_json())
}
