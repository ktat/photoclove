//! Achievement checking service
//!
//! Provides logic to check and award achievements based on user actions and data.

use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::meta_db::sqlite::achievements::AchievementProgress;
use super::definitions::{
    self, AchievementCategory, AchievementDefinition, ACHIEVEMENTS,
    PHOTO_COUNT_ACHIEVEMENTS, DAYS_ACHIEVEMENTS, STAR_COUNT_ACHIEVEMENTS,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// Result of checking achievements - contains newly achieved ones
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementCheckResult {
    pub newly_achieved: Vec<AchievementWithProgress>,
}

/// Achievement with its current progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementWithProgress {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: AchievementCategory,
    pub threshold: i64,
    pub current_value: i64,
    pub achieved_at: Option<String>,
}

impl AchievementWithProgress {
    pub fn from_def_and_progress(def: &AchievementDefinition, progress: Option<&AchievementProgress>) -> Self {
        Self {
            id: def.id.to_string(),
            name: def.name.to_string(),
            description: def.description.to_string(),
            icon: def.icon.to_string(),
            category: def.category,
            threshold: def.threshold,
            current_value: progress.map(|p| p.current_value).unwrap_or(0),
            achieved_at: progress.and_then(|p| p.achieved_at.clone()),
        }
    }
}

/// Achievement service for checking and awarding achievements
pub struct AchievementService {
    db: SQLite,
}

impl AchievementService {
    pub fn new(db: SQLite) -> Self {
        Self { db }
    }

    /// Get all achievements with their current progress
    pub fn get_all_achievements(&self) -> Result<Vec<AchievementWithProgress>, String> {
        let progress_list = self.db.get_all_achievements()
            .map_err(|e| format!("Failed to get achievements: {}", e))?;

        let mut result = Vec::new();
        for def in ACHIEVEMENTS {
            let progress = progress_list.iter().find(|p| p.id == def.id);
            result.push(AchievementWithProgress::from_def_and_progress(def, progress));
        }

        Ok(result)
    }

    /// Check and record a first-time action achievement
    pub fn check_first_action(&self, achievement_id: &str) -> Result<AchievementCheckResult, String> {
        let newly_achieved = self.db.mark_achievement_achieved(achievement_id)
            .map_err(|e| format!("Failed to mark achievement: {}", e))?;

        if newly_achieved {
            if let Some(def) = definitions::get_achievement_def(achievement_id) {
                let progress = self.db.get_achievement(achievement_id)
                    .map_err(|e| format!("Failed to get achievement: {}", e))?;

                return Ok(AchievementCheckResult {
                    newly_achieved: vec![AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    )],
                });
            }
        }

        Ok(AchievementCheckResult { newly_achieved: vec![] })
    }

    /// Check photo count achievements
    pub fn check_photo_count(&self) -> Result<AchievementCheckResult, String> {
        let conn = self.db.get_connection()
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_metadata WHERE delete_flg = 0 OR delete_flg IS NULL",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to count photos: {}", e))?;

        let mut newly_achieved = Vec::new();

        for achievement_id in PHOTO_COUNT_ACHIEVEMENTS {
            if let Some(def) = definitions::get_achievement_def(achievement_id) {
                let was_newly_achieved = self.db.upsert_achievement(
                    achievement_id,
                    count,
                    def.threshold,
                ).map_err(|e| format!("Failed to upsert achievement: {}", e))?;

                if was_newly_achieved {
                    let progress = self.db.get_achievement(achievement_id)
                        .map_err(|e| format!("Failed to get achievement: {}", e))?;
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    ));
                }
            }
        }

        // Also check first_import if count > 0
        if count > 0 {
            let first_import_result = self.check_first_action("first_import")?;
            newly_achieved.extend(first_import_result.newly_achieved);
        }

        Ok(AchievementCheckResult { newly_achieved })
    }

    /// Check star count achievements
    pub fn check_star_count(&self) -> Result<AchievementCheckResult, String> {
        let conn = self.db.get_connection()
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_metadata WHERE (delete_flg = 0 OR delete_flg IS NULL) AND star > 0",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to count starred photos: {}", e))?;

        let mut newly_achieved = Vec::new();

        for achievement_id in STAR_COUNT_ACHIEVEMENTS {
            if let Some(def) = definitions::get_achievement_def(achievement_id) {
                let was_newly_achieved = self.db.upsert_achievement(
                    achievement_id,
                    count,
                    def.threshold,
                ).map_err(|e| format!("Failed to upsert achievement: {}", e))?;

                if was_newly_achieved {
                    let progress = self.db.get_achievement(achievement_id)
                        .map_err(|e| format!("Failed to get achievement: {}", e))?;
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    ));
                }
            }
        }

        // Also check first_star if count > 0
        if count > 0 {
            let first_star_result = self.check_first_action("first_star")?;
            newly_achieved.extend(first_star_result.newly_achieved);
        }

        Ok(AchievementCheckResult { newly_achieved })
    }

    /// Check monthly pioneer achievements based on photo dates
    pub fn check_monthly_achievements(&self) -> Result<AchievementCheckResult, String> {
        let conn = self.db.get_connection()
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        // Get distinct months from photos
        let mut stmt = conn.prepare(
            "SELECT DISTINCT CAST(strftime('%m', photo_date) AS INTEGER) as month
             FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL) AND photo_date IS NOT NULL"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let months: Vec<u32> = stmt.query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query months: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        let mut newly_achieved = Vec::new();

        // Check each month achievement
        for month in &months {
            if let Some(achievement_id) = definitions::month_to_achievement_id(*month) {
                let was_newly_achieved = self.db.mark_achievement_achieved(achievement_id)
                    .map_err(|e| format!("Failed to mark achievement: {}", e))?;

                if was_newly_achieved {
                    if let Some(def) = definitions::get_achievement_def(achievement_id) {
                        let progress = self.db.get_achievement(achievement_id)
                            .map_err(|e| format!("Failed to get achievement: {}", e))?;
                        newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                            def,
                            progress.as_ref(),
                        ));
                    }
                }
            }
        }

        // Check "all months complete" achievement
        if months.len() >= 12 {
            let was_newly_achieved = self.db.upsert_achievement("monthly_all", 12, 12)
                .map_err(|e| format!("Failed to upsert achievement: {}", e))?;

            if was_newly_achieved {
                if let Some(def) = definitions::get_achievement_def("monthly_all") {
                    let progress = self.db.get_achievement("monthly_all")
                        .map_err(|e| format!("Failed to get achievement: {}", e))?;
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    ));
                }
            }
        } else {
            // Update progress even if not complete
            let _ = self.db.upsert_achievement("monthly_all", months.len() as i64, 12);
        }

        Ok(AchievementCheckResult { newly_achieved })
    }

    /// Check days-based achievements
    pub fn check_days_achievements(&self) -> Result<AchievementCheckResult, String> {
        let conn = self.db.get_connection()
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        // Count distinct days
        let unique_days: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT date(photo_date)) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL) AND photo_date IS NOT NULL",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to count days: {}", e))?;

        let mut newly_achieved = Vec::new();

        for achievement_id in DAYS_ACHIEVEMENTS {
            if let Some(def) = definitions::get_achievement_def(achievement_id) {
                let was_newly_achieved = self.db.upsert_achievement(
                    achievement_id,
                    unique_days,
                    def.threshold,
                ).map_err(|e| format!("Failed to upsert achievement: {}", e))?;

                if was_newly_achieved {
                    let progress = self.db.get_achievement(achievement_id)
                        .map_err(|e| format!("Failed to get achievement: {}", e))?;
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    ));
                }
            }
        }

        // Check leap year (Feb 29)
        let has_leap_day: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND strftime('%m-%d', photo_date) = '02-29')",
            [],
            |row| row.get(0),
        ).unwrap_or(false);

        if has_leap_day {
            let was_newly_achieved = self.db.mark_achievement_achieved("leap_year")
                .map_err(|e| format!("Failed to mark achievement: {}", e))?;

            if was_newly_achieved {
                if let Some(def) = definitions::get_achievement_def("leap_year") {
                    let progress = self.db.get_achievement("leap_year")
                        .map_err(|e| format!("Failed to get achievement: {}", e))?;
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                        def,
                        progress.as_ref(),
                    ));
                }
            }
        }

        // Check all dates complete (366 unique month-day combinations including Feb 29)
        let unique_month_days: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT strftime('%m-%d', photo_date)) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL) AND photo_date IS NOT NULL",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("all_dates_complete") {
            let was_newly_achieved = self.db.upsert_achievement(
                "all_dates_complete",
                unique_month_days,
                def.threshold,
            ).map_err(|e| format!("Failed to upsert achievement: {}", e))?;

            if was_newly_achieved {
                let progress = self.db.get_achievement("all_dates_complete")
                    .map_err(|e| format!("Failed to get achievement: {}", e))?;
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(
                    def,
                    progress.as_ref(),
                ));
            }
        }

        Ok(AchievementCheckResult { newly_achieved })
    }

    /// Check special achievements (time traveler, gear collector, etc.)
    pub fn check_special_achievements(&self) -> Result<AchievementCheckResult, String> {
        let conn = self.db.get_connection()
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        let mut newly_achieved = Vec::new();

        // Time Traveler - photo from 10+ years ago
        let ten_years_ago = chrono::Utc::now() - chrono::Duration::days(365 * 10);
        let has_old_photo: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND photo_date < ?)",
            params![ten_years_ago.format("%Y-%m-%d").to_string()],
            |row| row.get(0),
        ).unwrap_or(false);

        if has_old_photo {
            if let Ok(true) = self.db.mark_achievement_achieved("time_traveler") {
                if let Some(def) = definitions::get_achievement_def("time_traveler") {
                    let progress = self.db.get_achievement("time_traveler").ok().flatten();
                    newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
                }
            }
        }

        // Night Owl - photos between 0-4 AM
        let night_photos: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND CAST(strftime('%H', photo_date) AS INTEGER) BETWEEN 0 AND 3",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("night_owl") {
            if let Ok(true) = self.db.upsert_achievement("night_owl", night_photos, def.threshold) {
                let progress = self.db.get_achievement("night_owl").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        // Early Bird - photos between 5-7 AM
        let early_photos: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND CAST(strftime('%H', photo_date) AS INTEGER) BETWEEN 5 AND 7",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("early_bird") {
            if let Ok(true) = self.db.upsert_achievement("early_bird", early_photos, def.threshold) {
                let progress = self.db.get_achievement("early_bird").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        // Golden Hour - photos between 6-8 AM or 5-7 PM (17-19)
        let golden_hour_photos: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND (CAST(strftime('%H', photo_date) AS INTEGER) BETWEEN 6 AND 7
                  OR CAST(strftime('%H', photo_date) AS INTEGER) BETWEEN 17 AND 18)",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("golden_hour") {
            if let Ok(true) = self.db.upsert_achievement("golden_hour", golden_hour_photos, def.threshold) {
                let progress = self.db.get_achievement("golden_hour").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        // Gear Collector - different cameras
        let camera_count: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT exif_model) FROM photo_metadata
             WHERE (delete_flg = 0 OR delete_flg IS NULL)
             AND exif_model IS NOT NULL AND exif_model != ''",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("gear_collector") {
            if let Ok(true) = self.db.upsert_achievement("gear_collector", camera_count, def.threshold) {
                let progress = self.db.get_achievement("gear_collector").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        // Tag Master - different tags
        let tag_count: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT name) FROM photo_collection_items pci
             JOIN photo_collections pc ON pci.collection_id = pc.id
             WHERE pc.type = 'tag'",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("tag_master") {
            if let Ok(true) = self.db.upsert_achievement("tag_master", tag_count, def.threshold) {
                let progress = self.db.get_achievement("tag_master").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        // Album Curator - different albums
        let album_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photo_collections WHERE type = 'album'",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if let Some(def) = definitions::get_achievement_def("album_curator") {
            if let Ok(true) = self.db.upsert_achievement("album_curator", album_count, def.threshold) {
                let progress = self.db.get_achievement("album_curator").ok().flatten();
                newly_achieved.push(AchievementWithProgress::from_def_and_progress(def, progress.as_ref()));
            }
        }

        Ok(AchievementCheckResult { newly_achieved })
    }

    /// Run all achievement checks (typically after import)
    pub fn check_all_achievements(&self) -> Result<AchievementCheckResult, String> {
        let mut all_newly_achieved = Vec::new();

        let photo_result = self.check_photo_count()?;
        all_newly_achieved.extend(photo_result.newly_achieved);

        let star_result = self.check_star_count()?;
        all_newly_achieved.extend(star_result.newly_achieved);

        let monthly_result = self.check_monthly_achievements()?;
        all_newly_achieved.extend(monthly_result.newly_achieved);

        let days_result = self.check_days_achievements()?;
        all_newly_achieved.extend(days_result.newly_achieved);

        let special_result = self.check_special_achievements()?;
        all_newly_achieved.extend(special_result.newly_achieved);

        Ok(AchievementCheckResult { newly_achieved: all_newly_achieved })
    }
}
