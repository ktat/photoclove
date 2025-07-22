# How to Confirm Tokens are Successfully Saved to Keyring

## Methods to Verify Token Storage

### 1. **Check Application Logs**
Look for these log entries in `~/.local/share/photoclove/logs/`:
```
google_tokens_stored; expires_in=3600
store_tokens_success; correlation_id=...
```

### 2. **Use the Debug Command (Development Builds Only)**
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

### 3. **Platform-Specific Keyring Verification**

#### **macOS (Keychain Access)**
1. Open "Keychain Access" app
2. Search for "photoclove"
3. Look for entry: `photoclove` with account `google_oauth_tokens`
4. Double-click to view (requires password)

#### **Windows (Credential Manager)**
1. Open Control Panel → User Accounts → Credential Manager
2. Click "Windows Credentials"
3. Look for "photoclove" entry
4. Click to expand and view details

#### **Linux (Secret Service)**

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

### 4. **Test Token Persistence**
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

### 5. **Monitor Token Refresh**
Watch the logs for automatic token refresh:
```
access_token_expired; refreshing_token
refreshing_access_token
access_token_refreshed; expires_in=3600
```

### 6. **Error Scenarios to Test**

#### Test Invalid Token Storage:
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

#### Test Logout:
```javascript
// Delete tokens
await window.__TAURI__.invoke('logout_google');
logger.info('TokenVerification', 'logout_test', 'Tokens deleted');

// Verify they're gone
const authenticated = await window.__TAURI__.invoke('is_google_authenticated');
logger.info('TokenVerification', 'logout_verify', 'Verified logout status', { authenticated });
```

## Command Line Testing Tool

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

## Security Notes

- Tokens are encrypted using OS-native security:
  - macOS: Hardware-backed encryption on Apple Silicon
  - Windows: DPAPI (Data Protection API)
  - Linux: GNOME Keyring or KWallet

- Never log or display full tokens in production
- The debug command is only available in development builds
- Token preview shows only first 6 and last 4 characters for verification