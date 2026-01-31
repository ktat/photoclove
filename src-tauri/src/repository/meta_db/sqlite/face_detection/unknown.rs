//! Unknown Faces Operations
//!
//! Database operations for managing unknown (unassigned) faces.

use super::types::UnknownFaceRecord;
use super::super::SQLite;

/// Get count of unknown (unassigned) faces
pub fn get_unknown_faces_count(sqlite: &SQLite) -> Result<i64, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM detected_faces WHERE person_id IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count unknown faces: {}", e))?;

    Ok(count)
}

/// Get unknown (unassigned) faces with pagination
/// Sorted by detection time (newest first)
pub fn get_unknown_faces(
    sqlite: &SQLite,
    limit: u32,
    offset: u32,
) -> Result<Vec<UnknownFaceRecord>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT df.id, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height,
                    df.confidence, df.created_at
             FROM detected_faces df
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             WHERE df.person_id IS NULL
             ORDER BY df.created_at DESC
             LIMIT ? OFFSET ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let faces = stmt
        .query_map([limit, offset], |row| {
            Ok(UnknownFaceRecord {
                id: row.get(0)?,
                photo_path: row.get(1)?,
                bbox_x: row.get(2)?,
                bbox_y: row.get(3)?,
                bbox_width: row.get(4)?,
                bbox_height: row.get(5)?,
                confidence: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query unknown faces: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect unknown faces: {}", e))?;

    log::debug!(
        target: "face_detection",
        "get_unknown_faces; limit={}; offset={}; count={}",
        limit,
        offset,
        faces.len()
    );

    Ok(faces)
}
