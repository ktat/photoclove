//! Full-text and metadata search handler.
//!
//! Handles retrieval of photos matching search queries.

use super::{HandlerContext, SearchParams};
use crate::repository;

/// Handle full-text search request.
///
/// Searches photos by text query across various metadata fields.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including search query and type
///
/// # Returns
/// JSON string containing matching photos
pub async fn handle(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let search_query = params.query.clone().unwrap_or_default();

    // Get search parameters from params or use defaults
    let (search_type_param, filters_str, sort_field, sort_order) = if let Some(ref p) = params.params
    {
        let search_type_param = p
            .get("search_type")
            .and_then(|v| v.as_str())
            .unwrap_or("text")
            .to_string();
        let filters_str = p
            .get("filters")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string();
        let sort_field = p
            .get("sort_field")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let sort_order = p
            .get("sort_order")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        (search_type_param, filters_str, sort_field, sort_order)
    } else {
        ("text".to_string(), "{}".to_string(), None, None)
    };

    log::info!(target: "get_photos", "search_request; query={}; search_type={}", search_query, search_type_param);

    // Use existing search_photos implementation
    let max_photos_per_fetch = params.limit;
    match ctx.meta_db.search_photos(
        &search_query,
        &search_type_param,
        &filters_str,
        &sort_field.unwrap_or_else(|| "photo_date".to_string()),
        &sort_order.unwrap_or_else(|| "DESC".to_string()),
        max_photos_per_fetch,
    ) {
        Ok(result) => {
            log::info!(target: "get_photos", "search_complete; result_length={}", result.len());
            Ok(result)
        }
        Err(e) => {
            log::error!(target: "get_photos", "search_failed; error={}", e);
            Err(())
        }
    }
}

/// Handle "all" search request (general search across all fields).
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters
///
/// # Returns
/// JSON string containing matching photos
pub async fn handle_all(ctx: &HandlerContext<'_>, params: &SearchParams) -> Result<String, ()> {
    let search_query = params.query.clone().unwrap_or_default();

    // Get filters and sort parameters from params
    let (filters_str, sort_field, sort_order) = if let Some(ref p) = params.params {
        let filters_str = p
            .get("filters")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string();
        let sort_field = p
            .get("sort_field")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let sort_order = p
            .get("sort_order")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        (filters_str, sort_field, sort_order)
    } else {
        // Fallback to sort_value if no params
        let sort_config = repository::sort_from_int(params.sort_value);
        let (field, order) = match sort_config {
            repository::Sort::PhotoTimeDesc => ("photo_date", "DESC"),
            repository::Sort::PhotoTimeAsc => ("photo_date", "ASC"),
            repository::Sort::AddedTimeDesc => ("created_at", "DESC"),
            repository::Sort::AddedTimeAsc => ("created_at", "ASC"),
            repository::Sort::StarDesc => ("star", "DESC"),
            repository::Sort::StarAsc => ("star", "ASC"),
            repository::Sort::NameDesc => ("path", "DESC"),
            repository::Sort::NameAsc => ("path", "ASC"),
            repository::Sort::PhotoTime => ("photo_date", "DESC"),
            repository::Sort::Time => ("created_at", "DESC"),
            repository::Sort::Name => ("path", "ASC"),
        };
        (
            "{}".to_string(),
            Some(field.to_string()),
            Some(order.to_string()),
        )
    };

    // Use existing search_photos implementation
    let max_photos_per_fetch = params.limit;
    match ctx.meta_db.search_photos(
        &search_query,
        "all",
        &filters_str,
        &sort_field.unwrap_or_else(|| "photo_date".to_string()),
        &sort_order.unwrap_or_else(|| "DESC".to_string()),
        max_photos_per_fetch,
    ) {
        Ok(result) => Ok(result),
        Err(e) => {
            log::error!(target: "get_photos", "all_search_failed; error={}", e);
            Err(())
        }
    }
}
