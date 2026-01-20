use crate::value::date;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobUnit {
    pub id: String,
    pub jobs: Vec<String>,
    pub created_at: String,
    pub status: JobUnitStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobUnitStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

impl ToString for JobUnitStatus {
    fn to_string(&self) -> String {
        match self {
            JobUnitStatus::Pending => "pending".to_string(),
            JobUnitStatus::InProgress => "in_progress".to_string(),
            JobUnitStatus::Completed => "completed".to_string(),
            JobUnitStatus::Failed => "failed".to_string(),
        }
    }
}

impl From<String> for JobUnitStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => JobUnitStatus::Pending,
            "in_progress" => JobUnitStatus::InProgress,
            "completed" => JobUnitStatus::Completed,
            "failed" => JobUnitStatus::Failed,
            _ => JobUnitStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub job_unit_id: String,
    pub job_type: JobType,
    pub target: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobType {
    #[serde(rename = "import")]
    Import,
    #[serde(rename = "thumbnail")]
    Thumbnail,
    #[serde(rename = "create_db")]
    CreateDb,
    #[serde(rename = "google_photos_upload")]
    GooglePhotosUpload,
    #[serde(rename = "recalculate_grouping")]
    RecalculateGrouping,
    #[serde(rename = "ai_tagging")]
    AiTagging,
}

impl ToString for JobType {
    fn to_string(&self) -> String {
        match self {
            JobType::Import => "import".to_string(),
            JobType::Thumbnail => "thumbnail".to_string(),
            JobType::CreateDb => "create_db".to_string(),
            JobType::GooglePhotosUpload => "google_photos_upload".to_string(),
            JobType::RecalculateGrouping => "recalculate_grouping".to_string(),
            JobType::AiTagging => "ai_tagging".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedJob {
    pub id: Option<i64>,
    pub job_unit_id: String,
    pub job: Job,
    pub status: JobStatus,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

impl ToString for JobStatus {
    fn to_string(&self) -> String {
        match self {
            JobStatus::Pending => "pending".to_string(),
            JobStatus::Running => "running".to_string(),
            JobStatus::Completed => "completed".to_string(),
            JobStatus::Failed => "failed".to_string(),
        }
    }
}

impl From<String> for JobStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => JobStatus::Pending,
            "running" => JobStatus::Running,
            "completed" => JobStatus::Completed,
            "failed" => JobStatus::Failed,
            _ => JobStatus::Pending,
        }
    }
}

impl JobUnit {
    pub fn new(jobs: Vec<String>) -> Self {
        let uuid = Uuid::new_v4().to_string();
        let now = date::DateTime::now().to_db_string();

        JobUnit {
            id: uuid,
            jobs,
            created_at: now,
            status: JobUnitStatus::Pending,
        }
    }
}

impl Job {
    pub fn new(job_unit_id: String, job_type: JobType, target: Vec<String>) -> Self {
        let now = date::DateTime::now().to_db_string();

        Job {
            job_unit_id,
            job_type,
            target,
            created_at: now,
        }
    }
}

impl QueuedJob {
    pub fn new(job_unit_id: String, job: Job) -> Self {
        let now = date::DateTime::now().to_db_string();

        QueuedJob {
            id: None,
            job_unit_id,
            job,
            status: JobStatus::Pending,
            created_at: now,
            started_at: None,
            completed_at: None,
            error_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_unit_id: String,
    pub total_jobs: usize,
    pub completed_jobs: usize,
    pub current_job: Option<String>,
    pub overall_progress: f64,
    pub queue_position: Option<usize>,
}

impl JobProgress {
    pub fn new(job_unit_id: String, total_jobs: usize) -> Self {
        JobProgress {
            job_unit_id,
            total_jobs,
            completed_jobs: 0,
            current_job: None,
            overall_progress: 0.0,
            queue_position: None,
        }
    }

    pub fn update_progress(&mut self, completed_jobs: usize, current_job: Option<String>) {
        self.completed_jobs = completed_jobs;
        self.current_job = current_job;
        self.overall_progress = if self.total_jobs > 0 {
            (self.completed_jobs as f64 / self.total_jobs as f64) * 100.0
        } else {
            0.0
        };
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GooglePhotosUploadJob {
    pub photo_paths: Vec<String>,
    pub album_id: Option<String>,
    pub chunk_index: usize,
    pub total_chunks: usize,
}

/// Job parameters for recalculating burst groups
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecalculateGroupingJob {
    pub threshold_seconds: u32,
    pub min_group_size: u32,
}

/// Job parameters for AI auto-tagging
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AiTaggingJob {
    /// Photo paths to process
    pub photo_paths: Vec<String>,
    /// Confidence threshold (0.0 to 1.0)
    pub confidence_threshold: f32,
    /// Optional: specific date to process (for maintenance tab)
    pub target_date: Option<String>,
}
