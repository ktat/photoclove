//! Achievement definitions
//!
//! Contains all achievement types, their thresholds, and metadata.

use serde::{Deserialize, Serialize};

/// Achievement category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AchievementCategory {
    First,     // First time actions
    Monthly,   // Monthly pioneer
    Count,     // Photo count milestones
    Date,      // Date completion
    Special,   // Special achievements
}

/// Achievement definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub icon: &'static str,
    pub category: AchievementCategory,
    pub threshold: i64,
}

/// All achievement definitions
pub const ACHIEVEMENTS: &[AchievementDefinition] = &[
    // === First Time Achievements ===
    AchievementDefinition {
        id: "first_import",
        name: "First Import",
        description: "Import your first photo",
        icon: "🌱",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_edit",
        name: "First Edit",
        description: "Edit your first photo",
        icon: "✨",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_tag",
        name: "First Tag",
        description: "Add your first tag",
        icon: "🏷️",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_album",
        name: "First Album",
        description: "Create your first album",
        icon: "📁",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_star",
        name: "First Star",
        description: "Star your first photo",
        icon: "⭐",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_search",
        name: "First Search",
        description: "Use search for the first time",
        icon: "🔍",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_export",
        name: "First Export",
        description: "Export your first photo",
        icon: "📤",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_google_upload",
        name: "First Google Upload",
        description: "Upload to Google Photos for the first time",
        icon: "☁️",
        category: AchievementCategory::First,
        threshold: 1,
    },
    AchievementDefinition {
        id: "first_delete",
        name: "First Delete",
        description: "Delete your first photo",
        icon: "🗑️",
        category: AchievementCategory::First,
        threshold: 1,
    },

    // === Monthly Pioneer Achievements ===
    AchievementDefinition {
        id: "monthly_jan",
        name: "January Pioneer",
        description: "Import a photo taken in January",
        icon: "❄️",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_feb",
        name: "February Pioneer",
        description: "Import a photo taken in February",
        icon: "💝",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_mar",
        name: "March Pioneer",
        description: "Import a photo taken in March",
        icon: "🌸",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_apr",
        name: "April Pioneer",
        description: "Import a photo taken in April",
        icon: "🌷",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_may",
        name: "May Pioneer",
        description: "Import a photo taken in May",
        icon: "🌿",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_jun",
        name: "June Pioneer",
        description: "Import a photo taken in June",
        icon: "☔",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_jul",
        name: "July Pioneer",
        description: "Import a photo taken in July",
        icon: "🌻",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_aug",
        name: "August Pioneer",
        description: "Import a photo taken in August",
        icon: "🏖️",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_sep",
        name: "September Pioneer",
        description: "Import a photo taken in September",
        icon: "🍂",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_oct",
        name: "October Pioneer",
        description: "Import a photo taken in October",
        icon: "🎃",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_nov",
        name: "November Pioneer",
        description: "Import a photo taken in November",
        icon: "🍁",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_dec",
        name: "December Pioneer",
        description: "Import a photo taken in December",
        icon: "🎄",
        category: AchievementCategory::Monthly,
        threshold: 1,
    },
    AchievementDefinition {
        id: "monthly_all",
        name: "All Months Complete",
        description: "Have photos from all 12 months",
        icon: "📅",
        category: AchievementCategory::Monthly,
        threshold: 12,
    },

    // === Photo Count Milestones ===
    AchievementDefinition {
        id: "photos_100",
        name: "100 Photos",
        description: "Import 100 photos",
        icon: "📷",
        category: AchievementCategory::Count,
        threshold: 100,
    },
    AchievementDefinition {
        id: "photos_500",
        name: "500 Photos",
        description: "Import 500 photos",
        icon: "📷",
        category: AchievementCategory::Count,
        threshold: 500,
    },
    AchievementDefinition {
        id: "photos_1000",
        name: "1,000 Photos",
        description: "Import 1,000 photos",
        icon: "🥉",
        category: AchievementCategory::Count,
        threshold: 1000,
    },
    AchievementDefinition {
        id: "photos_5000",
        name: "5,000 Photos",
        description: "Import 5,000 photos",
        icon: "🥈",
        category: AchievementCategory::Count,
        threshold: 5000,
    },
    AchievementDefinition {
        id: "photos_10000",
        name: "10,000 Photos",
        description: "Import 10,000 photos",
        icon: "🥇",
        category: AchievementCategory::Count,
        threshold: 10000,
    },
    AchievementDefinition {
        id: "photos_50000",
        name: "50,000 Photos",
        description: "Import 50,000 photos",
        icon: "💎",
        category: AchievementCategory::Count,
        threshold: 50000,
    },
    AchievementDefinition {
        id: "photos_100000",
        name: "100,000 Photos",
        description: "Import 100,000 photos",
        icon: "👑",
        category: AchievementCategory::Count,
        threshold: 100000,
    },

    // === Date Completion ===
    AchievementDefinition {
        id: "days_7",
        name: "Week Complete",
        description: "Have photos from 7 consecutive days",
        icon: "📆",
        category: AchievementCategory::Date,
        threshold: 7,
    },
    AchievementDefinition {
        id: "days_100",
        name: "100 Dates",
        description: "Have photos from 100 unique dates (including year)",
        icon: "💯",
        category: AchievementCategory::Date,
        threshold: 100,
    },
    AchievementDefinition {
        id: "days_365",
        name: "365 Dates",
        description: "Have photos from 365 unique dates (including year)",
        icon: "🎊",
        category: AchievementCategory::Date,
        threshold: 365,
    },
    AchievementDefinition {
        id: "leap_year",
        name: "Leap Year",
        description: "Have a photo from February 29th",
        icon: "🦘",
        category: AchievementCategory::Date,
        threshold: 1,
    },
    AchievementDefinition {
        id: "all_dates_complete",
        name: "Calendar Complete",
        description: "Have photos from all 366 calendar days (1/1-12/31 + 2/29, any year)",
        icon: "🗓️",
        category: AchievementCategory::Date,
        threshold: 366,
    },

    // === Special Achievements ===
    AchievementDefinition {
        id: "time_traveler",
        name: "Time Traveler",
        description: "Import a photo from 10+ years ago",
        icon: "⏰",
        category: AchievementCategory::Special,
        threshold: 1,
    },
    AchievementDefinition {
        id: "globe_trotter",
        name: "Globe Trotter",
        description: "Have photos from 5+ countries",
        icon: "🌍",
        category: AchievementCategory::Special,
        threshold: 5,
    },
    AchievementDefinition {
        id: "night_owl",
        name: "Night Owl",
        description: "Have 100+ photos taken between 0-4 AM",
        icon: "🦉",
        category: AchievementCategory::Special,
        threshold: 100,
    },
    AchievementDefinition {
        id: "early_bird",
        name: "Early Bird",
        description: "Have 100+ photos taken between 5-7 AM",
        icon: "🐦",
        category: AchievementCategory::Special,
        threshold: 100,
    },
    AchievementDefinition {
        id: "gear_collector",
        name: "Gear Collector",
        description: "Use 5+ different cameras",
        icon: "📸",
        category: AchievementCategory::Special,
        threshold: 5,
    },
    AchievementDefinition {
        id: "tag_master",
        name: "Tag Master",
        description: "Create 50+ different tags",
        icon: "🏷️",
        category: AchievementCategory::Special,
        threshold: 50,
    },
    AchievementDefinition {
        id: "album_curator",
        name: "Album Curator",
        description: "Create 20+ albums",
        icon: "📚",
        category: AchievementCategory::Special,
        threshold: 20,
    },
];

/// Get an achievement definition by ID
pub fn get_achievement_def(id: &str) -> Option<&'static AchievementDefinition> {
    ACHIEVEMENTS.iter().find(|a| a.id == id)
}

/// Get the month ID for a given month number (1-12)
pub fn month_to_achievement_id(month: u32) -> Option<&'static str> {
    match month {
        1 => Some("monthly_jan"),
        2 => Some("monthly_feb"),
        3 => Some("monthly_mar"),
        4 => Some("monthly_apr"),
        5 => Some("monthly_may"),
        6 => Some("monthly_jun"),
        7 => Some("monthly_jul"),
        8 => Some("monthly_aug"),
        9 => Some("monthly_sep"),
        10 => Some("monthly_oct"),
        11 => Some("monthly_nov"),
        12 => Some("monthly_dec"),
        _ => None,
    }
}

/// Photo count achievement IDs in order
pub const PHOTO_COUNT_ACHIEVEMENTS: &[&str] = &[
    "photos_100",
    "photos_500",
    "photos_1000",
    "photos_5000",
    "photos_10000",
    "photos_50000",
    "photos_100000",
];

/// Days achievement IDs
pub const DAYS_ACHIEVEMENTS: &[&str] = &[
    "days_7",
    "days_100",
    "days_365",
];
