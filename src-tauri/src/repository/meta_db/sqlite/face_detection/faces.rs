//! Face Detection Operations
//!
//! Database operations for storing and retrieving detected faces.

use super::super::SQLite;
use super::types::{DetectedFaceInput, DetectedFaceRecord, NamedFaceEmbedding};
use rusqlite::params;
use std::collections::HashMap;

/// Get photo_id from photo_metadata by path
pub fn get_photo_id(conn: &rusqlite::Connection, photo_path: &str) -> Result<i64, String> {
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
        let embedding_json = face
            .embedding
            .as_ref()
            .map(|e| serde_json::to_string(e).unwrap_or_else(|_| "[]".to_string()));

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

/// Get all face IDs (for batch operations like thumbnail regeneration)
pub fn get_all_face_ids(sqlite: &SQLite) -> Result<Vec<i64>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id FROM detected_faces ORDER BY id")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let ids = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query faces: {}", e))?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|e| format!("Failed to collect face IDs: {}", e))?;

    Ok(ids)
}

/// Get all faces with person_id (named faces) and their embeddings for matching
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

    let mut person_embeddings: HashMap<i64, Vec<f32>> = HashMap::new();

    for (person_id, embedding_json) in results {
        if person_embeddings.contains_key(&person_id) {
            continue;
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

/// Delete a detected face by ID
pub fn delete_detected_face(sqlite: &SQLite, face_id: i64) -> Result<(), String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    conn.execute(
        "DELETE FROM photo_detected_faces WHERE detected_face_id = ?",
        params![face_id],
    )
    .map_err(|e| format!("Failed to delete face mapping: {}", e))?;

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

/// Delete multiple detected faces by IDs (batch operation)
pub fn delete_detected_faces_batch(sqlite: &SQLite, face_ids: &[i64]) -> Result<usize, String> {
    if face_ids.is_empty() {
        return Ok(0);
    }

    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Build placeholders for IN clause
    let placeholders: String = face_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // Delete from mapping table first
    let sql_mapping = format!(
        "DELETE FROM photo_detected_faces WHERE detected_face_id IN ({})",
        placeholders
    );
    let params: Vec<&dyn rusqlite::ToSql> = face_ids
        .iter()
        .map(|id| id as &dyn rusqlite::ToSql)
        .collect();
    conn.execute(&sql_mapping, params.as_slice())
        .map_err(|e| format!("Failed to delete face mappings: {}", e))?;

    // Delete from detected_faces table
    let sql_faces = format!("DELETE FROM detected_faces WHERE id IN ({})", placeholders);
    let params: Vec<&dyn rusqlite::ToSql> = face_ids
        .iter()
        .map(|id| id as &dyn rusqlite::ToSql)
        .collect();
    let rows_affected = conn
        .execute(&sql_faces, params.as_slice())
        .map_err(|e| format!("Failed to delete faces: {}", e))?;

    log::info!(
        target: "face_detection",
        "deleted_detected_faces_batch; count={}; face_ids={:?}",
        rows_affected,
        face_ids
    );

    Ok(rows_affected)
}
