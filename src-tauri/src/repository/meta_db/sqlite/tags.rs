use rusqlite::params;

use super::SQLite;

/// Remove all tags from a photo
pub(super) fn remove_all_tags_from_photo(db: &SQLite, photo_path: &str) -> Result<i32, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let rows_affected = conn
        .execute(
            "DELETE FROM photo_collection_items WHERE photo_path = ?1 AND type = 'tag'",
            params![photo_path],
        )
        .map_err(|e| format!("Failed to remove all tags from photo: {}", e))?;

    Ok(rows_affected as i32)
}

/// Get all tags for multiple photos in one query (optimized for bulk loading)
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

/// Get all tags associated with a photo
pub(super) fn get_tags_for_photo(
    db: &SQLite,
    photo_path: &str,
) -> Result<Vec<(i32, String, Option<String>)>, String> {
    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.name, pc.color FROM photo_collections pc
             JOIN photo_collection_items pci ON pc.id = pci.collection_id and pc.type='tag'
             WHERE pci.photo_path = ?1
             ORDER BY pc.name",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let tags = stmt
        .query_map(params![photo_path], |row| {
            let id: i32 = row.get(0)?;
            let name: String = row.get(1)?;
            let color: Option<String> = row.get(2)?;
            Ok((id, name, color))
        })
        .map_err(|e| format!("Failed to query tags for photo: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect tags: {}", e))?;

    Ok(tags)
}

/// Get all photos that have all of the specified tags
pub(super) fn get_photos_with_tags(db: &SQLite, tag_ids: &[i32]) -> Result<Vec<String>, String> {
    if tag_ids.is_empty() {
        return Ok(vec![]);
    }

    let conn = db
        .get_connection()
        .map_err(|_| "Failed to connect to database".to_string())?;

    let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!(
        "SELECT DISTINCT pt.photo_path FROM photo_collection_items pt
         WHERE pt.collection_id IN ({})
         GROUP BY pt.photo_path
         HAVING COUNT(DISTINCT pt.collection_id) = ?",
        placeholders
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut params: Vec<&dyn rusqlite::ToSql> = tag_ids
        .iter()
        .map(|id| id as &dyn rusqlite::ToSql)
        .collect();
    let tag_count = tag_ids.len() as i32;
    params.push(&tag_count);

    let photos = stmt
        .query_map(params.as_slice(), |row| {
            let path: String = row.get(0)?;
            Ok(path)
        })
        .map_err(|e| format!("Failed to query photos with tags: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    Ok(photos)
}
