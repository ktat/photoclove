//! Common utilities for CLIP-based models (OpenCLIP, SigLIP)
//!
//! This module provides shared functionality for CLIP-style vision-language models.

use super::{ClassificationResult, ClassifierConfig};
use crate::domain_service::ai_tagging::categories::AutoTagCategory;

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
    let mut label_sims: Vec<(&String, f32)> = labels.iter().zip(similarities.iter().cloned()).collect();
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
pub const CLIP_STD: [f32; 3] = [0.26862954, 0.26130258, 0.27577711];

/// Preprocess image for CLIP models
/// Returns tensor in NCHW format (batch=1, channels=3, height, width)
pub fn preprocess_clip_image(
    image_path: &std::path::Path,
    target_size: u32,
    use_exif_thumbnail: bool,
) -> Result<Vec<f32>, String> {
    use image::DynamicImage;
    use std::fs::File;
    use std::io::BufReader;
    use kexif::Reader as ExifReader;
    use kexif::{In, Tag};

    let mut img: Option<DynamicImage> = None;

    // Try to extract EXIF thumbnail if enabled
    if use_exif_thumbnail {
        if let Ok(file) = File::open(image_path) {
            let mut bufreader = BufReader::new(&file);

            if let Ok(exif_reader) = ExifReader::new().read_from_container(&mut bufreader) {
                // Try to get the thumbnail
                if let Some(thumbnail_field) = exif_reader.get_field(Tag::JPEGInterchangeFormat, In::THUMBNAIL) {
                    if let Some(length_field) = exif_reader.get_field(Tag::JPEGInterchangeFormatLength, In::THUMBNAIL) {
                        if let (kexif::Value::Long(ref offset_vec), kexif::Value::Long(ref length_vec)) =
                            (&thumbnail_field.value, &length_field.value) {
                            if !offset_vec.is_empty() && !length_vec.is_empty() {
                                let offset = offset_vec[0] as usize;
                                let length = length_vec[0] as usize;

                                // Re-open file to read thumbnail data
                                if let Ok(mut file) = File::open(image_path) {
                                    use std::io::{Seek, SeekFrom, Read};

                                    if file.seek(SeekFrom::Start(offset as u64)).is_ok() {
                                        let mut thumbnail_data = vec![0u8; length];
                                        if file.read_exact(&mut thumbnail_data).is_ok() {
                                            if let Ok(thumbnail_img) = image::load_from_memory(&thumbnail_data) {
                                                log::debug!(
                                                    target: "ai_tagging",
                                                    "exif_thumbnail_loaded; path={}; size={}x{}",
                                                    image_path.display(),
                                                    thumbnail_img.width(),
                                                    thumbnail_img.height()
                                                );
                                                img = Some(thumbnail_img);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: Load full image if EXIF thumbnail not found or disabled
    if img.is_none() {
        img = Some(
            image::open(image_path)
                .map_err(|e| format!("Failed to load image {}: {}", image_path.display(), e))?
        );

        if use_exif_thumbnail {
            log::debug!(
                target: "ai_tagging",
                "no_exif_thumbnail; fallback_to_full_image; path={}",
                image_path.display()
            );
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
    let resized = cropped.resize_exact(target_size, target_size, image::imageops::FilterType::Triangle);

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
