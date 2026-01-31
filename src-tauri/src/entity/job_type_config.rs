//! Job Type Configuration
//!
//! Defines configuration for each job type including resume/restart support
//! and the strategy for checking processed items.

use super::job_queue::JobType;

/// Strategy for checking if an item has been processed
#[derive(Debug, Clone, PartialEq)]
pub enum ProcessedCheckStrategy {
    /// Generic: Track last processed ID in job_queue table
    /// For sequential processing (most jobs)
    LastProcessedId,
    /// Generic: Check file mtime > job.started_at
    /// For parallel processing (Thumbnail only)
    FileCreationTime,
    /// Custom: Job-type specific logic
    Custom,
}

/// Configuration for each job type
#[derive(Debug, Clone)]
pub struct JobTypeConfig {
    /// Whether Resume (continue from where stopped) is supported
    pub resume_supported: bool,
    /// Whether Restart (start from beginning) is supported
    pub restart_supported: bool,
    /// Strategy for checking processed items
    pub check_strategy: ProcessedCheckStrategy,
}

impl JobTypeConfig {
    pub fn new(
        resume_supported: bool,
        restart_supported: bool,
        check_strategy: ProcessedCheckStrategy,
    ) -> Self {
        Self {
            resume_supported,
            restart_supported,
            check_strategy,
        }
    }
}

/// Get configuration for a specific job type
pub fn get_job_type_config(job_type: &JobType) -> JobTypeConfig {
    match job_type {
        // Custom: Check if destination file exists
        JobType::Import => JobTypeConfig::new(true, true, ProcessedCheckStrategy::Custom),

        // FileCreationTime: Only parallel processing job
        JobType::Thumbnail => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::FileCreationTime)
        }

        // LastProcessedId: Sequential processing by photo id
        JobType::CreateDb => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::LastProcessedId)
        }

        // Custom: Check if google_photos_url is set in DB
        JobType::GooglePhotosUpload => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::Custom)
        }

        // LastProcessedId: Sequential by datetime -> photo id
        JobType::RecalculateGrouping => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::LastProcessedId)
        }

        // LastProcessedId: Sequential by photo id
        JobType::AiTagging => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::LastProcessedId)
        }

        // Custom: Check if storage_sync record exists
        JobType::S3Sync => JobTypeConfig::new(true, true, ProcessedCheckStrategy::Custom),

        // LastProcessedId: Sequential by photo id
        JobType::FaceDetection => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::LastProcessedId)
        }

        // LastProcessedId: Sequential by face_id
        JobType::FaceThumbnailRegenerate => {
            JobTypeConfig::new(true, true, ProcessedCheckStrategy::LastProcessedId)
        }

        // Custom: Single-shot job, no resume needed
        JobType::InsightsCalculation => {
            JobTypeConfig::new(false, true, ProcessedCheckStrategy::Custom)
        }
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

    #[test]
    fn test_thumbnail_uses_file_creation_time() {
        let config = get_job_type_config(&JobType::Thumbnail);
        assert_eq!(config.check_strategy, ProcessedCheckStrategy::FileCreationTime);
    }

    #[test]
    fn test_import_uses_custom() {
        let config = get_job_type_config(&JobType::Import);
        assert_eq!(config.check_strategy, ProcessedCheckStrategy::Custom);
    }

    #[test]
    fn test_create_db_uses_last_processed_id() {
        let config = get_job_type_config(&JobType::CreateDb);
        assert_eq!(config.check_strategy, ProcessedCheckStrategy::LastProcessedId);
    }
}
