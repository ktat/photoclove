//! S3 Backup Tauri commands
//!
//! Commands for managing S3 backup configuration and sync operations.

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::domain_service::s3_service;
use crate::entity::config::{S3AuthMethod, S3Config, S3StorageType};
use crate::AppState;

/// Response for S3 sync statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct SyncStats {
    pub total_photos: u32,
    pub synced: u32,
    pub not_synced: u32,
    pub last_sync_at: Option<String>,
}

/// Response for S3 sync enqueue operation
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SyncEnqueueResult {
    pub job_id: String,
    pub total_photos: u32,
    pub to_sync: u32,
    pub already_synced: u32,
}

/// List available AWS profiles from ~/.aws/credentials
#[tauri::command]
pub fn list_aws_profiles() -> Result<String, String> {
    let profiles = s3_service::list_aws_profiles()?;
    Ok(json!(profiles).to_string())
}

/// Test S3 connection with current configuration
#[tauri::command]
pub async fn test_s3_connection(state: State<'_, AppState>) -> Result<String, String> {
    let s3_config = state.config.s3.clone().ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        return Err("S3 backup is not enabled".to_string());
    }

    let mut service = s3_service::S3Service::new(s3_config);
    service.init().await?;

    let result = service.test_connection().await?;

    Ok(json!({
        "success": result,
        "message": if result { "Connection successful" } else { "Connection failed" }
    }).to_string())
}

/// Save S3 configuration
#[tauri::command]
pub fn save_s3_config(
    state: State<'_, AppState>,
    enabled: bool,
    storage_type: String,
    bucket_uri: String,
    region: String,
    auth_method: String,
    profile: Option<String>,
    custom_endpoint: Option<String>,
    auto_sync: bool,
    backup_db: bool,
    max_file_size_mb: Option<u32>,
) -> Result<String, String> {
    let storage_type_enum = match storage_type.as_str() {
        "aws_s3" => S3StorageType::AwsS3,
        "minio" => S3StorageType::MinIO,
        "wasabi" => S3StorageType::Wasabi,
        "cloudflare_r2" => S3StorageType::CloudflareR2,
        "digitalocean" => S3StorageType::DigitalOcean,
        "custom" => S3StorageType::Custom,
        _ => S3StorageType::AwsS3,
    };

    let auth_method_enum = match auth_method.as_str() {
        "aws_credentials" => S3AuthMethod::AwsCredentials,
        "iam_role" => S3AuthMethod::IAMRole,
        "access_key" => S3AuthMethod::AccessKey,
        _ => S3AuthMethod::AwsCredentials,
    };

    // Preserve existing last_sync_at if present
    let last_sync_at = state.config.s3.as_ref().and_then(|s| s.last_sync_at.clone());

    let s3_config = S3Config {
        enabled,
        storage_type: storage_type_enum,
        bucket_uri,
        region,
        auth_method: auth_method_enum,
        profile,
        custom_endpoint,
        auto_sync,
        backup_db,
        max_file_size_mb,
        last_sync_at,
    };

    // Clone config, modify it, and save to file
    let mut config = state.config.clone();
    config.s3 = Some(s3_config);

    if !config.save() {
        return Err("Failed to save configuration".to_string());
    }

    log::info!(target: "s3_commands", "save_s3_config; enabled={}; storage_type={}",
        enabled, storage_type);

    Ok(json!({"success": true}).to_string())
}

/// Get current S3 configuration
#[tauri::command]
pub fn get_s3_config(state: State<'_, AppState>) -> Result<String, String> {
    let s3_config = match &state.config.s3 {
        Some(s3) => json!({
            "enabled": s3.enabled,
            "storage_type": match s3.storage_type {
                S3StorageType::AwsS3 => "aws_s3",
                S3StorageType::MinIO => "minio",
                S3StorageType::Wasabi => "wasabi",
                S3StorageType::CloudflareR2 => "cloudflare_r2",
                S3StorageType::DigitalOcean => "digitalocean",
                S3StorageType::Custom => "custom",
            },
            "bucket_uri": s3.bucket_uri,
            "region": s3.region,
            "auth_method": match s3.auth_method {
                S3AuthMethod::AwsCredentials => "aws_credentials",
                S3AuthMethod::IAMRole => "iam_role",
                S3AuthMethod::AccessKey => "access_key",
            },
            "profile": s3.profile,
            "custom_endpoint": s3.custom_endpoint,
            "auto_sync": s3.auto_sync,
            "backup_db": s3.backup_db,
            "max_file_size_mb": s3.max_file_size_mb,
            "last_sync_at": s3.last_sync_at,
        }),
        None => json!({
            "enabled": false,
            "storage_type": "aws_s3",
            "bucket_uri": "",
            "region": "ap-northeast-1",
            "auth_method": "aws_credentials",
            "profile": null,
            "custom_endpoint": null,
            "auto_sync": false,
            "backup_db": true,
            "max_file_size_mb": null,
            "last_sync_at": null,
        }),
    };

    Ok(s3_config.to_string())
}

/// Get S3 sync statistics
#[tauri::command]
pub fn get_s3_sync_stats(state: State<'_, AppState>) -> Result<String, String> {
    let s3_config = match &state.config.s3 {
        Some(s3) if s3.enabled => s3,
        _ => {
            return Ok(json!({
                "total_photos": 0,
                "synced": 0,
                "not_synced": 0,
                "last_sync_at": null
            }).to_string());
        }
    };

    // Get the provider name for this configuration
    let provider = match s3_config.storage_type {
        S3StorageType::AwsS3 => "aws_s3",
        S3StorageType::Wasabi => "wasabi",
        S3StorageType::MinIO => "minio",
        S3StorageType::CloudflareR2 => "cloudflare_r2",
        S3StorageType::DigitalOcean => "digitalocean",
        S3StorageType::Custom => "custom",
    };

    // Query counts from database
    let conn = state.meta_db.get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Total photos (not deleted)
    let total_photos: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_metadata WHERE delete_flg = 0 OR delete_flg IS NULL",
            [],
            |row: &rusqlite::Row| row.get(0),
        )
        .unwrap_or(0);

    // Synced photos (storage_sync contains the provider)
    let synced: u32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM photo_metadata
                 WHERE (delete_flg = 0 OR delete_flg IS NULL)
                   AND storage_sync LIKE '%\"{}\":%'",
                provider
            ),
            [],
            |row: &rusqlite::Row| row.get(0),
        )
        .unwrap_or(0);

    let not_synced = total_photos - synced;

    let stats = SyncStats {
        total_photos,
        synced,
        not_synced,
        last_sync_at: s3_config.last_sync_at.clone(),
    };

    Ok(serde_json::to_string(&stats).unwrap())
}

/// Enqueue S3 incremental sync (photos since last_sync_at)
#[tauri::command]
pub async fn enqueue_s3_incremental_sync(
    _state: State<'_, AppState>,
) -> Result<String, String> {
    // TODO: Implement in Phase 4
    Err("S3 incremental sync is not yet implemented".to_string())
}

/// Enqueue S3 full sync (all unsynced photos)
#[tauri::command]
pub async fn enqueue_s3_full_sync(
    _state: State<'_, AppState>,
) -> Result<String, String> {
    // TODO: Implement in Phase 4
    Err("S3 full sync is not yet implemented".to_string())
}

/// Enqueue S3 sync for a specific date
#[tauri::command]
pub async fn enqueue_s3_sync_by_date(
    _state: State<'_, AppState>,
    _date: String,
) -> Result<String, String> {
    // TODO: Implement in Phase 4
    Err("S3 date sync is not yet implemented".to_string())
}
