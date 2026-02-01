//! Achievement-related Tauri commands.
//!
//! Provides commands for retrieving and checking achievements.

use crate::app_state::AppState;
use crate::domain_service::achievements::{
    AchievementCategory, AchievementCheckResult, AchievementService, AchievementWithProgress,
    ACHIEVEMENTS,
};
use crate::repository::meta_db::sqlite::SQLite;
use serde::{Deserialize, Serialize};

/// Summary of achievements for display
#[derive(Debug, Serialize)]
pub struct AchievementsSummary {
    pub total: usize,
    pub achieved: usize,
    pub categories: Vec<CategorySummary>,
}

/// Summary of a single category
#[derive(Debug, Serialize)]
pub struct CategorySummary {
    pub category: AchievementCategory,
    pub name: String,
    pub total: usize,
    pub achieved: usize,
    pub achievements: Vec<AchievementWithProgress>,
}

/// Get all achievements with their current status and progress.
#[tauri::command]
pub async fn get_achievements(
    state: tauri::State<'_, AppState>,
) -> Result<AchievementsSummary, String> {
    log::info!(target: "achievements", "get_achievements; status=fetching");

    let db = SQLite::new(state.config.import_to.clone());
    let service = AchievementService::new(db);

    let achievements = service.get_all_achievements()?;

    // Group by category
    let mut categories: Vec<CategorySummary> = Vec::new();

    for category in &[
        (AchievementCategory::First, "Getting Started"),
        (AchievementCategory::Monthly, "Monthly Pioneer"),
        (AchievementCategory::Count, "Photo Milestones"),
        (AchievementCategory::Date, "Date Completion"),
        (AchievementCategory::Special, "Special"),
    ] {
        let category_achievements: Vec<AchievementWithProgress> = achievements
            .iter()
            .filter(|a| a.category == category.0)
            .cloned()
            .collect();

        let achieved_count = category_achievements
            .iter()
            .filter(|a| a.achieved_at.is_some())
            .count();

        categories.push(CategorySummary {
            category: category.0,
            name: category.1.to_string(),
            total: category_achievements.len(),
            achieved: achieved_count,
            achievements: category_achievements,
        });
    }

    let total = achievements.len();
    let achieved = achievements.iter().filter(|a| a.achieved_at.is_some()).count();

    log::info!(
        target: "achievements",
        "get_achievements; total={}; achieved={}",
        total, achieved
    );

    Ok(AchievementsSummary {
        total,
        achieved,
        categories,
    })
}

/// Check and update all achievements based on current data.
/// Returns newly achieved achievements.
#[tauri::command]
pub async fn check_all_achievements(
    state: tauri::State<'_, AppState>,
) -> Result<AchievementCheckResult, String> {
    log::info!(target: "achievements", "check_all_achievements; status=checking");

    let db = SQLite::new(state.config.import_to.clone());
    let service = AchievementService::new(db);

    let result = service.check_all_achievements()?;

    if !result.newly_achieved.is_empty() {
        log::info!(
            target: "achievements",
            "check_all_achievements; newly_achieved={}",
            result.newly_achieved.len()
        );
        for achievement in &result.newly_achieved {
            log::info!(
                target: "achievements",
                "new_achievement; id={}; name={}",
                achievement.id, achievement.name
            );
        }
    }

    Ok(result)
}

/// Check a specific first-time action achievement.
/// Call this when user performs an action for the first time.
#[tauri::command]
pub async fn check_first_action_achievement(
    state: tauri::State<'_, AppState>,
    achievement_id: String,
) -> Result<AchievementCheckResult, String> {
    log::info!(
        target: "achievements",
        "check_first_action; id={}",
        achievement_id
    );

    let db = SQLite::new(state.config.import_to.clone());
    let service = AchievementService::new(db);

    service.check_first_action(&achievement_id)
}

/// Check photo count achievements after import.
#[tauri::command]
pub async fn check_photo_count_achievements(
    state: tauri::State<'_, AppState>,
) -> Result<AchievementCheckResult, String> {
    log::info!(target: "achievements", "check_photo_count; status=checking");

    let db = SQLite::new(state.config.import_to.clone());
    let service = AchievementService::new(db);

    service.check_photo_count()
}

/// Check monthly achievements after import.
#[tauri::command]
pub async fn check_monthly_achievements(
    state: tauri::State<'_, AppState>,
) -> Result<AchievementCheckResult, String> {
    log::info!(target: "achievements", "check_monthly; status=checking");

    let db = SQLite::new(state.config.import_to.clone());
    let service = AchievementService::new(db);

    service.check_monthly_achievements()
}
