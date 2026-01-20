//! AI Auto-Tagging Service
//!
//! This module provides AI-powered automatic image classification.
//! It uses a trait-based design to allow multiple backend implementations:
//! - ONNX Runtime (MobileNetV3, EfficientNet)
//! - Future: Candle, Cloud APIs, etc.

pub mod backend;
pub mod categories;
pub mod service;

pub use backend::AIClassifierBackend;
pub use categories::AutoTagCategory;
pub use service::AITaggingService;
