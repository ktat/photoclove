//! Utility modules

pub mod cache;
pub mod exif_parser;
pub mod exif_thumbnail;
pub mod ffprobe;
pub mod heic_decode;
pub mod raw_decode;
pub mod raw_file;

// Re-export commonly used cache functions for backwards compatibility
pub use cache::{generate_cache_path, generate_persistent_cache_path, get_cache_dir};

/// Ensure the ONNX Runtime dynamic library is locatable before `ort` tries to
/// `dlopen` it.
///
/// Why: `ort`'s `load-dynamic` feature panics (not returns Err) when dlopen
/// fails. Called from a Tauri command on the main thread, that panic crosses
/// webkit2gtk's C ABI callback boundary and aborts the whole app. This helper
/// checks up front and surfaces a friendly Err instead.
pub fn ensure_ort_dylib_loaded() -> Result<(), String> {
    if let Ok(path) = std::env::var("ORT_DYLIB_PATH") {
        if std::path::Path::new(&path).exists() {
            return Ok(());
        }
        return Err(format!(
            "ORT_DYLIB_PATH points to a non-existent file: {}. \
             Open Preferences → AI Auto-Tagging to install ONNX Runtime.",
            path
        ));
    }

    let default_path = dirs::data_local_dir()
        .map(|d| d.join("photoclove").join("lib").join("libonnxruntime.so"))
        .ok_or_else(|| "Failed to resolve user data directory".to_string())?;

    if default_path.exists() {
        std::env::set_var("ORT_DYLIB_PATH", &default_path);
        Ok(())
    } else {
        Err("ONNX Runtime library is not installed. \
             Open Preferences → AI Auto-Tagging and click \"Download\" to install it."
            .to_string())
    }
}
