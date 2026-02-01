//! Achievement progress repository
//!
//! Handles persistence of achievement progress and completion status.

use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};

use super::SQLite;
use crate::value::date;

/// Achievement progress record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementProgress {
    pub id: String,
    pub current_value: i64,
    pub achieved_at: Option<String>,
    pub updated_at: String,
}

impl SQLite {
    /// Get all achievement progress records
    pub fn get_all_achievements(&self) -> Result<Vec<AchievementProgress>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, current_value, achieved_at, updated_at FROM achievement_progress ORDER BY id"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AchievementProgress {
                id: row.get(0)?,
                current_value: row.get(1)?,
                achieved_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut achievements = Vec::new();
        for row in rows {
            achievements.push(row?);
        }

        Ok(achievements)
    }

    /// Get a single achievement progress record
    pub fn get_achievement(&self, id: &str) -> Result<Option<AchievementProgress>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, current_value, achieved_at, updated_at FROM achievement_progress WHERE id = ?"
        )?;

        let result = stmt.query_row(params![id], |row| {
            Ok(AchievementProgress {
                id: row.get(0)?,
                current_value: row.get(1)?,
                achieved_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        });

        match result {
            Ok(achievement) => Ok(Some(achievement)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Update or insert achievement progress
    /// Returns true if the achievement was newly achieved (was not achieved before, now is)
    pub fn upsert_achievement(
        &self,
        id: &str,
        current_value: i64,
        threshold: i64,
    ) -> Result<bool> {
        let conn = self.get_connection()?;
        let now = date::DateTime::now().to_db_string();

        // Check if already achieved
        let existing: Option<(i64, Option<String>)> = conn
            .query_row(
                "SELECT current_value, achieved_at FROM achievement_progress WHERE id = ?",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        let was_achieved = existing
            .as_ref()
            .map(|(_, achieved)| achieved.is_some())
            .unwrap_or(false);

        let should_achieve = current_value >= threshold;
        let newly_achieved = !was_achieved && should_achieve;

        let achieved_at = if should_achieve {
            if was_achieved {
                // Keep existing achieved_at
                existing.as_ref().and_then(|(_, a)| a.clone())
            } else {
                // New achievement
                Some(now.clone())
            }
        } else {
            None
        };

        conn.execute(
            "INSERT INTO achievement_progress (id, current_value, achieved_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                current_value = excluded.current_value,
                achieved_at = COALESCE(achievement_progress.achieved_at, excluded.achieved_at),
                updated_at = excluded.updated_at",
            params![id, current_value, achieved_at, now],
        )?;

        log::debug!(
            target: "achievements",
            "upsert; id={}; value={}; threshold={}; newly_achieved={}",
            id, current_value, threshold, newly_achieved
        );

        Ok(newly_achieved)
    }

    /// Mark an achievement as achieved (for action-based achievements)
    /// Returns true if newly achieved
    pub fn mark_achievement_achieved(&self, id: &str) -> Result<bool> {
        let conn = self.get_connection()?;
        let now = date::DateTime::now().to_db_string();

        // Check if already achieved
        let already_achieved: bool = conn
            .query_row(
                "SELECT achieved_at IS NOT NULL FROM achievement_progress WHERE id = ?",
                params![id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if already_achieved {
            return Ok(false);
        }

        conn.execute(
            "INSERT INTO achievement_progress (id, current_value, achieved_at, updated_at)
             VALUES (?, 1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                current_value = 1,
                achieved_at = COALESCE(achievement_progress.achieved_at, excluded.achieved_at),
                updated_at = excluded.updated_at",
            params![id, now, now],
        )?;

        log::info!(
            target: "achievements",
            "achieved; id={}",
            id
        );

        Ok(true)
    }
}
