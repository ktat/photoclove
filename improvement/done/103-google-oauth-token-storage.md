# Improvement #103: Google OAuth Token Storage and Auto-Refresh

## Overview
Implement secure storage of Google OAuth tokens (access token and refresh token) and automatic token refresh on application startup to maintain persistent authentication with Google Photos.

## Current State
Based on existing documentation (`docs/guides/oauth-token-management.md`):
- OAuth tokens are stored in platform-native keyring (not in config files)
- Service name: `photoclove`
- Username: `google_oauth_tokens`
- Data format: JSON-serialized token data
- External service handles token refresh

## Requirements

### 1. Token Storage
**Location**: Platform-native keyring (already implemented)
- Linux: Secret Service API via `libsecret`
- macOS: Keychain Services
- Windows: Windows Credential Manager

**Data Structure**:
```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0g...",
  "expires_at": 1234567890,  // Unix timestamp
  "token_type": "Bearer",
  "scope": "https://www.googleapis.com/auth/photoslibrary.readonly"
}
```

### 2. Automatic Token Refresh on Startup
**When**: Application startup (before any Google Photos API calls)
**Logic**:
1. Read tokens from keyring on startup
2. Check if access token is expired or will expire soon (within 5 minutes)
3. If expired/expiring:
   - Use refresh token to get new access token from Google
   - Update stored tokens in keyring
   - Log refresh success/failure
4. If refresh token is invalid:
   - Clear stored tokens
   - Require user to re-authenticate

**API Endpoint**: `https://oauth2.googleapis.com/token`
**Request**:
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
refresh_token=STORED_REFRESH_TOKEN
grant_type=refresh_token
```

**Response**:
```json
{
  "access_token": "new_access_token",
  "expires_in": 3599,
  "scope": "https://www.googleapis.com/auth/photoslibrary.readonly",
  "token_type": "Bearer"
}
```

### 3. Token Management Functions

**Backend (Rust)**:
- `load_tokens_from_keyring() -> Result<TokenData, String>`
  - Read tokens from platform keyring
  - Deserialize JSON to TokenData struct

- `save_tokens_to_keyring(tokens: &TokenData) -> Result<(), String>`
  - Serialize TokenData to JSON
  - Store in platform keyring

- `refresh_access_token(refresh_token: &str) -> Result<TokenData, String>`
  - Call Google OAuth token refresh endpoint
  - Parse response and create new TokenData
  - Calculate expires_at from expires_in

- `check_and_refresh_tokens() -> Result<TokenData, String>`
  - Load current tokens
  - Check if access token is expired/expiring
  - Refresh if needed
  - Save updated tokens
  - Return current valid tokens

**Tauri Commands**:
```rust
#[tauri::command]
async fn ensure_google_auth() -> Result<bool, String> {
    // Check if tokens exist and are valid
    // Auto-refresh if needed
    // Return true if authenticated, false if needs re-auth
}

#[tauri::command]
async fn get_google_auth_status() -> Result<GoogleAuthStatus, String> {
    // Return authentication status for UI display
    // GoogleAuthStatus { authenticated: bool, user_email: Option<String> }
}

#[tauri::command]
async fn logout_google() -> Result<(), String> {
    // Clear tokens from keyring
    // Update UI to show logged out state
}
```

**GoogleAuthStatus struct**:
```rust
#[derive(serde::Serialize)]
struct GoogleAuthStatus {
    authenticated: bool,
    user_email: Option<String>, // Optional: if available from token/user info API
}
```

### 4. Configuration Option for Token Refresh Failure Behavior

**New Config Field**: `google_auth_auto_reauth: bool` (default: false)

**Purpose**: Control what happens when refresh token is invalid

**Behavior**:

When `google_auth_auto_reauth = false` (default):
- Invalid refresh token → Clear tokens silently
- Google Photos features appear as "Not connected"
- User must manually click "Connect to Google Photos"
- No prompts or interruptions on startup

When `google_auth_auto_reauth = true`:
- Invalid refresh token → Show re-authentication dialog
- User prompted to re-authenticate immediately
- More proactive but potentially intrusive

**Preferences UI**:
- Add checkbox: "Automatically prompt for Google Photos re-authentication on startup"
- Located in Google Photos/Integration section of Preferences

### 5. Application Startup Flow

**Sequence**:
1. App starts
2. `check_and_refresh_tokens()` called automatically
3. If successful:
   - User is authenticated
   - Google Photos features available
4. If failed (no tokens or refresh failed):
   - Check `google_auth_auto_reauth` config
   - If `true`: Show re-authentication dialog
   - If `false`: Silently disable Google Photos features, show "Connect" button

### 6. Error Handling

**Token Refresh Failures**:
- Invalid refresh token → Clear all tokens, behavior based on config
- Network error → Retry with exponential backoff (3 attempts)
- API error (invalid client) → Log error, behavior based on config

**Logging**:
- Log all token refresh attempts (success/failure)
- Log token expiration checks
- Never log actual token values (security)

### 6. Security Considerations

**Important**:
- ✅ Store tokens in platform keyring (already implemented)
- ✅ Never store tokens in config files
- ✅ Never log token values
- ✅ Use HTTPS for all token refresh requests
- ✅ Clear tokens on logout
- ✅ Handle token refresh failures gracefully

### 7. Configuration

**New Config Fields**:

Add to `Config` struct in `src-tauri/src/entity/config.rs`:
```rust
#[serde(default = "default_google_auth_auto_reauth")]
pub google_auth_auto_reauth: bool,
```

Default function:
```rust
fn default_google_auth_auto_reauth() -> bool {
    false
}
```

**Google OAuth Client Credentials**:
- Store in environment variables or secure config
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Never commit to version control

## Implementation Notes

### Files to Modify/Create

**Backend**:
- `src-tauri/src/services/google_oauth_service.rs` (create or update)
  - Token storage functions
  - Token refresh logic
  - Keyring integration

- `src-tauri/src/lib.rs`
  - Add `ensure_google_auth` command
  - Call `check_and_refresh_tokens()` on app startup

**Frontend**:
- `src/App/Preferences.jsx`
  - Add checkbox for `google_auth_auto_reauth`
  - Label: "Automatically prompt for Google Photos re-authentication on startup"
  - Add to initial state
  - Include in save/load config

- Update Google Photos integration to use `ensure_google_auth`
- Show authentication status in UI
- Handle re-authentication flow (dialog when auto_reauth = true)

- **Menu Item Update**:
  - Update "Login to Google" menu item to show authentication status
  - When logged in:
    - Label: "Google Photos: Connected ✓" or "Logout from Google Photos"
    - Action: Click to logout (calls `logout_google()`)
    - Optional: Show user email if available
  - When not logged in:
    - Label: "Login to Google Photos"
    - Action: Initiate OAuth flow
  - Implementation:
    - Call `get_google_auth_status()` on component mount and after auth changes
    - Store auth status in React state
    - Dynamically render menu item based on status
    - Update status after successful login/logout

### Dependencies

**Rust crates**:
- `keyring` - Platform keyring access (likely already added)
- `reqwest` - HTTP client for token refresh API calls
- `serde_json` - JSON serialization
- `chrono` - Timestamp handling

### Testing Checklist

- [ ] Tokens saved to keyring correctly
- [ ] Tokens loaded from keyring on startup
- [ ] Access token refreshed when expired
- [ ] New tokens saved after refresh
- [ ] Invalid refresh token handled gracefully
- [ ] Network errors handled with retry
- [ ] No tokens logged to console/files
- [ ] Re-authentication flow works after token clear
- [ ] Config option `google_auth_auto_reauth` saves and loads correctly
- [ ] Auto-reauth behavior works when enabled (shows dialog)
- [ ] Silent behavior works when disabled (no prompts)
- [ ] Preferences UI checkbox functions correctly
- [ ] Menu item shows "Connected ✓" when authenticated
- [ ] Menu item shows "Login to Google Photos" when not authenticated
- [ ] `get_google_auth_status` command returns correct status
- [ ] `logout_google` command clears tokens and updates UI
- [ ] Menu item updates dynamically after login/logout
- [ ] Works on Linux, macOS, Windows

## Benefits

- **Persistent authentication**: Users don't need to re-authenticate frequently
- **Seamless experience**: Automatic token refresh in background
- **Secure storage**: Platform-native keyring protection
- **Better UX**: Google Photos features available immediately on startup
- **Reliability**: Automatic handling of token expiration
- **User control**: Configurable behavior for re-authentication prompts
- **Non-intrusive default**: Silent failure by default, no unexpected dialogs

## Related Documentation

- `docs/guides/oauth-token-management.md` - Existing OAuth token documentation
- `src-tauri/src/bin/test_keyring.rs` - Keyring testing utility

## Notes

- This builds on existing keyring infrastructure
- Token refresh is standard OAuth 2.0 flow
- External service mentioned in docs may already handle some of this
- Check existing implementation before duplicating logic
