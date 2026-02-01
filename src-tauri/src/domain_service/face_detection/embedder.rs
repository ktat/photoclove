//! Face Embedder using ArcFace model
//!
//! ArcFace generates 512-dimensional face embeddings for recognition.

use image::{DynamicImage, GenericImageView};
use ort::session::Session;
use ort::value::Tensor;
use std::path::PathBuf;

use super::BoundingBox;

/// ArcFace input size (112x112 aligned face)
const INPUT_SIZE: u32 = 112;

/// ArcFace embedding dimension
pub const EMBEDDING_DIM: usize = 512;

/// ArcFace Face Embedder
pub struct FaceEmbedder {
    session: Option<Session>,
    models_dir: PathBuf,
}

impl FaceEmbedder {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            session: None,
            models_dir,
        }
    }

    /// Initialize the embedder by loading the ONNX model
    pub fn init(&mut self) -> Result<(), String> {
        let model_path = self.models_dir.join("w600k_r50.onnx");

        if !model_path.exists() {
            return Err(format!(
                "Face embedder model not found at {}. Please download from Preferences > Face Detection.",
                model_path.display()
            ));
        }

        log::info!(
            target: "face_detection",
            "loading_embedder_model; path={}",
            model_path.display()
        );

        let session = Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set threads: {}", e))?
            .commit_from_file(&model_path)
            .map_err(|e| format!("Failed to load ArcFace model: {}", e))?;

        self.session = Some(session);

        log::info!(target: "face_detection", "arcface_model_loaded");
        Ok(())
    }

    /// Check if the embedder is initialized
    #[allow(dead_code)]
    pub fn is_initialized(&self) -> bool {
        self.session.is_some()
    }

    /// Generate embedding for a cropped face image
    pub fn embed(&mut self, face_image: &DynamicImage) -> Result<Vec<f32>, String> {
        if self.session.is_none() {
            return Err("Embedder not initialized".to_string());
        }

        // Preprocess the face image (before mutable session borrow)
        let input_data = Self::preprocess_image(face_image)?;

        // Create input tensor with shape [1, 3, 112, 112] (NCHW format)
        let input_tensor = Tensor::from_array((
            [1_usize, 3, INPUT_SIZE as usize, INPUT_SIZE as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        // Run inference in a separate scope
        let embedding_raw = {
            let session = self.session.as_mut().unwrap();

            let outputs = session
                .run(ort::inputs![input_tensor])
                .map_err(|e| format!("ArcFace inference failed: {}", e))?;

            // Extract embedding to owned Vec
            let (_, output_value) = outputs
                .iter()
                .next()
                .ok_or("No output from ArcFace model")?;

            let (_, data) = output_value
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Failed to extract embedding: {}", e))?;

            data.to_vec()
        };

        // L2 normalize the embedding (outside mutable borrow)
        let embedding = Self::normalize_embedding(&embedding_raw);

        Ok(embedding)
    }

    /// Crop and embed a face from the original image
    pub fn embed_from_bbox(
        &mut self,
        image: &DynamicImage,
        bbox: &BoundingBox,
    ) -> Result<Vec<f32>, String> {
        // Crop the face region with some margin
        let (orig_width, orig_height) = image.dimensions();
        let (x, y, w, h) = bbox.to_pixels(orig_width, orig_height);

        // Add margin (20%) for better alignment
        let margin_x = (w as f32 * 0.2) as u32;
        let margin_y = (h as f32 * 0.2) as u32;

        let crop_x = x.saturating_sub(margin_x);
        let crop_y = y.saturating_sub(margin_y);
        let crop_w = (w + 2 * margin_x).min(orig_width - crop_x);
        let crop_h = (h + 2 * margin_y).min(orig_height - crop_y);

        let face_crop = image.crop_imm(crop_x, crop_y, crop_w, crop_h);

        self.embed(&face_crop)
    }

    /// Preprocess face image for ArcFace model
    /// Returns tensor data in NCHW format (batch=1, channels=3, height, width)
    fn preprocess_image(image: &DynamicImage) -> Result<Vec<f32>, String> {
        // Resize to 112x112
        let resized = image.resize_exact(
            INPUT_SIZE,
            INPUT_SIZE,
            image::imageops::FilterType::Lanczos3,
        );

        let rgb = resized.to_rgb8();
        let (width, height) = rgb.dimensions();

        // Create tensor in NCHW format with normalization
        let mut tensor = vec![0.0f32; (3 * height * width) as usize];

        for y in 0..height {
            for x in 0..width {
                let pixel = rgb.get_pixel(x, y);
                let idx = (y * width + x) as usize;

                // ArcFace normalization: (pixel - 127.5) / 127.5
                tensor[idx] = (pixel[0] as f32 - 127.5) / 127.5; // R channel
                tensor[(height * width) as usize + idx] = (pixel[1] as f32 - 127.5) / 127.5; // G channel
                tensor[(2 * height * width) as usize + idx] = (pixel[2] as f32 - 127.5) / 127.5; // B channel
            }
        }

        Ok(tensor)
    }

    /// L2 normalize embedding vector
    fn normalize_embedding(embedding: &[f32]) -> Vec<f32> {
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        let normalized: Vec<f32> = embedding.iter().map(|x| x / norm).collect();

        if normalized.len() != EMBEDDING_DIM {
            log::warn!(
                target: "face_detection",
                "unexpected_embedding_dim; expected={}; got={}",
                EMBEDDING_DIM,
                normalized.len()
            );
        }

        normalized
    }
}

/// Calculate cosine similarity between two embeddings
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();

    // Embeddings are already L2 normalized, so dot product = cosine similarity
    dot_product
}

/// Check if two faces belong to the same person
#[allow(dead_code)]
pub fn is_same_person(embedding1: &[f32], embedding2: &[f32], threshold: f32) -> bool {
    cosine_similarity(embedding1, embedding2) > threshold
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![0.5, 0.5, 0.5, 0.5];
        let b = vec![0.5, 0.5, 0.5, 0.5];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 0.01);
    }
}
