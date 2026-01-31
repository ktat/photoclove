//! Face Detection Type Definitions
//!
//! Data structures for face detection and person management.

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

/// Face detection statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceDetectionStats {
    pub total_faces: i64,
    pub photos_with_faces: i64,
    pub total_persons: i64,
    pub named_persons: i64,
    pub assigned_faces: i64,
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

/// Unknown face record for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnknownFaceRecord {
    pub id: i64,
    pub photo_path: String,
    pub bbox_x: f32,
    pub bbox_y: f32,
    pub bbox_width: f32,
    pub bbox_height: f32,
    pub confidence: f32,
    pub created_at: String,
}
