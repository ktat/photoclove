//! AI tagging, face detection, and collection helpers on [`SQLite`].
//!
//! Split out of `mod.rs`, which had grown past the repository's file-length
//! limit. These are inherent methods rather than `MetaInfoDB` ones because the
//! AI features call them directly, and Rust lets an inherent impl live in any
//! module of the defining crate - so the move is purely a relocation.

use super::{collections, face_detection, tags, SQLite};
use crate::entity::{config, photo};

/// Additional methods for AI tagging support
impl SQLite {
    /// Get or create a collection by name and type
    pub fn get_or_create_collection(
        &self,
        name: &str,
        collection_type: &str,
    ) -> Result<i32, String> {
        collections::get_or_create_collection(self, name, collection_type)
    }

    /// Add a photo to a collection with optional metadata
    pub fn add_photo_to_collection_with_metadata(
        &self,
        collection_id: i32,
        photo_path: &str,
        metadata: Option<String>,
    ) -> Result<(), String> {
        collections::add_photo_to_collection_with_metadata(
            self,
            collection_id,
            photo_path,
            metadata,
        )
    }

    /// Get tags for a photo with metadata (for AI tag confidence display)
    #[allow(clippy::type_complexity)]
    pub fn get_tags_for_photo_with_metadata(
        &self,
        photo_path: &str,
    ) -> Result<Vec<(i32, String, Option<String>, Option<String>)>, String> {
        tags::get_tags_for_photo_with_metadata(self, photo_path)
    }

    /// Get tags for multiple photos in bulk (optimized for burst detection)
    #[allow(clippy::type_complexity)]
    pub fn get_tags_for_photos_bulk(
        &self,
        photo_paths: &[String],
    ) -> Result<std::collections::HashMap<String, Vec<(i32, String, Option<String>)>>, String> {
        tags::get_tags_for_photos_bulk(self, photo_paths)
    }

    // ==================== Face Detection Operations ====================

    /// Save detected faces for a photo
    pub fn save_detected_faces(
        &self,
        photo_path: &str,
        faces: &[face_detection::DetectedFaceInput],
    ) -> Result<Vec<i64>, String> {
        face_detection::save_detected_faces(self, photo_path, faces)
    }

    /// Get detected faces for a photo
    pub fn get_detected_faces(
        &self,
        photo_path: &str,
    ) -> Result<Vec<face_detection::DetectedFaceRecord>, String> {
        face_detection::get_detected_faces(self, photo_path)
    }

    /// Check if a photo has been processed for face detection
    pub fn has_detected_faces(&self, photo_path: &str) -> Result<bool, String> {
        face_detection::has_detected_faces(self, photo_path)
    }

    /// Get a single detected face by ID
    pub fn get_detected_face(
        &self,
        face_id: i64,
    ) -> Result<face_detection::DetectedFaceRecord, String> {
        face_detection::get_detected_face(self, face_id)
    }

    /// Get all face IDs (for batch operations)
    pub fn get_all_face_ids(&self) -> Result<Vec<i64>, String> {
        face_detection::get_all_face_ids(self)
    }

    /// Get all named face embeddings for matching
    pub fn get_named_face_embeddings(
        &self,
    ) -> Result<Vec<face_detection::NamedFaceEmbedding>, String> {
        face_detection::get_named_face_embeddings(self)
    }

    /// Create a new person
    pub fn create_person(&self, name: Option<&str>) -> Result<i64, String> {
        face_detection::create_person(self, name)
    }

    /// Update person name
    pub fn update_person_name(&self, person_id: i64, name: &str) -> Result<(), String> {
        face_detection::update_person_name(self, person_id, name)
    }

    /// Get all persons
    pub fn get_all_persons(&self) -> Result<Vec<face_detection::PersonRecord>, String> {
        face_detection::get_all_persons(self)
    }

    /// Get all persons with face count and thumbnail for list display
    pub fn get_all_persons_for_list(&self) -> Result<Vec<face_detection::PersonListItem>, String> {
        face_detection::get_all_persons_for_list(self)
    }

    /// Get all named persons with face thumbnail info, sorted by similarity to target embedding
    pub fn get_persons_with_faces(
        &self,
        target_embedding: Option<&[f32]>,
    ) -> Result<Vec<face_detection::PersonWithFace>, String> {
        face_detection::get_persons_with_faces(self, target_embedding)
    }

    /// Assign a face to a person
    pub fn assign_face_to_person(&self, face_id: i64, person_id: i64) -> Result<(), String> {
        face_detection::assign_face_to_person(self, face_id, person_id)
    }

    /// Get photos containing a specific person (paths only)
    pub fn get_photos_for_person(&self, person_id: i64) -> Result<Vec<String>, String> {
        face_detection::get_photos_for_person(self, person_id)
    }

    /// Get full photo objects for a specific person
    pub fn get_photos_for_person_full(
        &self,
        person_id: i64,
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        face_detection::get_photos_for_person_full(self, person_id, sort_value, config)
    }

    /// Delete a person
    pub fn delete_person(&self, person_id: i64) -> Result<(), String> {
        face_detection::delete_person(self, person_id)
    }

    /// Get face detection statistics
    pub fn get_face_detection_stats(&self) -> Result<face_detection::FaceDetectionStats, String> {
        face_detection::get_face_detection_stats(self)
    }

    /// Delete a detected face by ID
    pub fn delete_detected_face(&self, face_id: i64) -> Result<(), String> {
        face_detection::delete_detected_face(self, face_id)
    }

    /// Get count of unknown (unassigned) faces
    pub fn get_unknown_faces_count(&self) -> Result<i64, String> {
        face_detection::get_unknown_faces_count(self)
    }

    /// Get unknown (unassigned) faces with pagination
    pub fn get_unknown_faces(
        &self,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<face_detection::UnknownFaceRecord>, String> {
        face_detection::get_unknown_faces(self, limit, offset)
    }

    /// Get full photo objects for photos containing unknown faces
    pub fn get_photos_for_unknown_faces_full(
        &self,
        sort_value: i32,
        config: Option<config::Config>,
    ) -> Result<Vec<photo::Photo>, String> {
        face_detection::get_photos_for_unknown_faces_full(self, sort_value, config)
    }
}
