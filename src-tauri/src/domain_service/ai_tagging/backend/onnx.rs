//! ONNX Runtime Backend Implementation
//!
//! This module provides AI classification using ONNX Runtime with MobileNetV3/EfficientNet models.

use super::{AIClassifierBackend, ClassificationResult, ClassifierConfig};
use crate::domain_service::ai_tagging::categories::ImageNetMapping;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Tensor;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};

/// Model preset for different accuracy/speed tradeoffs
#[derive(Debug, Clone, Copy, Default, PartialEq)]
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

    /// Get expected input size for the model
    pub fn input_size(&self) -> (u32, u32) {
        match self {
            ModelPreset::Light | ModelPreset::Standard => (224, 224),
            ModelPreset::Accurate => (300, 300), // EfficientNet uses larger input
        }
    }
}

/// ImageNet normalization constants
const IMAGENET_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [f32; 3] = [0.229, 0.224, 0.225];

/// ONNX Runtime based classifier
pub struct OnnxClassifier {
    model_preset: ModelPreset,
    model_path: Option<PathBuf>,
    session: Option<Session>,
}

impl OnnxClassifier {
    /// Create a new ONNX classifier with the specified model preset
    pub fn new(preset: ModelPreset) -> Self {
        Self {
            model_preset: preset,
            model_path: None,
            session: None,
        }
    }

    /// Create a new ONNX classifier with a custom model path
    pub fn with_model_path(model_path: PathBuf) -> Self {
        Self {
            model_preset: ModelPreset::Standard,
            model_path: Some(model_path),
            session: None,
        }
    }

    /// Get the path to the model file
    /// Checks multiple locations in order:
    /// 1. Custom model path (if specified)
    /// 2. App data directory (~/.local/share/photoclove/models/)
    /// 3. Bundled resources directory (for production builds)
    /// 4. Development directory (src-tauri/models/)
    fn get_model_path(&self) -> Result<PathBuf, String> {
        if let Some(ref path) = self.model_path {
            if path.exists() {
                return Ok(path.clone());
            }
        }

        let model_filename = self.model_preset.model_filename();

        // 1. Check in app data directory
        if let Some(data_dir) = dirs::data_local_dir() {
            let path = data_dir.join("photoclove").join("models").join(model_filename);
            if path.exists() {
                log::debug!(target: "ai_tagging", "model_found; location=app_data; path={}", path.display());
                return Ok(path);
            }
        }

        // 2. Check in executable directory (bundled resources for production)
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // On Linux/macOS bundled apps: ../Resources/models/ or ../share/models/
                let resource_paths = [
                    exe_dir.join("models").join(model_filename),
                    exe_dir.join("../Resources/models").join(model_filename),
                    exe_dir.join("../share/photoclove/models").join(model_filename),
                ];
                for path in &resource_paths {
                    if path.exists() {
                        log::debug!(target: "ai_tagging", "model_found; location=bundled; path={}", path.display());
                        return Ok(path.clone());
                    }
                }
            }
        }

        // 3. Check in development directory (when running with cargo run)
        if let Ok(cwd) = std::env::current_dir() {
            let dev_paths = [
                cwd.join("models").join(model_filename),
                cwd.join("src-tauri/models").join(model_filename),
            ];
            for path in &dev_paths {
                if path.exists() {
                    log::debug!(target: "ai_tagging", "model_found; location=dev; path={}", path.display());
                    return Ok(path.clone());
                }
            }
        }

        // Return app data path for error message (expected location)
        let expected_path = dirs::data_local_dir()
            .ok_or("Failed to get local data directory")?
            .join("photoclove")
            .join("models")
            .join(model_filename);

        Ok(expected_path)
    }

    /// Preprocess image for model input
    /// Returns tensor in NCHW format (batch=1, channels=3, height, width)
    fn preprocess_image(&self, image_path: &Path) -> Result<Vec<f32>, String> {
        let (width, height) = self.model_preset.input_size();

        // Load image
        let img = image::open(image_path)
            .map_err(|e| format!("Failed to load image {}: {}", image_path.display(), e))?;

        // Resize to model input size
        let resized = img.resize_exact(width, height, image::imageops::FilterType::Triangle);

        // Convert to RGB if necessary and normalize
        let rgb = resized.to_rgb8();

        // Create tensor in NCHW format
        let mut tensor = vec![0.0f32; (3 * height * width) as usize];

        for y in 0..height {
            for x in 0..width {
                let pixel = rgb.get_pixel(x, y);
                let idx = (y * width + x) as usize;

                // Normalize: (pixel / 255.0 - mean) / std
                tensor[idx] = ((pixel[0] as f32 / 255.0) - IMAGENET_MEAN[0]) / IMAGENET_STD[0]; // R
                tensor[(height * width) as usize + idx] =
                    ((pixel[1] as f32 / 255.0) - IMAGENET_MEAN[1]) / IMAGENET_STD[1]; // G
                tensor[(2 * height * width) as usize + idx] =
                    ((pixel[2] as f32 / 255.0) - IMAGENET_MEAN[2]) / IMAGENET_STD[2]; // B
            }
        }

        Ok(tensor)
    }

    /// Process model output and map to categories
    fn process_output(
        &self,
        output: &[f32],
        config: &ClassifierConfig,
    ) -> Vec<ClassificationResult> {
        // Get top predictions with their indices
        let mut predictions: Vec<(usize, f32)> = output
            .iter()
            .enumerate()
            .map(|(i, &score)| (i, score))
            .collect();

        // Sort by score descending
        predictions.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Map to categories and filter
        let mut results = Vec::new();

        for (class_idx, score) in predictions.iter().take(50) {
            // Check top 50 predictions
            // Apply softmax-like normalization if scores are logits
            let confidence = if *score > 0.0 && *score < 1.0 {
                *score // Already probabilities
            } else {
                // Apply sigmoid for logits
                1.0 / (1.0 + (-score).exp())
            };

            // Skip if below threshold
            if confidence < config.confidence_threshold {
                continue;
            }

            // Map to our category
            if let Some(category) = ImageNetMapping::map_class_index(*class_idx) {
                // Check if category is enabled
                if let Some(ref enabled) = config.enabled_categories {
                    if !enabled.contains(&category) {
                        continue;
                    }
                }

                // Avoid duplicates (multiple ImageNet classes may map to same category)
                if results.iter().any(|r: &ClassificationResult| r.category == category) {
                    continue;
                }

                results.push(ClassificationResult {
                    category,
                    confidence,
                });

                // Stop if we have enough tags
                if results.len() >= config.max_tags_per_image {
                    break;
                }
            }
        }

        results
    }
}

impl AIClassifierBackend for OnnxClassifier {
    fn initialize(&mut self) -> Result<(), String> {
        if self.session.is_some() {
            return Ok(());
        }

        // Set ORT_DYLIB_PATH if not already set and library exists in app data
        if std::env::var("ORT_DYLIB_PATH").is_err() {
            if let Some(data_dir) = dirs::data_local_dir() {
                let lib_path = data_dir.join("photoclove").join("lib").join("libonnxruntime.so");
                if lib_path.exists() {
                    log::info!(
                        target: "ai_tagging",
                        "setting_ort_dylib_path; path={}",
                        lib_path.display()
                    );
                    std::env::set_var("ORT_DYLIB_PATH", &lib_path);
                }
            }
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
                "Model file not found: {}. Please download the model first.",
                model_path.display()
            ));
        }

        // Initialize ONNX Runtime session
        let session = Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set thread count: {}", e))?
            .commit_from_file(&model_path)
            .map_err(|e| format!("Failed to load model: {}", e))?;

        self.session = Some(session);

        log::info!(
            target: "ai_tagging",
            "initialized; backend=onnx; status=ready"
        );

        Ok(())
    }

    fn is_initialized(&self) -> bool {
        self.session.is_some()
    }

    fn classify(
        &mut self,
        image_path: &Path,
        config: &ClassifierConfig,
    ) -> Result<Vec<ClassificationResult>, String> {
        if self.session.is_none() {
            return Err("Classifier not initialized. Call initialize() first.".to_string());
        }

        log::debug!(
            target: "ai_tagging",
            "classifying; backend=onnx; image={}",
            image_path.display()
        );

        // Preprocess image (before mutable session borrow)
        let input_data = self.preprocess_image(image_path)?;
        let (width, height) = self.model_preset.input_size();

        // Create input tensor with shape [1, 3, height, width] (NCHW format)
        let input_tensor = Tensor::from_array((
            [1_usize, 3, height as usize, width as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        // Run inference in a separate scope to limit the mutable borrow
        let output_vec = {
            // Safe: session existence is guaranteed by is_none() check at line 305
            let session = self.session.as_mut().unwrap();

            // Run inference using ort 2.0 API
            let outputs = session
                .run(ort::inputs![input_tensor])
                .map_err(|e| format!("Inference failed: {}", e))?;

            // Get first output tensor using iterator (ort 2.0 API)
            let (_, output_value) = outputs
                .iter()
                .next()
                .ok_or("No output from model")?;

            // Extract output as tensor data - returns (shape, data_slice)
            let (_, output_data) = output_value
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Failed to extract output tensor: {}", e))?;

            // Copy to Vec to release the borrow
            output_data.to_vec()
        };

        // Process output and map to categories (outside the mutable borrow)
        let results = self.process_output(&output_vec, config);

        log::debug!(
            target: "ai_tagging",
            "classified; image={}; results={}",
            image_path.display(),
            results.len()
        );

        Ok(results)
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

/// Global lazy-loaded classifier instance with RwLock for thread safety
static GLOBAL_CLASSIFIER: OnceLock<RwLock<OnnxClassifier>> = OnceLock::new();

/// Get or initialize the global classifier
pub fn get_global_classifier() -> &'static RwLock<OnnxClassifier> {
    GLOBAL_CLASSIFIER.get_or_init(|| RwLock::new(OnnxClassifier::default()))
}

/// Initialize the global classifier with a specific preset
pub fn init_global_classifier(preset: ModelPreset) -> Result<(), String> {
    let classifier = get_global_classifier();
    // Use unwrap_or_else to recover from poisoned lock (can happen if previous operation panicked)
    let mut guard = classifier.write().unwrap_or_else(|poisoned| {
        log::warn!(
            target: "ai_tagging",
            "recovering_poisoned_rwlock; status=recovered"
        );
        poisoned.into_inner()
    });

    // Only reinitialize if preset changed or not initialized
    if guard.model_preset != preset || !guard.is_initialized() {
        *guard = OnnxClassifier::new(preset);
        guard.initialize()?;
    }

    Ok(())
}
