//! Face Detection Repository Operations
//!
//! Database operations for storing and retrieving face detection results.
//! Split into submodules for better organization.

mod faces;
mod persons;
mod stats;
mod types;
mod unknown;

// Re-export all types
pub use types::*;

// Re-export all functions
pub use faces::{
    delete_detected_face, get_all_face_ids, get_detected_face, get_detected_faces,
    get_named_face_embeddings, get_photo_id, has_detected_faces, save_detected_faces,
};

pub use persons::{
    assign_face_to_person, create_person, delete_person, get_all_persons, get_all_persons_for_list,
    get_persons_with_faces, get_photos_for_person, get_photos_for_person_full, update_person_name,
};

pub use stats::get_face_detection_stats;

pub use unknown::{get_unknown_faces, get_unknown_faces_count, get_photos_for_unknown_faces_full};
