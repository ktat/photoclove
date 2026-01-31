//! Insights calculation job handler.
//!
//! Calculates photography insights statistics and saves to cache.

use crate::entity::job_queue::QueuedJob;
use crate::repository::meta_db::sqlite::stats;
use crate::repository::meta_db::sqlite::SQLite;
use std::fs;
use std::path::Path;
use tauri::{Emitter, Manager};

/// Process an insights calculation job
pub(crate) fn process_insights_job(
    job: &QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &SQLite,
) -> Result<(), String> {
    let job_id = job.id.unwrap_or(0);
    log::info!(target: "job_queue", "insights_job; job_id={}; status=starting", job_id);

    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Calculate insights
    log::info!(target: "job_queue", "insights_job; job_id={}; status=calculating", job_id);
    let insights = stats::get_all_insights(db, config)?;

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&insights)
        .map_err(|e| format!("Failed to serialize insights: {}", e))?;

    // Get cache directory
    let cache_path = get_insights_cache_path(config);

    // Ensure cache directory exists
    if let Some(parent) = Path::new(&cache_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
    }

    // Write to cache file
    fs::write(&cache_path, &json)
        .map_err(|e| format!("Failed to write insights cache: {}", e))?;

    log::info!(target: "job_queue", "insights_job; job_id={}; status=complete; cache_path={}", job_id, cache_path);

    // Emit event to notify frontend
    if let Err(e) = app_handle.emit("insights_updated", &cache_path) {
        log::error!(target: "job_queue", "insights_job; job_id={}; emit_error={}", job_id, e);
    }

    Ok(())
}

/// Get the cache file path for insights
pub fn get_insights_cache_path(config: &crate::entity::config::Config) -> String {
    let cache_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("photoclove")
        .join("cache");

    cache_dir
        .join("insights.json")
        .to_string_lossy()
        .to_string()
}

/// Read cached insights if available
pub fn read_cached_insights(config: &crate::entity::config::Config) -> Option<stats::PhotographyInsights> {
    let cache_path = get_insights_cache_path(config);

    if !Path::new(&cache_path).exists() {
        return None;
    }

    match fs::read_to_string(&cache_path) {
        Ok(json) => {
            match serde_json::from_str(&json) {
                Ok(insights) => Some(insights),
                Err(e) => {
                    log::warn!(target: "stats", "read_cached_insights; parse_error={}", e);
                    None
                }
            }
        }
        Err(e) => {
            log::warn!(target: "stats", "read_cached_insights; read_error={}", e);
            None
        }
    }
}

/// Get cache file metadata (for checking age)
pub fn get_cache_metadata(config: &crate::entity::config::Config) -> Option<CacheMetadata> {
    let cache_path = get_insights_cache_path(config);

    if !Path::new(&cache_path).exists() {
        return None;
    }

    match fs::metadata(&cache_path) {
        Ok(metadata) => {
            let modified = metadata.modified().ok()?;
            let age_secs = modified.elapsed().ok()?.as_secs();
            Some(CacheMetadata {
                path: cache_path,
                age_secs,
                size_bytes: metadata.len(),
            })
        }
        Err(_) => None,
    }
}

/// Cache metadata information
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheMetadata {
    pub path: String,
    pub age_secs: u64,
    pub size_bytes: u64,
}
