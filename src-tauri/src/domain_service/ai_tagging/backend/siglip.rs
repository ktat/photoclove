//! SigLIP Backend Implementation
//!
//! This module provides AI classification using SigLIP (Sigmoid Loss for Language Image Pre-Training).
//! SigLIP is an improved CLIP variant from Google with better accuracy.

use super::clip_common::{
    cosine_similarity, preprocess_clip_image, similarities_to_results, DEFAULT_CLIP_LABELS,
};
use super::{AIClassifierBackend, ClassificationResult, ClassifierConfig};
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Tensor;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// SigLIP model input size (base variant)
const SIGLIP_INPUT_SIZE: u32 = 224;

/// SigLIP embedding dimension (base)
const SIGLIP_EMBED_DIM: usize = 768;

/// SigLIP based classifier
pub struct SigLipClassifier {
    visual_session: Option<Session>,
    text_session: Option<Session>,
    /// Pre-computed text embeddings for labels
    text_embeddings: HashMap<String, Vec<f32>>,
    /// Current labels being used
    current_labels: Vec<String>,
    /// Model directory
    models_dir: PathBuf,
}

impl SigLipClassifier {
    /// Create a new SigLIP classifier
    pub fn new() -> Self {
        Self {
            visual_session: None,
            text_session: None,
            text_embeddings: HashMap::new(),
            current_labels: Vec::new(),
            models_dir: Self::default_models_dir(),
        }
    }

    /// Get the default models directory
    fn default_models_dir() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("photoclove")
            .join("models")
    }

    /// Get path to visual encoder model
    fn visual_model_path(&self) -> PathBuf {
        self.models_dir.join("siglip-base-visual.onnx")
    }

    /// Get path to text encoder model
    fn text_model_path(&self) -> PathBuf {
        self.models_dir.join("siglip-base-text.onnx")
    }

    /// Check if models are available
    pub fn models_available(&self) -> bool {
        self.visual_model_path().exists() && self.text_model_path().exists()
    }

    /// Set custom labels for classification
    pub fn set_labels(&mut self, labels: Vec<String>) {
        self.current_labels = labels;
        self.text_embeddings.clear();
    }

    /// Get default labels
    pub fn default_labels() -> Vec<String> {
        DEFAULT_CLIP_LABELS.iter().map(|s| s.to_string()).collect()
    }

    /// Encode image to embedding vector
    fn encode_image(&mut self, image_path: &Path) -> Result<Vec<f32>, String> {
        let session = self
            .visual_session
            .as_mut()
            .ok_or("Visual encoder not initialized")?;

        // Preprocess image
        let input_data = preprocess_clip_image(image_path, SIGLIP_INPUT_SIZE)?;

        // Create input tensor [1, 3, 224, 224]
        let input_tensor = Tensor::from_array((
            [1_usize, 3, SIGLIP_INPUT_SIZE as usize, SIGLIP_INPUT_SIZE as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        // Run inference
        let outputs = session
            .run(ort::inputs![input_tensor])
            .map_err(|e| format!("Visual encoding failed: {}", e))?;

        // Get output embedding
        let (_, output_value) = outputs
            .iter()
            .next()
            .ok_or("No output from visual encoder")?;

        let (_, output_data) = output_value
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract output: {}", e))?;

        // Normalize embedding
        let embedding: Vec<f32> = output_data.to_vec();
        Ok(Self::normalize_embedding(&embedding))
    }

    /// Encode text to embedding vector
    fn encode_text(&mut self, _text: &str) -> Result<Vec<f32>, String> {
        // Note: Similar to OpenCLIP, this requires proper tokenization and text encoder
        Err("Text encoding requires ONNX text encoder model. Please download the complete SigLIP model.".to_string())
    }

    /// Normalize an embedding vector to unit length
    fn normalize_embedding(embedding: &[f32]) -> Vec<f32> {
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            embedding.iter().map(|x| x / norm).collect()
        } else {
            embedding.to_vec()
        }
    }

    /// Pre-compute text embeddings for all labels
    fn precompute_text_embeddings(&mut self) -> Result<(), String> {
        if self.text_session.is_none() {
            log::warn!(
                target: "ai_tagging",
                "siglip_text_encoder_not_available; using_placeholder_embeddings"
            );
            return Ok(());
        }

        for label in &self.current_labels.clone() {
            if !self.text_embeddings.contains_key(label) {
                match self.encode_text(label) {
                    Ok(embedding) => {
                        self.text_embeddings.insert(label.clone(), embedding);
                    }
                    Err(e) => {
                        log::warn!(
                            target: "ai_tagging",
                            "siglip_text_encoding_failed; label={}; error={}",
                            label,
                            e
                        );
                    }
                }
            }
        }

        Ok(())
    }
}

impl AIClassifierBackend for SigLipClassifier {
    fn initialize(&mut self) -> Result<(), String> {
        if self.visual_session.is_some() {
            return Ok(());
        }

        // Set ORT_DYLIB_PATH if needed
        if std::env::var("ORT_DYLIB_PATH").is_err() {
            if let Some(data_dir) = dirs::data_local_dir() {
                let lib_path = data_dir.join("photoclove").join("lib").join("libonnxruntime.so");
                if lib_path.exists() {
                    std::env::set_var("ORT_DYLIB_PATH", &lib_path);
                }
            }
        }

        let visual_path = self.visual_model_path();
        let text_path = self.text_model_path();

        log::info!(
            target: "ai_tagging",
            "initializing; backend=siglip; visual_path={}",
            visual_path.display()
        );

        // Check if visual model exists
        if !visual_path.exists() {
            return Err(format!(
                "SigLIP visual model not found: {}. Please download the model first.",
                visual_path.display()
            ));
        }

        // Initialize visual encoder
        let visual_session = Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set thread count: {}", e))?
            .commit_from_file(&visual_path)
            .map_err(|e| format!("Failed to load visual model: {}", e))?;

        self.visual_session = Some(visual_session);

        // Initialize text encoder if available
        if text_path.exists() {
            match Session::builder()
                .map_err(|e| format!("Session builder error: {}", e))?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| format!("Optimization level error: {}", e))?
                .with_intra_threads(4)
                .map_err(|e| format!("Thread count error: {}", e))?
                .commit_from_file(&text_path)
            {
                Ok(session) => {
                    self.text_session = Some(session);
                    log::info!(
                        target: "ai_tagging",
                        "siglip_text_encoder_loaded; path={}",
                        text_path.display()
                    );
                }
                Err(e) => {
                    log::warn!(
                        target: "ai_tagging",
                        "siglip_text_encoder_load_failed; error={}",
                        e
                    );
                }
            }
        }

        // Set default labels if none set
        if self.current_labels.is_empty() {
            self.current_labels = Self::default_labels();
        }

        // Pre-compute text embeddings
        if let Err(e) = self.precompute_text_embeddings() {
            log::warn!(
                target: "ai_tagging",
                "siglip_precompute_embeddings_failed; error={}",
                e
            );
        }

        log::info!(
            target: "ai_tagging",
            "initialized; backend=siglip; labels={}",
            self.current_labels.len()
        );

        Ok(())
    }

    fn is_initialized(&self) -> bool {
        self.visual_session.is_some()
    }

    fn classify(
        &mut self,
        image_path: &Path,
        config: &ClassifierConfig,
    ) -> Result<Vec<ClassificationResult>, String> {
        if self.visual_session.is_none() {
            return Err("SigLIP not initialized. Call initialize() first.".to_string());
        }

        log::debug!(
            target: "ai_tagging",
            "classifying; backend=siglip; image={}",
            image_path.display()
        );

        // Encode the image
        let image_embedding = self.encode_image(image_path)?;

        // If we have text embeddings, compute similarities
        if !self.text_embeddings.is_empty() {
            let mut similarities = Vec::new();
            let mut labels = Vec::new();

            for (label, text_emb) in &self.text_embeddings {
                let sim = cosine_similarity(&image_embedding, text_emb);
                similarities.push(sim);
                labels.push(label.clone());
            }

            let results = similarities_to_results(&labels, &similarities, config);

            log::debug!(
                target: "ai_tagging",
                "classified; backend=siglip; image={}; results={}",
                image_path.display(),
                results.len()
            );

            return Ok(results);
        }

        // Fallback: return empty results if no text embeddings available
        log::warn!(
            target: "ai_tagging",
            "siglip_no_text_embeddings; returning_empty_results"
        );
        Ok(Vec::new())
    }

    fn backend_name(&self) -> &'static str {
        "SigLIP"
    }

    fn model_info(&self) -> String {
        format!(
            "SigLIP Base (Google, {} labels)",
            self.current_labels.len()
        )
    }
}

impl Default for SigLipClassifier {
    fn default() -> Self {
        Self::new()
    }
}
