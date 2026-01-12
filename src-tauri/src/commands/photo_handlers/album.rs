//! Album photos handler.
//!
//! Handles retrieval of photos from a specific album.

use super::{HandlerContext, SearchParams};
use crate::entity::photo;

/// Handle album photos search request.
///
/// Retrieves all photos in a specific album.
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

    log::info!(target: "get_photos", "album_photos_request_using_unified_collections; album_id={}", album_id);

    // Use get_collection_photos which includes tag information and config
    let mut photos = ctx
        .meta_db
        .get_collection_photos(album_id, true, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "album_photos_failed; error={}", e);
        })?;

    // Set has_thumbnail flag for each photo
    for p in photos.iter_mut() {
        p.set_has_thumbnail();
        // Debug: log photos with tags
        if p.tags.is_some() {
            log::debug!(target: "get_photos", "album_photo_with_tags; path={}; tags={:?}", p.file.path, p.tags);
        }
    }

    // Convert to Photos format to match other responses
    let photos_response = photo::Photos {
        photos,
        has_next: false,
        has_prev: false,
    };

    log::info!(target: "get_photos", "album_photos_success; album_id={}; count={}", album_id, photos_response.photos.len());
    Ok(photos_response.to_json())
}
