//! AI Auto-Tagging Service
//!
//! This module provides AI-powered automatic image classification.
//! It uses a trait-based design to allow multiple backend implementations:
//! - ONNX Runtime (MobileNetV3, EfficientNet)
//! - Future: Candle, Cloud APIs, etc.

// Suppress dead_code warnings for this module as it contains API surface
// that will be used when the full feature is integrated (Preferences UI, etc.)
#![allow(dead_code)]

pub mod backend;
pub mod categories;
pub mod service;
