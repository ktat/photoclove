//! Face Detection Repository Operations
//!
//! Database operations for storing and retrieving face detection results.

use super::SQLite;
use crate::entity::{config, photo};
use crate::value::file;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// Detected face data for database storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedFaceRecord {
    pub id: i64,
    pub photo_path: String,
    pub bbox_x: f32,
    pub bbox_y: f32,
    pub bbox_width: f32,
    pub bbox_height: f32,
    pub confidence: f32,
    pub embedding: Option<String>, // JSON array of floats
    pub person_id: Option<i64>,
    pub person_name: Option<String>,
    pub cluster_id: Option<i64>,
    pub created_at: String,
}

/// Person record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonRecord {
    pub id: i64,
    pub name: Option<String>,
    pub representative_face_id: Option<i64>,
    pub photo_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for saving a detected face
#[derive(Debug, Clone)]
pub struct DetectedFaceInput {
    pub photo_path: String,
    pub bbox_x: f32,
    pub bbox_y: f32,
    pub bbox_width: f32,
    pub bbox_height: f32,
    pub confidence: f32,
    pub embedding: Option<Vec<f32>>,
    pub person_id: Option<i64>,
}

/// Named face with embedding for matching
#[derive(Debug, Clone)]
pub struct NamedFaceEmbedding {
    pub person_id: i64,
    pub embedding: Vec<f32>,
}

/// Person with face thumbnail for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonListItem {
    pub person_id: i64,
    pub person_name: Option<String>,
    pub face_count: i32,
    pub photo_count: i32,
    pub photo_path: Option<String>,
    pub bbox_x: Option<f32>,
    pub bbox_y: Option<f32>,
    pub bbox_width: Option<f32>,
    pub bbox_height: Option<f32>,
}

/// Get photo_id from photo_metadata by path
fn get_photo_id(conn: &rusqlite::Connection, photo_path: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT id FROM photo_metadata WHERE path = ?",
        params![photo_path],
        |row| row.get(0),
    )
    .map_err(|e| format!("Photo not found in database: {} ({})", photo_path, e))
}

/// Save detected faces for a photo
pub fn save_detected_faces(
    sqlite: &SQLite,
    photo_path: &str,
    faces: &[DetectedFaceInput],
) -> Result<Vec<i64>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Get photo_id from photo_metadata
    let photo_id = get_photo_id(&conn, photo_path)?;

    // First, delete existing faces for this photo via mapping table
    // Get face IDs to delete
    let face_ids_to_delete: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT detected_face_id FROM photo_detected_faces WHERE photo_id = ?")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map(params![photo_id], |row| row.get(0))
            .map_err(|e| format!("Failed to query faces: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect face ids: {}", e))?
    };

    // Delete mappings
    conn.execute(
        "DELETE FROM photo_detected_faces WHERE photo_id = ?",
        params![photo_id],
    )
    .map_err(|e| format!("Failed to delete face mappings: {}", e))?;

    // Delete the actual faces
    for face_id in face_ids_to_delete {
        conn.execute("DELETE FROM detected_faces WHERE id = ?", params![face_id])
            .map_err(|e| format!("Failed to delete face: {}", e))?;
    }

    // Insert new faces
    let mut inserted_ids = Vec::new();

    for face in faces {
        let embedding_json = face.embedding.as_ref().map(|e| {
            serde_json::to_string(e).unwrap_or_else(|_| "[]".to_string())
        });

        // Insert into detected_faces (without photo_path)
        conn.execute(
            "INSERT INTO detected_faces (bbox_x, bbox_y, bbox_width, bbox_height, confidence, embedding, person_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                face.bbox_x,
                face.bbox_y,
                face.bbox_width,
                face.bbox_height,
                face.confidence,
                embedding_json,
                face.person_id,
            ],
        )
        .map_err(|e| format!("Failed to insert face: {}", e))?;

        let face_id = conn.last_insert_rowid();
        inserted_ids.push(face_id);

        // Create mapping entry
        conn.execute(
            "INSERT INTO photo_detected_faces (photo_id, detected_face_id) VALUES (?, ?)",
            params![photo_id, face_id],
        )
        .map_err(|e| format!("Failed to create face mapping: {}", e))?;
    }

    log::debug!(
        target: "face_detection",
        "saved_detected_faces; photo_path={}; photo_id={}; count={}",
        photo_path,
        photo_id,
        inserted_ids.len()
    );

    Ok(inserted_ids)
}

/// Get detected faces for a photo
pub fn get_detected_faces(
    sqlite: &SQLite,
    photo_path: &str,
) -> Result<Vec<DetectedFaceRecord>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT df.id, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height,
                    df.confidence, df.embedding, df.person_id, p.name, df.cluster_id, df.created_at
             FROM detected_faces df
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             LEFT JOIN persons p ON df.person_id = p.id
             WHERE pm.path = ?
             ORDER BY df.confidence DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let faces = stmt
        .query_map(params![photo_path], |row| {
            Ok(DetectedFaceRecord {
                id: row.get(0)?,
                photo_path: row.get(1)?,
                bbox_x: row.get(2)?,
                bbox_y: row.get(3)?,
                bbox_width: row.get(4)?,
                bbox_height: row.get(5)?,
                confidence: row.get(6)?,
                embedding: row.get(7)?,
                person_id: row.get(8)?,
                person_name: row.get(9)?,
                cluster_id: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to query faces: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect faces: {}", e))?;

    Ok(faces)
}

/// Check if a photo has been processed for face detection
pub fn has_detected_faces(sqlite: &SQLite, photo_path: &str) -> Result<bool, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_detected_faces pdf
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             WHERE pm.path = ?",
            params![photo_path],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count faces: {}", e))?;

    Ok(count > 0)
}

/// Get a single detected face by ID
pub fn get_detected_face(sqlite: &SQLite, face_id: i64) -> Result<DetectedFaceRecord, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.query_row(
        "SELECT df.id, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height,
                df.confidence, df.embedding, df.person_id, p.name, df.cluster_id, df.created_at
         FROM detected_faces df
         JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
         JOIN photo_metadata pm ON pdf.photo_id = pm.id
         LEFT JOIN persons p ON df.person_id = p.id
         WHERE df.id = ?",
        params![face_id],
        |row| {
            Ok(DetectedFaceRecord {
                id: row.get(0)?,
                photo_path: row.get(1)?,
                bbox_x: row.get(2)?,
                bbox_y: row.get(3)?,
                bbox_width: row.get(4)?,
                bbox_height: row.get(5)?,
                confidence: row.get(6)?,
                embedding: row.get(7)?,
                person_id: row.get(8)?,
                person_name: row.get(9)?,
                cluster_id: row.get(10)?,
                created_at: row.get(11)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get face {}: {}", face_id, e))
}

/// Get all faces with person_id (named faces) and their embeddings for matching
/// Returns only faces that have both a person_id and an embedding
pub fn get_named_face_embeddings(sqlite: &SQLite) -> Result<Vec<NamedFaceEmbedding>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT person_id, embedding FROM detected_faces
             WHERE person_id IS NOT NULL AND embedding IS NOT NULL",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let results = stmt
        .query_map([], |row| {
            let person_id: i64 = row.get(0)?;
            let embedding_json: String = row.get(1)?;
            Ok((person_id, embedding_json))
        })
        .map_err(|e| format!("Failed to query named faces: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect named faces: {}", e))?;

    // Parse embeddings and deduplicate by person_id (keep first embedding per person)
    let mut person_embeddings: std::collections::HashMap<i64, Vec<f32>> =
        std::collections::HashMap::new();

    for (person_id, embedding_json) in results {
        if person_embeddings.contains_key(&person_id) {
            continue; // Already have an embedding for this person
        }
        if let Ok(embedding) = serde_json::from_str::<Vec<f32>>(&embedding_json) {
            if !embedding.is_empty() {
                person_embeddings.insert(person_id, embedding);
            }
        }
    }

    Ok(person_embeddings
        .into_iter()
        .map(|(person_id, embedding)| NamedFaceEmbedding {
            person_id,
            embedding,
        })
        .collect())
}

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
/// Sorted by face count (most detected first)
pub fn get_all_persons_for_list(sqlite: &SQLite) -> Result<Vec<PersonListItem>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Get all persons with face count and one representative face for thumbnail
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
                df.bbox_height
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

    // Update person photo count (count distinct photos through mapping table)
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

    // First collect raw data as tuples
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

    // Fetch tags in bulk
    let photo_paths: Vec<String> = photos_data.iter().map(|(path, ..)| path.clone()).collect();
    let tags_map = super::tags::get_tags_for_photos_bulk(sqlite, &photo_paths)
        .unwrap_or_default();

    // Build Photo entities
    let mut photos = Vec::new();
    for (path, photo_date, star, comment, css_style, exif_orientation, burst_group_id) in photos_data {
        let file_entity = file::File::new(path.clone());
        let mut photo = photo::Photo::new(file_entity, config.clone());

        photo.set_time(photo_date);
        photo.star = if star > 0 { Some(star) } else { None };
        photo.comment = comment.filter(|c| !c.is_empty());
        photo.css_style = css_style;
        photo.burst_group_id = burst_group_id;

        if let Some(ref orientation) = exif_orientation {
            if !orientation.is_empty() {
                photo.meta_data.orientation = orientation.clone();
            }
        }

        if let Some(photo_tags) = tags_map.get(&path) {
            if !photo_tags.is_empty() {
                let tags: Vec<photo::PhotoTag> = photo_tags.iter()
                    .map(|(id, name, color)| photo::PhotoTag::new(*id, name.clone(), color.clone()))
                    .collect();
                photo.tags = Some(tags);
            }
        }

        photos.push(photo);
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

    // Unassign faces first
    conn.execute(
        "UPDATE detected_faces SET person_id = NULL WHERE person_id = ?",
        params![person_id],
    )
    .map_err(|e| format!("Failed to unassign faces: {}", e))?;

    // Delete person
    conn.execute("DELETE FROM persons WHERE id = ?", params![person_id])
        .map_err(|e| format!("Failed to delete person: {}", e))?;

    Ok(())
}

/// Get face detection statistics
pub fn get_face_detection_stats(sqlite: &SQLite) -> Result<FaceDetectionStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let total_faces: i64 = conn
        .query_row("SELECT COUNT(*) FROM detected_faces", [], |row| row.get(0))
        .unwrap_or(0);

    // Count distinct photos through mapping table
    let photos_with_faces: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT photo_id) FROM photo_detected_faces",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_persons: i64 = conn
        .query_row("SELECT COUNT(*) FROM persons", [], |row| row.get(0))
        .unwrap_or(0);

    let named_persons: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM persons WHERE name IS NOT NULL AND name != ''",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let assigned_faces: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM detected_faces WHERE person_id IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(FaceDetectionStats {
        total_faces,
        photos_with_faces,
        total_persons,
        named_persons,
        assigned_faces,
    })
}

/// Face detection statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceDetectionStats {
    pub total_faces: i64,
    pub photos_with_faces: i64,
    pub total_persons: i64,
    pub named_persons: i64,
    pub assigned_faces: i64,
}

/// Delete a detected face by ID
pub fn delete_detected_face(sqlite: &SQLite, face_id: i64) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Delete mapping first
    conn.execute(
        "DELETE FROM photo_detected_faces WHERE detected_face_id = ?",
        params![face_id],
    )
    .map_err(|e| format!("Failed to delete face mapping: {}", e))?;

    // Delete the face
    let rows_affected = conn
        .execute("DELETE FROM detected_faces WHERE id = ?", params![face_id])
        .map_err(|e| format!("Failed to delete face: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Face with ID {} not found", face_id));
    }

    log::info!(
        target: "face_detection",
        "deleted_detected_face; face_id={}",
        face_id
    );

    Ok(())
}

/// Person with face thumbnail info for UI selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonWithFace {
    pub person_id: i64,
    pub person_name: Option<String>,
    pub photo_path: String,
    pub bbox_x: f32,
    pub bbox_y: f32,
    pub bbox_width: f32,
    pub bbox_height: f32,
    pub similarity: f32, // Cosine similarity to target face (0-1)
}

/// Get all named persons with their face thumbnail info, sorted by similarity to target embedding
pub fn get_persons_with_faces(
    sqlite: &SQLite,
    target_embedding: Option<&[f32]>,
) -> Result<Vec<PersonWithFace>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Get all named persons with one of their faces
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height, df.embedding
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
            ))
        })
        .map_err(|e| format!("Failed to query persons: {}", e))?;

    let mut persons: Vec<PersonWithFace> = Vec::new();

    for row in rows {
        let (person_id, person_name, photo_path, bbox_x, bbox_y, bbox_width, bbox_height, embedding_json) =
            row.map_err(|e| format!("Failed to read row: {}", e))?;

        // Calculate similarity if we have both embeddings
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
        });
    }

    // Sort by similarity (highest first)
    persons.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));

    Ok(persons)
}
