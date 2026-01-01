use std::sync::atomic::{AtomicBool, Ordering};

/// Static variable to track locking state for preventing duplicate event handling
static IN_LOCKING: AtomicBool = AtomicBool::new(false);

/// Simple greeting command for testing Tauri command functionality
///
/// # Arguments
/// * `name` - The name to greet
///
/// # Returns
/// A greeting string
///
/// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Lock/unlock mechanism to prevent duplicate event handling
///
/// This function provides a simple lock mechanism to avoid events happening
/// twice at the same time. It uses atomic operations for thread-safe locking.
///
/// # Arguments
/// * `t` - true to acquire lock, false to release lock
///
/// # Returns
/// * `true` if operation succeeded (lock acquired or released)
/// * `false` if lock is already held (when trying to acquire)
#[tauri::command]
pub fn lock(t: bool) -> bool {
    if !t {
        IN_LOCKING.store(false, Ordering::SeqCst);
        return true;
    } else {
        if IN_LOCKING.load(Ordering::SeqCst) {
            return false;
        } else {
            IN_LOCKING.store(true, Ordering::SeqCst);
            return true;
        }
    }
}

/// Get the configured download directory path
///
/// # Arguments
/// * `state` - Application state containing the config
///
/// # Returns
/// The download directory path from the application configuration
#[tauri::command]
pub fn get_download_dir(state: tauri::State<crate::AppState>) -> Result<String, String> {
    Ok(state.config.download_dir.clone())
}

/// Open a file in the system's default application
///
/// This function opens a file using the OS-specific default application:
/// - Windows: Uses `cmd /C start`
/// - macOS: Uses `open`
/// - Linux/Unix: Uses `xdg-open`
///
/// # Arguments
/// * `file_path` - Path to the file to open
///
/// # Returns
/// * `Ok(())` if the file was successfully opened
/// * `Err(String)` if the operation failed
#[tauri::command]
pub async fn open_file_in_default_app(file_path: &str) -> Result<(), String> {
    use std::process::Command;

    let result = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", file_path])
            .status()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(file_path).status()
    } else {
        Command::new("xdg-open").arg(file_path).status()
    };

    match result {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err("Failed to open file".to_string()),
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}
