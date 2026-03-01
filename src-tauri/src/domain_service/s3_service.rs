//! S3 Service wrapper
//!
//! Thin wrapper around the s3-backup crate that handles credential resolution
//! from the main app's token storage and config types.

use crate::domain_service::token_storage_service::TokenStorageService;
use crate::entity::config::{S3AuthMethod, S3Config, S3StorageType};

// Re-export the S3Service and related types from the s3-backup crate
pub use s3_backup::S3Service;
pub use s3_backup::list_aws_profiles;

/// Convert the app's S3Config into s3-backup's S3BackupConfig,
/// resolving credentials from keyring when needed.
pub fn to_backup_config(config: &S3Config) -> Result<s3_backup::S3BackupConfig, String> {
    let storage_type = convert_storage_type(&config.storage_type);

    let auth = match config.auth_method {
        S3AuthMethod::AwsCredentials => {
            s3_backup::AuthConfig::AwsCredentials {
                profile: config.profile.clone(),
            }
        }
        S3AuthMethod::IAMRole => s3_backup::AuthConfig::IamRole,
        S3AuthMethod::AccessKey => {
            let provider = s3_backup::storage_type_to_provider(&storage_type);
            let (access_key_id, secret_access_key) =
                TokenStorageService::get_s3_credentials(provider)
                    .map_err(|e| format!("Failed to get S3 credentials from keyring: {}. Please enter your Access Key ID and Secret Access Key in Settings.", e))?;
            s3_backup::AuthConfig::AccessKey {
                access_key_id,
                secret_access_key,
            }
        }
    };

    Ok(s3_backup::S3BackupConfig {
        enabled: config.enabled,
        storage_type,
        bucket_uri: config.bucket_uri.clone(),
        region: config.region.clone(),
        auth,
        custom_endpoint: config.custom_endpoint.clone(),
        max_file_size_mb: config.max_file_size_mb,
    })
}

/// Create and initialize an S3Service from the app's S3Config
pub async fn create_service(config: &S3Config) -> Result<S3Service, String> {
    let backup_config = to_backup_config(config)?;
    let mut service = S3Service::new(backup_config);
    service.init().await?;
    Ok(service)
}

fn convert_storage_type(st: &S3StorageType) -> s3_backup::StorageType {
    match st {
        S3StorageType::AwsS3 => s3_backup::StorageType::AwsS3,
        S3StorageType::MinIO => s3_backup::StorageType::MinIO,
        S3StorageType::Wasabi => s3_backup::StorageType::Wasabi,
        S3StorageType::CloudflareR2 => s3_backup::StorageType::CloudflareR2,
        S3StorageType::DigitalOcean => s3_backup::StorageType::DigitalOcean,
        S3StorageType::IDriveE2 => s3_backup::StorageType::IDriveE2,
        S3StorageType::Custom => s3_backup::StorageType::Custom,
    }
}
