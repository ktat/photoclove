//! Face Detection Commands
//!
//! Tauri commands for face detection and person management.

use crate::app_state::AppState;
use crate::commands::job_helpers::{
    create_and_start_job, filter_image_paths, normalize_date, NO_IMAGES_RESPONSE, NO_PHOTOS_RESPONSE,
};
use crate::domain_service::face_detection::embedder::cosine_similarity;
use crate::domain_service::face_detection::service::FaceDetectionService;
use crate::domain_service::face_thumbnail_service;
use crate::entity::job_queue::JobType;
use crate::repository::meta_db::sqlite::face_detection::DetectedFaceInput;
use serde::Serialize;
use tauri::{Manager, State};

/// Threshold for face matching (cosine similarity)
/// ArcFace embeddings typically use 0.5-0.6 for same-person threshold
const FACE_MATCH_THRESHOLD: f32 = 0.5;

use crate::repository::meta_db::sqlite::face_detection::NamedFaceEmbedding;

/// Find a matching person for a face embedding
/// Returns the person_id if a match is found above the threshold
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

    if let Some((person_id, similarity)) = best_match {
        log::debug!(
            target: "face_detection",
            "best_face_match; person_id={}; similarity={}",
            person_id,
            similarity
        );
    }

    best_match.map(|(person_id, _)| person_id)
}

/// Response for face detection model status
#[derive(Serialize)]
struct FaceModelStatus {
    detector_available: bool,
    embedder_available: bool,
    detector_path: String,
    embedder_path: String,
    is_ready: bool,
}

/// Response for model download info
#[derive(Serialize)]
struct ModelDownloadInfoResponse {
    models: Vec<ModelDownloadInfoItem>,
}

#[derive(Serialize)]
struct ModelDownloadInfoItem {
    name: String,
    filename: String,
    url: String,
    size_mb: u32,
    description: String,
}

/// Check face detection model availability
#[tauri::command]
pub fn get_face_detection_model_status(state: State<AppState>) -> Result<String, String> {
    let models_dir = get_models_dir(&state);
    let status = FaceDetectionService::check_models_available(&models_dir);

    let response = FaceModelStatus {
        detector_available: status.detector_available,
        embedder_available: status.embedder_available,
        detector_path: status.detector_path.to_string_lossy().to_string(),
        embedder_path: status.embedder_path.to_string_lossy().to_string(),
        is_ready: status.is_ready(),
    };

    serde_json::to_string(&response).map_err(|e| format!("Serialization error: {}", e))
}

/// Get face detection model download info
#[tauri::command]
pub fn get_face_detection_model_info() -> Result<String, String> {
    let models = FaceDetectionService::get_model_download_info();

    let response = ModelDownloadInfoResponse {
        models: models
            .into_iter()
            .map(|m| ModelDownloadInfoItem {
                name: m.name,
                filename: m.filename,
                url: m.url,
                size_mb: m.size_mb,
                description: m.description,
            })
            .collect(),
    };

    serde_json::to_string(&response).map_err(|e| format!("Serialization error: {}", e))
}

/// Detect faces in a photo
#[tauri::command]
pub fn detect_faces_in_photo(
    state: State<AppState>,
    photo_path: String,
    save_to_db: bool,
    use_full_image: Option<bool>,
) -> Result<String, String> {
    let use_full = use_full_image.unwrap_or(false);

    log::info!(
        target: "face_detection",
        "detect_faces_request; photo_path={}; save_to_db={}; use_full_image={}",
        photo_path,
        save_to_db,
        use_full
    );

    let models_dir = get_models_dir(&state);

    // Check if models are available
    let status = FaceDetectionService::check_models_available(&models_dir);
    if !status.is_ready() {
        return Err("Face detection models not available. Please download them first.".to_string());
    }

    // Get config settings
    let face_config = &state.config.face_detection;
    let service_config = super::super::domain_service::face_detection::FaceDetectionConfig {
        confidence_threshold: face_config.confidence_threshold,
        max_faces: face_config.max_faces as usize,
        generate_embeddings: face_config.generate_embeddings,
    };

    log::info!(
        target: "face_detection",
        "detection_config; threshold={}; max_faces={}; min_thumbnail_size={}",
        service_config.confidence_threshold,
        service_config.max_faces,
        face_config.min_thumbnail_size
    );

    // Create and initialize service with config
    let mut service = FaceDetectionService::with_config(models_dir, service_config);
    service.init()?;

    // Detect faces with options
    let faces = service.detect_faces_in_file_with_options(
        &photo_path,
        use_full,
        face_config.min_thumbnail_size,
    )?;

    // Save to database if requested
    if save_to_db && !faces.is_empty() {
        // Get existing named faces for matching
        let named_faces = state.meta_db.get_named_face_embeddings().unwrap_or_default();

        log::debug!(
            target: "face_detection",
            "face_matching; named_faces_count={}",
            named_faces.len()
        );

        let face_inputs: Vec<DetectedFaceInput> = faces
            .iter()
            .map(|f| {
                // Try to match with existing named faces
                let matched_person_id = if let Some(ref new_embedding) = f.embedding {
                    find_matching_person(new_embedding, &named_faces)
                } else {
                    None
                };

                if let Some(person_id) = matched_person_id {
                    log::info!(
                        target: "face_detection",
                        "face_matched; person_id={}; confidence={}",
                        person_id,
                        f.confidence
                    );
                }

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

        state.meta_db.save_detected_faces(&photo_path, &face_inputs)?;

        // Fetch the saved faces from database to get complete data with person_name
        let saved_faces = state.meta_db.get_detected_faces(&photo_path)?;

        log::info!(
            target: "face_detection",
            "detect_faces_complete; photo_path={}; face_count={}",
            photo_path,
            saved_faces.len()
        );

        return serde_json::to_string(&saved_faces)
            .map_err(|e| format!("Serialization error: {}", e));
    }

    // If not saving to DB, return basic response
    let response: Vec<serde_json::Value> = faces
        .iter()
        .map(|f| {
            serde_json::json!({
                "bbox_x": f.bbox.x,
                "bbox_y": f.bbox.y,
                "bbox_width": f.bbox.width,
                "bbox_height": f.bbox.height,
                "confidence": f.confidence,
                "has_embedding": f.embedding.is_some()
            })
        })
        .collect();

    log::info!(
        target: "face_detection",
        "detect_faces_complete; photo_path={}; face_count={}",
        photo_path,
        response.len()
    );

    serde_json::to_string(&response).map_err(|e| format!("Serialization error: {}", e))
}

/// Get detected faces for a photo from database
#[tauri::command]
pub fn get_detected_faces_for_photo(
    state: State<AppState>,
    photo_path: String,
) -> Result<String, String> {
    let faces = state.meta_db.get_detected_faces(&photo_path)?;
    serde_json::to_string(&faces).map_err(|e| format!("Serialization error: {}", e))
}

/// Check if a photo has been processed for face detection
#[tauri::command]
pub fn has_photo_faces(state: State<AppState>, photo_path: String) -> Result<bool, String> {
    state.meta_db.has_detected_faces(&photo_path)
}

/// Get face detection statistics
#[tauri::command]
pub fn get_face_detection_stats(state: State<AppState>) -> Result<String, String> {
    let stats = state.meta_db.get_face_detection_stats()?;
    serde_json::to_string(&stats).map_err(|e| format!("Serialization error: {}", e))
}

/// Get all persons
#[tauri::command]
pub fn get_all_persons(state: State<AppState>) -> Result<String, String> {
    let persons = state.meta_db.get_all_persons()?;
    serde_json::to_string(&persons).map_err(|e| format!("Serialization error: {}", e))
}

/// Get all persons with face counts and thumbnails for list display
/// Sorted by face count (most detected first)
#[tauri::command]
pub fn get_all_persons_for_list(state: State<AppState>) -> Result<String, String> {
    log::info!(target: "face_detection", "get_all_persons_for_list; request");
    let persons = state.meta_db.get_all_persons_for_list()?;
    log::info!(
        target: "face_detection",
        "get_all_persons_for_list; count={}",
        persons.len()
    );
    serde_json::to_string(&persons).map_err(|e| format!("Serialization error: {}", e))
}

/// Get all named persons with face thumbnails, sorted by similarity to target face
#[tauri::command]
pub fn get_persons_with_faces(
    state: State<AppState>,
    face_id: Option<i64>,
) -> Result<String, String> {
    // Get target embedding from the face if provided
    let target_embedding: Option<Vec<f32>> = if let Some(id) = face_id {
        let face = state.meta_db.get_detected_face(id)?;
        face.embedding.and_then(|json| serde_json::from_str(&json).ok())
    } else {
        None
    };

    let persons = state
        .meta_db
        .get_persons_with_faces(target_embedding.as_deref())?;

    serde_json::to_string(&persons).map_err(|e| format!("Serialization error: {}", e))
}

/// Create a new person
#[tauri::command]
pub fn create_person(state: State<AppState>, name: Option<String>) -> Result<i64, String> {
    state.meta_db.create_person(name.as_deref())
}

/// Update person name
#[tauri::command]
pub fn update_person_name(
    state: State<AppState>,
    person_id: i64,
    name: String,
) -> Result<(), String> {
    state.meta_db.update_person_name(person_id, &name)
}

/// Assign a face to a person
#[tauri::command]
pub fn assign_face_to_person(
    state: State<AppState>,
    face_id: i64,
    person_id: i64,
) -> Result<(), String> {
    log::info!(
        target: "face_detection",
        "assign_face; face_id={}; person_id={}",
        face_id,
        person_id
    );
    state.meta_db.assign_face_to_person(face_id, person_id)
}

/// Get photos containing a specific person
#[tauri::command]
pub fn get_photos_for_person(
    state: State<AppState>,
    person_id: i64,
) -> Result<String, String> {
    let paths = state.meta_db.get_photos_for_person(person_id)?;
    serde_json::to_string(&paths).map_err(|e| format!("Serialization error: {}", e))
}

/// Delete a person
#[tauri::command]
pub fn delete_person(state: State<AppState>, person_id: i64) -> Result<(), String> {
    log::info!(
        target: "face_detection",
        "delete_person; person_id={}",
        person_id
    );
    state.meta_db.delete_person(person_id)
}

/// Delete a detected face (for removing false positives)
#[tauri::command]
pub fn delete_detected_face(state: State<AppState>, face_id: i64) -> Result<(), String> {
    log::info!(
        target: "face_detection",
        "delete_detected_face; face_id={}",
        face_id
    );
    state.meta_db.delete_detected_face(face_id)
}

/// Set person name for a face
/// If the face already has a person, updates that person's name
/// If the face doesn't have a person, creates a new person and assigns it
#[tauri::command]
pub fn set_face_person_name(
    state: State<AppState>,
    face_id: i64,
    name: String,
) -> Result<i64, String> {
    log::info!(
        target: "face_detection",
        "set_face_person_name; face_id={}; name={}",
        face_id,
        name
    );

    // Get the face's current person_id
    let face = state.meta_db.get_detected_face(face_id)?;

    if let Some(person_id) = face.person_id {
        // Face already has a person, update the name
        state.meta_db.update_person_name(person_id, &name)?;
        Ok(person_id)
    } else {
        // Create a new person and assign to face
        let person_id = state.meta_db.create_person(Some(&name))?;
        state.meta_db.assign_face_to_person(face_id, person_id)?;
        Ok(person_id)
    }
}

/// Download a face detection model
#[tauri::command]
pub fn download_face_detection_model(
    state: State<AppState>,
    model_type: String,
) -> Result<String, String> {
    log::info!(
        target: "face_detection",
        "download_model_request; model_type={}",
        model_type
    );

    let models_dir = get_models_dir(&state);

    // Ensure models directory exists
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let models = FaceDetectionService::get_model_download_info();

    // Find the requested model
    let model = models
        .iter()
        .find(|m| {
            if model_type == "detector" {
                m.filename.contains("det_") || m.filename.contains("scrfd")
            } else if model_type == "embedder" {
                m.filename.contains("w600k") || m.filename.contains("arcface")
            } else {
                m.filename == model_type
            }
        })
        .ok_or_else(|| format!("Unknown model type: {}", model_type))?;

    let dest_path = models_dir.join(&model.filename);

    if dest_path.exists() {
        log::info!(
            target: "face_detection",
            "model_already_exists; filename={}",
            model.filename
        );
        return Ok(serde_json::json!({
            "result": "already_exists",
            "filename": model.filename
        }).to_string());
    }

    log::info!(
        target: "face_detection",
        "downloading_model; filename={}; url={}; size_mb={}",
        model.filename,
        model.url,
        model.size_mb
    );

    // Download using ureq
    let response = ureq::get(&model.url)
        .call()
        .map_err(|e| format!("Failed to download {}: {}", model.filename, e))?;

    let mut reader = response.into_reader();
    let mut file_handle = std::fs::File::create(&dest_path)
        .map_err(|e| format!("Failed to create file {}: {}", model.filename, e))?;

    std::io::copy(&mut reader, &mut file_handle)
        .map_err(|e| format!("Failed to write file {}: {}", model.filename, e))?;

    log::info!(
        target: "face_detection",
        "model_downloaded; filename={}",
        model.filename
    );

    Ok(serde_json::json!({
        "result": "success",
        "filename": model.filename
    }).to_string())
}

/// Delete a face detection model
#[tauri::command]
pub fn delete_face_detection_model(
    state: State<AppState>,
    model_type: String,
) -> Result<String, String> {
    log::info!(
        target: "face_detection",
        "delete_model_request; model_type={}",
        model_type
    );

    let models_dir = get_models_dir(&state);
    let models = FaceDetectionService::get_model_download_info();

    let model = models
        .iter()
        .find(|m| {
            if model_type == "detector" {
                m.filename.contains("det_") || m.filename.contains("scrfd")
            } else if model_type == "embedder" {
                m.filename.contains("w600k") || m.filename.contains("arcface")
            } else {
                m.filename == model_type
            }
        })
        .ok_or_else(|| format!("Unknown model type: {}", model_type))?;

    let file_path = models_dir.join(&model.filename);

    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete {}: {}", model.filename, e))?;

        log::info!(
            target: "face_detection",
            "model_deleted; filename={}",
            model.filename
        );
    }

    Ok(serde_json::json!({
        "result": "success",
        "filename": model.filename
    }).to_string())
}

/// Run face detection for all photos in a date
#[tauri::command]
pub fn run_face_detection_for_date(
    date: String,
    window: tauri::Window,
    state: State<AppState>,
) -> Result<String, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "face_detection",
        "date_detection_request; correlation_id={}; date={}",
        correlation_id,
        date
    );

    // Check if models are available (face detection specific check)
    let models_dir = get_models_dir(&state);
    let status = FaceDetectionService::check_models_available(&models_dir);
    if !status.is_ready() {
        return Err("Face detection models not available. Please download them first.".to_string());
    }

    let normalized_date = normalize_date(&date);

    let photos = state
        .meta_db
        .get_photos_for_grouping_in_date(&normalized_date)
        .map_err(|e| format!("Failed to get photos for date: {}", e))?;

    if photos.is_empty() {
        log::info!(
            target: "face_detection",
            "date_detection_request; correlation_id={}; status=no_photos; date={}",
            correlation_id,
            normalized_date
        );
        return Ok(NO_PHOTOS_RESPONSE.to_string());
    }

    let image_paths = filter_image_paths(&photos);

    if image_paths.is_empty() {
        log::info!(
            target: "face_detection",
            "date_detection_request; correlation_id={}; status=no_images; date={}",
            correlation_id,
            normalized_date
        );
        return Ok(NO_IMAGES_RESPONSE.to_string());
    }

    let result = create_and_start_job(
        &state.meta_db,
        JobType::FaceDetection,
        image_paths,
        window.app_handle().clone(),
        &correlation_id,
        "face_detection",
    )?;

    Ok(result.to_json())
}

/// Get count of unknown (unassigned) faces
#[tauri::command]
pub fn get_unknown_faces_count(state: State<AppState>) -> Result<i64, String> {
    state.meta_db.get_unknown_faces_count()
}

/// Get unknown (unassigned) faces with pagination
/// Sorted by detection time (newest first)
#[tauri::command]
pub fn get_unknown_faces(
    state: State<AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<String, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let faces = state.meta_db.get_unknown_faces(limit, offset)?;

    serde_json::to_string(&faces).map_err(|e| format!("Serialization error: {}", e))
}

/// Get the path to a face thumbnail (returns error if not cached)
#[tauri::command]
pub fn get_face_thumbnail_path(state: State<AppState>, face_id: i64) -> Result<String, String> {
    let thumbnail_store = &state.config.thumbnail_store;
    let path = face_thumbnail_service::get_face_thumbnail_path(thumbnail_store, face_id);

    // Only return if thumbnail exists - don't generate on demand (too slow for UI)
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }

    Err(format!("Face thumbnail not cached: {}", face_id))
}

/// Check if a face thumbnail exists
#[tauri::command]
pub fn has_face_thumbnail(state: State<AppState>, face_id: i64) -> bool {
    let thumbnail_store = &state.config.thumbnail_store;
    face_thumbnail_service::face_thumbnail_exists(thumbnail_store, face_id)
}

/// Regenerate face thumbnails for all faces (runs as background job)
#[tauri::command]
pub fn regenerate_face_thumbnails(
    window: tauri::Window,
    state: State<AppState>,
) -> Result<String, String> {
    use crate::commands::job_helpers::create_and_start_job;

    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "face_thumbnail",
        "regenerate_request; correlation_id={}",
        correlation_id
    );

    // Get all face IDs from database
    let face_ids = state
        .meta_db
        .get_all_face_ids()
        .map_err(|e| format!("Failed to get face IDs: {}", e))?;

    if face_ids.is_empty() {
        return Err("No faces found in database".to_string());
    }

    log::info!(
        target: "face_thumbnail",
        "regenerate_request; correlation_id={}; face_count={}",
        correlation_id,
        face_ids.len()
    );

    // Convert face IDs to strings for job target
    let targets: Vec<String> = face_ids.iter().map(|id| id.to_string()).collect();

    let result = create_and_start_job(
        &state.meta_db,
        JobType::FaceThumbnailRegenerate,
        targets,
        window.app_handle().clone(),
        &correlation_id,
        "face_thumbnail",
    )?;

    Ok(result.to_json())
}

/// Helper to get models directory
fn get_models_dir(_state: &State<AppState>) -> std::path::PathBuf {
    // Use app data directory for models
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("photoclove").join("models")
    } else {
        std::path::PathBuf::from("models")
    }
}
