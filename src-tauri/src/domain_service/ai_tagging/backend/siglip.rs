//! SigLIP Backend Implementation
//!
//! This module provides AI classification using SigLIP (Sigmoid Loss for Language Image Pre-Training).
//! SigLIP is an improved CLIP variant from Google with better accuracy.

use super::clip_common::{BaseClipClassifier, ClipModelConfig};

/// SigLIP model configuration
#[derive(Default)]
pub struct SigLipConfig;

impl ClipModelConfig for SigLipConfig {
    const INPUT_SIZE: u32 = 224;
    const EMBED_DIM: usize = 768;
    // SigLIP returns two outputs: last_hidden_state [1,196,768] and pooler_output [1,768]
    // We need the pooler_output (second output, index 1)
    const OUTPUT_INDEX: usize = 1;
    const BACKEND_NAME: &'static str = "SigLIP";
    const MODEL_INFO: &'static str = "SigLIP Base (Google)";

    fn visual_model_filename() -> &'static str {
        "siglip-base-visual.onnx"
    }

    fn text_model_filename() -> &'static str {
        "siglip-base-text.onnx"
    }

    fn embeddings_filename() -> &'static str {
        "siglip_text_embeddings.json"
    }
}

/// SigLIP based classifier
pub type SigLipClassifier = BaseClipClassifier<SigLipConfig>;
