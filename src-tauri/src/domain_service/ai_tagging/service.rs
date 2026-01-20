//! AI Tagging Service
//!
//! This module provides the main service for AI-powered photo tagging.
//! It coordinates between the classifier backend and the tag storage.

use super::backend::{AIClassifierBackend, ClassificationResult, ClassifierConfig, OnnxClassifier};
use super::categories::AutoTagCategory;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};

/// Result of tagging a photo
#[derive(Debug, Clone)]
pub struct TaggingResult {
    /// Path to the photo that was tagged
    pub photo_path: String,
    /// Tags that were applied
    pub tags: Vec<AppliedTag>,
    /// Whether the tagging was successful
    pub success: bool,
    /// Error message if tagging failed
    pub error: Option<String>,
}

/// A tag that was applied to a photo
#[derive(Debug, Clone)]
pub struct AppliedTag {
    /// The tag name (with ai: prefix)
    pub tag_name: String,
    /// The category
    pub category: AutoTagCategory,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f32,
    /// Model used for classification
    pub model: String,
}

/// AI Tagging Service configuration
#[derive(Debug, Clone)]
pub struct AITaggingConfig {
    /// Whether AI tagging is enabled
    pub enabled: bool,
    /// Whether to auto-tag on import
    pub auto_tag_on_import: bool,
    /// Confidence threshold (0.0 to 1.0)
    pub confidence_threshold: f32,
    /// Maximum tags per image
    pub max_tags_per_image: usize,
    /// Enabled categories (None = all)
    pub enabled_categories: Option<Vec<AutoTagCategory>>,
}

impl Default for AITaggingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_tag_on_import: false,
            confidence_threshold: 0.7,
            max_tags_per_image: 5,
            enabled_categories: None,
        }
    }
}

/// The main AI Tagging Service
///
/// This service manages the AI classifier backend and provides
/// methods for tagging photos.
pub struct AITaggingService {
    backend: Arc<Mutex<Box<dyn AIClassifierBackend>>>,
    config: AITaggingConfig,
}

impl AITaggingService {
    /// Create a new AI Tagging Service with the default ONNX backend
    pub fn new(config: AITaggingConfig) -> Self {
        Self {
            backend: Arc::new(Mutex::new(Box::new(OnnxClassifier::default()))),
            config,
        }
    }

    /// Create a new AI Tagging Service with a custom backend
    pub fn with_backend(
        backend: Box<dyn AIClassifierBackend>,
        config: AITaggingConfig,
    ) -> Self {
        Self {
            backend: Arc::new(Mutex::new(backend)),
            config,
        }
    }

    /// Initialize the classifier backend
    pub fn initialize(&self) -> Result<(), String> {
        let mut backend = self
            .backend
            .lock()
            .map_err(|e| format!("Failed to acquire backend lock: {}", e))?;

        if backend.is_initialized() {
            return Ok(());
        }

        log::info!(
            target: "ai_tagging",
            "service_init; backend={}",
            backend.backend_name()
        );

        backend.initialize()
    }

    /// Check if the service is ready
    pub fn is_ready(&self) -> bool {
        if !self.config.enabled {
            return false;
        }

        self.backend
            .lock()
            .map(|b| b.is_initialized())
            .unwrap_or(false)
    }

    /// Classify a single photo
    pub fn classify_photo(&self, photo_path: &Path) -> Result<Vec<ClassificationResult>, String> {
        if !self.config.enabled {
            return Err("AI tagging is disabled".to_string());
        }

        let mut backend = self
            .backend
            .lock()
            .map_err(|e| format!("Failed to acquire backend lock: {}", e))?;

        if !backend.is_initialized() {
            return Err("Backend not initialized".to_string());
        }

        let classifier_config = ClassifierConfig {
            confidence_threshold: self.config.confidence_threshold,
            max_tags_per_image: self.config.max_tags_per_image,
            enabled_categories: self.config.enabled_categories.clone(),
        };

        backend.classify(photo_path, &classifier_config)
    }

    /// Tag a photo and return the applied tags
    pub fn tag_photo(&self, photo_path: &Path) -> TaggingResult {
        let path_str = photo_path.to_string_lossy().to_string();

        log::debug!(
            target: "ai_tagging",
            "tagging_photo; path={}",
            path_str
        );

        match self.classify_photo(photo_path) {
            Ok(results) => {
                let model_info = self
                    .backend
                    .lock()
                    .map(|b| b.model_info())
                    .unwrap_or_else(|_| "unknown".to_string());

                let tags: Vec<AppliedTag> = results
                    .into_iter()
                    .map(|r| AppliedTag {
                        tag_name: r.category.tag_name(),
                        category: r.category,
                        confidence: r.confidence,
                        model: model_info.clone(),
                    })
                    .collect();

                log::info!(
                    target: "ai_tagging",
                    "photo_tagged; path={}; tags={}",
                    path_str,
                    tags.len()
                );

                TaggingResult {
                    photo_path: path_str,
                    tags,
                    success: true,
                    error: None,
                }
            }
            Err(e) => {
                log::error!(
                    target: "ai_tagging",
                    "tagging_failed; path={}; error={}",
                    path_str,
                    e
                );

                TaggingResult {
                    photo_path: path_str,
                    tags: Vec::new(),
                    success: false,
                    error: Some(e),
                }
            }
        }
    }

    /// Tag multiple photos
    pub fn tag_photos(&self, photo_paths: &[&Path]) -> Vec<TaggingResult> {
        photo_paths.iter().map(|p| self.tag_photo(p)).collect()
    }

    /// Get the current configuration
    pub fn config(&self) -> &AITaggingConfig {
        &self.config
    }

    /// Update the configuration
    pub fn set_config(&mut self, config: AITaggingConfig) {
        self.config = config;
    }

    /// Get backend information
    pub fn backend_info(&self) -> String {
        self.backend
            .lock()
            .map(|b| format!("{}: {}", b.backend_name(), b.model_info()))
            .unwrap_or_else(|_| "Backend unavailable".to_string())
    }
}

/// Global AI Tagging Service instance (lazy initialized)
static GLOBAL_SERVICE: OnceLock<Mutex<AITaggingService>> = OnceLock::new();

/// Get the global AI Tagging Service instance
pub fn get_service() -> &'static Mutex<AITaggingService> {
    GLOBAL_SERVICE.get_or_init(|| Mutex::new(AITaggingService::new(AITaggingConfig::default())))
}

/// Initialize the global service with configuration
pub fn init_global_service(config: AITaggingConfig) -> Result<(), String> {
    let service = get_service();
    // Use unwrap_or_else to recover from poisoned lock (can happen if previous operation panicked)
    let mut svc = service.lock().unwrap_or_else(|poisoned| {
        log::warn!(
            target: "ai_tagging",
            "recovering_poisoned_lock; status=recovered"
        );
        poisoned.into_inner()
    });

    svc.set_config(config);

    if svc.config().enabled {
        svc.initialize()?;
    }

    Ok(())
}
