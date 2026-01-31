//! Face Batch Commands
//!
//! Tauri commands for batch operations on detected faces.

use crate::app_state::AppState;
use crate::repository::meta_db::sqlite::face_detection as face_repo;
use tauri::State;

/// Delete multiple detected faces (batch operation)
#[tauri::command]
pub fn delete_detected_faces_batch(
    state: State<AppState>,
    face_ids: Vec<i64>,
) -> Result<usize, String> {
    log::info!(
        target: "face_detection",
        "delete_detected_faces_batch; count={}; face_ids={:?}",
        face_ids.len(),
        face_ids
    );

    face_repo::delete_detected_faces_batch(&state.meta_db, &face_ids)
}

/// Assign multiple faces to a person (batch operation)
#[tauri::command]
pub fn assign_faces_to_person_batch(
    state: State<AppState>,
    face_ids: Vec<i64>,
    person_id: i64,
) -> Result<usize, String> {
    log::info!(
        target: "face_detection",
        "assign_faces_to_person_batch; person_id={}; count={}; face_ids={:?}",
        person_id,
        face_ids.len(),
        face_ids
    );

    face_repo::assign_faces_to_person_batch(&state.meta_db, &face_ids, person_id)
}
