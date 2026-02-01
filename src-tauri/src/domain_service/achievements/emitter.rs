//! Achievement event emitter
//!
//! Provides helper functions to check achievements and emit events to frontend.

use crate::repository::meta_db::sqlite::SQLite;
use super::service::{AchievementService, AchievementWithProgress};
use tauri::Emitter;

/// Check a first-action achievement and emit event if newly achieved.
///
/// This is designed to be called from backend commands after specific actions.
/// If the achievement is newly unlocked, it emits an "achievement_unlocked" event
/// to the frontend with the achievement details.
///
/// # Arguments
/// * `app_handle` - Tauri app handle for emitting events
/// * `db_path` - Path to the database (typically config.import_to)
/// * `achievement_id` - ID of the achievement to check (e.g., "first_tag", "first_star")
///
/// # Returns
/// * `Ok(Some(achievement))` - If newly achieved
/// * `Ok(None)` - If already achieved or not applicable
/// * `Err(...)` - If an error occurred
pub fn check_and_emit_achievement(
    app_handle: &tauri::AppHandle,
    db_path: &str,
    achievement_id: &str,
) -> Result<Option<AchievementWithProgress>, String> {
    let db = SQLite::new(db_path.to_string());
    let service = AchievementService::new(db);

    let result = service.check_first_action(achievement_id)?;

    if let Some(achievement) = result.newly_achieved.first() {
        log::info!(
            target: "achievements",
            "achievement_unlocked; id={}; name={}",
            achievement.id, achievement.name
        );

        // Emit event to frontend
        if let Err(e) = app_handle.emit("achievement_unlocked", achievement) {
            log::warn!(
                target: "achievements",
                "emit_achievement_event_failed; id={}; error={}",
                achievement_id, e
            );
        }

        return Ok(Some(achievement.clone()));
    }

    Ok(None)
}

/// Check achievements that require counting and emit events for newly achieved ones.
///
/// Used for achievements like tag_master, album_curator that track counts.
///
/// # Arguments
/// * `app_handle` - Tauri app handle for emitting events
/// * `db_path` - Path to the database
///
/// # Returns
/// Number of newly achieved achievements
pub fn check_and_emit_special_achievements(
    app_handle: &tauri::AppHandle,
    db_path: &str,
) -> Result<usize, String> {
    let db = SQLite::new(db_path.to_string());
    let service = AchievementService::new(db);

    let result = service.check_special_achievements()?;

    for achievement in &result.newly_achieved {
        log::info!(
            target: "achievements",
            "achievement_unlocked; id={}; name={}",
            achievement.id, achievement.name
        );

        if let Err(e) = app_handle.emit("achievement_unlocked", achievement) {
            log::warn!(
                target: "achievements",
                "emit_achievement_event_failed; id={}; error={}",
                achievement.id, e
            );
        }
    }

    Ok(result.newly_achieved.len())
}
