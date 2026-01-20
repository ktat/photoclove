use super::SQLite;

/// Get all tags for multiple photos in one query (optimized for bulk loading)
///
/// This is an internal optimization function used by collections.rs
/// to efficiently load tags for multiple photos at once.
pub(super) fn get_tags_for_photos_bulk(
    db: &SQLite,
    photo_paths: &[String],
) -> Result<std::collections::HashMap<String, Vec<(i32, String, Option<String>)>>, String> {
    use std::collections::HashMap;

    if photo_paths.is_empty() {
        return Ok(HashMap::new());
    }

    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    // Build IN clause with placeholders
    let placeholders = photo_paths.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!(
        "SELECT pci.photo_path, pc.id, pc.name, pc.color
         FROM photo_collection_items pci
         JOIN photo_collections pc ON pc.id = pci.collection_id AND pc.type='tag'
         WHERE pci.photo_path IN ({})
         ORDER BY pci.photo_path, pc.name",
        placeholders
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare bulk tags query: {}", e))?;

    // Create params vector
    let params: Vec<&dyn rusqlite::ToSql> = photo_paths
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let mut tags_map: HashMap<String, Vec<(i32, String, Option<String>)>> = HashMap::new();

    let rows = stmt
        .query_map(params.as_slice(), |row| {
            let photo_path: String = row.get(0)?;
            let tag_id: i32 = row.get(1)?;
            let tag_name: String = row.get(2)?;
            let tag_color: Option<String> = row.get(3)?;
            Ok((photo_path, tag_id, tag_name, tag_color))
        })
        .map_err(|e| format!("Failed to query bulk tags: {}", e))?;

    for row_result in rows {
        let (photo_path, tag_id, tag_name, tag_color) = row_result
            .map_err(|e| format!("Failed to process tag row: {}", e))?;

        tags_map
            .entry(photo_path)
            .or_insert_with(Vec::new)
            .push((tag_id, tag_name, tag_color));
    }

    Ok(tags_map)
}

/// Get tags for a photo with metadata (for AI tag confidence display)
///
/// # Arguments
/// * `db` - Database connection
/// * `photo_path` - Path to the photo
///
/// # Returns
/// Vector of (id, name, color, metadata) tuples where metadata contains AI tag info
pub(super) fn get_tags_for_photo_with_metadata(
    db: &SQLite,
    photo_path: &str,
) -> Result<Vec<(i32, String, Option<String>, Option<String>)>, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.name, pc.color, pci.metadata FROM photo_collections pc
             JOIN photo_collection_items pci ON pc.id = pci.collection_id
             WHERE pci.photo_path = ?1 AND pc.type = 'tag'
             ORDER BY pc.name",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt
        .query_map(rusqlite::params![photo_path], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| format!("Failed to query tags: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect results: {}", e))?;

    Ok(result)
}
