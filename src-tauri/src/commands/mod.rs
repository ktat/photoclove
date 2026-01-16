//! Tauri command modules for PhotoClove
//!
//! This module contains all Tauri commands organized by functionality.
//! Each submodule handles a specific domain of commands.

// Re-export all command modules
pub mod album_commands;
pub mod collection_commands;
pub mod config_commands;
pub mod database_commands;
pub mod google_commands;
pub mod image_commands;
pub mod import_commands;
pub mod job_queue_commands;
pub mod logging_commands;
pub mod recovery_queue_commands;
pub mod photo_commands;
pub mod photo_handlers;
pub mod search_commands;
pub mod style_commands;
pub mod tag_commands;
pub mod trash_commands;
pub mod utility_commands;

// Re-export all commands for convenient access
pub use album_commands::*;
pub use collection_commands::*;
pub use config_commands::*;
pub use database_commands::*;
pub use google_commands::*;
pub use image_commands::*;
pub use import_commands::*;
pub use job_queue_commands::*;
pub use logging_commands::*;
pub use photo_commands::*;
pub use recovery_queue_commands::*;
pub use search_commands::*;
pub use style_commands::*;
pub use tag_commands::*;
pub use trash_commands::*;
pub use utility_commands::*;
