use crate::app_state::AppState;
use crate::entity::config::Config;
use serde::Serialize;
use std::path::Path;
use tauri::State;

/// Setup status for first-run detection
#[derive(Debug, Serialize)]
pub struct SetupStatus {
    pub config_exists: bool,
    pub db_exists: bool,
    pub needs_setup: bool,
}

/// Check if initial setup is needed
///
/// Returns the setup status indicating whether config and DB exist.
/// This is called on app startup to determine if Tutorial should be shown.
#[tauri::command]
pub fn check_setup_status() -> SetupStatus {
    let config_path = Config::config_path_if_exists();
    let config_exists = config_path.is_some();

    let db_exists = if config_path.is_some() {
        // Config exists, check if DB exists at import_to location
        let config = Config::new();
        let db_path = format!("{}/photoclove.db", config.import_to);
        Path::new(&db_path).exists()
    } else {
        false
    };

    SetupStatus {
        config_exists,
        db_exists,
        needs_setup: !config_exists || !db_exists,
    }
}

/// Check if DB exists at a given import_to path
///
/// Used when user selects a new import_to location in Preferences
/// to detect if an existing DB is there.
#[tauri::command]
pub fn check_db_exists(import_to: String) -> bool {
    let db_path = format!("{}/photoclove.db", import_to);
    Path::new(&db_path).exists()
}

/// Initialize the database at the specified import_to path
///
/// Called after user completes initial setup in Preferences.
/// Creates the DB if it doesn't exist, or connects to existing DB.
///
/// # Arguments
/// * `import_to` - The path where the database should be created/initialized
#[tauri::command]
pub fn initialize_database(_state: State<AppState>, import_to: String) -> Result<bool, String> {
    use crate::repository::meta_db::sqlite::SQLite;

    let db_path = format!("{}/photoclove.db", import_to);

    log::info!(target: "config", "initialize_database; import_to={}; db_exists={}", import_to, Path::new(&db_path).exists());

    let sqlite_db = SQLite::new(import_to);

    if let Err(e) = sqlite_db.init_db() {
        log::error!(target: "config", "initialize_database_failed; error={}", e);
        return Err(format!("Failed to initialize database: {}", e));
    }

    log::info!(target: "config", "initialize_database_success");
    Ok(true)
}

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
