//! Face Detection Job Handler
//!
//! Processes face detection jobs for photos.

use crate::domain_service::face_detection::embedder::cosine_similarity;
use crate::domain_service::face_detection::service::FaceDetectionService;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::face_detection::{DetectedFaceInput, NamedFaceEmbedding};
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::Emitter;

/// Threshold for face matching (cosine similarity)
const FACE_MATCH_THRESHOLD: f32 = 0.5;

/// Find a matching person for a face embedding
fn find_matching_person(
    new_embedding: &[f32],
    named_faces: &[NamedFaceEmbedding],
) -> Option<i64> {
    let mut best_match: Option<(i64, f32)> = None;

    for named_face in named_faces {
        let similarity = cosine_similarity(new_embedding, &named_face.embedding);

        if similarity >= FACE_MATCH_THRESHOLD {
            match best_match {
                Some((_, best_similarity)) if similarity > best_similarity => {
                    best_match = Some((named_face.person_id, similarity));
                }
                None => {
                    best_match = Some((named_face.person_id, similarity));
                }
                _ => {}
            }
        }
    }

    best_match.map(|(person_id, _)| person_id)
}

/// Process face detection job - detects faces in photos and stores embeddings
pub(crate) fn process_face_detection_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(
        target: "face_detection_job",
        "execution; status=processing; files={}",
        job.job.target.len()
    );

    // Get models directory
    let models_dir = if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("photoclove").join("models")
    } else {
        std::path::PathBuf::from("models")
    };

    // Check if models are available
    let status = FaceDetectionService::check_models_available(&models_dir);
    if !status.is_ready() {
        log::error!(
            target: "face_detection_job",
            "execution; status=failed; reason=models_not_available"
        );
        return Err("Face detection models not available. Please download them first.".to_string());
    }

    // Emit progress event
    if let Err(e) = app_handle.emit(
        "face_detection_progress",
        (&job.job_unit_id, "Initializing face detection", 0),
    ) {
        log::error!(
            target: "face_detection_job",
            "progress_event_error; error={}",
            e
        );
    }

    // Initialize face detection service
    let mut service = FaceDetectionService::new(models_dir);
    service.init()?;

    let total_photos = job.job.target.len();
    let mut successful = 0;
    let mut failed = 0;
    let mut total_faces = 0;

    for (index, photo_path) in job.job.target.iter().enumerate() {
        log::debug!(
            target: "face_detection_job",
            "detecting; photo={}; progress={}/{}",
            photo_path,
            index + 1,
            total_photos
        );

        // Emit progress
        let progress = (index as f64 / total_photos as f64) * 100.0;
        if let Err(e) = app_handle.emit(
            "face_detection_progress",
            (
                &job.job_unit_id,
                format!("Processing {}/{}", index + 1, total_photos),
                progress,
            ),
        ) {
            log::error!(
                target: "face_detection_job",
                "progress_event_error; error={}",
                e
            );
        }

        // Check if already processed
        match db.has_detected_faces(photo_path) {
            Ok(true) => {
                log::debug!(
                    target: "face_detection_job",
                    "photo_skipped; path={}; reason=already_processed",
                    photo_path
                );
                successful += 1;
                continue;
            }
            Ok(false) => {}
            Err(e) => {
                log::warn!(
                    target: "face_detection_job",
                    "photo_check_failed; path={}; error={}",
                    photo_path,
                    e
                );
            }
        }

        // Detect faces
        match service.detect_faces_in_file(photo_path) {
            Ok(faces) => {
                successful += 1;
                total_faces += faces.len();

                if !faces.is_empty() {
                    // Get named faces for matching
                    let named_faces = db.get_named_face_embeddings().unwrap_or_default();

                    // Convert to input format with matching
                    let face_inputs: Vec<DetectedFaceInput> = faces
                        .iter()
                        .map(|f| {
                            let matched_person_id = if let Some(ref emb) = f.embedding {
                                find_matching_person(emb, &named_faces)
                            } else {
                                None
                            };

                            DetectedFaceInput {
                                photo_path: photo_path.clone(),
                                bbox_x: f.bbox.x,
                                bbox_y: f.bbox.y,
                                bbox_width: f.bbox.width,
                                bbox_height: f.bbox.height,
                                confidence: f.confidence,
                                embedding: f.embedding.clone(),
                                person_id: matched_person_id,
                            }
                        })
                        .collect();

                    // Save to database
                    if let Err(e) = db.save_detected_faces(photo_path, &face_inputs) {
                        log::error!(
                            target: "face_detection_job",
                            "save_faces_error; photo={}; error={}",
                            photo_path,
                            e
                        );
                    }
                }

                log::debug!(
                    target: "face_detection_job",
                    "photo_processed; path={}; faces={}",
                    photo_path,
                    faces.len()
                );
            }
            Err(e) => {
                failed += 1;
                log::warn!(
                    target: "face_detection_job",
                    "photo_detection_failed; path={}; error={}",
                    photo_path,
                    e
                );
            }
        }
    }

    log::info!(
        target: "face_detection_job",
        "execution; status=completed; total={}; successful={}; failed={}; total_faces={}",
        total_photos,
        successful,
        failed,
        total_faces
    );

    // Emit final progress
    if let Err(e) = app_handle.emit(
        "face_detection_progress",
        (&job.job_unit_id, "Face detection completed", 100.0),
    ) {
        log::error!(
            target: "face_detection_job",
            "progress_event_error; error={}",
            e
        );
    }

    // Emit event to refresh UI
    if let Err(e) = app_handle.emit("faces_detected", total_faces) {
        log::error!(
            target: "face_detection_job",
            "faces_event_error; error={}",
            e
        );
    }

    Ok(())
}
