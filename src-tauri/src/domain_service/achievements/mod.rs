//! Achievements module
//!
//! Provides achievement tracking and gamification features.

pub mod definitions;
pub mod emitter;
pub mod service;

pub use definitions::{AchievementCategory, AchievementDefinition, ACHIEVEMENTS};
pub use emitter::check_and_emit_achievement;
pub use service::{AchievementCheckResult, AchievementService, AchievementWithProgress};
