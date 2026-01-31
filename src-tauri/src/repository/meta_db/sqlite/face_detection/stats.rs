//! Face Detection Statistics
//!
//! Database operations for face detection statistics.

use super::types::FaceDetectionStats;
use super::super::SQLite;

/// Get face detection statistics
pub fn get_face_detection_stats(sqlite: &SQLite) -> Result<FaceDetectionStats, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let total_faces: i64 = conn
        .query_row("SELECT COUNT(*) FROM detected_faces", [], |row| row.get(0))
        .unwrap_or(0);

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
