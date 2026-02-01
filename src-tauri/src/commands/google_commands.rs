use crate::domain_service::achievements;
use crate::AppState;
use tauri::Manager;

/// Google OAuth authentication status
#[derive(serde::Serialize)]
pub struct GoogleAuthStatus {
    pub authenticated: bool,
    pub user_email: Option<String>,
}

/// Upload photos to Google Photos
///
/// Submits selected photos to the job queue for upload to Google Photos.
/// The upload happens asynchronously via the job queue system.
///
/// # Arguments
/// * `_window` - Tauri window handle (unused but may be needed for events)
/// * `state` - Application state containing job queue and logging service
/// * `selected_files` - Vector of file paths to upload
///
/// # Returns
/// * `Ok(Vec<String>)` - Vector containing the job unit ID
/// * `Err(String)` - Error message if authentication fails or job submission fails
#[tauri::command]
pub async fn upload_to_google_photos(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    selected_files: Vec<String>,
) -> Result<Vec<String>, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(
        target: "google_photos",
        "upload_request; correlation_id={}; files_count={}",
        correlation_id,
        selected_files.len()
    );

    // Check if user is authenticated
    if !crate::domain_service::token_storage_service::TokenStorageService::has_stored_tokens() {
        log::warn!(
            target: "google_photos",
            "upload_failed; correlation_id={}; reason=not_authenticated",
            correlation_id
        );
        return Err("User is not authenticated with Google Photos".to_string());
    }

    // Submit upload jobs to the job queue
    let job_unit_id = state
        .job_queue_manager
        .lock()
        .unwrap()
        .submit_google_photos_upload_jobs(selected_files, _window.app_handle().clone())
        .map_err(|e| {
            log::error!(
                target: "google_photos",
                "upload_submission_failed; correlation_id={}; error={}",
                correlation_id,
                e
            );
            format!("Failed to submit upload jobs: {}", e)
        })?;

    log::info!(
        target: "google_photos",
        "upload_jobs_submitted; correlation_id={}; job_unit_id={}",
        correlation_id,
        job_unit_id
    );

    // Check first_cloud_upload achievement
    let _ = achievements::check_and_emit_achievement(
        _window.app_handle(),
        &state.config.import_to,
        "first_cloud_upload",
    );

    Ok(vec![job_unit_id])
}

/// Store Google OAuth tokens securely
///
/// Stores the access token, refresh token, and expiration time in the platform's
/// secure credential storage (keyring).
///
/// # Arguments
/// * `access_token` - OAuth access token
/// * `refresh_token` - OAuth refresh token for obtaining new access tokens
/// * `expires_in` - Number of seconds until the access token expires
/// * `state` - Application state containing the logging service
///
/// # Returns
/// * `Ok(())` - Tokens stored successfully
/// * `Err(String)` - Error message if storage fails
#[tauri::command]
pub async fn store_google_tokens(
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "store_tokens_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::store_google_tokens(
        &access_token,
        &refresh_token,
        expires_in,
    ) {
        Ok(()) => {
            log::info!(target: "token_storage", "store_tokens_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "token_storage", "store_tokens_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Check if user is authenticated with Google
///
/// Returns whether valid Google OAuth tokens are stored in the credential storage.
///
/// # Arguments
/// * `state` - Application state containing the logging service
///
/// # Returns
/// * `Ok(bool)` - true if authenticated, false otherwise
/// * `Err(String)` - Error message (should not occur in normal operation)
#[tauri::command]
pub async fn is_google_authenticated(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    let is_authenticated =
        crate::domain_service::token_storage_service::TokenStorageService::has_stored_tokens();

    log::info!(
        target: "token_storage",
        "check_authentication; correlation_id={}; authenticated={}",
        correlation_id,
        is_authenticated
    );

    Ok(is_authenticated)
}

/// Get detailed Google authentication status
///
/// Returns authentication status along with optional user information.
/// Currently only returns authentication status; user email may be added in future.
///
/// # Arguments
/// * `state` - Application state containing the logging service
///
/// # Returns
/// * `Ok(GoogleAuthStatus)` - Authentication status structure
/// * `Err(String)` - Error message (should not occur in normal operation)
#[tauri::command]
pub async fn get_google_auth_status(
    state: tauri::State<'_, AppState>,
) -> Result<GoogleAuthStatus, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    let authenticated =
        crate::domain_service::token_storage_service::TokenStorageService::has_stored_tokens();

    log::info!(
        target: "token_storage",
        "get_auth_status; correlation_id={}; authenticated={}",
        correlation_id,
        authenticated
    );

    // TODO: Optionally fetch user email from Google UserInfo API if needed
    Ok(GoogleAuthStatus {
        authenticated,
        user_email: None,
    })
}

/// Log out from Google Photos
///
/// Deletes stored Google OAuth tokens from the platform's credential storage,
/// effectively logging the user out.
///
/// # Arguments
/// * `state` - Application state containing the logging service
///
/// # Returns
/// * `Ok(())` - Logout successful
/// * `Err(String)` - Error message if deletion fails
#[tauri::command]
pub async fn logout_google(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "logout_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::delete_google_tokens()
    {
        Ok(()) => {
            log::info!(target: "token_storage", "logout_success; correlation_id={}", correlation_id);
            Ok(())
        }
        Err(e) => {
            log::error!(target: "token_storage", "logout_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}

/// Get Google token information (Debug only)
///
/// Returns detailed token information for debugging purposes.
/// Only available in debug builds.
///
/// # Arguments
/// * `state` - Application state containing the logging service
///
/// # Returns
/// * `Ok(serde_json::Value)` - Token information as JSON
/// * `Err(String)` - Error message if retrieval fails
#[tauri::command]
#[cfg(debug_assertions)]
pub async fn get_google_token_info(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let logging_service = &state.logging_service;
    let correlation_id = logging_service.generate_correlation_id();

    log::info!(target: "token_storage", "get_token_info_request; correlation_id={}", correlation_id);

    match crate::domain_service::token_storage_service::TokenStorageService::get_token_info() {
        Ok(info) => {
            log::info!(target: "token_storage", "get_token_info_success; correlation_id={}", correlation_id);
            Ok(info)
        }
        Err(e) => {
            log::error!(target: "token_storage", "get_token_info_error; correlation_id={}; error={}", correlation_id, e);
            Err(e)
        }
    }
}
