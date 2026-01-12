//! Date-based photo search handler.
//!
//! Handles retrieval of photos from a specific date.

use super::{HandlerContext, SearchParams};
use crate::entity::photo_meta;
use crate::repository::{self, MetaInfoDB, RepositoryDB};
use crate::value::date as date_value;

/// Handle date-based photo search request.
///
/// Retrieves photos taken on a specific date.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including the date query
///
/// # Returns
/// JSON string containing photos array for the specified date
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let date_str = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "missing_date_query");
    })?;

    let limit = params.limit;
    let offset = params.offset;

    // Convert date string to Date object - detect delimiter
    let delimiter = if date_str.contains('/') {
        Some("/")
    } else {
        Some("-")
    };

    let date = match date_value::Date::try_from_string(&date_str.to_string(), delimiter) {
        Ok(d) => d,
        Err(e) => {
            log::error!(target: "get_photos", "date_parse_error; date_str={}; error={}", date_str, e);
            return Err(());
        }
    };

    // Get metadata first
    let metadata = match ctx.meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };

    let photos = ctx
        .repo_db
        .get_photos_in_date(
            &metadata,
            date,
            repository::sort_from_int(params.sort_value),
            limit,
            params.page,
            offset as usize,
            params.star,
            params.has_comment,
            &params.extension,
            Some(ctx.config.clone()),
        )
        .await;

    Ok(photos.to_json())
}
