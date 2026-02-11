//! Face Detection Service
//!
//! Main service that orchestrates face detection and embedding generation.

use image::DynamicImage;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::detector::FaceDetector;
use super::embedder::FaceEmbedder;
use super::{DetectedFace, FaceDetectionConfig};
use crate::utils::exif_thumbnail;

/// Default minimum thumbnail size for face detection (used if not configured)
const DEFAULT_MIN_THUMBNAIL_SIZE: u32 = 160;

/// Apply EXIF orientation to an image
fn apply_exif_orientation(image: DynamicImage, orientation: &str) -> DynamicImage {
    match orientation {
        // 1 = Normal
        "Normal" | "Horizontal (normal)" => image,
        // 2 = Horizontal flip
        "Mirror horizontal" | "Flip horizontal" => image.fliph(),
        // 3 = Rotate 180
        "Rotate 180" | "Rotate 180°" => image.rotate180(),
        // 4 = Vertical flip
        "Mirror vertical" | "Flip vertical" => image.flipv(),
        // 5 = Rotate 90 CCW + horizontal flip
        "Mirror horizontal and rotate 270 CW" | "Rotate 90 CCW and flip horizontal" => {
            image.rotate270().fliph()
        }
        // 6 = Rotate 90 CW (camera rotated CCW)
        // "Rotated to left" means the image appears rotated to the left, fix by rotating 90 CW
        "Rotate 90 CW" | "Rotate 90°" | "Rotate 90° CW" | "Rotated to left" => image.rotate90(),
        // 7 = Rotate 90 CW + horizontal flip
        "Mirror horizontal and rotate 90 CW" | "Rotate 90 CW and flip horizontal" => {
            image.rotate90().fliph()
        }
        // 8 = Rotate 90 CCW (or 270 CW, camera rotated CW)
        // "Rotated to right" means the image appears rotated to the right, fix by rotating 90 CCW
        "Rotate 270 CW" | "Rotate 90 CCW" | "Rotate 270° CW" | "Rotated to right" => {
            image.rotate270()
        }
        // Unknown or empty - no rotation
        _ => {
            log::debug!(
                target: "face_detection",
                "unknown_orientation; value={}",
                orientation
            );
            image
        }
    }
}

/// Read EXIF orientation from a file
fn read_exif_orientation(path: &str) -> Option<String> {
    // Read only first 64KB for EXIF data (sufficient for header)
    let mut file = std::fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; 65536];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    let (exif_result, _warnings) = rexif::parse_buffer_quiet(&buffer);
    let exif = exif_result.ok()?;

    for entry in exif.entries {
        if matches!(entry.tag, rexif::ExifTag::Orientation) {
            return Some(entry.value_more_readable.to_string());
        }
    }
    None
}

/// Face Detection Service
pub struct FaceDetectionService {
    detector: Mutex<FaceDetector>,
    embedder: Mutex<FaceEmbedder>,
    config: FaceDetectionConfig,
    initialized: bool,
}

impl FaceDetectionService {
    /// Create a new face detection service
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            detector: Mutex::new(FaceDetector::new(models_dir.clone())),
            embedder: Mutex::new(FaceEmbedder::new(models_dir)),
            config: FaceDetectionConfig::default(),
            initialized: false,
        }
    }

    /// Create with custom configuration
    pub fn with_config(models_dir: PathBuf, config: FaceDetectionConfig) -> Self {
        Self {
            detector: Mutex::new(FaceDetector::new(models_dir.clone())),
            embedder: Mutex::new(FaceEmbedder::new(models_dir)),
            config,
            initialized: false,
        }
    }

    /// Initialize the service (load models)
    pub fn init(&mut self) -> Result<(), String> {
        log::info!(target: "face_detection", "initializing_face_detection_service");

        // Set ORT_DYLIB_PATH if not already set and library exists in app data
        if std::env::var("ORT_DYLIB_PATH").is_err() {
            if let Some(data_dir) = dirs::data_local_dir() {
                let lib_path = data_dir
                    .join("photoclove")
                    .join("lib")
                    .join("libonnxruntime.so");
                if lib_path.exists() {
                    log::info!(
                        target: "face_detection",
                        "setting_ort_dylib_path; path={}",
                        lib_path.display()
                    );
                    std::env::set_var("ORT_DYLIB_PATH", &lib_path);
                } else {
                    log::warn!(
                        target: "face_detection",
                        "ort_dylib_not_found; expected_path={}",
                        lib_path.display()
                    );
                }
            }
        }

        // Initialize detector
        {
            let mut detector = self.detector.lock().map_err(|e| e.to_string())?;
            detector.init()?;
        }

        // Initialize embedder if needed
        if self.config.generate_embeddings {
            let mut embedder = self.embedder.lock().map_err(|e| e.to_string())?;
            embedder.init()?;
        }

        self.initialized = true;
        log::info!(target: "face_detection", "face_detection_service_initialized");

        Ok(())
    }

    /// Check if the service is initialized
    #[allow(dead_code)]
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Detect faces in an image file
    /// Uses EXIF thumbnail for faster detection when available and large enough
    /// - use_full_image: If true, always use full resolution image (skip thumbnail)
    /// - min_thumbnail_size: Minimum thumbnail size to use (0 = use default)
    pub fn detect_faces_in_file_with_options(
        &self,
        path: &str,
        use_full_image: bool,
        min_thumbnail_size: u32,
    ) -> Result<Vec<DetectedFace>, String> {
        if !self.initialized {
            return Err("Face detection service not initialized".to_string());
        }

        // Read EXIF orientation (shared between full image and thumbnail)
        let orientation = read_exif_orientation(path);

        // Determine effective min thumbnail size
        let effective_min_size = if min_thumbnail_size > 0 {
            min_thumbnail_size
        } else {
            DEFAULT_MIN_THUMBNAIL_SIZE
        };

        // Try to use EXIF thumbnail for faster detection (unless use_full_image is true)
        if !use_full_image {
            if let Some((mut thumb_image, thumb_width, thumb_height)) =
                exif_thumbnail::extract_exif_thumbnail_with_min_size(
                    std::path::Path::new(path),
                    effective_min_size,
                )
            {
                log::info!(
                    target: "face_detection",
                    "using_exif_thumbnail; path={}; thumb_size={}x{}",
                    path,
                    thumb_width,
                    thumb_height
                );

                // Apply EXIF orientation to thumbnail (same as main image)
                if let Some(ref orient) = orientation {
                    thumb_image = apply_exif_orientation(thumb_image, orient);
                }

                // Detect faces in thumbnail
                let faces_result = self.detect_faces(&thumb_image);

                if let Ok(faces) = faces_result {
                    if !faces.is_empty() {
                        // Faces detected in thumbnail - coordinates are already normalized (0-1)
                        // so they directly apply to the full image
                        log::info!(
                            target: "face_detection",
                            "faces_detected_in_thumbnail; path={}; count={}",
                            path,
                            faces.len()
                        );
                        return Ok(faces);
                    }
                }

                // If no faces found in thumbnail, fall back to full image
                log::debug!(
                    target: "face_detection",
                    "no_faces_in_thumbnail_fallback_to_full; path={}",
                    path
                );
            }
        }

        // Fall back to full image detection
        log::debug!(
            target: "face_detection",
            "using_full_image; path={}",
            path
        );

        // Load full image
        let mut image =
            image::open(path).map_err(|e| format!("Failed to load image {}: {}", path, e))?;

        // Apply EXIF orientation if available
        if let Some(orient) = orientation {
            log::debug!(
                target: "face_detection",
                "applying_exif_orientation; path={}; orientation={}",
                path,
                orient
            );
            image = apply_exif_orientation(image, &orient);
        }

        self.detect_faces(&image)
    }

    /// Detect faces in an image file (convenience method with default options)
    pub fn detect_faces_in_file(&self, path: &str) -> Result<Vec<DetectedFace>, String> {
        self.detect_faces_in_file_with_options(path, false, DEFAULT_MIN_THUMBNAIL_SIZE)
    }

    /// Detect faces in a DynamicImage
    pub fn detect_faces(&self, image: &DynamicImage) -> Result<Vec<DetectedFace>, String> {
        if !self.initialized {
            return Err("Face detection service not initialized".to_string());
        }

        // Detect faces
        let mut faces = {
            let mut detector = self.detector.lock().map_err(|e| e.to_string())?;
            detector.detect(
                image,
                self.config.confidence_threshold,
                self.config.max_faces,
            )?
        };

        // Generate embeddings if configured
        if self.config.generate_embeddings && !faces.is_empty() {
            let mut embedder = self.embedder.lock().map_err(|e| e.to_string())?;

            for face in &mut faces {
                match embedder.embed_from_bbox(image, &face.bbox) {
                    Ok(embedding) => {
                        face.embedding = Some(embedding);
                    }
                    Err(e) => {
                        log::warn!(
                            target: "face_detection",
                            "embedding_generation_failed; error={}",
                            e
                        );
                    }
                }
            }
        }

        Ok(faces)
    }

    /// Check if models are available
    pub fn check_models_available(models_dir: &Path) -> ModelsStatus {
        let detector_path = models_dir.join("det_10g.onnx");
        let embedder_path = models_dir.join("w600k_r50.onnx");

        ModelsStatus {
            detector_available: detector_path.exists(),
            embedder_available: embedder_path.exists(),
            detector_path,
            embedder_path,
        }
    }

    /// Get model download URLs
    pub fn get_model_download_info() -> Vec<ModelDownloadInfo> {
        vec![
            ModelDownloadInfo {
                name: "SCRFD-10G (Face Detector)".to_string(),
                filename: "det_10g.onnx".to_string(),
                url: "https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/det_10g.onnx".to_string(),
                size_mb: 17,
                description: "High-accuracy face detection model".to_string(),
            },
            ModelDownloadInfo {
                name: "ArcFace-W600K-R50 (Face Embedding)".to_string(),
                filename: "w600k_r50.onnx".to_string(),
                url: "https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx".to_string(),
                size_mb: 174,
                description: "Face recognition embedding model (512-dim)".to_string(),
            },
        ]
    }
}

/// Status of available models
#[derive(Debug)]
pub struct ModelsStatus {
    pub detector_available: bool,
    pub embedder_available: bool,
    pub detector_path: PathBuf,
    pub embedder_path: PathBuf,
}

impl ModelsStatus {
    pub fn is_ready(&self) -> bool {
        self.detector_available && self.embedder_available
    }

    #[allow(dead_code)]
    pub fn is_partial(&self) -> bool {
        self.detector_available != self.embedder_available
    }
}

/// Model download information
#[derive(Debug, Clone)]
pub struct ModelDownloadInfo {
    pub name: String,
    pub filename: String,
    pub url: String,
    pub size_mb: u32,
    pub description: String,
}
