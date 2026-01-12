use crate::app_state::AppState;
use crate::entity::config::Config;
use tauri::State;

/// Get the current application configuration
///
/// This function retrieves the current configuration by creating a new Config instance
/// which reads from the configuration file.
///
/// # Arguments
/// * `state` - Application state (unused but required for Tauri command)
///
/// # Returns
/// A JSON string representation of the current configuration
#[tauri::command]
pub fn get_config(_state: State<AppState>) -> String {
    let new_config = Config::new();
    serde_json::to_string(&new_config).unwrap()
}

/// Save application configuration to disk
///
/// This function persists the provided configuration to the configuration file.
///
/// # Arguments
/// * `state` - Application state (unused but required for Tauri command)
/// * `config` - The configuration object to save
///
/// # Returns
/// A JSON string indicating success (`{result: true}`) or failure (`{result: false}`)
#[tauri::command]
pub fn save_config(_state: State<AppState>, config: Config) -> String {
    log::info!(target: "config", "save_config_called; logging_enabled={}; use_exif_thumbnail={}; thumbnail_orientation_correction={}; google_auth_auto_reauth={}",
        config.logging_enabled,
        config.use_exif_thumbnail,
        config.thumbnail_orientation_correction,
        config.google_auth_auto_reauth
    );
    if config.save() {
        log::info!(target: "config", "save_config_success; status=saved");
        return "{result: true}".to_string();
    } else {
        log::error!(target: "config", "save_config_failed; status=error");
        return "{result: false}".to_string();
    }
}
