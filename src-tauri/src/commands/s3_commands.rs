//! S3 Backup Tauri commands
//!
//! Commands for managing S3 backup configuration and sync operations.

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::run_blocking;
use crate::domain_service::s3_service;
use crate::domain_service::token_storage_service::TokenStorageService;
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
    let s3_config = state
        .config
        .s3
        .clone()
        .ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        return Err("S3 backup is not enabled".to_string());
    }

    let service = s3_service::create_service(&s3_config).await?;

    let result = service.test_connection().await?;

    Ok(json!({
        "success": result,
        "message": if result { "Connection successful" } else { "Connection failed" }
    })
    .to_string())
}

/// Save S3 configuration
#[tauri::command]
#[allow(clippy::too_many_arguments)]
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
    backup_thumbnails: bool,
    max_file_size_mb: Option<u32>,
) -> Result<String, String> {
    let storage_type_enum = match storage_type.as_str() {
        "aws_s3" => S3StorageType::AwsS3,
        "minio" => S3StorageType::MinIO,
        "wasabi" => S3StorageType::Wasabi,
        "cloudflare_r2" => S3StorageType::CloudflareR2,
        "digitalocean" => S3StorageType::DigitalOcean,
        "idrive_e2" => S3StorageType::IDriveE2,
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
    let last_sync_at = state
        .config
        .s3
        .as_ref()
        .and_then(|s| s.last_sync_at.clone());

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
        backup_thumbnails,
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
                S3StorageType::IDriveE2 => "idrive_e2",
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
            "backup_thumbnails": s3.backup_thumbnails,
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
            "backup_thumbnails": true,
            "max_file_size_mb": null,
            "last_sync_at": null,
        }),
    };

    Ok(s3_config.to_string())
}

/// Get S3 sync statistics
#[tauri::command]
pub async fn get_s3_sync_stats(state: State<'_, AppState>) -> Result<String, String> {
    let meta_db = state.meta_db.clone();
    let config = state.config.clone();
    run_blocking(move || get_s3_sync_stats_blocking(&meta_db, &config)).await
}

fn get_s3_sync_stats_blocking(
    meta_db: &crate::repository::MetaDB,
    config: &crate::entity::config::Config,
) -> Result<String, String> {
    let s3_config = match &config.s3 {
        Some(s3) if s3.enabled => s3,
        _ => {
            return Ok(json!({
                "total_photos": 0,
                "synced": 0,
                "not_synced": 0,
                "last_sync_at": null
            })
            .to_string());
        }
    };

    // Get the provider name for this configuration
    let provider = match s3_config.storage_type {
        S3StorageType::AwsS3 => "aws_s3",
        S3StorageType::Wasabi => "wasabi",
        S3StorageType::MinIO => "minio",
        S3StorageType::CloudflareR2 => "cloudflare_r2",
        S3StorageType::DigitalOcean => "digitalocean",
        S3StorageType::IDriveE2 => "idrive_e2",
        S3StorageType::Custom => "custom",
    };

    // Query counts from database
    let conn = meta_db
        .get_connection()
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
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = state.meta_db.clone();
    let config = state.config.clone();
    run_blocking(move || enqueue_s3_incremental_sync_blocking(&meta_db, &config, window)).await
}

fn enqueue_s3_incremental_sync_blocking(
    meta_db: &crate::repository::MetaDB,
    config: &crate::entity::config::Config,
    window: tauri::Window,
) -> Result<String, String> {
    let s3_config = config.s3.clone().ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        return Err("S3 backup is not enabled".to_string());
    }

    let provider = get_provider_name(&s3_config.storage_type);
    let last_sync_at = s3_config
        .last_sync_at
        .clone()
        .ok_or("No previous sync found. Use Full Sync instead.")?;

    // Get photos imported after last_sync_at that are not synced
    let conn = meta_db
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT file_path FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL)
           AND created_at > ?1
           AND (storage_sync IS NULL OR storage_sync NOT LIKE '%\"{}\":%')",
            provider
        ))
        .map_err(|e| format!("Query error: {}", e))?;

    let photo_paths: Vec<String> = stmt
        .query_map([&last_sync_at], |row| row.get(0))
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    if photo_paths.is_empty() {
        return Ok(r#"{"result": "no_photos_to_sync", "count": 0}"#.to_string());
    }

    create_s3_sync_job(&window, meta_db, config.copy_parallel, photo_paths)
}

/// Enqueue S3 full sync (all unsynced photos)
#[tauri::command]
pub async fn enqueue_s3_full_sync(
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = state.meta_db.clone();
    let config = state.config.clone();
    run_blocking(move || enqueue_s3_full_sync_blocking(&meta_db, &config, window)).await
}

fn enqueue_s3_full_sync_blocking(
    meta_db: &crate::repository::MetaDB,
    config: &crate::entity::config::Config,
    window: tauri::Window,
) -> Result<String, String> {
    let s3_config = config.s3.clone().ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        return Err("S3 backup is not enabled".to_string());
    }

    let provider = get_provider_name(&s3_config.storage_type);

    // Get all photos that are not synced to this provider
    let conn = meta_db
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT file_path FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL)
           AND (storage_sync IS NULL OR storage_sync NOT LIKE '%\"{}\":%')",
            provider
        ))
        .map_err(|e| format!("Query error: {}", e))?;

    let photo_paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    if photo_paths.is_empty() {
        return Ok(r#"{"result": "no_photos_to_sync", "count": 0}"#.to_string());
    }

    create_s3_sync_job(&window, meta_db, config.copy_parallel, photo_paths)
}

/// Enqueue S3 sync for a specific date
#[tauri::command]
pub async fn enqueue_s3_sync_by_date(
    date: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let meta_db = state.meta_db.clone();
    let config = state.config.clone();
    run_blocking(move || enqueue_s3_sync_by_date_blocking(&meta_db, &config, date, window)).await
}

fn enqueue_s3_sync_by_date_blocking(
    meta_db: &crate::repository::MetaDB,
    config: &crate::entity::config::Config,
    date: String,
    window: tauri::Window,
) -> Result<String, String> {
    log::info!(target: "s3_commands", "enqueue_s3_sync_by_date; date={}", date);

    let s3_config = config.s3.clone().ok_or("S3 backup is not configured")?;

    if !s3_config.enabled {
        log::warn!(target: "s3_commands", "enqueue_s3_sync_by_date; s3_not_enabled");
        return Err("S3 backup is not enabled".to_string());
    }

    let provider = get_provider_name(&s3_config.storage_type);

    // Get photos for the specified date that are not synced
    let conn = meta_db
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Parse date using Date value object (supports both YYYY-MM-DD and YYYY/MM/DD formats)
    use crate::value::date::Date;
    let date_obj = Date::try_from_string(&date.to_string(), Some("/"))
        .or_else(|_| Date::try_from_string(&date.to_string(), Some("-")))
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Use range query for photo_date (format: "YYYY-MM-DD HH:MM:SS")
    // Range: "YYYY-MM-DD 00:00:00" <= photo_date < "YYYY-MM-DD+1 00:00:00"
    let date_str = date_obj.to_string();
    let next_date_str = date_obj
        .next_day()
        .map(|d| d.to_string())
        .unwrap_or_else(|| "2099-12-31".to_string());
    let next_date = format!("{} 00:00:00", next_date_str);
    let date_start = format!("{} 00:00:00", date_str);

    let mut stmt = conn
        .prepare(&format!(
            "SELECT path FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL)
           AND photo_date >= ?1 AND photo_date < ?2
           AND (storage_sync IS NULL OR storage_sync NOT LIKE '%\"{}\":%')",
            provider
        ))
        .map_err(|e| format!("Query error: {}", e))?;

    let photo_paths: Vec<String> = stmt
        .query_map([&date_start, &next_date], |row| row.get(0))
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    log::info!(target: "s3_commands", "enqueue_s3_sync_by_date; photos_found={}; provider={}", photo_paths.len(), provider);

    if photo_paths.is_empty() {
        log::info!(target: "s3_commands", "enqueue_s3_sync_by_date; no_photos_to_sync");
        return Ok(r#"{"result": "no_photos_to_sync", "count": 0}"#.to_string());
    }

    create_s3_sync_job(&window, meta_db, config.copy_parallel, photo_paths)
}

/// Helper function to get provider name string from storage type
fn get_provider_name(storage_type: &S3StorageType) -> &'static str {
    match storage_type {
        S3StorageType::AwsS3 => "aws_s3",
        S3StorageType::MinIO => "minio",
        S3StorageType::Wasabi => "wasabi",
        S3StorageType::CloudflareR2 => "cloudflare_r2",
        S3StorageType::DigitalOcean => "digitalocean",
        S3StorageType::IDriveE2 => "idrive_e2",
        S3StorageType::Custom => "custom",
    }
}

/// Helper function to create an S3 sync job
fn create_s3_sync_job(
    window: &tauri::Window,
    meta_db: &crate::repository::MetaDB,
    copy_parallel: usize,
    photo_paths: Vec<String>,
) -> Result<String, String> {
    use crate::domain_service::job_queue::executor::process_new_jobs;
    use crate::entity::job_queue::{Job, JobType, JobUnit, QueuedJob};

    use std::sync::Arc;
    use tauri::Manager;

    let photo_count = photo_paths.len();

    // Create job unit
    let job_types = vec!["s3_sync".to_string()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    meta_db
        .create_job_unit(&job_unit)
        .map_err(|e| format!("Failed to create job unit: {}", e))?;

    // Create S3 sync job
    let job = Job::new(job_unit_id.clone(), JobType::S3Sync, photo_paths);
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Add job to queue
    let job_id = meta_db
        .create_job(&queued_job)
        .map_err(|e| format!("Failed to create job: {}", e))?;

    log::info!(target: "s3_sync", "sync_job_created; job_id={}; job_unit_id={}; photos={}",
        job_id, job_unit_id, photo_count);

    // Trigger job processing
    let db = Arc::new(meta_db.clone());
    let app_handle = window.app_handle().clone();
    process_new_jobs(db, copy_parallel, app_handle);

    Ok(format!(
        r#"{{"result": "started", "job_unit_id": "{}", "job_id": {}, "to_sync": {}}}"#,
        job_unit_id, job_id, photo_count
    ))
}

// ========== S3 Credentials Management (Provider-specific) ==========

/// Store S3 Access Key ID and Secret Access Key securely in system keyring for a specific provider
#[tauri::command]
pub fn store_s3_credentials(
    provider: String,
    access_key_id: String,
    secret_access_key: String,
) -> Result<String, String> {
    TokenStorageService::store_s3_credentials(&provider, &access_key_id, &secret_access_key)?;
    log::info!(target: "s3_commands", "s3_credentials_stored; provider={}", provider);
    Ok(r#"{"result": "success"}"#.to_string())
}

/// Check if S3 credentials are stored in keyring for a specific provider
#[tauri::command]
pub fn has_s3_credentials(provider: String) -> Result<String, String> {
    let has_credentials = TokenStorageService::has_s3_credentials(&provider);
    Ok(json!({ "has_credentials": has_credentials }).to_string())
}

/// Delete stored S3 credentials from keyring for a specific provider
#[tauri::command]
pub fn delete_s3_credentials(provider: String) -> Result<String, String> {
    TokenStorageService::delete_s3_credentials(&provider)?;
    log::info!(target: "s3_commands", "s3_credentials_deleted; provider={}", provider);
    Ok(r#"{"result": "success"}"#.to_string())
}

/// Get masked preview of stored credentials for a specific provider (for UI display only)
#[tauri::command]
pub fn get_s3_credentials_preview(provider: String) -> Result<String, String> {
    match TokenStorageService::get_s3_credentials(&provider) {
        Ok((access_key_id, _secret_access_key)) => {
            // Only show preview of Access Key ID (not the secret)
            let preview = if access_key_id.len() > 8 {
                format!(
                    "{}...{}",
                    &access_key_id[..4],
                    &access_key_id[access_key_id.len() - 4..]
                )
            } else {
                "****".to_string()
            };
            Ok(json!({
                "has_credentials": true,
                "access_key_preview": preview
            })
            .to_string())
        }
        Err(_) => Ok(json!({
            "has_credentials": false,
            "access_key_preview": null
        })
        .to_string()),
    }
}
