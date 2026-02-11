//! AI Model Manager
//!
//! Manages downloading, storing, and querying AI models for the tagging system.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Information about an available AI model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Unique identifier for the model
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// License type
    pub license: String,
    /// Approximate size in MB
    pub size_mb: u32,
    /// Description of the model's capabilities
    pub description: String,
    /// Whether this model supports custom labels
    pub supports_custom_labels: bool,
    /// Speed rating (1-5, 5 being fastest)
    pub speed_rating: u8,
    /// Accuracy rating (1-5, 5 being most accurate)
    pub accuracy_rating: u8,
    /// Files required for this model
    pub files: Vec<ModelFile>,
}

/// A file that is part of a model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelFile {
    /// Filename
    pub filename: String,
    /// Download URL
    pub url: String,
    /// Expected file size in bytes (for progress tracking)
    pub size_bytes: u64,
}

/// Status of a model
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelStatus {
    /// Model is not downloaded
    NotDownloaded,
    /// Model is being downloaded
    Downloading { progress: f32 },
    /// Model is downloaded and ready
    Ready,
    /// Model download failed
    Failed { error: String },
}

/// Manages AI models for the tagging system
pub struct ModelManager {
    models_dir: PathBuf,
}

impl ModelManager {
    /// Create a new ModelManager
    pub fn new() -> Self {
        let models_dir = Self::default_models_dir();
        Self { models_dir }
    }

    /// Get the default models directory
    pub fn default_models_dir() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("photoclove")
            .join("models")
    }

    /// Get all available models
    pub fn list_available_models() -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "mobilenet".to_string(),
                name: "MobileNet (ImageNet)".to_string(),
                license: "Apache 2.0".to_string(),
                size_mb: 15,
                description: "Fast classification with 32 predefined categories. Good for basic object and scene detection.".to_string(),
                supports_custom_labels: false,
                speed_rating: 5,
                accuracy_rating: 2,
                files: vec![ModelFile {
                    filename: "mobilenet-v3-large.onnx".to_string(),
                    url: "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv3-large-100_224_fp32.onnx".to_string(),
                    size_bytes: 22_000_000,
                }],
            },
            ModelInfo {
                id: "openclip".to_string(),
                name: "OpenCLIP (ViT-B/32)".to_string(),
                license: "MIT".to_string(),
                size_mb: 606,
                description: "Flexible tagging with custom labels. Can detect people, scenes, events, and any custom concept you define.".to_string(),
                supports_custom_labels: true,
                speed_rating: 3,
                accuracy_rating: 4,
                files: vec![
                    ModelFile {
                        filename: "openclip-vit-b-32-visual.onnx".to_string(),
                        url: "https://huggingface.co/immich-app/ViT-B-32__laion2b-s34b-b79k/resolve/main/visual/model.onnx".to_string(),
                        size_bytes: 351_613_724,
                    },
                    ModelFile {
                        filename: "openclip-vit-b-32-text.onnx".to_string(),
                        url: "https://huggingface.co/immich-app/ViT-B-32__laion2b-s34b-b79k/resolve/main/textual/model.onnx".to_string(),
                        size_bytes: 254_200_000,
                    },
                ],
            },
            ModelInfo {
                id: "siglip".to_string(),
                name: "SigLIP (Base)".to_string(),
                license: "Apache 2.0".to_string(),
                size_mb: 813,
                description: "Improved CLIP variant with better accuracy. Supports custom labels and multilingual text.".to_string(),
                supports_custom_labels: true,
                speed_rating: 3,
                accuracy_rating: 5,
                files: vec![
                    ModelFile {
                        filename: "siglip-base-visual.onnx".to_string(),
                        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/onnx/vision_model.onnx".to_string(),
                        size_bytes: 371_820_000,
                    },
                    ModelFile {
                        filename: "siglip-base-text.onnx".to_string(),
                        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/onnx/text_model.onnx".to_string(),
                        size_bytes: 441_330_000,
                    },
                ],
            },
        ]
    }

    /// Get information about a specific model
    pub fn get_model_info(model_id: &str) -> Option<ModelInfo> {
        Self::list_available_models()
            .into_iter()
            .find(|m| m.id == model_id)
    }

    /// Check if a model is downloaded
    pub fn is_model_downloaded(&self, model_id: &str) -> bool {
        if let Some(model_info) = Self::get_model_info(model_id) {
            model_info
                .files
                .iter()
                .all(|f| self.get_model_file_path(&f.filename).exists())
        } else {
            false
        }
    }

    /// Get the status of a model
    pub fn get_model_status(&self, model_id: &str) -> ModelStatus {
        if self.is_model_downloaded(model_id) {
            ModelStatus::Ready
        } else {
            ModelStatus::NotDownloaded
        }
    }

    /// Get the path to a model file
    pub fn get_model_file_path(&self, filename: &str) -> PathBuf {
        self.models_dir.join(filename)
    }

    /// Get the models directory path
    pub fn get_models_dir(&self) -> &Path {
        &self.models_dir
    }

    /// Ensure the models directory exists
    pub fn ensure_models_dir(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))
    }

    /// Download a model (synchronous, blocking)
    /// For async download with progress, use download_model_async
    pub fn download_model(&self, model_id: &str) -> Result<(), String> {
        let model_info =
            Self::get_model_info(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

        self.ensure_models_dir()?;

        log::info!(
            target: "ai_tagging",
            "download_model_start; model_id={}; files={}",
            model_id,
            model_info.files.len()
        );

        for file in &model_info.files {
            let dest_path = self.get_model_file_path(&file.filename);

            if dest_path.exists() {
                log::debug!(
                    target: "ai_tagging",
                    "model_file_exists; filename={}",
                    file.filename
                );
                continue;
            }

            log::info!(
                target: "ai_tagging",
                "downloading_model_file; filename={}; url={}",
                file.filename,
                file.url
            );

            // Use ureq for synchronous HTTP download
            let response = ureq::get(&file.url)
                .call()
                .map_err(|e| format!("Failed to download {}: {}", file.filename, e))?;

            let mut reader = response.into_reader();
            let mut file_handle = std::fs::File::create(&dest_path)
                .map_err(|e| format!("Failed to create file {}: {}", file.filename, e))?;

            std::io::copy(&mut reader, &mut file_handle)
                .map_err(|e| format!("Failed to write file {}: {}", file.filename, e))?;

            log::info!(
                target: "ai_tagging",
                "model_file_downloaded; filename={}",
                file.filename
            );
        }

        log::info!(
            target: "ai_tagging",
            "download_model_complete; model_id={}",
            model_id
        );

        Ok(())
    }

    /// Delete a downloaded model
    pub fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let model_info =
            Self::get_model_info(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

        for file in &model_info.files {
            let file_path = self.get_model_file_path(&file.filename);
            if file_path.exists() {
                std::fs::remove_file(&file_path)
                    .map_err(|e| format!("Failed to delete {}: {}", file.filename, e))?;
            }
        }

        log::info!(
            target: "ai_tagging",
            "model_deleted; model_id={}",
            model_id
        );

        Ok(())
    }

    /// Get status of all models
    pub fn get_all_model_statuses(&self) -> Vec<(ModelInfo, ModelStatus)> {
        Self::list_available_models()
            .into_iter()
            .map(|model| {
                let status = self.get_model_status(&model.id);
                (model, status)
            })
            .collect()
    }
}

impl Default for ModelManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Default labels for CLIP-based models (OpenCLIP, SigLIP)
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

/// Map CLIP label to tag name (extracts the main subject)
pub fn clip_label_to_tag(label: &str) -> String {
    // Extract the main subject from "a photo of X" pattern
    let tag = label
        .trim_start_matches("a photo of ")
        .trim_start_matches("an ")
        .trim_start_matches("a ")
        .trim_end_matches(" photo")
        .replace(' ', "_");

    format!("ai:{}", tag)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clip_label_to_tag() {
        assert_eq!(clip_label_to_tag("a photo of a dog"), "ai:dog");
        assert_eq!(clip_label_to_tag("a photo of a person"), "ai:person");
        assert_eq!(clip_label_to_tag("a photo of the ocean"), "ai:the_ocean");
        assert_eq!(clip_label_to_tag("a wedding photo"), "ai:wedding");
        assert_eq!(clip_label_to_tag("an indoor photo"), "ai:indoor");
    }
}
