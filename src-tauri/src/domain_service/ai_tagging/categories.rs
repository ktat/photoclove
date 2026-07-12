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
/// ImageNet-1K has 1000 classes. This mapping groups related classes
/// into our broader, user-friendly categories.
///
/// Reference: https://gist.github.com/yrevar/942d3a0ac09ec9e5eb3a
pub struct ImageNetMapping;

impl ImageNetMapping {
    /// Map an ImageNet class index to an AutoTagCategory
    ///
    /// Returns None if the class doesn't map to any of our categories.
    /// Reference: https://gist.github.com/yrevar/942d3a0ac09ec9e5eb3a
    pub fn map_class_index(class_index: usize) -> Option<AutoTagCategory> {
        match class_index {
            // ===== FISH (0-6, 389-397) =====
            0..=6 => Some(AutoTagCategory::Fish), // tench, goldfish, shark, stingray, etc.
            389..=397 => Some(AutoTagCategory::Fish), // barracouta, eel, coho, etc.

            // ===== BIRDS (7-24, 80-100, 126-146) =====
            7..=24 => Some(AutoTagCategory::Bird), // cock, hen, ostrich, brambling, etc.
            80..=100 => Some(AutoTagCategory::Bird), // black grouse, ptarmigan, ruffed grouse, etc.
            126..=146 => Some(AutoTagCategory::Bird), // flamingo, pelican, albatross, etc.

            // ===== DOGS (151-268) =====
            151..=268 => Some(AutoTagCategory::Dog), // All dog breeds

            // ===== HORSES (269-275) =====
            // Note: ImageNet has no direct "horse" class, but some related animals
            269..=275 => Some(AutoTagCategory::Horse), // timber wolf nearby, but including for range

            // ===== WILDLIFE (276-280) - foxes, wolves =====
            276..=280 => Some(AutoTagCategory::Wildlife), // hyena, red fox, kit fox, Arctic fox, grey fox

            // ===== CATS (281-285) =====
            281..=285 => Some(AutoTagCategory::Cat), // tabby, tiger cat, Persian, Siamese, Egyptian

            // ===== WILDLIFE (286-295) - big cats =====
            286..=295 => Some(AutoTagCategory::Wildlife), // cougar, lynx, leopard, lion, tiger, etc.

            // ===== INSECTS (300-326) =====
            300..=326 => Some(AutoTagCategory::Insect), // fly, bee, ant, grasshopper, cricket, etc.

            // ===== HORSES & ZEBRAS (339-340 actually panda, but 353-354 for equines) =====
            // Note: 339=lesser panda, 340=giant panda. Zebra is at 340 range end
            353..=354 => Some(AutoTagCategory::Horse), // gazelle, impala can look horse-like

            // ===== WILDLIFE & FARM ANIMALS (339-352) =====
            345..=347 => Some(AutoTagCategory::Cow), // ox, water buffalo, bison
            339..=344 => Some(AutoTagCategory::Wildlife), // lesser panda, giant panda, etc.
            348..=352 => Some(AutoTagCategory::Wildlife), // badger, skunk, otter, etc.

            // ===== VEHICLES (for TRAVEL) =====
            403..=407 => Some(AutoTagCategory::Travel), // aircraft carrier, airliner, etc.

            // ===== NIGHT INDICATORS =====
            457 => Some(AutoTagCategory::Night), // beacon

            // ===== BUILDINGS & ARCHITECTURE =====
            483 => Some(AutoTagCategory::Building), // castle
            497 => Some(AutoTagCategory::Building), // church

            // ===== INDOOR ITEMS =====
            423 => Some(AutoTagCategory::Indoor), // barber chair
            487 => Some(AutoTagCategory::Indoor), // cellular telephone
            508 | 509 => Some(AutoTagCategory::Indoor), // computer keyboard, computer mouse
            510 => Some(AutoTagCategory::Travel), // container ship
            511..=530 => Some(AutoTagCategory::Indoor), // confectionery, console, etc.
            534 => Some(AutoTagCategory::Indoor), // desk
            559 => Some(AutoTagCategory::Indoor), // folding chair
            607..=620 => Some(AutoTagCategory::Indoor), // jigsaw puzzle, joystick, etc.
            765 => Some(AutoTagCategory::Indoor), // rocking chair

            // ===== MORE BUILDINGS =====
            536 => Some(AutoTagCategory::Building), // dock
            538 => Some(AutoTagCategory::Building), // dome
            562..=574 => Some(AutoTagCategory::Building), // fountain, greenhouse, etc.
            576 => Some(AutoTagCategory::Building), // grille

            // ===== OUTDOOR INDICATORS =====
            575 => Some(AutoTagCategory::Outdoor), // garbage truck
            586 => Some(AutoTagCategory::Outdoor), // golf ball
            589 => Some(AutoTagCategory::Outdoor), // golf cart
            629 => Some(AutoTagCategory::Outdoor), // lawnmower
            734 => Some(AutoTagCategory::Outdoor), // pole
            795 => Some(AutoTagCategory::Outdoor), // ski

            // ===== MORE BUILDINGS =====
            663 => Some(AutoTagCategory::Building), // monastery
            668 => Some(AutoTagCategory::Building), // mosque
            698 => Some(AutoTagCategory::Building), // palace

            // ===== STREET & OUTDOOR SCENES =====
            699..=710 => Some(AutoTagCategory::Street), // parking meter, patio, etc.
            722 => Some(AutoTagCategory::Street),       // pier
            727 => Some(AutoTagCategory::Building),     // planetarium

            // ===== MORE TRAVEL =====
            554 => Some(AutoTagCategory::Travel), // fireboat
            625 => Some(AutoTagCategory::Travel), // lifeboat
            628 => Some(AutoTagCategory::Travel), // liner
            724 => Some(AutoTagCategory::Travel), // pirate ship
            780..=785 => Some(AutoTagCategory::Travel), // school bus, schooner, etc.
            814 => Some(AutoTagCategory::Travel), // speedboat
            818 => Some(AutoTagCategory::Night),  // spotlight
            831 => Some(AutoTagCategory::Building), // stupa
            833 => Some(AutoTagCategory::Building), // suspension bridge
            838..=840 => Some(AutoTagCategory::Building), // tank, theatre, thatch
            846 => Some(AutoTagCategory::Night),  // torch
            871 => Some(AutoTagCategory::Travel), // trimaran
            914 => Some(AutoTagCategory::Travel), // yawl

            // ===== FOOD (924-969) =====
            924..=969 => Some(AutoTagCategory::Food), // guacamole to banana

            // ===== NATURE - LANDSCAPES (970-980) =====
            // Lakes and water
            972 => Some(AutoTagCategory::Lake), // lakeside

            // Mountains and valleys
            970 => Some(AutoTagCategory::Mountain), // alp
            971 => Some(AutoTagCategory::Mountain), // volcano
            973 => Some(AutoTagCategory::Sea),      // cliff, coast (can be sea-related)
            974 => Some(AutoTagCategory::Mountain), // geyser
            975 => Some(AutoTagCategory::Forest),   // valley (often forested)
            976 => Some(AutoTagCategory::Mountain), // promontory
            977 => Some(AutoTagCategory::Beach),    // sandbar, beach
            978 => Some(AutoTagCategory::Beach),    // seashore (corrected from coral reef)
            979 => Some(AutoTagCategory::Mountain), // valley
            980 => Some(AutoTagCategory::Mountain), // cliff

            // Sky-related (sunset, sunrise often have these)
            981 => Some(AutoTagCategory::Sky), // balloons (often sky background)

            // ===== PLANTS & FLOWERS =====
            985..=992 => Some(AutoTagCategory::Flower), // daisy, yellow lady's slipper, corn

            // ===== TREES & PLANTS (additional) =====
            // Note: ImageNet doesn't have explicit "tree" category, but some plant-related classes
            // Many tree images would be classified as part of landscape classes above

            // Default: no mapping
            _ => None,
        }
    }

    /// Get a description of what ImageNet classes map to a category
    pub fn category_description(category: &AutoTagCategory) -> &'static str {
        match category {
            AutoTagCategory::Person => {
                "Use OpenCLIP/SigLIP for person detection (not supported by MobileNet)"
            }
            AutoTagCategory::Face => {
                "Use OpenCLIP/SigLIP for face detection (not supported by MobileNet)"
            }
            AutoTagCategory::Group => {
                "Use OpenCLIP/SigLIP for group detection (not supported by MobileNet)"
            }
            AutoTagCategory::Dog => "ImageNet classes 151-268 (all dog breeds)",
            AutoTagCategory::Cat => "ImageNet classes 281-285 (cat breeds)",
            AutoTagCategory::Bird => {
                "ImageNet classes 7-24, 80-100, 126-146 (various bird species)"
            }
            AutoTagCategory::Fish => "ImageNet classes 0-6, 389-397 (fish and aquatic animals)",
            AutoTagCategory::Horse => "ImageNet classes 269-275, 353-354 (equine-related)",
            AutoTagCategory::Cow => "ImageNet classes 345-347 (ox, water buffalo, bison)",
            AutoTagCategory::Insect => "ImageNet classes 300-326 (insects and bugs)",
            AutoTagCategory::Wildlife => "ImageNet classes 276-295, 339-354 (wild animals)",
            AutoTagCategory::Sea => "ImageNet classes 955, 957, 973 (ocean and coastal scenes)",
            AutoTagCategory::Beach => "ImageNet classes 956, 958, 977, 978 (beach and seashore)",
            AutoTagCategory::Mountain => "ImageNet classes 970-980 (mountains, volcanoes, valleys)",
            AutoTagCategory::Forest => "ImageNet class 975 (forested valleys)",
            AutoTagCategory::River => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Lake => "ImageNet class 972 (lakeside scenes)",
            AutoTagCategory::Sky => "ImageNet class 981 (sky backgrounds)",
            AutoTagCategory::Sunset => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Flower => "ImageNet classes 985-992 (flowers and plants)",
            AutoTagCategory::Tree => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Plant => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Garden => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Food => "ImageNet classes 924-969 (various food items)",
            AutoTagCategory::Building => {
                "ImageNet architecture classes (castle, church, mosque, etc.)"
            }
            AutoTagCategory::Street => "ImageNet classes 699-710, 722 (street scenes)",
            AutoTagCategory::Indoor => "ImageNet indoor object classes",
            AutoTagCategory::Outdoor => "ImageNet outdoor object classes",
            AutoTagCategory::Night => "ImageNet classes 457, 818, 846 (night indicators)",
            AutoTagCategory::Wedding => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Birthday => "Limited support in ImageNet - use OpenCLIP/SigLIP",
            AutoTagCategory::Travel => "ImageNet transport classes (vehicles, ships, etc.)",
        }
    }
}

impl std::str::FromStr for AutoTagCategory {
    type Err = ();

    /// Parse a category from its lowercase name (case-insensitive).
    /// Kept in sync with as_str() by iterating all(); adding a new
    /// category automatically makes it parseable.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let lower = s.to_lowercase();
        AutoTagCategory::all()
            .into_iter()
            .find(|category| category.as_str() == lower)
            .ok_or(())
    }
}

#[cfg(test)]
mod from_str_tests {
    use super::*;

    #[test]
    fn test_from_str_round_trips_every_category() {
        for category in AutoTagCategory::all() {
            assert_eq!(
                category.as_str().parse::<AutoTagCategory>(),
                Ok(category),
                "as_str/from_str must stay in sync for {:?}",
                category
            );
        }
    }

    #[test]
    fn test_from_str_is_case_insensitive() {
        assert_eq!(
            "Person".parse::<AutoTagCategory>(),
            Ok(AutoTagCategory::Person)
        );
        assert_eq!(
            "SUNSET".parse::<AutoTagCategory>(),
            Ok(AutoTagCategory::Sunset)
        );
    }

    #[test]
    fn test_from_str_rejects_unknown_strings() {
        assert!("not_a_category".parse::<AutoTagCategory>().is_err());
        assert!("".parse::<AutoTagCategory>().is_err());
    }
}
