//! AI Auto-Tag Categories
//!
//! This module defines the categories that can be automatically detected in photos.
//! Categories are mapped from ImageNet classes to user-friendly tag names.

use serde::{Deserialize, Serialize};

/// Categories that can be automatically detected in photos
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoTagCategory {
    // People
    Person,
    Face,
    Group,

    // Animals
    Dog,
    Cat,
    Bird,
    Fish,
    Horse,
    Cow,
    Insect,
    Wildlife,

    // Nature
    Sea,
    Beach,
    Mountain,
    Forest,
    River,
    Lake,
    Sky,
    Sunset,

    // Plants
    Flower,
    Tree,
    Plant,
    Garden,

    // Scenes
    Food,
    Building,
    Street,
    Indoor,
    Outdoor,
    Night,

    // Events
    Wedding,
    Birthday,
    Travel,
}

impl AutoTagCategory {
    /// Get the tag name with ai: prefix
    pub fn tag_name(&self) -> String {
        format!("ai:{}", self.as_str())
    }

    /// Get the category as a lowercase string
    pub fn as_str(&self) -> &'static str {
        match self {
            AutoTagCategory::Person => "person",
            AutoTagCategory::Face => "face",
            AutoTagCategory::Group => "group",
            AutoTagCategory::Dog => "dog",
            AutoTagCategory::Cat => "cat",
            AutoTagCategory::Bird => "bird",
            AutoTagCategory::Fish => "fish",
            AutoTagCategory::Horse => "horse",
            AutoTagCategory::Cow => "cow",
            AutoTagCategory::Insect => "insect",
            AutoTagCategory::Wildlife => "wildlife",
            AutoTagCategory::Sea => "sea",
            AutoTagCategory::Beach => "beach",
            AutoTagCategory::Mountain => "mountain",
            AutoTagCategory::Forest => "forest",
            AutoTagCategory::River => "river",
            AutoTagCategory::Lake => "lake",
            AutoTagCategory::Sky => "sky",
            AutoTagCategory::Sunset => "sunset",
            AutoTagCategory::Flower => "flower",
            AutoTagCategory::Tree => "tree",
            AutoTagCategory::Plant => "plant",
            AutoTagCategory::Garden => "garden",
            AutoTagCategory::Food => "food",
            AutoTagCategory::Building => "building",
            AutoTagCategory::Street => "street",
            AutoTagCategory::Indoor => "indoor",
            AutoTagCategory::Outdoor => "outdoor",
            AutoTagCategory::Night => "night",
            AutoTagCategory::Wedding => "wedding",
            AutoTagCategory::Birthday => "birthday",
            AutoTagCategory::Travel => "travel",
        }
    }

    /// Get a human-readable display name
    pub fn display_name(&self) -> &'static str {
        match self {
            AutoTagCategory::Person => "Person",
            AutoTagCategory::Face => "Face",
            AutoTagCategory::Group => "Group of People",
            AutoTagCategory::Dog => "Dog",
            AutoTagCategory::Cat => "Cat",
            AutoTagCategory::Bird => "Bird",
            AutoTagCategory::Fish => "Fish",
            AutoTagCategory::Horse => "Horse",
            AutoTagCategory::Cow => "Cow",
            AutoTagCategory::Insect => "Insect",
            AutoTagCategory::Wildlife => "Wildlife",
            AutoTagCategory::Sea => "Sea",
            AutoTagCategory::Beach => "Beach",
            AutoTagCategory::Mountain => "Mountain",
            AutoTagCategory::Forest => "Forest",
            AutoTagCategory::River => "River",
            AutoTagCategory::Lake => "Lake",
            AutoTagCategory::Sky => "Sky",
            AutoTagCategory::Sunset => "Sunset",
            AutoTagCategory::Flower => "Flower",
            AutoTagCategory::Tree => "Tree",
            AutoTagCategory::Plant => "Plant",
            AutoTagCategory::Garden => "Garden",
            AutoTagCategory::Food => "Food",
            AutoTagCategory::Building => "Building",
            AutoTagCategory::Street => "Street",
            AutoTagCategory::Indoor => "Indoor",
            AutoTagCategory::Outdoor => "Outdoor",
            AutoTagCategory::Night => "Night",
            AutoTagCategory::Wedding => "Wedding",
            AutoTagCategory::Birthday => "Birthday",
            AutoTagCategory::Travel => "Travel",
        }
    }

    /// Get all available categories
    pub fn all() -> Vec<AutoTagCategory> {
        vec![
            AutoTagCategory::Person,
            AutoTagCategory::Face,
            AutoTagCategory::Group,
            AutoTagCategory::Dog,
            AutoTagCategory::Cat,
            AutoTagCategory::Bird,
            AutoTagCategory::Fish,
            AutoTagCategory::Horse,
            AutoTagCategory::Cow,
            AutoTagCategory::Insect,
            AutoTagCategory::Wildlife,
            AutoTagCategory::Sea,
            AutoTagCategory::Beach,
            AutoTagCategory::Mountain,
            AutoTagCategory::Forest,
            AutoTagCategory::River,
            AutoTagCategory::Lake,
            AutoTagCategory::Sky,
            AutoTagCategory::Sunset,
            AutoTagCategory::Flower,
            AutoTagCategory::Tree,
            AutoTagCategory::Plant,
            AutoTagCategory::Garden,
            AutoTagCategory::Food,
            AutoTagCategory::Building,
            AutoTagCategory::Street,
            AutoTagCategory::Indoor,
            AutoTagCategory::Outdoor,
            AutoTagCategory::Night,
            AutoTagCategory::Wedding,
            AutoTagCategory::Birthday,
            AutoTagCategory::Travel,
        ]
    }

    /// Get categories by group
    pub fn by_group(group: CategoryGroup) -> Vec<AutoTagCategory> {
        match group {
            CategoryGroup::People => vec![
                AutoTagCategory::Person,
                AutoTagCategory::Face,
                AutoTagCategory::Group,
            ],
            CategoryGroup::Animals => vec![
                AutoTagCategory::Dog,
                AutoTagCategory::Cat,
                AutoTagCategory::Bird,
                AutoTagCategory::Fish,
                AutoTagCategory::Horse,
                AutoTagCategory::Cow,
                AutoTagCategory::Insect,
                AutoTagCategory::Wildlife,
            ],
            CategoryGroup::Nature => vec![
                AutoTagCategory::Sea,
                AutoTagCategory::Beach,
                AutoTagCategory::Mountain,
                AutoTagCategory::Forest,
                AutoTagCategory::River,
                AutoTagCategory::Lake,
                AutoTagCategory::Sky,
                AutoTagCategory::Sunset,
            ],
            CategoryGroup::Plants => vec![
                AutoTagCategory::Flower,
                AutoTagCategory::Tree,
                AutoTagCategory::Plant,
                AutoTagCategory::Garden,
            ],
            CategoryGroup::Scenes => vec![
                AutoTagCategory::Food,
                AutoTagCategory::Building,
                AutoTagCategory::Street,
                AutoTagCategory::Indoor,
                AutoTagCategory::Outdoor,
                AutoTagCategory::Night,
            ],
            CategoryGroup::Events => vec![
                AutoTagCategory::Wedding,
                AutoTagCategory::Birthday,
                AutoTagCategory::Travel,
            ],
        }
    }
}

/// Category groups for UI organization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CategoryGroup {
    People,
    Animals,
    Nature,
    Plants,
    Scenes,
    Events,
}

impl CategoryGroup {
    pub fn all() -> Vec<CategoryGroup> {
        vec![
            CategoryGroup::People,
            CategoryGroup::Animals,
            CategoryGroup::Nature,
            CategoryGroup::Plants,
            CategoryGroup::Scenes,
            CategoryGroup::Events,
        ]
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CategoryGroup::People => "People",
            CategoryGroup::Animals => "Animals",
            CategoryGroup::Nature => "Nature",
            CategoryGroup::Plants => "Plants",
            CategoryGroup::Scenes => "Scenes",
            CategoryGroup::Events => "Events",
        }
    }
}

/// Mapping from ImageNet class indices to AutoTagCategory
///
/// This is a simplified mapping - the actual ImageNet has 1000 classes,
/// and we map multiple related classes to our broader categories.
#[allow(dead_code)]
pub struct ImageNetMapping;

#[allow(dead_code)]
impl ImageNetMapping {
    /// Map an ImageNet class index to an AutoTagCategory
    ///
    /// Returns None if the class doesn't map to any of our categories.
    pub fn map_class_index(class_index: usize) -> Option<AutoTagCategory> {
        // ImageNet class ranges (approximate, will need refinement with actual model)
        match class_index {
            // Dogs (151-268 in ImageNet)
            151..=268 => Some(AutoTagCategory::Dog),
            // Cats (281-285 in ImageNet)
            281..=285 => Some(AutoTagCategory::Cat),
            // Birds (various ranges)
            7..=24 => Some(AutoTagCategory::Bird),
            80..=100 => Some(AutoTagCategory::Bird),
            // Fish
            0..=6 => Some(AutoTagCategory::Fish),
            389..=397 => Some(AutoTagCategory::Fish),
            // Insects
            300..=326 => Some(AutoTagCategory::Insect),
            // Flowers
            985..=998 => Some(AutoTagCategory::Flower),
            // Food
            924..=969 => Some(AutoTagCategory::Food),
            // Buildings/Architecture
            497..=520 => Some(AutoTagCategory::Building),
            // Vehicles that might indicate travel
            751..=780 => Some(AutoTagCategory::Travel),
            // Default: no mapping
            _ => None,
        }
    }
}
