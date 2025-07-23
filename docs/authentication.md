# OAuth Authentication Flow

## Overview

PhotoClove uses a secure OAuth 2.0 authentication flow for Google Photos integration. The authentication process involves an external authentication server that handles the OAuth flow, ensuring that client secrets are never exposed to the desktop application.

## Authentication Architecture

```mermaid
graph TB
    subgraph "PhotoClove Desktop App"
        PC[PhotoClove App]
        KR[Platform Keyring<br/>Linux: Secret Service<br/>macOS: Keychain<br/>Windows: Credential Manager]
        TS[Token Storage Service]
    end
    
    subgraph "External Services"
        AS[Auth Server<br/>auth.photoclove.com]
        GS[Google OAuth]
    end
    
    subgraph "Local Browser"
        BR[Browser Window]
    end
    
    PC -->|Store/Retrieve Tokens| TS
    TS -->|Secure Storage| KR
    PC -->|Open Auth URL| BR
    BR -->|OAuth Request| AS
    AS -->|OAuth Flow| GS
    GS -->|Authorization Code| AS
    AS -->|Redirect with Tokens| BR
    BR -->|Send Tokens| PC
```

## OAuth Flow Sequence

```mermaid
sequenceDiagram
    participant PC as PhotoClove App
    participant TS as Token Storage
    participant BR as Browser
    participant AS as Auth Server
    participant GS as Google OAuth
    
    Note over PC,GS: User initiates Google Photos login
    
    PC->>PC: Generate random state string
    PC->>PC: Start local HTTP server on random port
    PC->>AS: Register callback (port, state)
    AS->>AS: Store state → port mapping
    AS-->>PC: 200 OK
    
    PC->>BR: Open OAuth URL with state
    BR->>AS: GET /auth/google?state={state}
    AS->>GS: Redirect to Google OAuth
    
    Note over GS,BR: User logs in to Google
    
    GS->>AS: Authorization code + state
    AS->>AS: Validate state
    AS->>GS: Exchange code for tokens
    GS-->>AS: Access token + Refresh token
    
    AS->>AS: Lookup port by state
    AS->>BR: Redirect to localhost:{port}/save_token
    BR->>PC: POST tokens to local server
    
    PC->>TS: Store tokens securely
    TS->>TS: Encrypt and save to keyring
    PC->>BR: Show success message
    PC->>PC: Close local HTTP server
```

## Token Lifecycle Management

```mermaid
stateDiagram-v2
    [*] --> NoToken: Initial State
    
    NoToken --> Authenticating: User Login
    Authenticating --> TokenStored: Success
    Authenticating --> NoToken: Failed
    
    TokenStored --> Active: Token Valid
    Active --> Refreshing: Near Expiry
    Active --> Uploading: Upload Photo
    
    Refreshing --> Active: Success
    Refreshing --> Reauthenticate: Failed
    
    Uploading --> Active: Complete
    Uploading --> Refreshing: Token Expired
    
    Reauthenticate --> Authenticating: User Action
    Active --> NoToken: User Logout
    
    note right of Refreshing: Automatic refresh<br/>5 min before expiry
    note right of TokenStored: Stored in platform<br/>keyring
```

## Token Storage Architecture

```mermaid
graph LR
    subgraph "Application Layer"
        PC[PhotoClove App]
        CMD[Tauri Commands]
    end
    
    subgraph "Service Layer"
        TSS[Token Storage Service]
        EH[Error Handler]
    end
    
    subgraph "Storage Layer"
        KR[keyring-rs]
        subgraph "Platform Storage"
            LS[Linux Secret Service]
            MC[macOS Keychain]
            WC[Windows Credential Manager]
        end
    end
    
    PC --> CMD
    CMD --> TSS
    TSS --> KR
    KR --> LS
    KR --> MC
    KR --> WC
    TSS --> EH
    
    style LS fill:#f9f,stroke:#333,stroke-width:2px
    style MC fill:#9ff,stroke:#333,stroke-width:2px
    style WC fill:#ff9,stroke:#333,stroke-width:2px
```

## Error Handling Flow

```mermaid
flowchart TD
    A[API Request] --> B{Token Valid?}
    B -->|Yes| C[Make Request]
    B -->|No| D{Refresh Token Exists?}
    
    C --> E{Success?}
    E -->|Yes| F[Return Result]
    E -->|No| G{401 Error?}
    
    G -->|Yes| D
    G -->|No| H[Return Error]
    
    D -->|Yes| I[Refresh Token]
    D -->|No| J[Prompt Re-auth]
    
    I --> K{Refresh Success?}
    K -->|Yes| L[Update Storage]
    K -->|No| M[Clear Tokens]
    
    L --> C
    M --> J
    
    J --> N[User Login]
    N --> O[Store New Tokens]
    O --> C
```

## Security Features

### 1. No Client Secrets
- OAuth client ID and secret never stored in the desktop app
- External auth server handles all OAuth credential exchanges
- Desktop app only receives and stores user tokens

### 2. Secure Token Storage
- Tokens encrypted by platform-native keyring systems
- Never stored in plain text files or application memory
- Automatic cleanup on application uninstall

### 3. State Validation
- Random state parameter prevents CSRF attacks
- State verified by auth server before token exchange
- One-time use prevents replay attacks

### 4. Automatic Token Refresh
- Tokens refreshed 5 minutes before expiration
- Refresh happens transparently during API calls
- Failed refresh triggers re-authentication

## Implementation Details

### Frontend (JavaScript)
```javascript
// src/services/firebase/auth.js
class GooglePhotosAuth {
    async login() {
        // 1. Generate random state
        // 2. Start local server
        // 3. Register with auth server
        // 4. Open browser for OAuth
        // 5. Wait for callback
        // 6. Store tokens via Tauri
    }
}
```

### Backend (Rust)
```rust
// src-tauri/src/domain_service/token_storage_service.rs
pub struct TokenStorageService {
    keyring: Entry,
}

impl TokenStorageService {
    pub fn store_tokens(&self, tokens: GoogleTokens) -> Result<()> {
        // Serialize and encrypt tokens
        // Store in platform keyring
    }
    
    pub fn get_tokens(&self) -> Result<GoogleTokens> {
        // Retrieve from keyring
        // Decrypt and deserialize
    }
    
    pub fn refresh_if_needed(&self) -> Result<()> {
        // Check expiration
        // Refresh if < 5 minutes remaining
    }
}
```

### Auth Server
The external auth server (auth.photoclove.com) handles:
1. OAuth client credentials
2. State validation
3. Token exchange with Google
4. Secure redirect to desktop app

## Testing and Debugging

### Debug Commands
PhotoClove includes built-in commands for testing OAuth functionality:

```bash
# Test keyring storage
photoclove test keyring

# Show current token status
photoclove google-auth status

# Manually refresh token
photoclove google-auth refresh

# Clear stored credentials
photoclove google-auth clear
```

### Common Issues

1. **Token Storage Fails**
   - Ensure keyring service is running (Linux)
   - Check keychain access permissions (macOS)
   - Verify Windows Credential Manager is enabled

2. **Refresh Token Invalid**
   - Token may be revoked by user
   - OAuth app may need re-authorization
   - Clear and re-authenticate

3. **Authentication Timeout**
   - Check firewall settings for localhost
   - Ensure browser can reach auth server
   - Verify state parameter matches

## API Integration

```mermaid
graph TD
    subgraph "Photo Upload Flow"
        A[Select Photo] --> B[Check Auth]
        B --> C{Authenticated?}
        C -->|No| D[Login Flow]
        C -->|Yes| E[Get Token]
        E --> F{Token Valid?}
        F -->|No| G[Refresh Token]
        F -->|Yes| H[Upload Photo]
        G --> I{Refresh OK?}
        I -->|Yes| H
        I -->|No| D
        D --> E
        H --> J[Store Photo URL]
    end
```

## Monitoring and Logging

All authentication events are logged with structured format:
- Login attempts and results
- Token refresh operations
- API authentication failures
- Keyring storage operations

Access logs via LogViewer (Ctrl+Shift+L) and filter by "auth" or "token" components.