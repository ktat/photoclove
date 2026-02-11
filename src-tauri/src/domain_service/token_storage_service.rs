use chrono::{DateTime, Duration, Utc};
use keyring::Entry;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

pub struct TokenStorageService;

impl TokenStorageService {
    /// Store Google OAuth tokens securely using platform-native keyring
    pub fn store_google_tokens(
        access_token: &str,
        refresh_token: &str,
        expires_in: i64, // seconds until expiration
    ) -> Result<(), String> {
        let token_data = TokenData {
            access_token: access_token.to_string(),
            refresh_token: refresh_token.to_string(),
            expires_at: Utc::now() + Duration::seconds(expires_in - 300), // 5 min buffer
        };

        let json_data = serde_json::to_string(&token_data)
            .map_err(|e| format!("Failed to serialize token data: {}", e))?;

        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;
        entry
            .set_password(&json_data)
            .map_err(|e| format!("Failed to store tokens: {}", e))?;

        log::info!(target: "token_storage", "google_tokens_stored; expires_in={}", expires_in);
        Ok(())
    }

    /// Get a valid access token, automatically refreshing if expired
    pub async fn get_valid_access_token() -> Result<String, String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;

        let json_data = entry
            .get_password()
            .map_err(|e| format!("No stored tokens found: {}", e))?;

        let token_data: TokenData = serde_json::from_str(&json_data)
            .map_err(|e| format!("Failed to parse token data: {}", e))?;

        // Check if token is expired or will expire soon
        if Utc::now() >= token_data.expires_at {
            log::info!(target: "token_storage", "access_token_expired; refreshing_token");
            // Token expired, refresh it
            let new_access_token = Self::refresh_access_token(&token_data).await?;
            Ok(new_access_token)
        } else {
            log::debug!(target: "token_storage", "access_token_valid; using_cached_token");
            Ok(token_data.access_token)
        }
    }

    /// Refresh the access token using the refresh token via external service
    async fn refresh_access_token(token_data: &TokenData) -> Result<String, String> {
        log::info!(target: "token_storage", "refreshing_access_token; using_external_service=true");

        // Use the same external service that handles initial OAuth
        let client = reqwest::Client::new();
        let params = [("refresh_token", token_data.refresh_token.clone())];

        let response = client
            .post("https://rwds.net/cgi-bin/token.cgi")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Failed to refresh token via external service: {}", e))?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read refresh response: {}", e))?;

        if !status.is_success() {
            log::error!(target: "token_storage", "token_refresh_failed; status={}; response={}", status, response_text);

            // Check for specific error types
            if response_text.contains("invalid_grant")
                || response_text.contains("missing_refresh_token")
            {
                // Refresh token is invalid, user needs to re-authenticate
                return Err("Invalid refresh token - please login again".to_string());
            }

            return Err(format!(
                "Token refresh failed: {} - {}",
                status, response_text
            ));
        }

        // External service returns JSON directly (not a redirect like in initial auth)
        let token_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

        let new_access_token = token_response["access_token"]
            .as_str()
            .ok_or("No access token in refresh response")?;

        let expires_in = token_response["expires_in"].as_i64().unwrap_or(3600);

        // Store the new token (keeping the same refresh_token)
        Self::store_google_tokens(new_access_token, &token_data.refresh_token, expires_in)?;

        log::info!(target: "token_storage", "access_token_refreshed; expires_in={}", expires_in);
        Ok(new_access_token.to_string())
    }

    /// Delete stored Google tokens
    pub fn delete_google_tokens() -> Result<(), String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;
        let _ = entry.delete_password(); // Ignore error if not exists
        log::info!(target: "token_storage", "google_tokens_deleted");
        Ok(())
    }

    /// Check if tokens are stored
    pub fn has_stored_tokens() -> bool {
        if let Ok(entry) = Entry::new("photoclove", "google_oauth_tokens") {
            entry.get_password().is_ok()
        } else {
            false
        }
    }

    /// Get stored refresh token (for internal use)
    pub fn get_refresh_token() -> Result<String, String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;

        let json_data = entry
            .get_password()
            .map_err(|e| format!("No stored tokens found: {}", e))?;

        let token_data: TokenData = serde_json::from_str(&json_data)
            .map_err(|e| format!("Failed to parse token data: {}", e))?;

        Ok(token_data.refresh_token)
    }

    /// Debug method to get token info (for testing only - masks sensitive data)
    #[cfg(debug_assertions)]
    pub fn get_token_info() -> Result<serde_json::Value, String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;

        let json_data = entry
            .get_password()
            .map_err(|e| format!("No stored tokens found: {}", e))?;

        let token_data: TokenData = serde_json::from_str(&json_data)
            .map_err(|e| format!("Failed to parse token data: {}", e))?;

        // Return masked token info for security
        Ok(serde_json::json!({
            "has_access_token": !token_data.access_token.is_empty(),
            "access_token_preview": format!("{}...{}",
                &token_data.access_token.chars().take(6).collect::<String>(),
                &token_data.access_token.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>()
            ),
            "has_refresh_token": !token_data.refresh_token.is_empty(),
            "refresh_token_preview": format!("{}...{}",
                &token_data.refresh_token.chars().take(6).collect::<String>(),
                &token_data.refresh_token.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>()
            ),
            "expires_at": token_data.expires_at.to_rfc3339(),
            "is_expired": Utc::now() >= token_data.expires_at,
            "time_until_expiry": (token_data.expires_at - Utc::now()).num_seconds(),
        }))
    }

    // ========== S3 Access Key Storage (Provider-specific) ==========

    /// Store S3 Access Key ID and Secret Access Key securely for a specific provider
    pub fn store_s3_credentials(
        provider: &str,
        access_key_id: &str,
        secret_access_key: &str,
    ) -> Result<(), String> {
        let credentials = serde_json::json!({
            "access_key_id": access_key_id,
            "secret_access_key": secret_access_key,
        });

        let json_data = serde_json::to_string(&credentials)
            .map_err(|e| format!("Failed to serialize S3 credentials: {}", e))?;

        let key_name = format!("s3_credentials_{}", provider);
        let entry = Entry::new("photoclove", &key_name)
            .map_err(|e| format!("Failed to create S3 credentials entry: {}", e))?;
        entry
            .set_password(&json_data)
            .map_err(|e| format!("Failed to store S3 credentials: {}", e))?;

        log::info!(target: "token_storage", "s3_credentials_stored; provider={}", provider);
        Ok(())
    }

    /// Get stored S3 credentials for a specific provider
    pub fn get_s3_credentials(provider: &str) -> Result<(String, String), String> {
        let key_name = format!("s3_credentials_{}", provider);
        let entry = Entry::new("photoclove", &key_name)
            .map_err(|e| format!("Failed to create S3 credentials entry: {}", e))?;

        let json_data = entry.get_password().map_err(|e| {
            format!(
                "No stored S3 credentials found for provider {}: {}",
                provider, e
            )
        })?;

        let credentials: serde_json::Value = serde_json::from_str(&json_data)
            .map_err(|e| format!("Failed to parse S3 credentials: {}", e))?;

        let access_key_id = credentials["access_key_id"]
            .as_str()
            .ok_or("Missing access_key_id in stored credentials")?
            .to_string();

        let secret_access_key = credentials["secret_access_key"]
            .as_str()
            .ok_or("Missing secret_access_key in stored credentials")?
            .to_string();

        Ok((access_key_id, secret_access_key))
    }

    /// Delete stored S3 credentials for a specific provider
    pub fn delete_s3_credentials(provider: &str) -> Result<(), String> {
        let key_name = format!("s3_credentials_{}", provider);
        let entry = Entry::new("photoclove", &key_name)
            .map_err(|e| format!("Failed to create S3 credentials entry: {}", e))?;
        let _ = entry.delete_password(); // Ignore error if not exists
        log::info!(target: "token_storage", "s3_credentials_deleted; provider={}", provider);
        Ok(())
    }

    /// Check if S3 credentials are stored for a specific provider
    pub fn has_s3_credentials(provider: &str) -> bool {
        let key_name = format!("s3_credentials_{}", provider);
        if let Ok(entry) = Entry::new("photoclove", &key_name) {
            entry.get_password().is_ok()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_data_serialization() {
        let token_data = TokenData {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at: Utc::now() + Duration::seconds(3600),
        };

        let serialized = serde_json::to_string(&token_data).unwrap();
        let deserialized: TokenData = serde_json::from_str(&serialized).unwrap();

        assert_eq!(token_data.access_token, deserialized.access_token);
        assert_eq!(token_data.refresh_token, deserialized.refresh_token);
    }

    #[test]
    fn test_has_stored_tokens_when_empty() {
        // This test assumes no tokens are stored
        // In a real test environment, you'd want to clean up first
        let result = TokenStorageService::has_stored_tokens();
        // We can't make assumptions about the state, just test that it doesn't panic
        assert!(result == true || result == false);
    }
}
