//! Photography insights statistics module.
//!
//! Provides aggregated statistics about the photo library including:
//! - Shooting time patterns (hour of day, day of week)
//! - Camera settings distribution (ISO, aperture, shutter speed, focal length)
//! - Equipment usage (cameras, lenses)
//! - Organization metrics (total photos, tags, albums)
//! - Storage usage
//!
//! Supports time period filtering: all, weekly, monthly, yearly.

pub mod stats_types;
pub mod stats_queries;

pub use stats_types::*;
use stats_queries::*;

use crate::entity::config::Config;
use crate::repository::meta_db::sqlite::SQLite;

/// Get all photography insights for the specified period
pub fn get_all_insights(
    sqlite: &SQLite,
    config: &Config,
    period: &TimePeriod,
) -> Result<PhotographyInsights, String> {
    log::info!(target: "stats", "get_all_insights; status=starting; period={:?}", period);

    let shooting_time = get_shooting_time_stats(sqlite, period)?;
    let camera_settings = get_camera_settings_stats(sqlite, period)?;
    let equipment = get_equipment_stats(sqlite, period)?;
    let organization = get_organization_stats(sqlite, period)?;
    // Storage stats are not affected by time period (always shows current usage)
    let storage = get_storage_stats(config)?;

    log::info!(target: "stats", "get_all_insights; status=complete; period={:?}", period);

    Ok(PhotographyInsights {
        period: period.clone(),
        shooting_time,
        camera_settings,
        equipment,
        organization,
        storage,
    })
}

/// Get available time periods in the photo library
pub use stats_queries::get_available_periods;