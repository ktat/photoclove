# A bit improvement LogViewer

- Add logging switch to LogViewer
- only when logging switch is on, loggin is enabled.
- logging switch status should be written in config file.
- logging switch default value is off, but when development env, default on.

## Implementation Plan

### Overview
Add a configurable logging switch that allows users to enable/disable logging at runtime. The switch will be integrated into the existing configuration system and provide controls in both the LogViewer component and Preferences panel.

### Files to be Changed

#### 1. Backend Configuration (`src-tauri/src/entity/config.rs`)
- Add `logging_enabled: bool` field to Config struct
- Add `logging_level: String` field for granular control
- Set default values: `false` for production, `true` for development

#### 2. Backend Logging Service (`src-tauri/src/domain_service/logging_service.rs`)
- Add methods to enable/disable logging based on config
- Implement runtime logging level changes
- Add config-aware log filtering

#### 3. Backend Commands (`src-tauri/src/lib.rs`)
- Add `set_logging_enabled(enabled: bool)` command
- Add `get_logging_status()` command
- Update existing logging commands to respect enabled state

#### 4. Frontend Logger Service (`src/services/LoggerService.js`)
- Add `isEnabled` property to LoggerService class
- Implement `setEnabled(enabled)` method
- Skip log collection when disabled
- Add config integration

#### 5. Frontend Configuration Hook (`src/hooks/useAppConfig.js`)
- Add logging configuration to the config hook
- Provide `setLoggingEnabled` function
- Sync with backend configuration

#### 6. LogViewer Component (`src/App/LogViewer.jsx`)
- Add logging status indicator (enabled/disabled badge)
- Add toggle switch in LogViewer header
- Show warning when logging is disabled
- Update real-time status display

#### 7. Preferences Panel (`src/App/Preferences.jsx`)
- Add "Logging" section with toggle switch
- Add logging level dropdown (Debug, Info, Warn, Error)
- Include description of logging behavior
- Integrate with existing config save/load

### Implementation Details

#### Configuration Structure
```rust
// In config.rs
pub struct Config {
    // existing fields...
    pub logging_enabled: bool,
    pub logging_level: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            // existing defaults...
            logging_enabled: cfg!(debug_assertions), // true in dev, false in production
            logging_level: "info".to_string(),
        }
    }
}
```

#### Frontend LoggerService Changes
```javascript
// In LoggerService.js
class LoggerService {
    constructor() {
        this.isEnabled = process.env.NODE_ENV === 'development'; // default
        // existing code...
    }
    
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.logs = []; // clear logs when disabled
        }
    }
    
    log(level, component, event, message, data = {}) {
        if (!this.isEnabled) return; // skip if disabled
        // existing log implementation...
    }
}
```

#### LogViewer Integration
- Add toggle switch in header next to export button
- Show "Logging: Enabled/Disabled" status badge
- Display message when logging is disabled: "Logging is currently disabled. Enable in Preferences or use the toggle above."
- Real-time sync with configuration changes

### Testing Strategy
1. Verify default values (off in production, on in development)
2. Test configuration persistence across app restarts
3. Verify logging stops/starts when toggled
4. Test UI controls in both LogViewer and Preferences
5. Ensure backend commands work correctly

### Benefits
- Users can disable logging for privacy/performance
- Developers can easily enable detailed logging for debugging
- Consistent configuration management using existing system
- Granular control with logging levels
- Immediate feedback in LogViewer interface
