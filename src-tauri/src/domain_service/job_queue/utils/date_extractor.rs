use crate::repository::meta_db::sqlite::SQLite;
use std::collections::HashSet;
use std::sync::Arc;

/// Extract dates from file paths following the structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
/// Returns a set of date strings in YYYY-MM-DD format
pub(crate) fn extract_dates_from_paths(file_paths: &[String]) -> HashSet<String> {
    let mut dates_set = HashSet::new();
    let date_re = regex::Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();

    for file_path in file_paths {
        let path = std::path::Path::new(file_path);

        // Extract date from destination path structure: [dest]/[YYYY-MM-DD]/[UUID]/[filename]
        if let Some(parent) = path.parent() {
            if let Some(_uuid_dir) = parent.file_name() {
                if let Some(date_dir) = parent.parent() {
                    if let Some(date_str) = date_dir.file_name() {
                        let date_string = date_str.to_string_lossy().to_string();
                        // Only add if it looks like a date (YYYY-MM-DD format)
                        if date_re.is_match(&date_string) {
                            dates_set.insert(date_string);
                        }
                    }
                }
            }
        }
    }

    dates_set
}

/// Helper method to extract the list of dates that had photos imported
/// Gets all jobs for a job unit and extracts dates from import job file paths
pub(crate) fn get_imported_dates_from_job_unit(db: &Arc<SQLite>, job_unit_id: &str) -> Vec<String> {
    log::debug!(target: "imported_dates", "extraction; job_unit_id={}", job_unit_id);

    // Get all jobs for this job unit to find the import job
    match db.get_jobs_for_unit(job_unit_id) {
        Ok(jobs) => {
            let mut dates_set = HashSet::new();

            // Look through completed jobs to find dates
            for job in jobs {
                if job.job.job_type == crate::entity::job_queue::JobType::Import {
                    // Extract dates from the imported file paths
                    let extracted_dates = extract_dates_from_paths(&job.job.target);
                    dates_set.extend(extracted_dates);
                }
            }

            let dates: Vec<String> = dates_set.into_iter().collect();
            log::debug!(target: "imported_dates", "extraction; dates={:?}", dates);
            dates
        }
        Err(e) => {
            log::error!(target: "imported_dates", "extraction_error; job_unit_id={}; error={}", job_unit_id, e);
            vec![]
        }
    }
}
