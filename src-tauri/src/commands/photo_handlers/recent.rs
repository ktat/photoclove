//! Recent photos handler.
//!
//! Handles retrieval of most recently taken photos.

use super::{HandlerContext, SearchParams};
use crate::repository::{self, MetaInfoDB, RepositoryDB};

/// Handle recent photos search request.
///
/// Retrieves the most recently taken photos from the database.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including limit, offset, and filters
///
/// # Returns
/// JSON string containing photos array
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let limit = params.limit;

    // Get recent photos metadata directly from database using SQL
    let meta_data = match ctx.meta_db.get_recent_photos_metadata(limit) {
        Ok(data) => data,
        Err(e) => {
            log::error!(target: "get_photos", "recent_metadata_error; error={}", e);
            return Err(());
        }
    };

    let photos = ctx
        .repo_db
        .get_recent_photos(
            &meta_data,
            params.page,
            repository::sort_from_int(params.sort_value),
            limit,
            params.offset as usize,
            params.star,
            params.has_comment,
            &params.extension,
            Some(ctx.config.clone()),
        )
        .await;

    let json_result = photos.to_json();
    Ok(json_result)
}
