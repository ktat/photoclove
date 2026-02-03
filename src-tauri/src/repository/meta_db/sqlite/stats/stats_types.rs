//! Type definitions for photography insights statistics.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

// Re-export TimePeriod from value::date for backward compatibility
pub use crate::value::date::TimePeriod;

/// Complete photography insights statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotographyInsights {
    pub period: TimePeriod,
    pub shooting_time: ShootingTimeStats,
    pub camera_settings: CameraSettingsStats,
    pub equipment: EquipmentStats,
    pub organization: OrganizationStats,
    pub storage: StorageStats,
}

/// Shooting time statistics by hour and day of week
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShootingTimeStats {
    pub by_hour: Vec<HourCount>,
    pub by_day_of_week: Vec<DayOfWeekCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourCount {
    pub hour: u32,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayOfWeekCount {
    pub day: u32,
    pub day_name: String,
    pub count: u32,
}

/// Camera settings distribution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSettingsStats {
    pub iso: Vec<SettingCount>,
    pub aperture: Vec<SettingCount>,
    pub shutter_speed: Vec<SettingCount>,
    pub focal_length: Vec<SettingCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingCount {
    pub value: String,
    pub display: String,
    pub count: u32,
}

/// Equipment usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquipmentStats {
    pub cameras: Vec<EquipmentCount>,
    pub lenses: Vec<EquipmentCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquipmentCount {
    pub name: String,
    pub count: u32,
    pub percentage: f32,
}

/// Organization metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationStats {
    pub total_photos: u32,
    pub total_photos_with_exif: u32,
    pub total_tags: u32,
    pub total_albums: u32,
    pub photos_with_tags: u32,
    pub photos_in_albums: u32,
}

/// Storage usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_size_bytes: u64,
    pub thumbnail_size_bytes: u64,
    pub face_thumbnail_size_bytes: u64,
}

/// Available time periods in the photo library
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailablePeriods {
    pub years: Vec<i32>,
    pub months: Vec<(i32, u32)>,
    pub weeks: Vec<NaiveDate>,
}