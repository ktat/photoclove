//! ONNX Runtime auto-installer
//!
//! Downloads and installs the ONNX Runtime dynamic library so end users do
//! not need to run `make download-onnxruntime` themselves. Mirrors the
//! Makefile's `download-onnxruntime` target.

use std::path::PathBuf;

/// Pinned ONNX Runtime version (must match the one ort 2.0.0-rc.11 expects).
pub const ONNX_VERSION: &str = "1.23.0";

/// User-data lib directory where libonnxruntime.so is installed.
pub fn lib_dir() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .map(|d| d.join("photoclove").join("lib"))
        .ok_or_else(|| "Failed to resolve user data directory".to_string())
}

/// Path to the installed library file.
pub fn lib_path() -> Result<PathBuf, String> {
    Ok(lib_dir()?.join(library_filename()))
}

/// Platform-specific library filename ort's `load-dynamic` expects.
fn library_filename() -> &'static str {
    if cfg!(target_os = "windows") {
        "onnxruntime.dll"
    } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
    } else {
        "libonnxruntime.so"
    }
}

/// Whether the runtime file is already in place.
pub fn is_installed() -> bool {
    lib_path().map(|p| p.exists()).unwrap_or(false)
}

/// Download URL for the current platform, or None if auto-install is unsupported.
pub fn download_url() -> Option<String> {
    let v = ONNX_VERSION;
    if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some(format!(
            "https://github.com/microsoft/onnxruntime/releases/download/v{v}/onnxruntime-linux-x64-{v}.tgz"
        ))
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        Some(format!(
            "https://github.com/microsoft/onnxruntime/releases/download/v{v}/onnxruntime-linux-aarch64-{v}.tgz"
        ))
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some(format!(
            "https://github.com/microsoft/onnxruntime/releases/download/v{v}/onnxruntime-osx-x86_64-{v}.tgz"
        ))
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some(format!(
            "https://github.com/microsoft/onnxruntime/releases/download/v{v}/onnxruntime-osx-arm64-{v}.tgz"
        ))
    } else {
        None
    }
}

fn archive_subdir() -> Option<&'static str> {
    if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some("onnxruntime-linux-x64")
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        Some("onnxruntime-linux-aarch64")
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some("onnxruntime-osx-x86_64")
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some("onnxruntime-osx-arm64")
    } else {
        None
    }
}

/// Source filename inside the extracted archive that we copy as the canonical lib.
fn source_lib_in_archive() -> &'static str {
    if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
    } else {
        "libonnxruntime.so"
    }
}

/// Download, extract, and install the ONNX Runtime library.
///
/// Blocking — call from a sync Tauri command (which Tauri runs on a worker
/// thread, not the GTK main thread).
pub fn install() -> Result<(), String> {
    let url = download_url().ok_or_else(|| {
        "Auto-install of ONNX Runtime is not supported on this platform. \
         See README.md for manual setup instructions."
            .to_string()
    })?;
    let subdir = archive_subdir().ok_or_else(|| "unsupported platform".to_string())?;
    let target_dir = lib_dir()?;

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create lib directory: {}", e))?;

    log::info!(target: "ai_tagging", "onnx_runtime_download_start; url={}", url);

    let tmp_archive = std::env::temp_dir()
        .join(format!("photoclove-onnxruntime-{}.tgz", ONNX_VERSION));
    let extract_dir = std::env::temp_dir()
        .join(format!("photoclove-onnxruntime-extract-{}", ONNX_VERSION));

    // Download to temp file
    let response = ureq::get(&url)
        .call()
        .map_err(|e| format!("Failed to download ONNX Runtime: {}", e))?;
    let mut reader = response.into_reader();
    let mut file = std::fs::File::create(&tmp_archive)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    let bytes = std::io::copy(&mut reader, &mut file)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    drop(file);

    log::info!(
        target: "ai_tagging",
        "onnx_runtime_download_complete; bytes={}; archive={}",
        bytes,
        tmp_archive.display()
    );

    // Extract via system tar (available on all supported platforms)
    let _ = std::fs::remove_dir_all(&extract_dir);
    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| format!("Failed to create extract dir: {}", e))?;

    let status = std::process::Command::new("tar")
        .arg("xzf")
        .arg(&tmp_archive)
        .arg("-C")
        .arg(&extract_dir)
        .status()
        .map_err(|e| format!("Failed to spawn tar: {}", e))?;
    if !status.success() {
        return Err(format!(
            "tar extraction failed (exit code {:?})",
            status.code()
        ));
    }

    // Find the inner lib dir; the archive root may include the version suffix.
    let src_lib_dir = find_lib_dir(&extract_dir, subdir)
        .ok_or_else(|| "Could not locate lib/ inside extracted archive".to_string())?;

    let src_link = src_lib_dir.join(source_lib_in_archive());
    let canonical = std::fs::canonicalize(&src_link)
        .map_err(|e| format!("Failed to resolve {}: {}", src_link.display(), e))?;

    let dest = target_dir.join(library_filename());
    let _ = std::fs::remove_file(&dest);
    std::fs::copy(&canonical, &dest)
        .map_err(|e| format!("Failed to copy library to {}: {}", dest.display(), e))?;

    log::info!(
        target: "ai_tagging",
        "onnx_runtime_installed; dest={}",
        dest.display()
    );

    let _ = std::fs::remove_file(&tmp_archive);
    let _ = std::fs::remove_dir_all(&extract_dir);

    Ok(())
}

/// Find the `lib/` directory inside the extracted archive. The archive may
/// extract to either `<subdir>/lib` or `<subdir>-<version>/lib` depending on
/// the release; check both.
fn find_lib_dir(extract_dir: &std::path::Path, subdir: &str) -> Option<PathBuf> {
    let candidates = [
        extract_dir.join(format!("{}-{}", subdir, ONNX_VERSION)).join("lib"),
        extract_dir.join(subdir).join("lib"),
    ];
    candidates.into_iter().find(|p| p.exists())
}
