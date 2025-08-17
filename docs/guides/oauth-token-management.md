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

This section provides comprehensive methods to verify that OAuth tokens are properly stored and managed.

### Methods to Verify Token Storage

#### 1. Check Application Logs
Look for these log entries in `~/.local/share/photoclove/logs/`:
```
google_tokens_stored; expires_in=3600
store_tokens_success; correlation_id=...
```

#### 2. Use Debug Commands (Development Builds Only)
In the browser console while running the app:
```javascript
// Import the logger service first (or use it from your component)
import { logger } from './services/LoggerService.js';

// Check if tokens are stored
const isAuthenticated = await window.__TAURI__.invoke('is_google_authenticated');
logger.info('TokenVerification', 'auth_check', 'Authentication status checked', { isAuthenticated });

// Get detailed token info (debug builds only)
const tokenInfo = await window.__TAURI__.invoke('get_google_token_info');
logger.info('TokenVerification', 'token_info', 'Token details retrieved', { tokenInfo });
// This will show:
// - has_access_token: true/false
// - access_token_preview: "abc123...wxyz" (masked)
// - has_refresh_token: true/false
// - refresh_token_preview: "def456...uvwx" (masked)
// - expires_at: "2025-07-21T15:30:00Z"
// - is_expired: false
// - time_until_expiry: 3300 (seconds)
```

#### 3. Platform-Specific Keyring Verification

##### macOS (Keychain Access)
1. Open "Keychain Access" app
2. Search for "photoclove"
3. Look for entry: `photoclove` with account `google_oauth_tokens`
4. Double-click to view (requires password)

##### Windows (Credential Manager)
1. Open Control Panel → User Accounts → Credential Manager
2. Click "Windows Credentials"
3. Look for "photoclove" entry
4. Click to expand and view details

##### Linux (Secret Service)

**Option 1: Install secret-tool**
```bash
# Ubuntu/Debian
sudo apt-get install libsecret-tools

# Fedora
sudo dnf install libsecret

# Arch
sudo pacman -S libsecret
```

Then use:
```bash
# List all PhotoClove secrets
secret-tool search service photoclove

# View specific token (will prompt for password)
secret-tool lookup service photoclove username google_oauth_tokens
```

**Option 2: Use our test binary (Recommended)**
```bash
cd src-tauri
cargo run --bin test_keyring
```

**Option 3: GUI Tools**
- **GNOME**: "Passwords and Keys" (Seahorse)
  ```bash
  # Install if needed
  sudo apt-get install seahorse
  ```
- **KDE**: KWalletManager
  ```bash
  # Install if needed
  sudo apt-get install kwalletmanager
  ```

**Option 4: Python script**
```python
#!/usr/bin/env python3
import secretstorage

connection = secretstorage.dbus_init()
collection = secretstorage.get_default_collection(connection)

for item in collection.get_all_items():
    if item.get_label() == "photoclove":
        print(f"Found PhotoClove token: {item.get_label()}")
        print(f"Created: {item.get_created()}")
        print(f"Modified: {item.get_modified()}")
        # Don't print the actual secret
        print("Token is stored successfully!")
```

**Option 5: Check keyring is working**
```bash
# Check if keyring daemon is running
ps aux | grep -E "gnome-keyring|kwallet"

# Check D-Bus secret service
dbus-send --session --print-reply --dest=org.freedesktop.DBus \
  /org/freedesktop/DBus org.freedesktop.DBus.ListNames | grep -i secret
```

#### 4. Test Token Persistence
```javascript
// Import logger if not already available
import { logger } from './services/LoggerService.js';

// 1. Store tokens
await window.__TAURI__.invoke('store_google_tokens', {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresIn: 3600
});
logger.info('TokenVerification', 'store_test', 'Test tokens stored');

// 2. Restart the app

// 3. Check if still authenticated
const stillAuthenticated = await window.__TAURI__.invoke('is_google_authenticated');
logger.info('TokenVerification', 'persistence_check', 'Checked authentication after restart', { stillAuthenticated });
```

#### 5. Monitor Token Refresh
Watch the logs for automatic token refresh:
```
access_token_expired; refreshing_token
refreshing_access_token
access_token_refreshed; expires_in=3600
```

#### 6. Error Scenarios to Test

##### Test Invalid Token Storage:
```javascript
// Import logger if not already available
import { logger } from './services/LoggerService.js';

// This should fail with proper error message
try {
    await window.__TAURI__.invoke('store_google_tokens', {
        accessToken: '',
        refreshToken: '',
        expiresIn: -1
    });
} catch (error) {
    logger.error('TokenVerification', 'invalid_store_test', 'Expected error occurred', { error: error.toString() });
}
```

##### Test Logout:
```javascript
// Delete tokens
await window.__TAURI__.invoke('logout_google');
logger.info('TokenVerification', 'logout_test', 'Tokens deleted');

// Verify they're gone
const authenticated = await window.__TAURI__.invoke('is_google_authenticated');
logger.info('TokenVerification', 'logout_verify', 'Verified logout status', { authenticated });
```

### Command Line Testing Tool

Create a simple Rust test binary (`src-tauri/src/bin/test_keyring.rs`):

```rust
use keyring::Entry;

fn main() {
    println!("Testing PhotoClove Keyring Storage...\n");
    
    // Check if tokens exist
    match Entry::new("photoclove", "google_oauth_tokens") {
        Ok(entry) => {
            match entry.get_password() {
                Ok(data) => {
                    println!("✅ Tokens found in keyring!");
                    println!("📊 Data length: {} bytes", data.len());
                    
                    // Try to parse as JSON
                    match serde_json::from_str::<serde_json::Value>(&data) {
                        Ok(json) => {
                            println!("✅ Valid JSON structure");
                            if json.get("access_token").is_some() {
                                println!("✅ Has access_token field");
                            }
                            if json.get("refresh_token").is_some() {
                                println!("✅ Has refresh_token field");
                            }
                            if json.get("expires_at").is_some() {
                                println!("✅ Has expires_at field");
                            }
                        }
                        Err(e) => println!("❌ Invalid JSON: {}", e),
                    }
                }
                Err(e) => println!("❌ No tokens found: {}", e),
            }
        }
        Err(e) => println!("❌ Failed to access keyring: {}", e),
    }
}
```

Run with: `cargo run --bin test_keyring`

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

### Security Notes

- Tokens are encrypted using OS-native security:
  - macOS: Hardware-backed encryption on Apple Silicon
  - Windows: DPAPI (Data Protection API)
  - Linux: GNOME Keyring or KWallet

- Never log or display full tokens in production
- The debug command is only available in development builds
- Token preview shows only first 6 and last 4 characters for verification

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