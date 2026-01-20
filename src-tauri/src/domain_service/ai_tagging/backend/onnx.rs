//! ONNX Runtime Backend Implementation
//!
//! This module provides AI classification using ONNX Runtime with MobileNetV3/EfficientNet models.

use super::{AIClassifierBackend, ClassificationResult, ClassifierConfig};
use crate::domain_service::ai_tagging::categories::AutoTagCategory;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Model preset for different accuracy/speed tradeoffs
#[derive(Debug, Clone, Copy, Default)]
pub enum ModelPreset {
    /// MobileNetV3-Small (~5MB, ~50ms, medium accuracy)
    Light,
    /// MobileNetV3-Large (~15MB, ~100ms, good accuracy)
    #[default]
    Standard,
    /// EfficientNet-Lite4 (~50MB, ~200ms, high accuracy)
    Accurate,
}

impl ModelPreset {
    pub fn model_filename(&self) -> &'static str {
        match self {
            ModelPreset::Light => "mobilenet-v3-small.onnx",
            ModelPreset::Standard => "mobilenet-v3-large.onnx",
            ModelPreset::Accurate => "efficientnet-lite4.onnx",
        }
    }
}

/// ONNX Runtime based classifier
pub struct OnnxClassifier {
    model_preset: ModelPreset,
    model_path: Option<PathBuf>,
    initialized: bool,
    // Session will be added when we integrate actual ONNX runtime
    // session: Option<ort::Session>,
}

impl OnnxClassifier {
    /// Create a new ONNX classifier with the specified model preset
    pub fn new(preset: ModelPreset) -> Self {
        Self {
            model_preset: preset,
            model_path: None,
            initialized: false,
        }
    }

    /// Create a new ONNX classifier with a custom model path
    pub fn with_model_path(model_path: PathBuf) -> Self {
        Self {
            model_preset: ModelPreset::Standard,
            model_path: Some(model_path),
            initialized: false,
        }
    }

    /// Get the path to the model file
    fn get_model_path(&self) -> Result<PathBuf, String> {
        if let Some(ref path) = self.model_path {
            return Ok(path.clone());
        }

        // TODO: Get model path from app resources
        // For now, return a placeholder path
        let model_dir = dirs::data_local_dir()
            .ok_or("Failed to get local data directory")?
            .join("photoclove")
            .join("models");

        Ok(model_dir.join(self.model_preset.model_filename()))
    }

    /// Preprocess image for model input
    #[allow(dead_code)]
    fn preprocess_image(&self, _image_path: &Path) -> Result<Vec<f32>, String> {
        // TODO: Implement image preprocessing
        // 1. Load image
        // 2. Resize to model input size (224x224 for MobileNet)
        // 3. Normalize pixel values
        // 4. Convert to tensor format
        Err("Image preprocessing not yet implemented".to_string())
    }

    /// Map model output indices to AutoTagCategory
    #[allow(dead_code)]
    fn map_output_to_categories(
        &self,
        _output: &[f32],
        config: &ClassifierConfig,
    ) -> Vec<ClassificationResult> {
        // TODO: Implement output mapping
        // 1. Get top-k predictions
        // 2. Map ImageNet class indices to AutoTagCategory
        // 3. Filter by confidence threshold
        // 4. Filter by enabled categories
        let _ = config;
        Vec::new()
    }
}

impl AIClassifierBackend for OnnxClassifier {
    fn initialize(&mut self) -> Result<(), String> {
        if self.initialized {
            return Ok(());
        }

        let model_path = self.get_model_path()?;

        log::info!(
            target: "ai_tagging",
            "initializing; backend=onnx; model={}; path={}",
            self.model_preset.model_filename(),
            model_path.display()
        );

        // Check if model file exists
        if !model_path.exists() {
            return Err(format!(
                "Model file not found: {}. Please ensure the model is bundled with the application.",
                model_path.display()
            ));
        }

        // TODO: Initialize ONNX Runtime session
        // let session = ort::Session::builder()?
        //     .with_optimization_level(ort::GraphOptimizationLevel::Level3)?
        //     .with_intra_threads(4)?
        //     .commit_from_file(&model_path)?;

        self.initialized = true;

        log::info!(
            target: "ai_tagging",
            "initialized; backend=onnx; status=ready"
        );

        Ok(())
    }

    fn is_initialized(&self) -> bool {
        self.initialized
    }

    fn classify(
        &self,
        image_path: &Path,
        config: &ClassifierConfig,
    ) -> Result<Vec<ClassificationResult>, String> {
        if !self.initialized {
            return Err("Classifier not initialized. Call initialize() first.".to_string());
        }

        log::debug!(
            target: "ai_tagging",
            "classifying; backend=onnx; image={}",
            image_path.display()
        );

        // TODO: Implement actual classification
        // 1. Preprocess image
        // 2. Run inference
        // 3. Process output
        // 4. Map to categories

        // Placeholder: Return empty results for now
        let _ = config;
        Ok(Vec::new())
    }

    fn backend_name(&self) -> &'static str {
        "ONNX Runtime"
    }

    fn model_info(&self) -> String {
        format!(
            "{} ({})",
            self.model_preset.model_filename(),
            match self.model_preset {
                ModelPreset::Light => "Light - Fast, basic classification",
                ModelPreset::Standard => "Standard - Balanced speed/accuracy",
                ModelPreset::Accurate => "Accurate - Slower, higher precision",
            }
        )
    }
}

impl Default for OnnxClassifier {
    fn default() -> Self {
        Self::new(ModelPreset::default())
    }
}

/// Global lazy-loaded classifier instance
static CLASSIFIER: OnceLock<std::sync::Mutex<OnnxClassifier>> = OnceLock::new();

/// Get or initialize the global classifier
#[allow(dead_code)]
pub fn get_global_classifier() -> &'static std::sync::Mutex<OnnxClassifier> {
    CLASSIFIER.get_or_init(|| std::sync::Mutex::new(OnnxClassifier::default()))
}
