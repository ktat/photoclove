//! Search and filter operations for SQLite repository

use super::SQLite;
use super::filter_options;
use super::search_debug::{format_param_for_debug, create_embedded_sql, log_date_range_debug};
use crate::entity::photo::Photo;
use crate::entity::photo::Photos;
use crate::value::exif::ExifData;
use crate::value::file::File;

// Re-export filter options functions
pub use filter_options::{get_camera_options, get_lens_options, get_extension_options};

/// Add advanced filter conditions to SQL query
pub fn add_advanced_filters(
    _sqlite: &SQLite,
    sql_query: &mut String,
    params: &mut Vec<Box<dyn rusqlite::ToSql>>,
    filter_params: &serde_json::Value,
) -> Result<(), String> {
    // Date range filter - check exif_date_time_original, exif_date_time, and photo_date
    if let Some(start_date) = filter_params.get("start_date").and_then(|v| v.as_str()) {
        if !start_date.is_empty() {
            sql_query.push_str(
                " AND (exif_date_time_original >= ? OR exif_date_time >= ? OR photo_date >= ?)",
            );
            params.push(Box::new(start_date.to_string()));
            params.push(Box::new(start_date.to_string()));
            params.push(Box::new(start_date.to_string()));
        }
    }

    if let Some(end_date) = filter_params.get("end_date").and_then(|v| v.as_str()) {
        if !end_date.is_empty() {
            sql_query.push_str(
                " AND (exif_date_time_original <= ? OR exif_date_time <= ? OR photo_date <= ?)",
            );
            params.push(Box::new(end_date.to_string()));
            params.push(Box::new(end_date.to_string()));
            params.push(Box::new(end_date.to_string()));
        }
    }

    // Star rating filter
    if let Some(min_rating) = filter_params.get("min_rating").and_then(|v| v.as_i64()) {
        sql_query.push_str(" AND star >= ?");
        params.push(Box::new(min_rating));
    }

    // Camera filter - match the same ID format used in options generation
    if let Some(camera) = filter_params.get("camera").and_then(|v| v.as_str()) {
        if !camera.is_empty() && camera != "all" {
            if camera == "unknown" {
                // Filter for photos with unknown camera info
                sql_query.push_str(" AND (exif_make IS NULL OR exif_model IS NULL OR exif_make = '' OR exif_model = '')");
            } else {
                sql_query.push_str(" AND LOWER(REPLACE(exif_make, ' ', '_') || '_' || REPLACE(exif_model, ' ', '_')) = ?");
                params.push(Box::new(camera.to_string()));
            }
        }
    }

    // Lens filter - match the same ID format used in options generation
    if let Some(lens) = filter_params.get("lens").and_then(|v| v.as_str()) {
        if !lens.is_empty() && lens != "all" {
            sql_query.push_str(" AND LOWER(REPLACE(exif_lens_model, ' ', '_')) = ?");
            params.push(Box::new(lens.to_string()));
        }
    }

    // ISO range filter
    if let Some(iso_min) = filter_params.get("iso_min").and_then(|v| v.as_i64()) {
        sql_query.push_str(" AND CAST(exif_iso AS INTEGER) >= ?");
        params.push(Box::new(iso_min));
    }

    if let Some(iso_max) = filter_params.get("iso_max").and_then(|v| v.as_i64()) {
        sql_query.push_str(" AND CAST(exif_iso AS INTEGER) <= ?");
        params.push(Box::new(iso_max));
    }

    // Aperture range filter
    if let Some(aperture_min) = filter_params.get("aperture_min").and_then(|v| v.as_f64()) {
        sql_query.push_str(" AND CAST(exif_fnumber AS REAL) >= ?");
        params.push(Box::new(aperture_min));
    }

    if let Some(aperture_max) = filter_params.get("aperture_max").and_then(|v| v.as_f64()) {
        sql_query.push_str(" AND CAST(exif_fnumber AS REAL) <= ?");
        params.push(Box::new(aperture_max));
    }

    // Focal length range filter
    if let Some(focal_min) = filter_params
        .get("focal_length_min")
        .and_then(|v| v.as_f64())
    {
        sql_query.push_str(" AND CAST(exif_focal_length AS REAL) >= ?");
        params.push(Box::new(focal_min));
    }

    if let Some(focal_max) = filter_params
        .get("focal_length_max")
        .and_then(|v| v.as_f64())
    {
        sql_query.push_str(" AND CAST(exif_focal_length AS REAL) <= ?");
        params.push(Box::new(focal_max));
    }

    // Shutter speed range filter
    if let Some(shutter_min) = filter_params
        .get("shutter_speed_min")
        .and_then(|v| v.as_str())
    {
        if !shutter_min.is_empty() {
            sql_query.push_str(" AND exif_shutter_speed_value >= ?");
            params.push(Box::new(shutter_min.to_string()));
        }
    }

    if let Some(shutter_max) = filter_params
        .get("shutter_speed_max")
        .and_then(|v| v.as_str())
    {
        if !shutter_max.is_empty() {
            sql_query.push_str(" AND exif_shutter_speed_value <= ?");
            params.push(Box::new(shutter_max.to_string()));
        }
    }

    // File extension filter
    if let Some(extension) = filter_params.get("extension").and_then(|v| v.as_str()) {
        if !extension.is_empty() && extension != "all" {
            sql_query.push_str(" AND path LIKE ?");
            params.push(Box::new(format!("%.{}", extension)));
        }
    }

    // Has comments filter
    if let Some(has_comments) = filter_params.get("has_comments").and_then(|v| v.as_bool()) {
        if has_comments {
            sql_query.push_str(" AND comment IS NOT NULL AND comment != ''");
        }
    }

    // Tag filter - only include photos that have ALL selected tags
    if let Some(tag_ids) = filter_params.get("tag_ids").and_then(|v| v.as_array()) {
        if !tag_ids.is_empty() {
            let tag_id_values: Vec<i64> = tag_ids.iter().filter_map(|v| v.as_i64()).collect();

            if !tag_id_values.is_empty() {
                // Use subquery to find photos that have ALL the specified tags
                let placeholders: Vec<String> =
                    tag_id_values.iter().map(|_| "?".to_string()).collect();
                let placeholders_str = placeholders.join(",");

                sql_query.push_str(&format!(
                    " AND path IN (SELECT photo_path FROM photo_collection_items pci
                      JOIN photo_collections pc ON pc.id = pci.collection_id and pc.type = 'tag'
                      WHERE pci.collection_id IN ({})
                      GROUP BY pci.photo_path HAVING COUNT(DISTINCT pci.collection_id) = ?)",
                    placeholders_str
                ));

                // Add the tag IDs as parameters
                for tag_id in &tag_id_values {
                    params.push(Box::new(*tag_id));
                }
                // Add the count of tags for the HAVING clause
                params.push(Box::new(tag_id_values.len() as i64));
            }
        }
    }

    Ok(())
}

/// Search photos with query and filters
pub fn search_photos(
    sqlite: &SQLite,
    query: &str,
    search_type: &str,
    filters: &str,
    sort_field: &str,
    sort_order: &str,
    max_photos_per_fetch: u32,
) -> Result<String, String> {
    let start_time = std::time::Instant::now();

    log::debug!(
        target: "database",
        "search_photos_start; query={}; search_type={}; filters={}; sort_field={}; sort_order={}",
        query, search_type, filters, sort_field, sort_order
    );

    let conn = sqlite.get_connection().map_err(|e| e.to_string())?;

    // Parse filters JSON
    let filter_params: serde_json::Value =
        serde_json::from_str(filters).unwrap_or(serde_json::json!({}));

    log::debug!(
        target: "database",
        "filters_parsed; filter_count={}",
        filter_params.as_object().map_or(0, |obj| obj.len())
    );

    // Build search query based on search_type with tags
    let mut sql_query = String::from("
    SELECT pm.*, GROUP_CONCAT(pc.id || ':' || pc.name || ':' || COALESCE(pc.color, '')) as tags -- 2
    FROM photo_metadata pm
    LEFT JOIN photo_collection_items pci ON pm.path = pci.photo_path
    LEFT JOIN photo_collections pc ON pc.id = pci.collection_id AND pc.type = 'tag'
    WHERE (pm.delete_flg = 0 OR pm.delete_flg IS NULL)");

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Add search condition based on search_type (only if query is not empty)
    if !query.is_empty() {
        add_search_condition(&mut sql_query, &mut params, query, search_type);
    }

    // Add advanced filters
    add_advanced_filters(sqlite, &mut sql_query, &mut params, &filter_params)?;

    // Debug logging
    let param_strings: Vec<String> = params
        .iter()
        .enumerate()
        .map(|(i, param)| format_param_for_debug(i, param))
        .collect();

    let embedded_sql = create_embedded_sql(&sql_query, &params);

    log::debug!(
        target: "database",
        "sql_with_params; query={}; params=[{}]",
        sql_query,
        param_strings.join(", ")
    );

    log::debug!(
        target: "database",
        "sql_embedded; query={}",
        embedded_sql
    );

    // Debug: Sample database date ranges to help troubleshooting
    if filter_params.get("start_date").is_some() || filter_params.get("end_date").is_some() {
        log_date_range_debug(&conn);
    }

    // Add GROUP BY clause for tag aggregation
    sql_query.push_str(" GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.google_photos_url, pm.exif_date_time_original, pm.exif_make, pm.exif_model, pm.exif_lens_model");

    // Add ORDER BY clause with primary and secondary sort fields
    add_order_by_clause(&mut sql_query, sort_field, sort_order);

    // Add LIMIT clause
    sql_query.push_str(&format!(" LIMIT {}", max_photos_per_fetch));

    // Log the complete SQL with ORDER BY and LIMIT
    log::debug!(
        target: "database",
        "sql_with_params_complete; query={}; params=[{}]",
        sql_query,
        param_strings.join(", ")
    );

    // Execute query
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    log::info!(target: "database", "search_photos_final_query; query={}; param_count={}", sql_query, param_refs.len());

    let mut stmt = conn.prepare(&sql_query).map_err(|e| e.to_string())?;
    let photo_iter = stmt.query_map(&param_refs[..], |row| {
        map_row_to_photo(row)
    }).map_err(|e| e.to_string())?;

    let mut photos = Photos::new();
    for photo_result in photo_iter {
        match photo_result {
            Ok(photo) => {
                log::info!(target: "database", "search_photos_photo_added; path={}; has_tags={}",
                    photo.file.path, photo.tags.is_some());
                photos.photos.push(photo);
            }
            Err(e) => {
                log::error!(target: "database", "search_photos_photo_error; error={}", e);
            }
        }
    }

    let final_count = photos.photos.len();
    let duration = start_time.elapsed();

    let json_response = photos.to_json();

    log::info!(
        target: "database",
        "search_photos_complete; result_count={}; limit={}; duration_ms={}",
        final_count,
        max_photos_per_fetch,
        duration.as_millis()
    );

    // Log first photo with tags for debugging
    if let Some(first_photo) = photos.photos.first() {
        if let Some(tags) = &first_photo.tags {
            log::info!(target: "database", "search_photos_response_sample; first_photo_tags={:?}; path={:?}",
                tags, first_photo.file.path);
        }
    }

    Ok(json_response)
}

/// Add search condition based on search_type
fn add_search_condition(
    sql_query: &mut String,
    params: &mut Vec<Box<dyn rusqlite::ToSql>>,
    query: &str,
    search_type: &str,
) {
    match search_type {
        "filename" => {
            sql_query.push_str(" AND path LIKE ?");
            params.push(Box::new(format!("%{}%", query)));
        }
        "comment" => {
            sql_query.push_str(" AND comment LIKE ?");
            params.push(Box::new(format!("%{}%", query)));
        }
        "camera" => {
            sql_query.push_str(" AND (exif_make LIKE ? OR exif_model LIKE ?)");
            params.push(Box::new(format!("%{}%", query)));
            params.push(Box::new(format!("%{}%", query)));
        }
        "settings" => {
            sql_query.push_str(" AND (exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ? OR exif_shutter_speed_value LIKE ?)");
            let query_pattern = format!("%{}%", query);
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern));
        }
        "date" => {
            sql_query.push_str(" AND (exif_date_time_original LIKE ? OR exif_date_time LIKE ? OR photo_date LIKE ?)");
            let query_pattern = format!("%{}%", query);
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern));
        }
        "exif" => {
            sql_query.push_str(" AND (exif_make LIKE ? OR exif_model LIKE ? OR exif_lens_model LIKE ? OR exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ? OR exif_shutter_speed_value LIKE ?)");
            let query_pattern = format!("%{}%", query);
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern));
        }
        "all" => {
            sql_query.push_str(" AND (path LIKE ? OR comment LIKE ? OR exif_make LIKE ? OR exif_model LIKE ? OR exif_lens_model LIKE ? OR exif_iso LIKE ? OR exif_fnumber LIKE ? OR exif_focal_length LIKE ?)");
            let query_pattern = format!("%{}%", query);
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern.clone()));
            params.push(Box::new(query_pattern));
        }
        _ => {
            sql_query.push_str(" AND path LIKE ?");
            params.push(Box::new(format!("%{}%", query)));
        }
    }
}

/// Add ORDER BY clause with primary and secondary sort fields
///
/// # Security
/// This function uses whitelist validation for both sort_field and sort_order:
/// - sort_field: Only recognized column names are used (via match expression)
/// - sort_order: Normalized to "ASC" or "DESC" only
/// Unknown values fall through to safe defaults, preventing SQL injection.
fn add_order_by_clause(sql_query: &mut String, sort_field: &str, sort_order: &str) {
    let order_direction = if sort_order.to_lowercase() == "asc" {
        "ASC"
    } else {
        "DESC"
    };
    let secondary_direction = "DESC";

    match sort_field {
        "exif_date_time_original" => {
            sql_query.push_str(&format!(
                " ORDER BY pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}",
                order_direction, secondary_direction, secondary_direction
            ));
        }
        "photo_date" => {
            sql_query.push_str(&format!(
                " ORDER BY pm.photo_date {}, pm.exif_date_time_original {}, pm.path {}",
                order_direction, secondary_direction, secondary_direction
            ));
        }
        "path" => {
            sql_query.push_str(&format!(
                " ORDER BY pm.path {}, pm.exif_date_time_original {}, pm.photo_date {}",
                order_direction, secondary_direction, secondary_direction
            ));
        }
        "star" => {
            let null_handling = if sort_order.to_lowercase() == "desc" {
                "NULLS LAST"
            } else {
                "NULLS FIRST"
            };
            sql_query.push_str(&format!(" ORDER BY pm.star {} {}, pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}",
                order_direction, null_handling, secondary_direction, secondary_direction, secondary_direction));
        }
        _ => {
            // Unknown sort_field - log for debugging and use safe default
            // This provides defense-in-depth against SQL injection attempts
            if !sort_field.is_empty() && !["exif_date_time_original", "photo_date", "path", "star"].contains(&sort_field) {
                log::warn!(target: "search", "unknown_sort_field; field={}; using_default=exif_date_time_original", sort_field);
            }
            sql_query.push_str(&format!(
                " ORDER BY pm.exif_date_time_original {}, pm.photo_date {}, pm.path {}",
                order_direction, secondary_direction, secondary_direction
            ));
        }
    }
}

/// Map a database row to a Photo entity
fn map_row_to_photo(row: &rusqlite::Row) -> Result<Photo, rusqlite::Error> {
    let photo_path = row.get::<_, String>("path").unwrap_or_default();

    // Create Photo entity from file path
    let file_result = File::new_if_exists(photo_path.clone());
    if file_result.is_none() {
        return Err(rusqlite::Error::InvalidPath(photo_path.into()));
    }
    let file = file_result.unwrap();

    // Get config for thumbnail checking
    let config = crate::entity::config::Config::new();
    let mut photo = Photo::new(file, Some(config));

    // Set thumbnail status
    photo.set_has_thumbnail();

    // Set metadata from database
    let star = row.get::<_, i32>("star").unwrap_or(0);
    photo.set_star(star);

    let comment = row.get::<_, Option<String>>("comment").unwrap_or_default().unwrap_or_default();
    photo.set_comment(comment);

    // Set EXIF data
    let mut exif_data = ExifData::empty();
    if let Some(date_time) = row.get::<_, Option<String>>("exif_date_time_original").unwrap_or_default() {
        exif_data.date_time = date_time;
    }
    if let Some(orientation) = row.get::<_, Option<String>>("exif_orientation").unwrap_or_default() {
        exif_data.orientation = orientation;
    }
    photo.embed_exif(exif_data);

    // Process tags from concatenated string: "id:name:color,id:name:color"
    let tags_string = row.get::<_, Option<String>>("tags").unwrap_or_default();

    log::info!(target: "database", "search_photos_row_tags; path={}; raw_tags={:?}", photo_path, tags_string);

    photo.set_tags_from_string(tags_string);

    Ok(photo)
}
