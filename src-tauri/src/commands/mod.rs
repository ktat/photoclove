//! Tauri command modules for PhotoClove
//!
//! This module contains all Tauri commands organized by functionality.
//! Each submodule handles a specific domain of commands.

// Re-export all command modules
pub mod achievement_commands;
pub mod ai_model_commands;

// Internal helpers (not re-exported)
pub mod album_commands;
pub mod burst_group_commands;
pub mod collection_commands;
pub mod config_commands;
pub mod database_commands;
pub mod face_batch_commands;
pub mod face_detection_commands;
pub mod google_commands;
pub mod image_commands;
pub mod import_commands;
pub(crate) mod job_helpers;
pub mod job_queue_commands;
pub mod logging_commands;
pub mod photo_commands;
pub mod photo_handlers;
pub mod recovery_queue_commands;
pub mod s3_commands;
pub mod search_commands;
pub mod stats_commands;
pub mod style_commands;
pub mod tag_commands;
pub mod trash_commands;
pub mod utility_commands;
pub mod video_commands;

// Re-export all commands for convenient access
pub use ai_model_commands::*;
pub use album_commands::*;
pub use burst_group_commands::*;
pub use collection_commands::*;
pub use config_commands::*;
pub use database_commands::*;
pub use face_batch_commands::*;
pub use face_detection_commands::*;
pub use google_commands::*;
pub use image_commands::*;
pub use import_commands::*;
pub use job_queue_commands::*;
pub use logging_commands::*;
pub use photo_commands::*;
pub use recovery_queue_commands::*;
pub use s3_commands::*;
pub use search_commands::*;
pub use style_commands::*;
pub use tag_commands::*;
pub use trash_commands::*;
pub use utility_commands::*;
pub use video_commands::*;

/// Run blocking work (DB queries, filesystem access, network, inference) on
/// the blocking thread pool from an async command.
///
/// Synchronous Tauri commands execute on the GTK main thread, where an
/// NFS-slow query or a SQLite busy_timeout retry loop freezes the whole
/// window (observed: ~4.6s nanosleep on the main thread during the first
/// date load). Every command touching the DB or filesystem must be
/// `async fn` and route its work through this helper.
pub(crate) async fn run_blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("Blocking task failed: {}", e))?
}
