//! AI Classifier Backend Interface
//!
//! This module defines the trait for AI classification backends.
//! Implementations can use different ML frameworks (ONNX, Candle, etc.)

pub mod onnx;

use crate::domain_service::ai_tagging::categories::AutoTagCategory;
use std::path::Path;

/// Result of classifying a single image
#[derive(Debug, Clone)]
pub struct ClassificationResult {
    /// The detected category
    pub category: AutoTagCategory,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f32,
}

/// Configuration for the AI classifier
#[derive(Debug, Clone)]
pub struct ClassifierConfig {
    /// Confidence threshold - results below this are filtered out
    pub confidence_threshold: f32,
    /// Maximum number of tags to return per image
    pub max_tags_per_image: usize,
    /// Enabled categories (None = all enabled)
    pub enabled_categories: Option<Vec<AutoTagCategory>>,
}

impl Default for ClassifierConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.7,
            max_tags_per_image: 5,
            enabled_categories: None,
        }
    }
}

/// Trait defining the interface for AI classification backends
///
/// This trait allows swapping between different ML implementations:
/// - ONNX Runtime (default)
/// - Candle (Hugging Face Rust ML)
/// - Cloud APIs (future)
pub trait AIClassifierBackend: Send + Sync {
    /// Initialize the classifier and load the model
    ///
    /// This may be called lazily on first classification request.
    fn initialize(&mut self) -> Result<(), String>;

    /// Check if the classifier is ready to process images
    fn is_initialized(&self) -> bool;

    /// Classify a single image and return detected categories with confidence scores
    ///
    /// # Arguments
    /// * `image_path` - Path to the image file
    /// * `config` - Classification configuration
    ///
    /// # Returns
    /// Vector of classification results, sorted by confidence (highest first)
    ///
    /// Note: Takes &mut self because some backends (e.g., ONNX Runtime)
    /// require mutable access for inference.
    fn classify(
        &mut self,
        image_path: &Path,
        config: &ClassifierConfig,
    ) -> Result<Vec<ClassificationResult>, String>;

    /// Get the name of this backend (for logging/debugging)
    fn backend_name(&self) -> &'static str;

    /// Get the model name/version being used
    fn model_info(&self) -> String;
}

pub use onnx::OnnxClassifier;
