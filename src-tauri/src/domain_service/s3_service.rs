//! S3 Service for cloud backup operations
//!
//! This module provides S3 upload/sync functionality for backing up photos
//! to Amazon S3 or S3-compatible storage services.

use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, Client as S3Client};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

use crate::domain_service::token_storage_service::TokenStorageService;
use crate::entity::config::{S3AuthMethod, S3Config, S3StorageType};

/// S3 Service for managing S3 operations
pub struct S3Service {
    client: Option<S3Client>,
    config: S3Config,
}

impl S3Service {
    /// Create a new S3Service instance
    pub fn new(config: S3Config) -> Self {
        Self {
            client: None,
            config,
        }
    }

    /// Initialize the S3 client with the configured credentials
    pub async fn init(&mut self) -> Result<(), String> {
        if !self.config.enabled {
            return Err("S3 backup is not enabled".to_string());
        }

        let region = Region::new(self.config.region.clone());

        // Build AWS config based on auth method
        let sdk_config = match self.config.auth_method {
            S3AuthMethod::AwsCredentials => {
                // Use AWS CLI credentials with optional profile
                let mut config_loader = aws_config::defaults(BehaviorVersion::latest())
                    .region(region);

                if let Some(profile) = &self.config.profile {
                    config_loader = config_loader.profile_name(profile);
                }

                config_loader.load().await
            }
            S3AuthMethod::IAMRole => {
                // Use IAM role (for EC2/ECS environments)
                aws_config::defaults(BehaviorVersion::latest())
                    .region(region)
                    .load()
                    .await
            }
            S3AuthMethod::AccessKey => {
                // Load Access Key from keyring for this provider
                let provider = self.get_provider_name();
                let (access_key_id, secret_access_key) = TokenStorageService::get_s3_credentials(provider)
                    .map_err(|e| format!("Failed to get S3 credentials from keyring: {}. Please enter your Access Key ID and Secret Access Key in Settings.", e))?;

                let credentials = Credentials::new(
                    access_key_id,
                    secret_access_key,
                    None, // session token
                    None, // expiration
                    "photoclove-keyring",
                );

                aws_config::defaults(BehaviorVersion::latest())
                    .region(region)
                    .credentials_provider(credentials)
                    .load()
                    .await
            }
        };

        // Create S3 client with optional custom endpoint for S3-compatible storage
        let mut s3_config_builder = aws_sdk_s3::config::Builder::from(&sdk_config);

        // Set custom endpoint for S3-compatible storage
        if let Some(endpoint) = &self.config.custom_endpoint {
            s3_config_builder = s3_config_builder.endpoint_url(endpoint);
            // Force path-style for S3-compatible storage
            s3_config_builder = s3_config_builder.force_path_style(true);
        } else if self.config.storage_type != S3StorageType::AwsS3 {
            // Set default endpoints for known providers
            if let Some(endpoint) = self.get_default_endpoint() {
                s3_config_builder = s3_config_builder.endpoint_url(endpoint);
                s3_config_builder = s3_config_builder.force_path_style(true);
            }
        }

        let s3_config = s3_config_builder.build();
        self.client = Some(S3Client::from_conf(s3_config));

        log::info!(target: "s3_service", "init; storage_type={:?}; region={}; auth_method={:?}",
            self.config.storage_type, self.config.region, self.config.auth_method);

        Ok(())
    }

    /// Get default endpoint URL for known S3-compatible providers
    fn get_default_endpoint(&self) -> Option<String> {
        match self.config.storage_type {
            S3StorageType::Wasabi => {
                Some(format!("https://s3.{}.wasabisys.com", self.config.region))
            }
            S3StorageType::MinIO => None, // MinIO requires custom endpoint
            S3StorageType::CloudflareR2 => None, // R2 requires custom endpoint with account ID
            S3StorageType::DigitalOcean => {
                Some(format!("https://{}.digitaloceanspaces.com", self.config.region))
            }
            S3StorageType::IDriveE2 => {
                // iDrive e2 uses AWS-compatible region names (e.g., ap-southeast-1)
                Some(format!("https://s3.{}.idrivee2.com", self.config.region))
            }
            S3StorageType::Custom | S3StorageType::AwsS3 => None,
        }
    }

    /// Parse bucket name and key prefix from bucket_uri (e.g., s3://bucket-name/prefix/)
    fn parse_bucket_uri(&self) -> Result<(String, String), String> {
        let uri = &self.config.bucket_uri;
        if !uri.starts_with("s3://") {
            return Err(format!("Invalid S3 URI: {}. Must start with s3://", uri));
        }

        let path = uri.trim_start_matches("s3://");
        let parts: Vec<&str> = path.splitn(2, '/').collect();

        let bucket = parts[0].to_string();
        let prefix = if parts.len() > 1 {
            parts[1].trim_end_matches('/').to_string()
        } else {
            String::new()
        };

        if bucket.is_empty() {
            return Err("Bucket name cannot be empty".to_string());
        }

        Ok((bucket, prefix))
    }

    /// Generate S3 key for a photo based on its import path
    ///
    /// The key structure mirrors the local import path:
    /// `{prefix}/{YYYY-MM-DD}/{UUID}/filename.jpg`
    fn generate_s3_key(&self, local_path: &str, import_to: &str) -> Result<String, String> {
        let (_, prefix) = self.parse_bucket_uri()?;

        // Get relative path from import_to
        let relative_path = if local_path.starts_with(import_to) {
            local_path.strip_prefix(import_to).unwrap_or(local_path)
        } else {
            local_path
        };

        // Remove leading slash
        let relative_path = relative_path.trim_start_matches('/');

        // Combine prefix and relative path
        if prefix.is_empty() {
            Ok(relative_path.to_string())
        } else {
            Ok(format!("{}/{}", prefix, relative_path))
        }
    }

    /// Test connection to S3 by listing objects (limit 1)
    pub async fn test_connection(&self) -> Result<bool, String> {
        let client = self.client.as_ref()
            .ok_or("S3 client not initialized")?;

        let (bucket, prefix) = self.parse_bucket_uri()?;

        let result = client
            .list_objects_v2()
            .bucket(&bucket)
            .prefix(&prefix)
            .max_keys(1)
            .send()
            .await;

        match result {
            Ok(_) => {
                log::info!(target: "s3_service", "test_connection; status=success; bucket={}", bucket);
                Ok(true)
            }
            Err(e) => {
                log::error!(target: "s3_service", "test_connection; status=failed; error={}", e);
                Err(format!("Connection test failed: {}", e))
            }
        }
    }

    /// Upload a single file to S3
    pub async fn upload_file(
        &self,
        local_path: &str,
        import_to: &str,
    ) -> Result<String, String> {
        let client = self.client.as_ref()
            .ok_or("S3 client not initialized")?;

        let (bucket, _) = self.parse_bucket_uri()?;
        let s3_key = self.generate_s3_key(local_path, import_to)?;

        // Check file size limit
        if let Some(max_size_mb) = self.config.max_file_size_mb {
            let metadata = std::fs::metadata(local_path)
                .map_err(|e| format!("Failed to read file metadata: {}", e))?;
            let size_mb = metadata.len() / (1024 * 1024);
            if size_mb > max_size_mb as u64 {
                return Err(format!(
                    "File size ({} MB) exceeds limit ({} MB)",
                    size_mb, max_size_mb
                ));
            }
        }

        // Read file content
        let path = Path::new(local_path);
        let mut file = File::open(path).await
            .map_err(|e| format!("Failed to open file: {}", e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents).await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Determine content type from extension
        let content_type = match path.extension().and_then(|e| e.to_str()) {
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("png") => "image/png",
            Some("gif") => "image/gif",
            Some("heic") | Some("heif") => "image/heic",
            Some("webp") => "image/webp",
            Some("mp4") => "video/mp4",
            Some("mov") => "video/quicktime",
            _ => "application/octet-stream",
        };

        // Upload to S3
        let result = client
            .put_object()
            .bucket(&bucket)
            .key(&s3_key)
            .body(contents.into())
            .content_type(content_type)
            .send()
            .await;

        match result {
            Ok(_) => {
                let s3_url = format!("s3://{}/{}", bucket, s3_key);
                log::info!(target: "s3_service", "upload_file; status=success; path={}; s3_url={}",
                    local_path, s3_url);
                Ok(s3_url)
            }
            Err(e) => {
                log::error!(target: "s3_service", "upload_file; status=failed; path={}; error={}",
                    local_path, e);
                Err(format!("Upload failed: {}", e))
            }
        }
    }

    /// Check if a file exists in S3
    #[allow(dead_code)]
    pub async fn file_exists(&self, s3_key: &str) -> Result<bool, String> {
        let client = self.client.as_ref()
            .ok_or("S3 client not initialized")?;

        let (bucket, _) = self.parse_bucket_uri()?;

        let result = client
            .head_object()
            .bucket(&bucket)
            .key(s3_key)
            .send()
            .await;

        match result {
            Ok(_) => Ok(true),
            Err(e) => {
                // Check if it's a "not found" error
                let service_error = e.into_service_error();
                if service_error.is_not_found() {
                    Ok(false)
                } else {
                    Err(format!("Failed to check file existence: {:?}", service_error))
                }
            }
        }
    }

    /// Backup the SQLite database to S3
    pub async fn backup_database(
        &self,
        db_path: &str,
    ) -> Result<String, String> {
        let client = self.client.as_ref()
            .ok_or("S3 client not initialized")?;

        let (bucket, prefix) = self.parse_bucket_uri()?;

        // Create a temporary backup using VACUUM INTO
        let backup_dir = std::env::temp_dir();
        let backup_path = backup_dir.join("photoclove_backup.db");
        let backup_path_str = backup_path.display().to_string();

        // Open connection and create backup
        let conn = rusqlite::Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute(&format!("VACUUM INTO '{}'", backup_path_str), [])
            .map_err(|e| format!("Failed to backup database: {}", e))?;

        // Read the backup file
        let mut file = File::open(&backup_path).await
            .map_err(|e| format!("Failed to open backup file: {}", e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents).await
            .map_err(|e| format!("Failed to read backup file: {}", e))?;

        // Upload to S3
        let s3_key = if prefix.is_empty() {
            ".photoclove/photoclove.db".to_string()
        } else {
            format!("{}/.photoclove/photoclove.db", prefix)
        };

        let result = client
            .put_object()
            .bucket(&bucket)
            .key(&s3_key)
            .body(contents.into())
            .content_type("application/x-sqlite3")
            .send()
            .await;

        // Clean up temporary backup file
        let _ = std::fs::remove_file(&backup_path);

        match result {
            Ok(_) => {
                let s3_url = format!("s3://{}/{}", bucket, s3_key);
                log::info!(target: "s3_service", "backup_database; status=success; s3_url={}", s3_url);
                Ok(s3_url)
            }
            Err(e) => {
                log::error!(target: "s3_service", "backup_database; status=failed; error={}", e);
                Err(format!("Database backup failed: {}", e))
            }
        }
    }

    /// Get the provider name string for storage_sync JSON
    pub fn get_provider_name(&self) -> &'static str {
        match self.config.storage_type {
            S3StorageType::AwsS3 => "aws_s3",
            S3StorageType::Wasabi => "wasabi",
            S3StorageType::MinIO => "minio",
            S3StorageType::CloudflareR2 => "cloudflare_r2",
            S3StorageType::DigitalOcean => "digitalocean",
            S3StorageType::IDriveE2 => "idrive_e2",
            S3StorageType::Custom => "custom",
        }
    }
}

/// List available AWS profiles from ~/.aws/credentials
pub fn list_aws_profiles() -> Result<Vec<String>, String> {
    let home = dirs::home_dir()
        .ok_or("Cannot find home directory")?;

    let credentials_path = home.join(".aws").join("credentials");

    if !credentials_path.exists() {
        log::info!(target: "s3_service", "list_aws_profiles; status=no_credentials_file");
        return Ok(vec!["default".to_string()]);
    }

    let contents = std::fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Failed to read credentials file: {}", e))?;

    let mut profiles = Vec::new();
    for line in contents.lines() {
        let line = line.trim();
        if line.starts_with('[') && line.ends_with(']') {
            let profile = line.trim_start_matches('[').trim_end_matches(']');
            profiles.push(profile.to_string());
        }
    }

    if profiles.is_empty() {
        profiles.push("default".to_string());
    }

    log::info!(target: "s3_service", "list_aws_profiles; count={}", profiles.len());
    Ok(profiles)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bucket_uri() {
        let config = S3Config {
            enabled: true,
            bucket_uri: "s3://my-bucket/photos/".to_string(),
            ..Default::default()
        };
        let service = S3Service::new(config);

        let (bucket, prefix) = service.parse_bucket_uri().unwrap();
        assert_eq!(bucket, "my-bucket");
        assert_eq!(prefix, "photos");
    }

    #[test]
    fn test_generate_s3_key() {
        let config = S3Config {
            enabled: true,
            bucket_uri: "s3://my-bucket/backup/".to_string(),
            ..Default::default()
        };
        let service = S3Service::new(config);

        let key = service.generate_s3_key(
            "/home/user/.photoclove/import/2024-01-15/abc123/photo.jpg",
            "/home/user/.photoclove/import"
        ).unwrap();

        assert_eq!(key, "backup/2024-01-15/abc123/photo.jpg");
    }
}
