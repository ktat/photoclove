use super::utils::{row_to_queued_job, with_connection};
use crate::entity::job_queue::{Job, JobProgress, JobStatus, JobUnit, QueuedJob};
use crate::repository::meta_db::sqlite::SQLite;
use crate::value::date;
use rusqlite::{params, OptionalExtension};

const JOB_COLUMNS: &str =
    "id, job_unit_id, job, status, created_at, started_at, completed_at, error_message, processed_count, last_processed_id";

/// Get jobs with optional status filter
fn get_jobs_with_filter(
    sqlite: &SQLite,
    status_filter: Option<&str>,
    order: &str,
) -> Result<Vec<QueuedJob>, String> {
    with_connection(sqlite, |conn| {
        let query = match status_filter {
            Some(_) => format!(
                "SELECT {} FROM job_queue WHERE status = ? ORDER BY created_at {}",
                JOB_COLUMNS, order
            ),
            None => format!(
                "SELECT {} FROM job_queue ORDER BY created_at {}",
                JOB_COLUMNS, order
            ),
        };

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let job_iter = match status_filter {
            Some(status) => stmt.query_map([status], row_to_queued_job),
            None => stmt.query_map([], row_to_queued_job),
        }
        .map_err(|e| format!("Failed to query jobs: {}", e))?;

        let mut jobs = Vec::new();
        for job in job_iter {
            jobs.push(job.map_err(|e| format!("Failed to parse job: {}", e))?);
        }

        Ok(jobs)
    })
}

pub(super) fn create_job_unit(sqlite: &SQLite, job_unit: &JobUnit) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        let jobs_json = serde_json::to_string(&job_unit.jobs)
            .map_err(|e| format!("Failed to serialize jobs: {}", e))?;

        conn.execute(
            "INSERT INTO job_unit (id, jobs, created_at, status) VALUES (?1, ?2, ?3, ?4)",
            params![
                job_unit.id,
                jobs_json,
                job_unit.created_at,
                job_unit.status.to_string()
            ],
        )
        .map_err(|e| format!("Failed to insert job unit: {}", e))?;

        Ok(())
    })
}

pub(super) fn create_job(sqlite: &SQLite, queued_job: &QueuedJob) -> Result<i64, String> {
    with_connection(sqlite, |conn| {
        let job_json = serde_json::to_string(&queued_job.job)
            .map_err(|e| format!("Failed to serialize job: {}", e))?;

        conn.execute(
            "INSERT INTO job_queue (job_unit_id, job, status, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                queued_job.job_unit_id,
                job_json,
                queued_job.status.to_string(),
                queued_job.created_at
            ],
        )
        .map_err(|e| format!("Failed to insert job: {}", e))?;

        Ok(conn.last_insert_rowid())
    })
}

pub(super) fn get_pending_jobs(sqlite: &SQLite) -> Result<Vec<QueuedJob>, String> {
    get_jobs_with_filter(sqlite, Some("pending"), "ASC")
}

pub(super) fn get_all_jobs(sqlite: &SQLite) -> Result<Vec<QueuedJob>, String> {
    get_jobs_with_filter(sqlite, None, "DESC")
}

pub(super) fn update_job_status(
    sqlite: &SQLite,
    job_id: i64,
    status: &JobStatus,
    error_message: Option<String>,
) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        let now = date::DateTime::now().to_db_string();

        match status {
            JobStatus::Running => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, started_at = ?2 WHERE id = ?3",
                    params![status.to_string(), now, job_id],
                )
                .map_err(|e| format!("Failed to update job status: {}", e))?;
            }
            JobStatus::Completed => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, completed_at = ?2 WHERE id = ?3",
                    params![status.to_string(), now, job_id],
                )
                .map_err(|e| format!("Failed to update job status: {}", e))?;
            }
            JobStatus::Failed => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1, completed_at = ?2, error_message = ?3 WHERE id = ?4",
                    params![status.to_string(), now, error_message, job_id],
                )
                .map_err(|e| format!("Failed to update job status: {}", e))?;
            }
            _ => {
                conn.execute(
                    "UPDATE job_queue SET status = ?1 WHERE id = ?2",
                    params![status.to_string(), job_id],
                )
                .map_err(|e| format!("Failed to update job status: {}", e))?;
            }
        }

        Ok(())
    })
}

/// Update job progress count
pub(super) fn update_job_progress(
    sqlite: &SQLite,
    job_id: i64,
    processed_count: i64,
) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        conn.execute(
            "UPDATE job_queue SET processed_count = ?1 WHERE id = ?2",
            params![processed_count, job_id],
        )
        .map_err(|e| format!("Failed to update job progress: {}", e))?;

        Ok(())
    })
}

/// Update job progress with last processed item ID (for LastProcessedId strategy)
pub(super) fn update_job_progress_with_last_id(
    sqlite: &SQLite,
    job_id: i64,
    processed_count: i64,
    last_processed_id: i64,
) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        conn.execute(
            "UPDATE job_queue SET processed_count = ?1, last_processed_id = ?2 WHERE id = ?3",
            params![processed_count, last_processed_id, job_id],
        )
        .map_err(|e| format!("Failed to update job progress with last_id: {}", e))?;

        Ok(())
    })
}

/// Get a job by ID
pub(super) fn get_job_by_id(sqlite: &SQLite, job_id: i64) -> Result<Option<QueuedJob>, String> {
    with_connection(sqlite, |conn| {
        let query = format!("SELECT {} FROM job_queue WHERE id = ?1", JOB_COLUMNS);

        let result = conn
            .query_row(&query, params![job_id], row_to_queued_job)
            .optional()
            .map_err(|e| format!("Failed to get job: {}", e))?;

        Ok(result)
    })
}

pub(super) fn get_job_unit_progress(
    sqlite: &SQLite,
    job_unit_id: &str,
) -> Result<JobProgress, String> {
    with_connection(sqlite, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT status, COUNT(*) FROM job_queue WHERE job_unit_id = ?1 GROUP BY status",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let mut total_jobs = 0;
        let mut completed_jobs = 0;

        let rows = stmt
            .query_map([job_unit_id], |row| {
                let status: String = row.get(0)?;
                let count: i32 = row.get(1)?;
                Ok((status, count))
            })
            .map_err(|e| format!("Failed to query job progress: {}", e))?;

        for row in rows {
            let (status, count) =
                row.map_err(|e| format!("Failed to parse job progress row: {}", e))?;
            total_jobs += count;
            if status == "completed" {
                completed_jobs += count;
            }
        }

        let mut progress = JobProgress::new(job_unit_id.to_string(), total_jobs as usize);
        progress.update_progress(completed_jobs as usize, None);

        Ok(progress)
    })
}

pub(super) fn update_job_unit_status_if_complete(
    sqlite: &SQLite,
    job_unit_id: &str,
) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        // Check if all jobs for this job unit are completed
        let incomplete_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM job_queue WHERE job_unit_id = ?1 AND status != 'completed'",
                [job_unit_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to query incomplete jobs: {}", e))?;

        // If no incomplete jobs, mark job unit as completed
        if incomplete_count == 0 {
            log::info!(target: "sqlite", "job_unit_complete; job_unit_id={}; status=updating", job_unit_id);
            conn.execute(
                "UPDATE job_unit SET status = 'completed' WHERE id = ?1",
                [job_unit_id],
            )
            .map_err(|e| format!("Failed to update job unit status: {}", e))?;
        }

        Ok(())
    })
}

pub(super) fn cleanup_completed_jobs(sqlite: &SQLite) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        // First, delete all completed jobs (no time restriction for immediate cleanup)
        let deleted_jobs = conn
            .execute("DELETE FROM job_queue WHERE status = 'completed'", [])
            .map_err(|e| format!("Failed to cleanup completed jobs: {}", e))?;

        // Then delete completed job units that have no remaining jobs
        let deleted_units = conn
            .execute(
                "DELETE FROM job_unit WHERE status = 'completed' AND id NOT IN (SELECT DISTINCT job_unit_id FROM job_queue)",
                [],
            )
            .map_err(|e| format!("Failed to cleanup completed job units: {}", e))?;

        if deleted_jobs > 0 || deleted_units > 0 {
            log::info!(target: "sqlite", "job_cleanup; deleted_jobs={}; deleted_units={}", deleted_jobs, deleted_units);
        }

        Ok(())
    })
}

pub(super) fn get_jobs_for_unit(
    sqlite: &SQLite,
    job_unit_id: &str,
) -> Result<Vec<QueuedJob>, String> {
    with_connection(sqlite, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, job_unit_id, job, status, error_message, created_at
                 FROM job_queue WHERE job_unit_id = ?1",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let job_iter = stmt
            .query_map([job_unit_id], |row| {
                let job_id: i64 = row.get(0)?;
                let job_unit_id: String = row.get(1)?;
                let job_json: String = row.get(2)?;
                let status_str: String = row.get(3)?;
                let error_message: Option<String> = row.get(4)?;
                let _created_at: String = row.get(5)?;

                // Parse job JSON
                let job: Job = serde_json::from_str(&job_json).map_err(|_| {
                    rusqlite::Error::InvalidColumnType(
                        2,
                        "job".to_string(),
                        rusqlite::types::Type::Text,
                    )
                })?;

                // Parse status
                let status = match status_str.as_str() {
                    "pending" => JobStatus::Pending,
                    "running" => JobStatus::Running,
                    "completed" => JobStatus::Completed,
                    "failed" => JobStatus::Failed,
                    _ => {
                        return Err(rusqlite::Error::InvalidColumnType(
                            3,
                            "status".to_string(),
                            rusqlite::types::Type::Text,
                        ))
                    }
                };

                // Create queued job
                let mut queued_job = QueuedJob::new(job_unit_id, job);
                queued_job.id = Some(job_id);
                queued_job.status = status;
                queued_job.error_message = error_message;

                Ok(queued_job)
            })
            .map_err(|e| format!("Failed to query jobs: {}", e))?;

        let mut jobs = Vec::new();
        for job_result in job_iter {
            jobs.push(job_result.map_err(|e| format!("Failed to parse job: {}", e))?);
        }

        Ok(jobs)
    })
}

pub(super) fn reset_running_jobs_to_pending(sqlite: &SQLite) -> Result<usize, String> {
    with_connection(sqlite, |conn| {
        let affected_rows = conn
            .execute(
                "UPDATE job_queue SET status = 'pending' WHERE status = 'running'",
                [],
            )
            .map_err(|e| format!("Failed to reset running jobs: {}", e))?;

        Ok(affected_rows)
    })
}

pub(super) fn delete_job(sqlite: &SQLite, job_id: i64) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        let affected_rows = conn
            .execute(
                "DELETE FROM job_queue WHERE id = ?1 AND status IN ('pending', 'failed')",
                [job_id],
            )
            .map_err(|e| format!("Failed to delete job: {}", e))?;

        if affected_rows == 0 {
            return Err("Job not found or cannot be deleted (job may be running)".to_string());
        }

        Ok(())
    })
}

pub(super) fn delete_job_unit(sqlite: &SQLite, job_unit_id: &str) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        // Delete all jobs for this unit (only if not running)
        let _affected_jobs = conn
            .execute(
                "DELETE FROM job_queue WHERE job_unit_id = ?1 AND status IN ('pending', 'failed', 'completed')",
                [job_unit_id],
            )
            .map_err(|e| format!("Failed to delete jobs for unit: {}", e))?;

        // Delete the job unit itself
        let affected_units = conn
            .execute("DELETE FROM job_unit WHERE id = ?1", [job_unit_id])
            .map_err(|e| format!("Failed to delete job unit: {}", e))?;

        if affected_units == 0 {
            return Err("Job unit not found".to_string());
        }

        Ok(())
    })
}
