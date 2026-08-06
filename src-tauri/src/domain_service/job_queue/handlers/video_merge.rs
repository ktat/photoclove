use super::utils::{cleanup_kill_file, should_stop_job};
use crate::domain_service::job_queue::submission::submit_import_jobs;
use crate::domain_service::video_edit_service;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::cell::Cell;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Process a video merge job - concatenates the trimmed clips into one file and
/// hands the result to the normal import pipeline so it lands in the library
/// with a thumbnail and a database entry like any other video.
pub(crate) fn process_video_merge_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    log::info!(target: "video_merge_job", "job; status=starting; job_unit_id={}", job.job_unit_id);

    let job_data_json = job
        .job
        .target
        .first()
        .ok_or_else(|| "No job data found in target field".to_string())?;
    let job_data: job_queue::VideoMergeJob = serde_json::from_str(job_data_json)
        .map_err(|e| format!("Failed to deserialize job data: {}", e))?;

    let job_id = job.id.unwrap_or(0);
    let state = app_handle.state::<crate::AppState>();
    let config = &state.config;

    // Outputs of earlier merges are only copied by the import job, so clear the
    // ones that have aged out before writing another full-size video.
    video_edit_service::cleanup_stale_staging_files();

    let output_path = video_edit_service::staging_dir().join(&job_data.output_name);
    log::info!(
        target: "video_merge_job",
        "merge_params; clips={}; output={}",
        job_data.clips.len(),
        output_path.display()
    );

    emit_progress(app_handle, &job.job_unit_id, "Merging videos...", 0);

    // Emitting on every ffmpeg progress line would flood the frontend, so only
    // whole-percent changes are forwarded.
    let last_percent = Cell::new(0_u32);
    let merge_result = video_edit_service::merge_videos(
        &job_data.clips,
        &output_path,
        |ratio| {
            let percent = (ratio * 100.0).round() as u32;
            if percent > last_percent.get() {
                last_percent.set(percent);
                emit_progress(app_handle, &job.job_unit_id, "Merging videos...", percent);
            }
        },
        || should_stop_job(job_id),
    );

    if let Err(e) = merge_result {
        cleanup_kill_file(job_id);
        log::error!(target: "video_merge_job", "merge_failed; job_id={}; error={}", job_id, e);
        return Err(e);
    }

    // Reuse the import pipeline: it copies the file into the dated library
    // directory and schedules the dependent thumbnail/database jobs.
    let output = output_path.display().to_string();
    let import_job_unit_id = match submit_import_jobs(
        db.clone(),
        config.copy_parallel,
        vec![output.clone()],
        app_handle.clone(),
    ) {
        Ok(id) => id,
        Err(e) => {
            // The encode itself succeeded, so say where the file is: the staging
            // copy survives until it ages out and can still be imported by hand.
            log::error!(
                target: "video_merge_job",
                "import_submit_failed_after_merge; job_id={}; output={}; error={}",
                job_id, output, e
            );
            return Err(format!(
                "Merge succeeded but the import step failed ({}). Output left at {}",
                e, output
            ));
        }
    };

    let _ = state.meta_db.update_job_progress(job_id, 1);
    emit_progress(app_handle, &job.job_unit_id, "Merge completed", 100);

    log::info!(
        target: "video_merge_job",
        "job; status=completed; job_id={}; output={}; import_job_unit_id={}",
        job_id, output, import_job_unit_id
    );
    Ok(())
}

/// Mirrors the `*_progress` events the import and thumbnail jobs emit, so the
/// frontend can follow a merge with the same listener shape.
fn emit_progress(app_handle: &tauri::AppHandle, job_unit_id: &str, message: &str, percent: u32) {
    if let Err(e) = app_handle.emit("video_merge_progress", (job_unit_id, message, percent)) {
        log::error!(target: "video_merge_job", "progress_event_error; error={}", e);
    }
}
