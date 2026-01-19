//! Album photos handler.
//!
//! Handles retrieval of photos from a specific album.
//! Uses unified collection search for consistency with tag handler.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;
use crate::repository::MetaInfoDB;

/// Handle album photos search request.
///
/// Retrieves all photos in a specific album.
/// Uses the unified get_photos_by_collection_ids function for consistency.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including album_id in params
///
/// # Returns
/// JSON string containing photos array for the specified album
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let album_id = if let Some(ref p) = params.params {
        p.get("album_id")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32)
            .ok_or_else(|| {
                log::error!(target: "get_photos", "missing_album_id_in_params");
            })?
    } else {
        log::error!(target: "get_photos", "missing_params_for_album_photos");
        return Err(());
    };

    log::info!(target: "get_photos", "album_photos_request; album_id={}; sort_value={}", album_id, params.sort_value);

    // Use unified collection search function
    let mut photos_vec = ctx.meta_db
        .get_photos_by_collection_ids(&[album_id], params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "album_photos_failed; error={}", e);
        })?;

    // Set has_thumbnail flag for each photo
    for p in photos_vec.iter_mut() {
        p.set_has_thumbnail();
    }

    let photos_response = photo::Photos {
        photos: photos_vec,
        has_next: false,
        has_prev: false,
    };

    log::info!(target: "get_photos", "album_photos_success; album_id={}; count={}", album_id, photos_response.photos.len());
    Ok(photos_response.to_json())
}
