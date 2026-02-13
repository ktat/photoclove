//! Common utilities for CLIP-based models (OpenCLIP, SigLIP)
//!
//! This module provides shared functionality for CLIP-style vision-language models.

use super::{AIClassifierBackend, ClassificationResult, ClassifierConfig};
use crate::domain_service::ai_tagging::categories::AutoTagCategory;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Tensor;
use std::collections::HashMap;
use std::marker::PhantomData;
use std::path::{Path, PathBuf};

/// Default labels for CLIP-based classification
pub const DEFAULT_CLIP_LABELS: &[&str] = &[
    // People
    "a photo of a person",
    "a photo of people",
    "a photo of a face",
    "a group photo",
    "a selfie",
    // Animals
    "a photo of a dog",
    "a photo of a cat",
    "a photo of a bird",
    "a photo of fish",
    "a photo of a horse",
    "a photo of wildlife",
    "a photo of an insect",
    "a photo of a cow",
    // Nature
    "a photo of the ocean",
    "a photo of a beach",
    "a photo of mountains",
    "a photo of a forest",
    "a photo of a sunset",
    "a photo of the sky",
    "a photo of a lake",
    "a photo of a river",
    // Plants
    "a photo of flowers",
    "a photo of trees",
    "a photo of a garden",
    "a photo of plants",
    // Scenes
    "a photo of food",
    "a photo of a building",
    "a photo of a street",
    "an indoor photo",
    "an outdoor photo",
    "a night photo",
    // Events
    "a wedding photo",
    "a birthday party photo",
    "a travel photo",
    "a vacation photo",
];

/// Map a CLIP label to an AutoTagCategory
pub fn label_to_category(label: &str) -> Option<AutoTagCategory> {
    let lower = label.to_lowercase();

    // Events (check first - more specific patterns)
    if lower.contains("wedding") {
        return Some(AutoTagCategory::Wedding);
    }
    if lower.contains("birthday") {
        return Some(AutoTagCategory::Birthday);
    }
    if lower.contains("travel") || lower.contains("vacation") {
        return Some(AutoTagCategory::Travel);
    }

    // People
    if lower.contains("person") || lower.contains("selfie") {
        return Some(AutoTagCategory::Person);
    }
    if lower.contains("people") || lower.contains("group photo") {
        return Some(AutoTagCategory::Group);
    }
    if lower.contains("face") {
        return Some(AutoTagCategory::Face);
    }

    // Animals
    if lower.contains("dog") {
        return Some(AutoTagCategory::Dog);
    }
    if lower.contains("cat") {
        return Some(AutoTagCategory::Cat);
    }
    if lower.contains("bird") {
        return Some(AutoTagCategory::Bird);
    }
    if lower.contains("fish") {
        return Some(AutoTagCategory::Fish);
    }
    if lower.contains("horse") {
        return Some(AutoTagCategory::Horse);
    }
    if lower.contains("cow") {
        return Some(AutoTagCategory::Cow);
    }
    if lower.contains("wildlife") {
        return Some(AutoTagCategory::Wildlife);
    }
    if lower.contains("insect") {
        return Some(AutoTagCategory::Insect);
    }

    // Nature
    if lower.contains("ocean") || lower.contains("sea") {
        return Some(AutoTagCategory::Sea);
    }
    if lower.contains("beach") {
        return Some(AutoTagCategory::Beach);
    }
    if lower.contains("mountain") {
        return Some(AutoTagCategory::Mountain);
    }
    if lower.contains("forest") {
        return Some(AutoTagCategory::Forest);
    }
    if lower.contains("sunset") {
        return Some(AutoTagCategory::Sunset);
    }
    if lower.contains("sky") {
        return Some(AutoTagCategory::Sky);
    }
    if lower.contains("lake") {
        return Some(AutoTagCategory::Lake);
    }
    if lower.contains("river") {
        return Some(AutoTagCategory::River);
    }

    // Plants
    if lower.contains("flower") {
        return Some(AutoTagCategory::Flower);
    }
    if lower.contains("tree") {
        return Some(AutoTagCategory::Tree);
    }
    if lower.contains("garden") {
        return Some(AutoTagCategory::Garden);
    }
    if lower.contains("plant") {
        return Some(AutoTagCategory::Plant);
    }

    // Scenes
    if lower.contains("food") {
        return Some(AutoTagCategory::Food);
    }
    if lower.contains("building") {
        return Some(AutoTagCategory::Building);
    }
    if lower.contains("street") {
        return Some(AutoTagCategory::Street);
    }
    if lower.contains("indoor") {
        return Some(AutoTagCategory::Indoor);
    }
    if lower.contains("outdoor") {
        return Some(AutoTagCategory::Outdoor);
    }
    if lower.contains("night") {
        return Some(AutoTagCategory::Night);
    }

    None
}

/// Calculate cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

/// Softmax normalization for converting logits to probabilities
pub fn softmax(logits: &[f32]) -> Vec<f32> {
    if logits.is_empty() {
        return Vec::new();
    }

    let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exp_sum: f32 = logits.iter().map(|x| (x - max_logit).exp()).sum();

    logits
        .iter()
        .map(|x| (x - max_logit).exp() / exp_sum)
        .collect()
}

/// Convert similarity scores to classification results
pub fn similarities_to_results(
    labels: &[String],
    similarities: &[f32],
    config: &ClassifierConfig,
) -> Vec<ClassificationResult> {
    // Use cosine similarities directly (no softmax needed for CLIP models)
    // Cosine similarities are already in [-1, 1] range, normalized embeddings give [0, 1]

    // Create (label, similarity) pairs and sort by similarity
    let mut label_sims: Vec<(&String, f32)> =
        labels.iter().zip(similarities.iter().cloned()).collect();
    label_sims.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Log top 5 similarities for debugging
    log::debug!(
        target: "ai_tagging",
        "top_similarities; top5={:?}",
        label_sims.iter().take(5).map(|(l, s)| (l.as_str(), s)).collect::<Vec<_>>()
    );

    // Convert to ClassificationResult, filtering by threshold
    let mut results = Vec::new();
    let mut seen_categories = std::collections::HashSet::new();

    for (label, similarity) in label_sims {
        if similarity < config.confidence_threshold {
            continue;
        }

        // Log labels that pass threshold
        log::debug!(
            target: "ai_tagging",
            "above_threshold; label={}; similarity={}",
            label,
            similarity
        );

        if let Some(category) = label_to_category(label) {
            // Skip if we've already seen this category
            if seen_categories.contains(&category) {
                continue;
            }

            // Check if category is enabled
            if let Some(ref enabled) = config.enabled_categories {
                if !enabled.contains(&category) {
                    continue;
                }
            }

            seen_categories.insert(category);
            results.push(ClassificationResult {
                category,
                confidence: similarity,
            });

            log::debug!(
                target: "ai_tagging",
                "tag_added; category={:?}; confidence={}",
                category,
                similarity
            );

            if results.len() >= config.max_tags_per_image {
                break;
            }
        }
    }

    results
}

/// ImageNet normalization constants (used by CLIP models)
pub const CLIP_MEAN: [f32; 3] = [0.48145466, 0.4578275, 0.40821073];
pub const CLIP_STD: [f32; 3] = [0.26862954, 0.261_302_6, 0.275_777_1];

/// Preprocess image for CLIP models
/// Returns tensor in NCHW format (batch=1, channels=3, height, width)
pub fn preprocess_clip_image(
    image_path: &std::path::Path,
    target_size: u32,
    use_exif_thumbnail: bool,
    min_thumbnail_size: u32,
) -> Result<Vec<f32>, String> {
    use image::DynamicImage;

    let mut img: Option<DynamicImage> = None;

    // Try to extract EXIF thumbnail if enabled
    if use_exif_thumbnail {
        if let Some((thumbnail_img, width, height)) =
            crate::utils::exif_thumbnail::extract_exif_thumbnail_with_min_size(
                image_path,
                min_thumbnail_size,
            )
        {
            log::debug!(
                target: "ai_tagging",
                "exif_thumbnail_loaded; path={}; size={}x{}",
                image_path.display(),
                width,
                height
            );
            img = Some(thumbnail_img);
        }
    }

    // Fallback: Load full image (use libheif for HEIC/AVIF)
    if img.is_none() {
        let path_str = image_path.to_string_lossy();
        img = Some(if crate::utils::raw_file::is_heic_or_avif(&path_str) {
            crate::utils::heic_decode::decode_heic_to_image(&path_str, 1600)
                .map(|(i, _, _)| i)
                .ok_or_else(|| format!("Failed to decode HEIC/AVIF: {}", image_path.display()))?
        } else {
            image::open(image_path)
                .map_err(|e| format!("Failed to load image {}: {}", image_path.display(), e))?
        });
        if use_exif_thumbnail {
            log::debug!(target: "ai_tagging", "no_exif_thumbnail; fallback_to_full_image; path={}", image_path.display());
        }
    }

    let img = img.unwrap();

    // Resize to target size (center crop + resize)
    let (width, height) = (img.width(), img.height());
    let min_dim = width.min(height);

    // Center crop to square
    let crop_x = (width - min_dim) / 2;
    let crop_y = (height - min_dim) / 2;
    let cropped = img.crop_imm(crop_x, crop_y, min_dim, min_dim);

    // Resize to target size
    let resized = cropped.resize_exact(
        target_size,
        target_size,
        image::imageops::FilterType::Triangle,
    );

    // Convert to RGB
    let rgb = resized.to_rgb8();

    // Create tensor in NCHW format with CLIP normalization
    let mut tensor = vec![0.0f32; (3 * target_size * target_size) as usize];

    for y in 0..target_size {
        for x in 0..target_size {
            let pixel = rgb.get_pixel(x, y);
            let idx = (y * target_size + x) as usize;

            // Normalize: (pixel / 255.0 - mean) / std
            tensor[idx] = ((pixel[0] as f32 / 255.0) - CLIP_MEAN[0]) / CLIP_STD[0]; // R
            tensor[(target_size * target_size) as usize + idx] =
                ((pixel[1] as f32 / 255.0) - CLIP_MEAN[1]) / CLIP_STD[1]; // G
            tensor[(2 * target_size * target_size) as usize + idx] =
                ((pixel[2] as f32 / 255.0) - CLIP_MEAN[2]) / CLIP_STD[2]; // B
        }
    }

    Ok(tensor)
}

// ============================================================================
// Base CLIP Classifier - Shared implementation for OpenCLIP and SigLIP
// ============================================================================

/// Configuration trait for CLIP-based models
pub trait ClipModelConfig: Default + Send + Sync {
    /// Model input size (e.g., 224)
    const INPUT_SIZE: u32;
    /// Embedding dimension (e.g., 512 for OpenCLIP, 768 for SigLIP)
    const EMBED_DIM: usize;
    /// Output index for visual encoder (0 for OpenCLIP, 1 for SigLIP pooler_output)
    const OUTPUT_INDEX: usize;
    /// Backend name for logging
    const BACKEND_NAME: &'static str;
    /// Model info description
    const MODEL_INFO: &'static str;

    /// Visual model filename
    fn visual_model_filename() -> &'static str;
    /// Text model filename
    fn text_model_filename() -> &'static str;
    /// Text embeddings JSON filename
    fn embeddings_filename() -> &'static str;
}

/// Base CLIP classifier with shared implementation
pub struct BaseClipClassifier<C: ClipModelConfig> {
    visual_session: Option<Session>,
    text_session: Option<Session>,
    text_embeddings: HashMap<String, Vec<f32>>,
    current_labels: Vec<String>,
    models_dir: PathBuf,
    _phantom: PhantomData<C>,
}

impl<C: ClipModelConfig> BaseClipClassifier<C> {
    /// Create a new classifier
    pub fn new() -> Self {
        Self {
            visual_session: None,
            text_session: None,
            text_embeddings: HashMap::new(),
            current_labels: Vec::new(),
            models_dir: Self::default_models_dir(),
            _phantom: PhantomData,
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
        self.models_dir.join(C::visual_model_filename())
    }

    /// Get path to text encoder model
    fn text_model_path(&self) -> PathBuf {
        self.models_dir.join(C::text_model_filename())
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
    fn encode_image(
        &mut self,
        image_path: &Path,
        use_exif_thumbnail: bool,
        min_thumbnail_size: u32,
    ) -> Result<Vec<f32>, String> {
        let session = self
            .visual_session
            .as_mut()
            .ok_or("Visual encoder not initialized")?;

        let input_data = preprocess_clip_image(
            image_path,
            C::INPUT_SIZE,
            use_exif_thumbnail,
            min_thumbnail_size,
        )?;

        let input_tensor = Tensor::from_array((
            [1_usize, 3, C::INPUT_SIZE as usize, C::INPUT_SIZE as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        let outputs = session
            .run(ort::inputs![input_tensor])
            .map_err(|e| format!("Visual encoding failed: {}", e))?;

        // Debug: log output shapes
        log::debug!(
            target: "ai_tagging",
            "clip_outputs; backend={}; count={}",
            C::BACKEND_NAME,
            outputs.len()
        );

        // Get output at configured index
        let (_, output_value) = outputs
            .iter()
            .nth(C::OUTPUT_INDEX)
            .or_else(|| outputs.iter().next())
            .ok_or("No output from visual encoder")?;

        let (_, output_data) = output_value
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract output: {}", e))?;

        let embedding: Vec<f32> = output_data.to_vec();
        let normalized = Self::normalize_embedding(&embedding);

        // Debug: log embedding statistics
        log::debug!(
            target: "ai_tagging",
            "image_embedding; backend={}; dim={}",
            C::BACKEND_NAME,
            normalized.len()
        );

        Ok(normalized)
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

    /// Load pre-computed text embeddings from JSON file
    fn load_precomputed_embeddings(&mut self) -> Result<bool, String> {
        let embeddings_path = self.models_dir.join(C::embeddings_filename());

        if !embeddings_path.exists() {
            log::debug!(
                target: "ai_tagging",
                "precomputed_embeddings_not_found; backend={}; path={}",
                C::BACKEND_NAME,
                embeddings_path.display()
            );
            return Ok(false);
        }

        let data = std::fs::read_to_string(&embeddings_path)
            .map_err(|e| format!("Failed to read embeddings file: {}", e))?;

        let parsed: HashMap<String, Vec<f32>> = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse embeddings JSON: {}", e))?;

        if let Some(first_emb) = parsed.values().next() {
            if first_emb.len() != C::EMBED_DIM {
                return Err(format!(
                    "Embedding dimension mismatch: expected {}, got {}",
                    C::EMBED_DIM,
                    first_emb.len()
                ));
            }
        }

        self.text_embeddings = parsed;
        self.current_labels = self.text_embeddings.keys().cloned().collect();

        log::info!(
            target: "ai_tagging",
            "loaded_precomputed_embeddings; backend={}; count={}; dim={}",
            C::BACKEND_NAME,
            self.text_embeddings.len(),
            C::EMBED_DIM
        );

        Ok(true)
    }

    /// Pre-compute text embeddings for all labels
    fn precompute_text_embeddings(&mut self) -> Result<(), String> {
        match self.load_precomputed_embeddings() {
            Ok(true) => return Ok(()),
            Ok(false) => {}
            Err(e) => {
                log::warn!(
                    target: "ai_tagging",
                    "precomputed_embeddings_load_error; backend={}; error={}",
                    C::BACKEND_NAME,
                    e
                );
            }
        }

        if self.text_session.is_none() {
            log::warn!(
                target: "ai_tagging",
                "no_text_embeddings_available; backend={}; classification_disabled",
                C::BACKEND_NAME
            );
        }

        Ok(())
    }
}

impl<C: ClipModelConfig> Default for BaseClipClassifier<C> {
    fn default() -> Self {
        Self::new()
    }
}

impl<C: ClipModelConfig> AIClassifierBackend for BaseClipClassifier<C> {
    fn initialize(&mut self) -> Result<(), String> {
        if self.visual_session.is_some() {
            return Ok(());
        }

        // Set ORT_DYLIB_PATH if needed
        if std::env::var("ORT_DYLIB_PATH").is_err() {
            if let Some(data_dir) = dirs::data_local_dir() {
                let lib_path = data_dir
                    .join("photoclove")
                    .join("lib")
                    .join("libonnxruntime.so");
                if lib_path.exists() {
                    std::env::set_var("ORT_DYLIB_PATH", &lib_path);
                }
            }
        }

        let visual_path = self.visual_model_path();
        let text_path = self.text_model_path();

        log::info!(
            target: "ai_tagging",
            "initializing; backend={}; visual_path={}",
            C::BACKEND_NAME,
            visual_path.display()
        );

        if !visual_path.exists() {
            return Err(format!(
                "{} visual model not found: {}. Please download the model first.",
                C::BACKEND_NAME,
                visual_path.display()
            ));
        }

        let visual_session = Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set thread count: {}", e))?
            .commit_from_file(&visual_path)
            .map_err(|e| format!("Failed to load visual model: {}", e))?;

        self.visual_session = Some(visual_session);

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
                        "text_encoder_loaded; backend={}; path={}",
                        C::BACKEND_NAME,
                        text_path.display()
                    );
                }
                Err(e) => {
                    log::warn!(
                        target: "ai_tagging",
                        "text_encoder_load_failed; backend={}; error={}",
                        C::BACKEND_NAME,
                        e
                    );
                }
            }
        }

        if self.current_labels.is_empty() {
            self.current_labels = Self::default_labels();
        }

        if let Err(e) = self.precompute_text_embeddings() {
            log::warn!(
                target: "ai_tagging",
                "precompute_embeddings_failed; backend={}; error={}",
                C::BACKEND_NAME,
                e
            );
        }

        log::info!(
            target: "ai_tagging",
            "initialized; backend={}; labels={}",
            C::BACKEND_NAME,
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
            return Err(format!(
                "{} not initialized. Call initialize() first.",
                C::BACKEND_NAME
            ));
        }

        log::debug!(
            target: "ai_tagging",
            "classifying; backend={}; image={}; use_exif={}",
            C::BACKEND_NAME,
            image_path.display(),
            config.use_exif_thumbnail
        );

        let image_embedding = self.encode_image(
            image_path,
            config.use_exif_thumbnail,
            config.min_thumbnail_size,
        )?;

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
                "classified; backend={}; image={}; results={}",
                C::BACKEND_NAME,
                image_path.display(),
                results.len()
            );

            return Ok(results);
        }

        log::warn!(
            target: "ai_tagging",
            "no_text_embeddings; backend={}; returning_empty_results",
            C::BACKEND_NAME
        );
        Ok(Vec::new())
    }

    fn backend_name(&self) -> &'static str {
        C::BACKEND_NAME
    }

    fn model_info(&self) -> String {
        format!("{} ({} labels)", C::MODEL_INFO, self.current_labels.len())
    }
}
