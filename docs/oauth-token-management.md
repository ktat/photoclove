# Google OAuth Token Management

## Overview

PhotoClove implements secure Google OAuth token storage and automatic refresh functionality to enable seamless Google Photos integration without requiring users to re-authenticate frequently.

## Architecture

### Token Storage Service

**File**: `src-tauri/src/domain_service/token_storage_service.rs`

The `TokenStorageService` provides secure token management using platform-native keyring storage:

- **Linux**: Uses Secret Service API via `libsecret`
- **macOS**: Uses Keychain Services
- **Windows**: Uses Windows Credential Manager

### Token Data Structure

```rust
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}
```

### External Service Integration

PhotoClove uses an external OAuth proxy service (`https://rwds.net/cgi-bin/token.cgi`) that:
- Handles OAuth credentials securely on the server side
- Supports both initial authorization and token refresh
- Eliminates need for client-side credential storage

## Key Features

### 1. Secure Token Storage

- **Platform Integration**: Uses native keyring systems for maximum security
- **Service Name**: `photoclove`
- **Username**: `google_oauth_tokens`
- **Data Format**: JSON-serialized `TokenData` struct

### 2. Automatic Token Refresh

- **Proactive Refresh**: Tokens refreshed 5 minutes before expiration
- **External Service**: Uses same proxy service as initial OAuth flow
- **Seamless UX**: No user interruption during token refresh
- **Error Handling**: Graceful fallback to re-authentication if refresh fails

### 3. Debug and Testing Tools

#### Built-in Commands
```bash
# Get refresh token (debug builds only)
cargo run --bin photoclove -- get-refresh-token

# Get token info with masked data
cargo run --bin photoclove -- get-token-info

# Delete stored tokens
cargo run --bin photoclove -- delete-tokens
```

#### Test Keyring Program
```bash
# Comprehensive token inspection
cargo run --bin test_keyring
```

#### Manual Token Management
```python
# Get tokens using Python
python3 -c "import keyring, json; print(json.loads(keyring.get_password('photoclove', 'google_oauth_tokens')))"

# Clear tokens for testing
python3 -c "import keyring; keyring.delete_password('photoclove', 'google_oauth_tokens')"
```

## Implementation Details

### Token Refresh Flow

1. **Check Expiration**: `get_valid_access_token()` checks if token expires within 5 minutes
2. **Refresh Request**: Calls external service with refresh_token
3. **Update Storage**: Stores new access_token with updated expiration
4. **Return Token**: Provides valid access_token to calling service

### Error Handling

- **Invalid Refresh Token**: Returns error message prompting re-authentication
- **Network Errors**: Detailed error messages for debugging
- **Service Unavailable**: Graceful degradation with user notification

### Integration Points

#### Frontend (JavaScript)
- **File**: `src/services/firebase/auth.js`
- **Command**: `store_google_tokens` - Stores tokens after OAuth flow
- **Logging**: Structured logging for OAuth events

#### Backend Commands
- **File**: `src-tauri/src/lib.rs`
- `store_google_tokens`: Securely store OAuth tokens
- `get_google_access_token`: Get valid access token (with auto-refresh)
- `delete_google_tokens`: Remove stored tokens

### Google Photos Integration

**File**: `src-tauri/src/entity/google_photos.rs`

- Automatically uses `TokenStorageService::get_valid_access_token()`
- Handles token refresh transparently during API calls
- Improved error handling for authentication failures

## Security Considerations

### Platform-Native Security
- **Linux**: Tokens encrypted by system keyring daemon
- **macOS**: Protected by Keychain Access permissions
- **Windows**: Secured by Windows Credential Manager

### No Client-Side Secrets
- OAuth credentials stored only on external service
- Client never handles `client_secret`
- Reduced attack surface for credential theft

### Token Lifecycle
- Access tokens expire after 1 hour (configurable)
- Refresh tokens have longer lifespan (typically 6 months)
- Automatic cleanup on user logout

## Testing and Debugging

### Token Verification
```bash
# Linux: Check with secret-tool (if available)
secret-tool lookup service photoclove username google_oauth_tokens

# Cross-platform: Use Python
python3 -c "import keyring; print('Tokens stored:' if keyring.get_password('photoclove', 'google_oauth_tokens') else 'No tokens found')"
```

### Test Token Refresh
1. Clear access token but keep refresh token
2. Make Google Photos API call
3. Monitor logs for automatic refresh

### Common Issues

#### No Keyring Service
**Symptoms**: "Failed to create token entry" errors
**Solution**: Install and configure keyring service for your platform

#### Token Refresh Failures
**Symptoms**: "Invalid refresh token" errors
**Solution**: User needs to re-authenticate through login flow

#### External Service Unavailable
**Symptoms**: Network errors during refresh
**Solution**: Check network connectivity and service status

## Related Files

### Core Implementation
- `src-tauri/src/domain_service/token_storage_service.rs` - Main service
- `src-tauri/src/lib.rs` - Tauri commands
- `src/services/firebase/auth.js` - Frontend OAuth integration

### Testing Tools
- `src-tauri/src/bin/test_keyring.rs` - Token inspection tool
- `token-modified.cgi` - External service with refresh support

### Configuration
- `src-tauri/Cargo.toml` - Keyring dependency
- `src/.google-auth-config.js` - OAuth client configuration

This secure token management system enables PhotoClove to provide seamless Google Photos integration while maintaining high security standards and excellent user experience.