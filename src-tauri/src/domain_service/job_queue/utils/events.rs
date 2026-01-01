use super::date_extractor::get_imported_dates_from_job_unit;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::Arc;
use tauri::Emitter;

/// Emit completion events for import job completion
/// This emits the sequence of events that the frontend expects to reload date lists and show notifications
pub(crate) fn emit_import_completion_events(
    app_handle: &tauri::AppHandle,
    job_unit_id: &str,
    db: &Arc<SQLite>,
) {
    log::info!(target: "completion_events", "import_completion; status=emitting; job_unit_id={}", job_unit_id);

    // Get the imported dates from the completed jobs
    let imported_dates = get_imported_dates_from_job_unit(db, job_unit_id);

    // Emit the sequence of events that the original import system used
    // These events trigger frontend to reload date lists and show notifications

    // 1. Notify that thumbnail creation is starting
    if let Err(e) = app_handle.emit("import", "start thumbnail creation") {
        log::error!(target: "completion_events", "event_emit_error; event=start_thumbnail_creation; error={}", e);
    }

    // 2. Notify that thumbnail creation finished
    if let Err(e) = app_handle.emit("import", "thumbnail creation finish") {
        log::error!(target: "completion_events", "event_emit_error; event=thumbnail_creation_finish; error={}", e);
    }

    // 3. Emit final completion event with dates information
    // The frontend expects this to trigger date list reload and notifications
    if let Err(e) = app_handle.emit("import", "finish") {
        log::error!(target: "completion_events", "event_emit_error; event=finish; error={}", e);
    }

    // 4. Also emit modern job unit completion event with dates
    let completion_data = serde_json::json!({
        "job_unit_id": job_unit_id,
        "imported_dates": imported_dates,
        "status": "completed"
    });

    if let Err(e) = app_handle.emit("import_job_unit_completed", completion_data) {
        log::error!(target: "completion_events", "event_emit_error; event=import_job_unit_completed; error={}", e);
    }

    log::info!(target: "completion_events", "import_completion; status=events_emitted");
}
