## Configuration file

## ~/.photoclove.yml

PhotoClove config file is "~/.photoclove.yml".
If the file doesn't exist, it is automatically created with default settings.

### Default Configuration Template

```yaml
repository:
  store: ""
  option: {}

# Directory paths
import_to: ~/.photoclove/import/          # Where imported photos are stored
export_from:                             # Source directories for importing
  - /
trash_path: ~/.photoclove/trash/          # Directory for deleted photos  
data_path: ~/.photoclove/data/           # Application data directory
thumbnail_store: ~/.photoclove/thumbnail/ # Thumbnail cache location
download_dir: ~/Downloads                 # Where styled images are downloaded

# Thumbnail generation settings
thumbnail_ratio: 0.05                     # Size ratio for thumbnails
thumbnail_compression_quality: 0.5        # JPEG compression quality (0.0-1.0)
thumbnail_ignore_file_size: 1048576      # Skip thumbnails for files smaller than this (1MB)

# Performance settings
copy_parallel: 2                         # Number of parallel file operations
thumbnail_parallel: 1                    # Number of parallel thumbnail generations
use_count: 0                            # Application usage counter

# Photo loading performance
max_photos_per_fetch: 1000               # Maximum photos loaded per request

# Appearance settings
app_theme: dark                          # Application theme: dark, light
photo_grid_theme: default               # Grid theme: default, filmstrip, slide-mount, lightbox, slide-35mm

# Debug logging
logging_enabled: true                    # Enable/disable application logging
logging_level: debug                     # Log level: debug, info, warn, error
```

## Configuration Options

### Directory Paths

#### import_to
- **Purpose**: Where imported photos are organized and stored
- **Default**: `~/.photoclove/import/`
- **Structure**: Photos organized in `YYYY-MM-DD/UUID/` subdirectories
- **Configurable**: Yes, through Preferences

#### export_from
- **Purpose**: Source directories for importing photos
- **Default**: `["/"]` (root directory)
- **Type**: Array of directory paths
- **Configurable**: Yes, through Preferences

#### trash_path
- **Purpose**: Directory for deleted photos (soft delete)
- **Default**: `~/.photoclove/trash/`
- **Behavior**: Photos moved here instead of permanent deletion
- **Configurable**: Yes, through Preferences

#### thumbnail_store
- **Purpose**: Cache location for generated thumbnail images
- **Default**: `~/.photoclove/thumbnail/`
- **Structure**: Mirrors import_to structure with thumbnail files
- **Performance**: SSD recommended for faster thumbnail loading

#### download_dir
- **Purpose**: Where styled/edited images are downloaded from the image editor
- **Default**: User's default Downloads directory (`~/Downloads`)
- **Configurable**: Yes, through Preferences → DownloadDir
- **Usage**: Used by image editor export functionality

### Performance Settings

#### max_photos_per_fetch
- **Purpose**: Maximum number of photos to load in a single request
- **Default**: `1000`
- **Impact**: Higher values load more photos but use more memory
- **Recommendation**: Adjust based on system memory and collection size
- **Configurable**: Yes, through Preferences

#### copy_parallel
- **Purpose**: Number of parallel file copy operations during import
- **Default**: `2`
- **Impact**: Higher values speed up imports but increase system load
- **Recommendation**: Set to number of CPU cores or storage devices

#### thumbnail_parallel
- **Purpose**: Number of parallel thumbnail generation processes
- **Default**: `1`
- **Status**: Currently not fully utilized
- **Future**: May be enhanced for batch thumbnail generation

### Thumbnail Generation

#### thumbnail_ratio
- **Purpose**: Size ratio for generated thumbnails relative to original
- **Default**: `0.05` (5% of original size)
- **Range**: `0.01` to `0.5` recommended
- **Impact**: Lower values create smaller files, faster loading

#### thumbnail_compression_quality
- **Purpose**: JPEG compression quality for thumbnail files
- **Default**: `0.5` (50% quality)
- **Range**: `0.0` (lowest) to `1.0` (highest quality)
- **Impact**: Higher values create larger but better quality thumbnails

#### thumbnail_ignore_file_size
- **Purpose**: Skip thumbnail generation for files smaller than this size
- **Default**: `1048576` (1MB)
- **Reason**: Small files load quickly as-is, don't need thumbnails
- **Units**: Bytes

### Appearance Settings

#### app_theme
- **Purpose**: Application color theme (dark or light mode)
- **Default**: `dark`
- **Options**: `dark`, `light`
- **Access**: Configurable through Preferences → Appearance
- **Behavior**: Sets `data-theme` attribute on document root

#### photo_grid_theme
- **Purpose**: Visual theme for photo grid display
- **Default**: `default`
- **Options**:
  - `default` - Standard grid layout
  - `filmstrip` - Film strip with sprocket holes (negative style)
  - `slide-mount` - Slide mount frame appearance
  - `lightbox` - Light box viewing style
  - `slide-35mm` - Classic 35mm slide appearance
- **Access**: Configurable through Preferences → Appearance
- **Behavior**: Sets `data-grid-theme` attribute on document root

### Debug Logging

#### logging_enabled
- **Purpose**: Enable or disable application logging
- **Default**: `true` in development, `false` in production
- **Access**: Configurable through Preferences
- **Impact**: Affects LogViewer data collection

#### logging_level
- **Purpose**: Set minimum log level for captured events
- **Default**: `debug` in development, `info` in production
- **Options**: `debug`, `info`, `warn`, `error`
- **Impact**: Higher levels capture fewer but more important events

### Legacy/System Fields

#### repository
- **Purpose**: Repository configuration (legacy)
- **Status**: Currently not fully utilized
- **Default**: `store: ""`, `option: {}`

#### data_path
- **Purpose**: Application data directory
- **Default**: `~/.photoclove/data/`
- **Usage**: Internal application data storage

#### use_count
- **Purpose**: Track application usage for welcome screen behavior
- **Default**: `0`
- **Behavior**: Welcome screen shown for `use_count <= 2`
- **Management**: Automatically incremented by application

### Backward Compatibility

PhotoClove handles missing configuration fields gracefully:
- Missing fields use default values from source code
- Configuration file is automatically updated when preferences change
- Old configuration files continue to work with new features
- New fields are added with `#[serde(default = "function_name")]` attributes

## OAuth Token Storage

**Important**: OAuth tokens are **NOT** stored in configuration files for security reasons.

PhotoClove uses platform-native keyring storage for OAuth tokens:

- **Linux**: Secret Service API via `libsecret`
- **macOS**: Keychain Services  
- **Windows**: Windows Credential Manager

### Token Security Features

- **Encrypted Storage**: Tokens encrypted by platform keyring service
- **Access Control**: Protected by OS-level permissions
- **No Plain Text**: No sensitive data in readable files
- **Automatic Management**: Tokens refreshed automatically by external service

### Token Storage Details

- **Service Name**: `photoclove`
- **Username**: `google_oauth_tokens`
- **Data Format**: JSON-serialized token data with access token, refresh token, and expiration
- **Documentation**: See [OAuth Token Management](oauth-token-management.md) for complete details

### For Developers

Testing and debugging tools available:
- `src-tauri/src/bin/test_keyring.rs` - Keyring testing utility
- Debug commands in token storage service
- Comprehensive test suite for token operations