# Implement Secure Google OAuth Token Storage with Auto-Refresh

## Overview
Currently, Google OAuth access tokens and refresh tokens are passed around in memory but not persisted securely. We need to implement secure storage to:
- Avoid re-authentication on every app restart
- Protect sensitive tokens from unauthorized access
- Enable automatic token refresh when tokens expire
- Seamlessly handle token expiration during upload jobs

## Implementation Plan

### 1. Use Platform-Native Secure Storage
Implement token storage using the `keyring` crate which provides:
- **macOS**: Keychain Services (hardware-backed encryption on Apple Silicon)
- **Windows**: Windows Credential Manager (DPAPI protection)
- **Linux**: Secret Service API (GNOME Keyring/KWallet)

### 2. Token Storage Service
Create a new service in `src-tauri/src/domain_service/token_storage_service.rs`:

```rust
use keyring::Entry;
use chrono::{DateTime, Utc, Duration};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct TokenData {
    access_token: String,
    refresh_token: String,
    expires_at: DateTime<Utc>,
}

pub struct TokenStorageService;

impl TokenStorageService {
    pub fn store_google_tokens(
        access_token: &str, 
        refresh_token: &str,
        expires_in: i64 // seconds until expiration
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
        entry.set_password(&json_data)
            .map_err(|e| format!("Failed to store tokens: {}", e))?;
        
        Ok(())
    }
    
    pub fn get_valid_access_token() -> Result<String, String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;
        
        let json_data = entry.get_password()
            .map_err(|e| format!("No stored tokens found: {}", e))?;
        
        let token_data: TokenData = serde_json::from_str(&json_data)
            .map_err(|e| format!("Failed to parse token data: {}", e))?;
        
        // Check if token is expired
        if Utc::now() >= token_data.expires_at {
            // Token expired, refresh it
            let new_access_token = Self::refresh_access_token(&token_data.refresh_token)?;
            Ok(new_access_token)
        } else {
            Ok(token_data.access_token)
        }
    }
    
    fn refresh_access_token(refresh_token: &str) -> Result<String, String> {
        // Call Google OAuth2 token refresh endpoint
        let client = reqwest::blocking::Client::new();
        let params = [
            ("client_id", "YOUR_CLIENT_ID"),
            ("client_secret", "YOUR_CLIENT_SECRET"),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ];
        
        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .map_err(|e| format!("Failed to refresh token: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Token refresh failed: {}", response.status()));
        }
        
        let token_response: serde_json::Value = response.json()
            .map_err(|e| format!("Failed to parse refresh response: {}", e))?;
        
        let new_access_token = token_response["access_token"]
            .as_str()
            .ok_or("No access token in refresh response")?;
        
        let expires_in = token_response["expires_in"]
            .as_i64()
            .unwrap_or(3600);
        
        // Store the new token
        Self::store_google_tokens(new_access_token, refresh_token, expires_in)?;
        
        Ok(new_access_token.to_string())
    }
    
    pub fn delete_google_tokens() -> Result<(), String> {
        let entry = Entry::new("photoclove", "google_oauth_tokens")
            .map_err(|e| format!("Failed to create token entry: {}", e))?;
        let _ = entry.delete_password(); // Ignore error if not exists
        Ok(())
    }
    
    pub fn has_stored_tokens() -> bool {
        if let Ok(entry) = Entry::new("photoclove", "google_oauth_tokens") {
            entry.get_password().is_ok()
        } else {
            false
        }
    }
}
```

### 3. Update Google Photos Upload Flow

#### a. Update `upload_to_google_photos` command in `lib.rs`:
```rust
#[tauri::command]
pub async fn upload_to_google_photos(
    state: tauri::State<'_, AppState>,
    selected_files: Vec<String>,
    // Remove access_token and refresh_token parameters
) -> Result<Vec<String>, String> {
    // Check if user is authenticated
    if !TokenStorageService::has_stored_tokens() {
        return Err("Not authenticated with Google Photos. Please login first.".to_string());
    }
    
    // Create job without tokens (they'll be retrieved when job executes)
    job_queue_service.create_google_photos_upload_job(
        selected_files,
        app_handle.clone(),
    ).await
}
```

#### b. Update `GooglePhotosUploadJob` struct:
```rust
// Remove access_token and refresh_token fields from the struct
pub struct GooglePhotosUploadJob {
    pub photo_paths: Vec<String>,
    pub album_id: Option<String>,
    pub chunk_index: usize,
    pub total_chunks: usize,
}
```

#### c. Update job execution in `job_queue_service.rs`:
```rust
async fn execute_google_photos_upload(job_data: &str) -> Result<(), String> {
    let job: GooglePhotosUploadJob = serde_json::from_str(job_data)
        .map_err(|e| format!("Failed to parse job data: {}", e))?;
    
    // Get fresh access token (will auto-refresh if needed)
    let access_token = TokenStorageService::get_valid_access_token()
        .map_err(|e| format!("Authentication failed: {}", e))?;
    
    // Use the access_token for the upload
    let google_photos = GooglePhotos::new(
        access_token,
        // refresh_token not needed here anymore
        db_path
    );
    
    // Continue with upload logic...
}
```

### 4. Update Frontend Integration

#### a. After OAuth Login Success:
```javascript
// In the OAuth callback handler
const { access_token, refresh_token, expires_in } = await getTokensFromGoogle();

// Store tokens securely in backend
await invoke('store_google_tokens', {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in
});
```

#### b. Check Authentication Status:
```javascript
// Add a new command to check if user is authenticated
const isAuthenticated = await invoke('is_google_authenticated');

if (!isAuthenticated) {
    // Show login button
} else {
    // Show upload options
}
```

#### c. Simplified Upload Call:
```javascript
// No need to pass tokens anymore
const result = await invoke('upload_to_google_photos', {
    selectedFiles: photos
});
```

### 5. Add New Tauri Commands

```rust
#[tauri::command]
pub async fn store_google_tokens(
    access_token: String,
    refresh_token: String,
    expires_in: i64
) -> Result<(), String> {
    TokenStorageService::store_google_tokens(&access_token, &refresh_token, expires_in)
}

#[tauri::command]
pub async fn is_google_authenticated() -> Result<bool, String> {
    Ok(TokenStorageService::has_stored_tokens())
}

#[tauri::command]
pub async fn logout_google() -> Result<(), String> {
    TokenStorageService::delete_google_tokens()
}
```

### 6. Error Handling for Token Refresh

Handle various token refresh scenarios:
- Network errors during refresh
- Invalid refresh token (user needs to re-authenticate)
- Revoked access (user removed app permissions)

```rust
match TokenStorageService::get_valid_access_token() {
    Ok(token) => {
        // Use token for upload
    }
    Err(e) if e.contains("Invalid refresh token") => {
        // Clear stored tokens and prompt re-authentication
        TokenStorageService::delete_google_tokens()?;
        return Err("Please login to Google Photos again".to_string());
    }
    Err(e) => {
        // Other errors (network, etc.)
        return Err(format!("Authentication error: {}", e));
    }
}
```

### 7. Benefits of This Approach

- **Seamless Experience**: Users stay logged in across app restarts
- **Automatic Token Refresh**: No manual intervention needed when tokens expire
- **Secure Storage**: Tokens encrypted by OS
- **Clean Architecture**: Token management separated from business logic
- **Better Error Handling**: Clear messages when re-authentication needed
- **No Token Passing**: Frontend doesn't handle sensitive tokens after initial auth

### 8. Testing Plan

1. **Initial Authentication**: Login and verify tokens are stored
2. **Token Persistence**: Restart app and verify upload works without re-login
3. **Token Refresh**: Wait for token expiry (or manually expire) and verify auto-refresh
4. **Error Cases**: 
   - Test with revoked refresh token
   - Test with no network during refresh
   - Test logout and re-login flow
5. **Upload Flow**: Verify uploads work with stored tokens
6. **Cross-Platform**: Test on macOS, Windows, and Linux