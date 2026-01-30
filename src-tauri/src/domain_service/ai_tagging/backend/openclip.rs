//! OpenCLIP Backend Implementation
//!
//! This module provides AI classification using OpenCLIP (LAION trained CLIP variant).
//! OpenCLIP allows flexible multi-label classification using text-image similarity.

use super::clip_common::{BaseClipClassifier, ClipModelConfig};

/// OpenCLIP model configuration
#[derive(Default)]
pub struct OpenClipConfig;

impl ClipModelConfig for OpenClipConfig {
    const INPUT_SIZE: u32 = 224;
    const EMBED_DIM: usize = 512;
    const OUTPUT_INDEX: usize = 0;
    const BACKEND_NAME: &'static str = "OpenCLIP";
    const MODEL_INFO: &'static str = "OpenCLIP ViT-B/32 (LAION-2B)";

    fn visual_model_filename() -> &'static str {
        "openclip-vit-b-32-visual.onnx"
    }

    fn text_model_filename() -> &'static str {
        "openclip-vit-b-32-text.onnx"
    }

    fn embeddings_filename() -> &'static str {
        "openclip_text_embeddings.json"
    }
}

/// OpenCLIP based classifier
pub type OpenClipClassifier = BaseClipClassifier<OpenClipConfig>;
