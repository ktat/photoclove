//! Face Detection Service
//!
//! Provides face detection and recognition capabilities using InsightFace models:
//! - SCRFD for face detection
//! - ArcFace for face embedding/recognition

pub mod detector;
pub mod embedder;
pub mod service;

/// Detected face with bounding box and confidence
#[derive(Debug, Clone)]
pub struct DetectedFace {
    /// Bounding box (normalized 0-1 coordinates)
    pub bbox: BoundingBox,
    /// Detection confidence (0-1)
    pub confidence: f32,
    /// Face embedding vector (512-dim for ArcFace)
    pub embedding: Option<Vec<f32>>,
}

/// Bounding box in normalized coordinates (0-1)
#[derive(Debug, Clone)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl BoundingBox {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    /// Convert to pixel coordinates given image dimensions
    pub fn to_pixels(&self, img_width: u32, img_height: u32) -> (u32, u32, u32, u32) {
        let x = (self.x * img_width as f32) as u32;
        let y = (self.y * img_height as f32) as u32;
        let w = (self.width * img_width as f32) as u32;
        let h = (self.height * img_height as f32) as u32;
        (x, y, w, h)
    }
}

/// Face detection configuration
#[derive(Debug, Clone)]
pub struct FaceDetectionConfig {
    /// Minimum confidence threshold for detection (0-1)
    pub confidence_threshold: f32,
    /// Whether to generate embeddings for detected faces
    pub generate_embeddings: bool,
    /// Maximum number of faces to detect per image
    pub max_faces: usize,
}

impl Default for FaceDetectionConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.5,
            generate_embeddings: true,
            max_faces: 50,
        }
    }
}
