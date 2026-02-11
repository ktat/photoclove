//! Collections list handlers.
//!
//! Handles retrieval of album and tag lists.

use super::HandlerContext;
use crate::repository::MetaInfoDB;

/// Handle all albums list request.
///
/// Retrieves all albums with their metadata and photo counts.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
///
/// # Returns
/// JSON string containing array of album objects
pub async fn handle_albums(ctx: &HandlerContext<'_>) -> Result<String, ()> {
    log::info!(target: "get_photos", "all_albums_request; using_unified_collections=true");
    match ctx
        .meta_db
        .get_all_collections(Some("album"), ctx.config.clone())
    {
        Ok(albums) => Ok(serde_json::to_string(&albums).unwrap_or_else(|_| "[]".to_string())),
        Err(e) => {
            log::error!(target: "get_photos", "all_albums_error; error={}", e);
            Err(())
        }
    }
}

/// Handle all tags list request.
///
/// Retrieves all tags with their metadata and photo counts.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
///
/// # Returns
/// JSON string containing array of tag objects
pub async fn handle_tags(ctx: &HandlerContext<'_>) -> Result<String, ()> {
    log::info!(target: "get_photos", "all_tags_request; using_unified_collections=true");
    match ctx
        .meta_db
        .get_all_collections(Some("tag"), ctx.config.clone())
    {
        Ok(tags) => Ok(serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string())),
        Err(e) => {
            log::error!(target: "get_photos", "all_tags_error; error={}", e);
            Err(())
        }
    }
}
