//! Job Type Configuration
//!
//! Defines configuration for each job type including resume/restart support.

use super::job_queue::JobType;

/// Configuration for each job type
#[derive(Debug, Clone)]
pub struct JobTypeConfig {
    /// Whether Resume (continue from where stopped) is supported
    pub resume_supported: bool,
    /// Whether Restart (start from beginning) is supported
    pub restart_supported: bool,
}

impl JobTypeConfig {
    pub fn new(resume_supported: bool, restart_supported: bool) -> Self {
        Self {
            resume_supported,
            restart_supported,
        }
    }
}

/// Get configuration for a specific job type
pub fn get_job_type_config(job_type: &JobType) -> JobTypeConfig {
    match job_type {
        JobType::Import => JobTypeConfig::new(true, true),
        JobType::Thumbnail => JobTypeConfig::new(true, true),
        JobType::CreateDb => JobTypeConfig::new(true, true),
        JobType::GooglePhotosUpload => JobTypeConfig::new(true, true),
        JobType::RecalculateGrouping => JobTypeConfig::new(true, true),
        JobType::AiTagging => JobTypeConfig::new(true, true),
        JobType::S3Sync => JobTypeConfig::new(true, true),
        JobType::FaceDetection => JobTypeConfig::new(true, true),
        JobType::FaceThumbnailRegenerate => JobTypeConfig::new(true, true),
        JobType::InsightsCalculation => JobTypeConfig::new(false, true),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_job_types_have_config() {
        let job_types = vec![
            JobType::Import,
            JobType::Thumbnail,
            JobType::CreateDb,
            JobType::GooglePhotosUpload,
            JobType::RecalculateGrouping,
            JobType::AiTagging,
            JobType::S3Sync,
            JobType::FaceDetection,
            JobType::FaceThumbnailRegenerate,
            JobType::InsightsCalculation,
        ];

        for job_type in job_types {
            let config = get_job_type_config(&job_type);
            // Most job types should support restart
            assert!(config.restart_supported);
        }
    }
}
