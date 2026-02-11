//! Person Management Operations
//!
//! Database operations for managing persons and face assignments.

use super::types::{PersonListItem, PersonRecord, PersonWithFace};
use super::super::SQLite;
use crate::entity::{config, photo};
use crate::value::file;
use rusqlite::params;

/// Create a new person
pub fn create_person(sqlite: &SQLite, name: Option<&str>) -> Result<i64, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.execute(
        "INSERT INTO persons (name) VALUES (?)",
        params![name],
    )
    .map_err(|e| format!("Failed to create person: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Update person name
pub fn update_person_name(sqlite: &SQLite, person_id: i64, name: &str) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.execute(
        "UPDATE persons SET name = ?, updated_at = datetime('now') WHERE id = ?",
        params![name, person_id],
    )
    .map_err(|e| format!("Failed to update person: {}", e))?;

    Ok(())
}

/// Get all persons
pub fn get_all_persons(sqlite: &SQLite) -> Result<Vec<PersonRecord>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, representative_face_id, photo_count, created_at, updated_at
             FROM persons
             ORDER BY photo_count DESC, name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let persons = stmt
        .query_map([], |row| {
            Ok(PersonRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                representative_face_id: row.get(2)?,
                photo_count: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query persons: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect persons: {}", e))?;

    Ok(persons)
}

/// Get all persons with face count and thumbnail for list display
pub fn get_all_persons_for_list(sqlite: &SQLite) -> Result<Vec<PersonListItem>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT
                p.id as person_id,
                p.name as person_name,
                (SELECT COUNT(*) FROM detected_faces df WHERE df.person_id = p.id) as face_count,
                p.photo_count,
                pm.path as photo_path,
                df.bbox_x,
                df.bbox_y,
                df.bbox_width,
                df.bbox_height,
                df.id as representative_face_id
             FROM persons p
             LEFT JOIN (
                SELECT df.*, pdf.photo_id,
                       ROW_NUMBER() OVER (PARTITION BY df.person_id ORDER BY df.confidence DESC) as rn
                FROM detected_faces df
                JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
                WHERE df.person_id IS NOT NULL
             ) df ON df.person_id = p.id AND df.rn = 1
             LEFT JOIN photo_metadata pm ON df.photo_id = pm.id
             ORDER BY face_count DESC, p.name ASC NULLS LAST",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let persons = stmt
        .query_map([], |row| {
            Ok(PersonListItem {
                person_id: row.get(0)?,
                person_name: row.get(1)?,
                face_count: row.get(2)?,
                photo_count: row.get(3)?,
                photo_path: row.get(4)?,
                bbox_x: row.get(5)?,
                bbox_y: row.get(6)?,
                bbox_width: row.get(7)?,
                bbox_height: row.get(8)?,
                representative_face_id: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query persons: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect persons: {}", e))?;

    Ok(persons)
}

/// Assign a face to a person
pub fn assign_face_to_person(
    sqlite: &SQLite,
    face_id: i64,
    person_id: i64,
) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.execute(
        "UPDATE detected_faces SET person_id = ? WHERE id = ?",
        params![person_id, face_id],
    )
    .map_err(|e| format!("Failed to assign face: {}", e))?;

    conn.execute(
        "UPDATE persons SET
            photo_count = (
                SELECT COUNT(DISTINCT pdf.photo_id)
                FROM detected_faces df
                JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
                WHERE df.person_id = ?
            ),
            updated_at = datetime('now')
         WHERE id = ?",
        params![person_id, person_id],
    )
    .map_err(|e| format!("Failed to update person count: {}", e))?;

    Ok(())
}

/// Assign multiple faces to a person (batch operation)
pub fn assign_faces_to_person_batch(
    sqlite: &SQLite,
    face_ids: &[i64],
    person_id: i64,
) -> Result<usize, String> {
    if face_ids.is_empty() {
        return Ok(0);
    }

    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Build placeholders for IN clause
    let placeholders: String = face_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // Update detected_faces
    let sql = format!(
        "UPDATE detected_faces SET person_id = ? WHERE id IN ({})",
        placeholders
    );
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![&person_id as &dyn rusqlite::ToSql];
    params.extend(face_ids.iter().map(|id| id as &dyn rusqlite::ToSql));

    let rows_affected = conn
        .execute(&sql, params.as_slice())
        .map_err(|e| format!("Failed to assign faces: {}", e))?;

    // Update person's photo_count
    conn.execute(
        "UPDATE persons SET
            photo_count = (
                SELECT COUNT(DISTINCT pdf.photo_id)
                FROM detected_faces df
                JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
                WHERE df.person_id = ?
            ),
            updated_at = datetime('now')
         WHERE id = ?",
        params![person_id, person_id],
    )
    .map_err(|e| format!("Failed to update person count: {}", e))?;

    log::info!(
        target: "face_detection",
        "assigned_faces_to_person_batch; person_id={}; count={}; face_ids={:?}",
        person_id,
        rows_affected,
        face_ids
    );

    Ok(rows_affected)
}

/// Get photos containing a specific person (paths only)
pub fn get_photos_for_person(
    sqlite: &SQLite,
    person_id: i64,
) -> Result<Vec<String>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT pm.path
             FROM detected_faces df
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             WHERE df.person_id = ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let paths = stmt
        .query_map(params![person_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    Ok(paths)
}

/// Get full photo objects for a specific person
pub fn get_photos_for_person_full(
    sqlite: &SQLite,
    person_id: i64,
    sort_value: i32,
    config: Option<config::Config>,
) -> Result<Vec<photo::Photo>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let order_clause = crate::repository::sort_to_order_by_clause(sort_value, "pm");

    let query = format!(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style,
                pm.google_photos_url, pm.exif_orientation, pm.burst_group_id
         FROM photo_metadata pm
         WHERE pm.path IN (
             SELECT DISTINCT pm2.path
             FROM detected_faces df
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm2 ON pdf.photo_id = pm2.id
             WHERE df.person_id = ?
         ) AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
         {}",
        order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    #[allow(clippy::type_complexity)]
    let photos_data: Vec<(String, String, i32, Option<String>, Option<String>, Option<String>, Option<String>)> = stmt
        .query_map(params![person_id], |row| {
            let path: String = row.get(0)?;
            let photo_date: String = row.get(1)?;
            let star: i32 = row.get::<_, i32>(2).unwrap_or(0);
            let comment: Option<String> = row.get(3)?;
            let css_style: Option<String> = row.get(4)?;
            let exif_orientation: Option<String> = row.get(6)?;
            let burst_group_id: Option<String> = row.get(7)?;

            Ok((path, photo_date, star, comment, css_style, exif_orientation, burst_group_id))
        })
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    let photo_paths: Vec<String> = photos_data.iter().map(|(path, ..)| path.clone()).collect();
    let tags_map = super::super::tags::get_tags_for_photos_bulk(sqlite, &photo_paths)
        .unwrap_or_default();

    let mut photos = Vec::new();
    for (path, photo_date, star, comment, css_style, exif_orientation, burst_group_id) in photos_data {
        let file_entity = file::File::from_relative(path.clone());
        let mut photo_entity = photo::Photo::new(file_entity, config.clone());

        photo_entity.set_time(photo_date);
        photo_entity.star = if star > 0 { Some(star) } else { None };
        photo_entity.comment = comment.filter(|c| !c.is_empty());
        photo_entity.css_style = css_style;
        photo_entity.burst_group_id = burst_group_id;

        if let Some(ref orientation) = exif_orientation {
            if !orientation.is_empty() {
                photo_entity.meta_data.orientation = orientation.clone();
            }
        }

        if let Some(photo_tags) = tags_map.get(&path) {
            if !photo_tags.is_empty() {
                let tags: Vec<photo::PhotoTag> = photo_tags.iter()
                    .map(|(id, name, color)| photo::PhotoTag::new(*id, name.clone(), color.clone()))
                    .collect();
                photo_entity.tags = Some(tags);
            }
        }

        photos.push(photo_entity);
    }

    log::info!(target: "face_detection", "get_photos_for_person_full; person_id={}; sort={}; count={}",
        person_id, sort_value, photos.len());

    Ok(photos)
}

/// Delete a person (faces remain but become unassigned)
pub fn delete_person(sqlite: &SQLite, person_id: i64) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.execute(
        "UPDATE detected_faces SET person_id = NULL WHERE person_id = ?",
        params![person_id],
    )
    .map_err(|e| format!("Failed to unassign faces: {}", e))?;

    conn.execute("DELETE FROM persons WHERE id = ?", params![person_id])
        .map_err(|e| format!("Failed to delete person: {}", e))?;

    Ok(())
}

/// Get all named persons with their face thumbnail info, sorted by similarity to target embedding
pub fn get_persons_with_faces(
    sqlite: &SQLite,
    target_embedding: Option<&[f32]>,
) -> Result<Vec<PersonWithFace>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height, df.embedding, df.id as face_id
             FROM persons p
             JOIN detected_faces df ON df.person_id = p.id
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             WHERE p.name IS NOT NULL AND p.name != ''
             GROUP BY p.id
             ORDER BY p.name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f32>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, f32>(5)?,
                row.get::<_, f32>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })
        .map_err(|e| format!("Failed to query persons: {}", e))?;

    let mut persons: Vec<PersonWithFace> = Vec::new();

    for row in rows {
        let (person_id, person_name, photo_path, bbox_x, bbox_y, bbox_width, bbox_height, embedding_json, representative_face_id) =
            row.map_err(|e| format!("Failed to read row: {}", e))?;

        let similarity = match (target_embedding, &embedding_json) {
            (Some(target), Some(json)) => {
                if let Ok(stored_embedding) = serde_json::from_str::<Vec<f32>>(json) {
                    crate::domain_service::face_detection::embedder::cosine_similarity(
                        target,
                        &stored_embedding,
                    )
                } else {
                    0.0
                }
            }
            _ => 0.0,
        };

        persons.push(PersonWithFace {
            person_id,
            person_name,
            photo_path,
            bbox_x,
            bbox_y,
            bbox_width,
            bbox_height,
            similarity,
            representative_face_id,
        });
    }

    persons.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));

    Ok(persons)
}
