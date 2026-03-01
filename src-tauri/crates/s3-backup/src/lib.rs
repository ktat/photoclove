//! S3 Backup crate for cloud storage operations
//!
//! Separated into its own crate to isolate AWS SDK codegen from the main binary,
//! preventing LLVM SmallVector overflow on Windows release builds.

use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, Client as S3Client};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

/// Authentication configuration for S3
pub enum AuthConfig {
    /// Use AWS CLI credentials (~/.aws/credentials) with optional profile
    AwsCredentials { profile: Option<String> },
    /// Use IAM Role (EC2/ECS environment)
    IamRole,
    /// Use Access Key ID + Secret Access Key directly
    AccessKey {
        access_key_id: String,
        secret_access_key: String,
    },
}

/// Storage provider type
#[derive(Debug, Clone, PartialEq)]
pub enum StorageType {
    AwsS3,
    MinIO,
    Wasabi,
    CloudflareR2,
    DigitalOcean,
    IDriveE2,
    Custom,
}

/// Configuration for the S3 backup service
pub struct S3BackupConfig {
    pub enabled: bool,
    pub storage_type: StorageType,
    pub bucket_uri: String,
    pub region: String,
    pub auth: AuthConfig,
    pub custom_endpoint: Option<String>,
    pub max_file_size_mb: Option<u32>,
}

/// S3 Service for managing S3 operations
pub struct S3Service {
    client: Option<S3Client>,
    config: S3BackupConfig,
}

impl S3Service {
    /// Create a new S3Service instance
    pub fn new(config: S3BackupConfig) -> Self {
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
        let sdk_config = match &self.config.auth {
            AuthConfig::AwsCredentials { profile } => {
                let mut config_loader =
                    aws_config::defaults(BehaviorVersion::latest()).region(region);

                if let Some(profile) = profile {
                    config_loader = config_loader.profile_name(profile);
                }

                config_loader.load().await
            }
            AuthConfig::IamRole => {
                aws_config::defaults(BehaviorVersion::latest())
                    .region(region)
                    .load()
                    .await
            }
            AuthConfig::AccessKey {
                access_key_id,
                secret_access_key,
            } => {
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
            s3_config_builder = s3_config_builder.force_path_style(true);
        } else if self.config.storage_type != StorageType::AwsS3 {
            if let Some(endpoint) = self.get_default_endpoint() {
                s3_config_builder = s3_config_builder.endpoint_url(endpoint);
                s3_config_builder = s3_config_builder.force_path_style(true);
            }
        }

        let s3_config = s3_config_builder.build();
        self.client = Some(S3Client::from_conf(s3_config));

        log::info!(target: "s3_service", "init; storage_type={:?}; region={}",
            self.config.storage_type, self.config.region);

        Ok(())
    }

    /// Get default endpoint URL for known S3-compatible providers
    fn get_default_endpoint(&self) -> Option<String> {
        match self.config.storage_type {
            StorageType::Wasabi => {
                Some(format!("https://s3.{}.wasabisys.com", self.config.region))
            }
            StorageType::MinIO => None,
            StorageType::CloudflareR2 => None,
            StorageType::DigitalOcean => Some(format!(
                "https://{}.digitaloceanspaces.com",
                self.config.region
            )),
            StorageType::IDriveE2 => {
                Some(format!("https://s3.{}.idrivee2.com", self.config.region))
            }
            StorageType::Custom | StorageType::AwsS3 => None,
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
    fn generate_s3_key(&self, local_path: &str, import_to: &str) -> Result<String, String> {
        let (_, prefix) = self.parse_bucket_uri()?;

        let relative_path = if local_path.starts_with(import_to) {
            local_path.strip_prefix(import_to).unwrap_or(local_path)
        } else {
            local_path
        };

        let relative_path = relative_path.trim_start_matches('/');

        if prefix.is_empty() {
            Ok(relative_path.to_string())
        } else {
            Ok(format!("{}/{}", prefix, relative_path))
        }
    }

    /// Test connection to S3 by listing objects (limit 1)
    pub async fn test_connection(&self) -> Result<bool, String> {
        let client = self.client.as_ref().ok_or("S3 client not initialized")?;

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
    pub async fn upload_file(&self, local_path: &str, import_to: &str) -> Result<String, String> {
        let client = self.client.as_ref().ok_or("S3 client not initialized")?;

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
        let mut file = File::open(path)
            .await
            .map_err(|e| format!("Failed to open file: {}", e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .await
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

    /// Upload a thumbnail file to S3
    pub async fn upload_thumbnail(
        &self,
        thumbnail_path: &str,
        thumbnail_store: &str,
    ) -> Result<String, String> {
        let client = self.client.as_ref().ok_or("S3 client not initialized")?;

        let (bucket, prefix) = self.parse_bucket_uri()?;

        if !Path::new(thumbnail_path).exists() {
            return Err(format!("Thumbnail file not found: {}", thumbnail_path));
        }

        let relative_path = if thumbnail_path.starts_with(thumbnail_store) {
            thumbnail_path
                .strip_prefix(thumbnail_store)
                .unwrap_or(thumbnail_path)
        } else {
            thumbnail_path
        };
        let relative_path = relative_path.trim_start_matches('/');

        let s3_key = if prefix.is_empty() {
            format!("thumbnails/{}", relative_path)
        } else {
            format!("{}/thumbnails/{}", prefix, relative_path)
        };

        let path = Path::new(thumbnail_path);
        let mut file = File::open(path)
            .await
            .map_err(|e| format!("Failed to open thumbnail: {}", e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .await
            .map_err(|e| format!("Failed to read thumbnail: {}", e))?;

        let result = client
            .put_object()
            .bucket(&bucket)
            .key(&s3_key)
            .body(contents.into())
            .content_type("image/jpeg")
            .send()
            .await;

        match result {
            Ok(_) => {
                let s3_url = format!("s3://{}/{}", bucket, s3_key);
                log::debug!(target: "s3_service", "upload_thumbnail; status=success; path={}; s3_url={}",
                    thumbnail_path, s3_url);
                Ok(s3_url)
            }
            Err(e) => {
                log::error!(target: "s3_service", "upload_thumbnail; status=failed; path={}; error={}",
                    thumbnail_path, e);
                Err(format!("Thumbnail upload failed: {}", e))
            }
        }
    }

    /// Check if a file exists in S3
    #[allow(dead_code)]
    pub async fn file_exists(&self, s3_key: &str) -> Result<bool, String> {
        let client = self.client.as_ref().ok_or("S3 client not initialized")?;

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
                let service_error = e.into_service_error();
                if service_error.is_not_found() {
                    Ok(false)
                } else {
                    Err(format!(
                        "Failed to check file existence: {:?}",
                        service_error
                    ))
                }
            }
        }
    }

    /// Backup the SQLite database to S3
    pub async fn backup_database(&self, db_path: &str) -> Result<String, String> {
        let client = self.client.as_ref().ok_or("S3 client not initialized")?;

        let (bucket, prefix) = self.parse_bucket_uri()?;

        // Create a temporary backup using VACUUM INTO
        let backup_dir = std::env::temp_dir();
        let backup_path = backup_dir.join("photoclove_backup.db");
        let backup_path_str = backup_path.display().to_string();

        let conn = rusqlite::Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute(&format!("VACUUM INTO '{}'", backup_path_str), [])
            .map_err(|e| format!("Failed to backup database: {}", e))?;

        let mut file = File::open(&backup_path)
            .await
            .map_err(|e| format!("Failed to open backup file: {}", e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .await
            .map_err(|e| format!("Failed to read backup file: {}", e))?;

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
        storage_type_to_provider(&self.config.storage_type)
    }
}

/// Convert StorageType to provider name string
pub fn storage_type_to_provider(storage_type: &StorageType) -> &'static str {
    match storage_type {
        StorageType::AwsS3 => "aws_s3",
        StorageType::Wasabi => "wasabi",
        StorageType::MinIO => "minio",
        StorageType::CloudflareR2 => "cloudflare_r2",
        StorageType::DigitalOcean => "digitalocean",
        StorageType::IDriveE2 => "idrive_e2",
        StorageType::Custom => "custom",
    }
}

/// List available AWS profiles from ~/.aws/credentials
pub fn list_aws_profiles() -> Result<Vec<String>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;

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
        let config = S3BackupConfig {
            enabled: true,
            storage_type: StorageType::AwsS3,
            bucket_uri: "s3://my-bucket/photos/".to_string(),
            region: "ap-northeast-1".to_string(),
            auth: AuthConfig::IamRole,
            custom_endpoint: None,
            max_file_size_mb: None,
        };
        let service = S3Service::new(config);

        let (bucket, prefix) = service.parse_bucket_uri().unwrap();
        assert_eq!(bucket, "my-bucket");
        assert_eq!(prefix, "photos");
    }

    #[test]
    fn test_generate_s3_key() {
        let config = S3BackupConfig {
            enabled: true,
            storage_type: StorageType::AwsS3,
            bucket_uri: "s3://my-bucket/backup/".to_string(),
            region: "ap-northeast-1".to_string(),
            auth: AuthConfig::IamRole,
            custom_endpoint: None,
            max_file_size_mb: None,
        };
        let service = S3Service::new(config);

        let key = service
            .generate_s3_key(
                "/home/user/.photoclove/import/2024-01-15/abc123/photo.jpg",
                "/home/user/.photoclove/import",
            )
            .unwrap();

        assert_eq!(key, "backup/2024-01-15/abc123/photo.jpg");
    }
}
