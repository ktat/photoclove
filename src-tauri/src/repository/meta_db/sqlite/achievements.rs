//! Achievement progress repository
//!
//! Handles persistence of achievement progress and completion status.
//! Includes hash verification to detect tampering.

use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::SQLite;
use crate::value::date;

/// Secret salt for hash generation (obfuscated to make casual tampering harder)
const HASH_SALT: &str = "Ph0t0Cl0v3_Ach13v3m3nt_S4lt_2024";

/// Achievement progress record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementProgress {
    pub id: String,
    pub current_value: i64,
    pub achieved_at: Option<String>,
    pub updated_at: String,
}

/// Generate verification hash for an achievement
fn generate_hash(id: &str, achieved_at: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}:{}", id, achieved_at, HASH_SALT));
    let result = hasher.finalize();
    // Convert to hex string
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Verify achievement hash
fn verify_hash(id: &str, achieved_at: &str, stored_hash: Option<&str>) -> bool {
    match stored_hash {
        Some(hash) if !hash.is_empty() => {
            let expected = generate_hash(id, achieved_at);
            hash == expected
        }
        _ => false, // No hash = tampered or legacy, reject
    }
}

impl SQLite {
    /// Get all achievement progress records
    /// Records with invalid hashes will have achieved_at set to None
    pub fn get_all_achievements(&self) -> Result<Vec<AchievementProgress>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, current_value, achieved_at, updated_at, verification_hash FROM achievement_progress ORDER BY id"
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let current_value: i64 = row.get(1)?;
            let achieved_at: Option<String> = row.get(2)?;
            let updated_at: String = row.get(3)?;
            let verification_hash: Option<String> = row.get(4)?;

            // Verify hash if achieved
            let verified_achieved_at = if let Some(ref at) = achieved_at {
                if verify_hash(&id, at, verification_hash.as_deref()) {
                    achieved_at
                } else {
                    log::warn!(
                        target: "achievements",
                        "hash_verification_failed; id={}; possible_tampering",
                        id
                    );
                    None // Invalid hash - treat as not achieved
                }
            } else {
                None
            };

            Ok(AchievementProgress {
                id,
                current_value,
                achieved_at: verified_achieved_at,
                updated_at,
            })
        })?;

        let mut achievements = Vec::new();
        for row in rows {
            achievements.push(row?);
        }

        Ok(achievements)
    }

    /// Get a single achievement progress record
    /// Record with invalid hash will have achieved_at set to None
    pub fn get_achievement(&self, id: &str) -> Result<Option<AchievementProgress>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, current_value, achieved_at, updated_at, verification_hash FROM achievement_progress WHERE id = ?"
        )?;

        let result = stmt.query_row(params![id], |row| {
            let id: String = row.get(0)?;
            let current_value: i64 = row.get(1)?;
            let achieved_at: Option<String> = row.get(2)?;
            let updated_at: String = row.get(3)?;
            let verification_hash: Option<String> = row.get(4)?;

            // Verify hash if achieved
            let verified_achieved_at = if let Some(ref at) = achieved_at {
                if verify_hash(&id, at, verification_hash.as_deref()) {
                    achieved_at
                } else {
                    log::warn!(
                        target: "achievements",
                        "hash_verification_failed; id={}; possible_tampering",
                        id
                    );
                    None
                }
            } else {
                None
            };

            Ok(AchievementProgress {
                id,
                current_value,
                achieved_at: verified_achieved_at,
                updated_at,
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
    pub fn upsert_achievement(&self, id: &str, current_value: i64, threshold: i64) -> Result<bool> {
        let conn = self.get_connection()?;
        let now = date::DateTime::now().to_db_string();

        // Check if already achieved (with hash verification)
        let existing: Option<(i64, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT current_value, achieved_at, verification_hash FROM achievement_progress WHERE id = ?",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .ok();

        // Verify existing achievement
        let was_achieved = existing
            .as_ref()
            .map(|(_, achieved_at, hash)| {
                if let Some(at) = achieved_at {
                    verify_hash(id, at, hash.as_deref())
                } else {
                    false
                }
            })
            .unwrap_or(false);

        let should_achieve = current_value >= threshold;

        // Check if record already has achieved_at (even without a valid hash = legacy record)
        let has_existing_achieved_at = existing
            .as_ref()
            .map(|(_, at, _)| at.is_some())
            .unwrap_or(false);

        // Newly achieved only if threshold is met AND no prior achieved_at exists
        let newly_achieved = !was_achieved && should_achieve && !has_existing_achieved_at;

        let (achieved_at, verification_hash) = if should_achieve {
            if was_achieved {
                // Keep existing achieved_at and hash
                let (_, achieved, hash) = existing.as_ref().unwrap();
                (achieved.clone(), hash.clone())
            } else if has_existing_achieved_at {
                // Legacy record: has achieved_at but missing/invalid hash - fix hash using existing timestamp
                let existing_at = existing
                    .as_ref()
                    .unwrap()
                    .1
                    .as_deref()
                    .unwrap_or(&now)
                    .to_string();
                let hash = generate_hash(id, &existing_at);
                (Some(existing_at), Some(hash))
            } else {
                // Genuinely new achievement - generate hash from now
                let hash = generate_hash(id, &now);
                (Some(now.clone()), Some(hash))
            }
        } else {
            (None, None)
        };

        conn.execute(
            "INSERT INTO achievement_progress (id, current_value, achieved_at, updated_at, verification_hash)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                current_value = excluded.current_value,
                achieved_at = COALESCE(achievement_progress.achieved_at, excluded.achieved_at),
                updated_at = excluded.updated_at,
                verification_hash = COALESCE(achievement_progress.verification_hash, excluded.verification_hash)",
            params![id, current_value, achieved_at, now, verification_hash],
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

        // Check if already achieved (with hash verification)
        let existing: Option<(Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT achieved_at, verification_hash FROM achievement_progress WHERE id = ?",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        let already_achieved = existing
            .as_ref()
            .map(|(achieved_at, hash)| {
                if let Some(at) = achieved_at {
                    verify_hash(id, at, hash.as_deref())
                } else {
                    false
                }
            })
            .unwrap_or(false);

        // Check if record already has achieved_at (even without a valid hash = legacy record)
        let has_existing_achieved_at = existing
            .as_ref()
            .map(|(at, _)| at.is_some())
            .unwrap_or(false);

        if already_achieved || has_existing_achieved_at {
            if has_existing_achieved_at && !already_achieved {
                // Legacy record: fix hash silently using existing achieved_at
                let existing_at = existing
                    .as_ref()
                    .unwrap()
                    .0
                    .as_deref()
                    .unwrap_or(&now)
                    .to_string();
                let verification_hash = generate_hash(id, &existing_at);
                conn.execute(
                    "UPDATE achievement_progress SET verification_hash = ?, updated_at = ? WHERE id = ? AND (verification_hash IS NULL OR verification_hash = '')",
                    params![verification_hash, now, id],
                )?;
                log::info!(
                    target: "achievements",
                    "legacy_hash_fixed; id={}",
                    id
                );
            }
            return Ok(false);
        }

        // Generate hash for genuinely new achievement
        let verification_hash = generate_hash(id, &now);

        conn.execute(
            "INSERT INTO achievement_progress (id, current_value, achieved_at, updated_at, verification_hash)
             VALUES (?, 1, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                current_value = 1,
                achieved_at = COALESCE(achievement_progress.achieved_at, excluded.achieved_at),
                updated_at = excluded.updated_at,
                verification_hash = COALESCE(achievement_progress.verification_hash, excluded.verification_hash)",
            params![id, now, now, verification_hash],
        )?;

        log::info!(
            target: "achievements",
            "achieved; id={}",
            id
        );

        Ok(true)
    }
}
