//! Default CLIP label set and label-to-category mapping for OpenCLIP/SigLIP.

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
