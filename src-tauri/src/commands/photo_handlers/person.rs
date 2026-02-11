//! Person-based photo search handler.
//!
//! Handles retrieval of photos containing a specific person (by face detection).

use super::{HandlerContext, SearchParams};
use crate::entity::photo;

/// Handle person-based photo search request.
///
/// Retrieves all photos that contain faces belonging to a specific person.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including person ID in query
///
/// # Returns
/// JSON string containing photos array for the specified person
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let person_id_str = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "missing_person_id_query");
    })?;

    let person_id: i64 = person_id_str.trim().parse().map_err(|e| {
        log::error!(target: "get_photos", "invalid_person_id; error={}", e);
    })?;

    log::info!(target: "get_photos", "person_request; person_id={}", person_id);

    // Get full photo objects for this person
    let mut photos_vec = ctx
        .meta_db
        .get_photos_for_person_full(person_id, params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "person_photos_query_failed; error={}", e);
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

    log::info!(target: "get_photos", "person_complete; count={}", photos.photos.len());
    Ok(photos.to_json())
}
