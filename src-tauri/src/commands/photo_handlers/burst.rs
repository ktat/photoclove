//! Burst-based photo search handlers.
//!
//! Handles retrieval of photos with burst grouping support.
//! This module provides handlers for:
//! - burst_date: Representative photos + non-grouped photos for a specific date
//! - burst_album: Representative photos + non-grouped photos in an album
//! - burst_tag: Representative photos + non-grouped photos with specific tags
//! - burst_group: All photos within a specific burst group

use super::{HandlerContext, SearchParams};
use crate::entity::photo;
use crate::repository::{sort_to_order_by_clause, MetaInfoDB};
use crate::value::date as date_value;

/// Apply burst grouping to a list of photos.
/// Groups photos by burst_group_id, keeping only the representative (first) photo of each group.
/// Sets burst_count on each representative photo.
fn apply_burst_grouping(photos: Vec<photo::Photo>) -> photo::Photos {
    use std::collections::HashMap;

    if photos.is_empty() {
        return photo::Photos::new();
    }

    // Group photos by burst_group_id (or path if no group)
    let mut groups: HashMap<String, Vec<photo::Photo>> = HashMap::new();
    let mut order: Vec<String> = Vec::new(); // Preserve original order

    for p in photos {
        let key = p
            .burst_group_id
            .clone()
            .unwrap_or_else(|| p.file.path.clone());
        if !groups.contains_key(&key) {
            order.push(key.clone());
        }
        groups.entry(key).or_default().push(p);
    }

    // Build result: take first photo from each group, set burst_count
    let mut result_photos = Vec::new();
    for key in order {
        if let Some(group) = groups.remove(&key) {
            let count = group.len() as u32;
            if let Some(mut representative) = group.into_iter().next() {
                representative.burst_count = Some(count);
                representative.set_has_thumbnail();
                result_photos.push(representative);
            }
        }
    }

    photo::Photos {
        photos: result_photos,
        has_next: false,
        has_prev: false,
    }
}

/// Handle burst date search - get representative photos + non-grouped photos for a date.
///
/// This query groups photos by burst_group_id (or individual path if not grouped),
/// returning only the oldest photo from each group along with the group count.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including the date query
///
/// # Returns
/// JSON string containing photos array with burst_count set for grouped photos
pub async fn handle_burst_date(
    ctx: &HandlerContext<'_>,
    params: &SearchParams,
) -> Result<String, ()> {
    let date_str = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "burst_date; error=missing_date_query");
    })?;

    // Normalize date format to YYYY-MM-DD (same as database storage)
    let delimiter = if date_str.contains('/') {
        Some("/")
    } else {
        Some("-")
    };
    let date =
        date_value::Date::try_from_string(&date_str.to_string(), delimiter).map_err(|e| {
            log::error!(target: "get_photos", "burst_date; error=date_parse_error; details={}", e);
        })?;
    let normalized_date = date.to_string(); // Returns YYYY-MM-DD format

    log::info!(target: "get_photos", "burst_date; date={}; normalized={}", date_str, normalized_date);

    let conn = ctx.meta_db.get_connection().map_err(|e| {
        log::error!(target: "get_photos", "burst_date; error=db_connection_failed; details={}", e);
    })?;

    // SQL using CTE with ROW_NUMBER to get representative photos
    // Representative = oldest photo in each group (by exif_date_time_original, then path)
    // Use date() function to extract date part from photo_date (format: YYYY-MM-DD HH:MM:SS)
    let order_by = sort_to_order_by_clause(params.sort_value, "r");
    let query_sql = format!(
        r#"
        WITH ranked AS (
            SELECT
                pm.*,
                IFNULL(pm.burst_group_id, pm.path) AS group_key,
                ROW_NUMBER() OVER (
                    PARTITION BY IFNULL(pm.burst_group_id, pm.path)
                    ORDER BY pm.exif_date_time_original ASC, pm.path ASC
                ) AS rn,
                COUNT(*) OVER (PARTITION BY IFNULL(pm.burst_group_id, pm.path)) AS burst_count
            FROM photo_metadata pm
            WHERE date(pm.photo_date) = ?1 AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL){star_filter}{comment_filter}
        )
        SELECT r.path, r.photo_date, r.star, r.comment, r.css_style, r.google_photos_url,
               r.exif_orientation, r.burst_group_id, r.burst_count,
               GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags
        FROM ranked r
        LEFT JOIN photo_collection_items pci ON r.path = pci.photo_path
        LEFT JOIN photo_collections pc ON pci.collection_id = pc.id AND pc.type = 'tag'
        WHERE r.rn = 1
        GROUP BY r.path
        {order_by}
    "#,
        star_filter = if params.star >= 0 {
            " AND pm.star >= ?2"
        } else {
            ""
        },
        comment_filter = if params.has_comment {
            " AND pm.comment IS NOT NULL AND pm.comment != ''"
        } else {
            ""
        },
        order_by = order_by
    );

    let mut stmt = conn.prepare(&query_sql).map_err(|e| {
        log::error!(target: "get_photos", "burst_date; error=prepare_failed; details={}", e);
    })?;

    // Build query params dynamically
    let config = ctx.config.clone();
    let star = params.star;

    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(normalized_date.clone())];
    if params.star >= 0 {
        query_params.push(Box::new(star));
    }

    let params_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();

    let photo_iter = stmt
        .query_map(params_refs.as_slice(), |row| {
            map_burst_photo_row(row, &config)
        })
        .map_err(|e| {
            log::error!(target: "get_photos", "burst_date; error=query_failed; details={}", e);
        })?;

    let photos = collect_photos(photo_iter);

    log::info!(target: "get_photos", "burst_date; date={}; count={}", normalized_date, photos.photos.len());
    Ok(photos.to_json())
}

/// Handle burst album search - get representative photos + non-grouped photos in an album.
/// Uses unified collection search for consistency, then applies burst grouping.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including the album_id in params (same as album_photos)
///
/// # Returns
/// JSON string containing photos array with burst_count set for grouped photos
pub async fn handle_burst_album(
    ctx: &HandlerContext<'_>,
    params: &SearchParams,
) -> Result<String, ()> {
    let album_id = if let Some(ref p) = params.params {
        p.get("album_id")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32)
            .ok_or_else(|| {
                log::error!(target: "get_photos", "burst_album; error=missing_album_id_in_params");
            })?
    } else {
        log::error!(target: "get_photos", "burst_album; error=missing_params");
        return Err(());
    };

    log::info!(target: "get_photos", "burst_album; album_id={}; sort_value={}", album_id, params.sort_value);

    // Use unified collection search, then apply burst grouping
    let photos_vec = ctx
        .meta_db
        .get_photos_by_collection_ids(&[album_id], params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "burst_album; error=query_failed; details={}", e);
        })?;

    // Apply burst grouping (for now, just set burst_count = 1 since no groups exist)
    let photos = apply_burst_grouping(photos_vec);

    log::info!(target: "get_photos", "burst_album; album_id={}; count={}", album_id, photos.photos.len());
    Ok(photos.to_json())
}

/// Handle burst tag search - get representative photos + non-grouped photos with specific tags.
/// Uses unified collection search for consistency, then applies burst grouping.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including comma-separated tag IDs in query
///
/// # Returns
/// JSON string containing photos array with burst_count set for grouped photos
pub async fn handle_burst_tag(
    ctx: &HandlerContext<'_>,
    params: &SearchParams,
) -> Result<String, ()> {
    // Parse tag IDs from query parameter (comma-separated)
    let tag_ids_str = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "burst_tag; error=missing_tag_ids");
    })?;

    let tag_ids: Result<Vec<i32>, _> = tag_ids_str
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse::<i32>())
        .collect();

    let tag_ids = tag_ids.map_err(|e| {
        log::error!(target: "get_photos", "burst_tag; error=invalid_tag_ids; details={}", e);
    })?;

    if tag_ids.is_empty() {
        log::warn!(target: "get_photos", "burst_tag; error=empty_tag_ids");
        return Ok(photo::Photos::new().to_json());
    }

    log::info!(target: "get_photos", "burst_tag; tag_ids={:?}; sort_value={}", tag_ids, params.sort_value);

    // Use unified collection search, then apply burst grouping
    let photos_vec = ctx
        .meta_db
        .get_photos_by_collection_ids(&tag_ids, params.sort_value, Some(ctx.config.clone()))
        .map_err(|e| {
            log::error!(target: "get_photos", "burst_tag; error=query_failed; details={}", e);
        })?;

    let photos = apply_burst_grouping(photos_vec);

    log::info!(target: "get_photos", "burst_tag; tag_ids={:?}; count={}", tag_ids, photos.photos.len());
    Ok(photos.to_json())
}

/// Handle burst group search - get all photos in a specific burst group.
///
/// # Arguments
/// * `ctx` - Handler context with database connections
/// * `params` - Search parameters including burst_group_id in query
///
/// # Returns
/// JSON string containing all photos in the burst group, ordered by time
pub async fn handle_burst_group(
    ctx: &HandlerContext<'_>,
    params: &SearchParams,
) -> Result<String, ()> {
    let burst_group_id = params.query.as_ref().ok_or_else(|| {
        log::error!(target: "get_photos", "burst_group; error=missing_burst_group_id");
    })?;

    log::info!(target: "get_photos", "burst_group; burst_group_id={}", burst_group_id);

    let conn = ctx.meta_db.get_connection().map_err(|e| {
        log::error!(target: "get_photos", "burst_group; error=db_connection_failed; details={}", e);
    })?;

    // Simple query to get all photos in the burst group
    let order_by = sort_to_order_by_clause(params.sort_value, "pm");
    let query_sql = format!(
        r#"
        SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url,
               pm.exif_orientation, pm.burst_group_id,
               (SELECT COUNT(*) FROM photo_metadata WHERE burst_group_id = ?1 AND (delete_flg = 0 OR delete_flg IS NULL)) as burst_count,
               GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags
        FROM photo_metadata pm
        LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
        LEFT JOIN photo_collections pc ON pci.collection_id = pc.id AND pc.type = 'tag'
        WHERE pm.burst_group_id = ?1 AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
        GROUP BY pm.path
        {order_by}
    "#
    );

    let mut stmt = conn.prepare(&query_sql).map_err(|e| {
        log::error!(target: "get_photos", "burst_group; error=prepare_failed; details={}", e);
    })?;

    let config = ctx.config.clone();
    let photo_iter = stmt
        .query_map([burst_group_id], |row| map_burst_photo_row(row, &config))
        .map_err(|e| {
            log::error!(target: "get_photos", "burst_group; error=query_failed; details={}", e);
        })?;

    let photos = collect_photos(photo_iter);

    log::info!(target: "get_photos", "burst_group; burst_group_id={}; count={}", burst_group_id, photos.photos.len());
    Ok(photos.to_json())
}

/// Map a database row to a Photo entity with burst information.
fn map_burst_photo_row(
    row: &rusqlite::Row,
    config: &crate::entity::config::Config,
) -> rusqlite::Result<photo::Photo> {
    let photo_path = row.get::<_, String>("path")?;

    // Photo paths in the DB are stored RELATIVE to config.import_to. The
    // previous implementation used File::new_if_exists which does
    // Path::new(path).exists() — that resolves against the process's
    // current working directory, never against import_to, so it always
    // returned None for every row. The mapper then returned an Err for
    // every photo and the entire burst result was empty (count=0).
    //
    // Use File::from_relative which is the documented "DB read use case"
    // constructor — no filesystem validation, just stores the path.
    let file = crate::value::file::File::from_relative(photo_path);

    let mut p = photo::Photo::new(file, Some(config.clone()));
    p.set_has_thumbnail();

    // Set metadata from database
    let star = row.get::<_, i32>("star").unwrap_or(0);
    p.set_star(star);

    let comment = row
        .get::<_, Option<String>>("comment")
        .unwrap_or_default()
        .unwrap_or_default();
    p.set_comment(comment);

    if let Ok(css_style) = row.get::<_, Option<String>>("css_style") {
        p.set_css_style(css_style);
    }

    if let Ok(Some(orientation)) = row.get::<_, Option<String>>("exif_orientation") {
        if !orientation.is_empty() {
            p.meta_data.orientation = orientation;
        }
    }

    // Set burst information
    if let Ok(burst_group_id) = row.get::<_, Option<String>>("burst_group_id") {
        p.set_burst_group_id(burst_group_id);
    }

    if let Ok(burst_count) = row.get::<_, u32>("burst_count") {
        p.set_burst_count(burst_count);
    }

    // Process tags from concatenated string
    let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();
    p.set_tags_from_string(tags_string);

    Ok(p)
}

/// Collect photos from MappedRows iterator, logging errors for failed items.
fn collect_photos<F>(photo_iter: rusqlite::MappedRows<'_, F>) -> photo::Photos
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<photo::Photo>,
{
    let mut photos = photo::Photos::new();
    for photo_result in photo_iter {
        match photo_result {
            Ok(p) => photos.photos.push(p),
            Err(e) => {
                log::error!(target: "get_photos", "burst_photo_error; error={}", e);
            }
        }
    }
    photos
}
