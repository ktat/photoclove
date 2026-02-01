//! Statistics-related Tauri commands.
//!
//! Provides commands for retrieving photography insights and statistics.
//! Uses job queue for background calculation and caching for fast access.
//! Supports time period filtering: all, weekly, monthly, yearly.

use crate::app_state::AppState;
use crate::domain_service::job_queue::handlers::insights;
use crate::entity::job_queue::{Job, JobType, JobUnit, QueuedJob};
use crate::repository::meta_db::sqlite::stats::TimePeriod;
use crate::repository::meta_db::sqlite::SQLite;
use serde::Serialize;
use std::sync::Arc;

/// Cache status response
#[derive(Debug, Serialize)]
pub struct InsightsCacheStatus {
    pub available: bool,
    pub age_secs: Option<u64>,
    pub path: Option<String>,
}

/// Get cached photography insights (fast, from cache file).
///
/// Returns cached insights if available, null otherwise.
/// Use queue_insights_refresh to trigger recalculation.
///
/// # Arguments
/// * `period` - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
#[tauri::command]
pub async fn get_cached_insights(
    state: tauri::State<'_, AppState>,
    period: Option<String>,
) -> Result<Option<String>, String> {
    let time_period = period
        .map(|p| TimePeriod::from_str(&p))
        .unwrap_or(TimePeriod::All);

    log::info!(target: "stats", "get_cached_insights; status=checking; period={}", time_period.as_str());

    match insights::read_cached_insights(&state.config, time_period) {
        Some(cached) => {
            log::info!(target: "stats", "get_cached_insights; status=found; period={}", time_period.as_str());
            let json = serde_json::to_string(&cached)
                .map_err(|e| format!("Serialization error: {}", e))?;
            Ok(Some(json))
        }
        None => {
            log::info!(target: "stats", "get_cached_insights; status=not_found; period={}", time_period.as_str());
            Ok(None)
        }
    }
}

/// Get cache status (whether cache exists and how old it is).
///
/// # Arguments
/// * `period` - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
#[tauri::command]
pub async fn get_insights_cache_status(
    state: tauri::State<'_, AppState>,
    period: Option<String>,
) -> Result<InsightsCacheStatus, String> {
    let time_period = period
        .map(|p| TimePeriod::from_str(&p))
        .unwrap_or(TimePeriod::All);

    log::info!(target: "stats", "get_insights_cache_status; status=checking; period={}", time_period.as_str());

    match insights::get_cache_metadata(&state.config, time_period) {
        Some(metadata) => {
            log::info!(target: "stats", "get_insights_cache_status; available=true; age_secs={}; period={}",
                metadata.age_secs, time_period.as_str());
            Ok(InsightsCacheStatus {
                available: true,
                age_secs: Some(metadata.age_secs),
                path: Some(metadata.path),
            })
        }
        None => {
            log::info!(target: "stats", "get_insights_cache_status; available=false; period={}", time_period.as_str());
            Ok(InsightsCacheStatus {
                available: false,
                age_secs: None,
                path: None,
            })
        }
    }
}

/// Queue insights calculation job.
///
/// Returns the job unit ID for tracking progress.
///
/// # Arguments
/// * `period` - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
#[tauri::command]
pub async fn queue_insights_refresh(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    period: Option<String>,
) -> Result<String, String> {
    let time_period = period
        .map(|p| TimePeriod::from_str(&p))
        .unwrap_or(TimePeriod::All);

    log::info!(target: "stats", "queue_insights_refresh; status=queueing; period={}", time_period.as_str());

    let sqlite = SQLite::new(state.config.import_to.clone());

    // Create job unit
    let job_types = vec!["insights_calculation".to_string()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    sqlite.create_job_unit(&job_unit)?;

    // Create the job with period as target (to pass period info to job handler)
    let job = Job::new(
        job_unit_id.clone(),
        JobType::InsightsCalculation,
        vec![time_period.as_str().to_string()],
    );
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Save job to queue
    sqlite.create_job(&queued_job)?;

    log::info!(target: "stats", "queue_insights_refresh; status=queued; job_unit_id={}; period={}",
        job_unit_id, time_period.as_str());

    // Trigger job processing
    let db_arc = Arc::new(sqlite);
    crate::domain_service::job_queue::executor::process_new_jobs(db_arc, 1, app_handle);

    Ok(job_unit_id)
}

/// Get photography insights directly (synchronous, may be slow).
///
/// This is a fallback for when cache is not available.
/// Prefer using get_cached_insights + queue_insights_refresh.
///
/// # Arguments
/// * `period` - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
#[tauri::command]
pub async fn get_photography_insights(
    state: tauri::State<'_, AppState>,
    period: Option<String>,
) -> Result<String, String> {
    let time_period = period
        .map(|p| TimePeriod::from_str(&p))
        .unwrap_or(TimePeriod::All);

    log::info!(target: "stats", "get_photography_insights; status=starting; period={}", time_period.as_str());

    let sqlite = SQLite::new(state.config.import_to.clone());

    let insights = crate::repository::meta_db::sqlite::stats::get_all_insights(
        &sqlite,
        &state.config,
        time_period,
    )?;

    log::info!(target: "stats", "get_photography_insights; status=complete; period={}", time_period.as_str());

    serde_json::to_string(&insights).map_err(|e| format!("Serialization error: {}", e))
}
