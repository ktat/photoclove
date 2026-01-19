//! BurstGroup entity for photo burst grouping.
//!
//! Represents a group of photos taken in rapid succession.
//! Groups can be created automatically during import or manually by user.

use crate::value::date;
use serde::{Deserialize, Serialize};

/// Represents a burst group of photos.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurstGroup {
    /// Unique identifier for the burst group
    pub id: String,
    /// Whether this group was created manually by the user
    pub is_manual: bool,
    /// Creation timestamp in ISO format
    pub created_at: String,
}

impl BurstGroup {
    /// Create a new manual burst group with a generated ID.
    pub fn new_manual(id: String) -> Self {
        Self {
            id,
            is_manual: true,
            created_at: date::DateTime::now().to_db_string(),
        }
    }

    /// Create a new auto burst group (from automatic detection).
    pub fn new_auto(id: String) -> Self {
        Self {
            id,
            is_manual: false,
            created_at: date::DateTime::now().to_db_string(),
        }
    }

    /// Create a burst group from database row data.
    #[allow(dead_code)]
    pub fn from_db(id: String, is_manual: bool, created_at: String) -> Self {
        Self {
            id,
            is_manual,
            created_at,
        }
    }
}
