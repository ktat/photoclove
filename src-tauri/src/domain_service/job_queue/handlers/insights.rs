//! Insights calculation job handler.
//!
//! Calculates photography insights statistics and saves to cache.
//! Supports time period filtering with separate cache files per period.

use crate::entity::job_queue::QueuedJob;
use crate::repository::meta_db::sqlite::stats;
use crate::value::date::TimePeriod;
use crate::repository::meta_db::sqlite::SQLite;
use serde::{Deserialize, Serialize};
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

    // Extract period from job targets (first element is period string)
    let period = job
        .job
        .target
        .first()
        .map(|s| TimePeriod::from_str(s))
        .unwrap_or(TimePeriod::All);

    log::info!(target: "job_queue", "insights_job; job_id={}; status=starting; period={}",
        job_id, period.as_str());

    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Calculate insights
    log::info!(target: "job_queue", "insights_job; job_id={}; status=calculating; period={}",
        job_id, period.as_str());
    let insights = stats::get_all_insights(db, config, &period)?;

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&insights)
        .map_err(|e| format!("Failed to serialize insights: {}", e))?;

    // Get cache directory (period-specific)
    let cache_path = get_insights_cache_path(config, &period);

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

    log::info!(target: "job_queue", "insights_job; job_id={}; status=complete; cache_path={}; period={}",
        job_id, cache_path, period.as_str());

    // Emit event to notify frontend (include period info)
    let event_payload = InsightsUpdatedPayload {
        path: cache_path,
        period: period.as_str().to_string(),
    };
    if let Err(e) = app_handle.emit("insights_updated", &event_payload) {
        log::error!(target: "job_queue", "insights_job; job_id={}; emit_error={}", job_id, e);
    }

    Ok(())
}

/// Payload for insights_updated event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightsUpdatedPayload {
    pub path: String,
    pub period: String,
}

/// Get the cache file path for insights (period-specific)
pub fn get_insights_cache_path(
    _config: &crate::entity::config::Config,
    period: &TimePeriod,
) -> String {
    let cache_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("photoclove")
        .join("cache");

    // Replace colons with underscores for valid filename (e.g., "yearly:2023" -> "yearly_2023")
    let period_str = period.as_str().replace(':', "_");
    let filename = format!("insights_{}.json", period_str);
    cache_dir.join(filename).to_string_lossy().to_string()
}

/// Read cached insights if available
pub fn read_cached_insights(
    config: &crate::entity::config::Config,
    period: &TimePeriod,
) -> Option<stats::PhotographyInsights> {
    let cache_path = get_insights_cache_path(config, period);

    if !Path::new(&cache_path).exists() {
        return None;
    }

    match fs::read_to_string(&cache_path) {
        Ok(json) => match serde_json::from_str(&json) {
            Ok(insights) => Some(insights),
            Err(e) => {
                log::warn!(target: "stats", "read_cached_insights; parse_error={}; period={}", e, period.as_str());
                None
            }
        },
        Err(e) => {
            log::warn!(target: "stats", "read_cached_insights; read_error={}; period={}", e, period.as_str());
            None
        }
    }
}

/// Get cache file metadata (for checking age)
pub fn get_cache_metadata(
    config: &crate::entity::config::Config,
    period: &TimePeriod,
) -> Option<CacheMetadata> {
    let cache_path = get_insights_cache_path(config, period);

    if !Path::new(&cache_path).exists() {
        return None;
    }

    match fs::metadata(&cache_path) {
        Ok(metadata) => {
            let modified = metadata.modified().ok()?;
            let age_secs = modified.elapsed().ok()?.as_secs();
            Some(CacheMetadata {
                path: cache_path,
                period: period.as_str(),
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
    pub period: String,
    pub age_secs: u64,
    pub size_bytes: u64,
}
