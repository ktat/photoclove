//! Statistics-related Tauri commands.
//!
//! Provides commands for retrieving photography insights and statistics.

use crate::app_state::AppState;
use crate::repository::meta_db::sqlite::stats;

/// Get photography insights statistics.
///
/// Returns aggregated statistics about the photo library including:
/// - Shooting time patterns
/// - Camera settings distribution
/// - Equipment usage
/// - Organization metrics
/// - Storage usage
#[tauri::command]
pub async fn get_photography_insights(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "stats", "get_photography_insights; status=starting");

    let sqlite = crate::repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());

    let insights = stats::get_all_insights(&sqlite, &state.config)?;

    log::info!(target: "stats", "get_photography_insights; status=complete");

    serde_json::to_string(&insights).map_err(|e| format!("Serialization error: {}", e))
}
