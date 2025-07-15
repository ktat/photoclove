## Configuration file

## ~/.photoclove.yml

Photoclove config file is "~/.photoclove.yml".
If file doesn't exist, the file is automatically created.

For example:

```yaml
# The path in which deleted files are put
trash_path: "/mnt/picture/.photoclove_trash/"
# The path to which photo files are imported
import_to: "/mnt/picture/00 pictures/"
# The paths from which photo files are exported
export_from:
  - "/media/ktat/"
  - "/path/to/import/"
# The directory where downloaded styled images are saved
download_dir: "/home/user/Downloads/"
# Copy files parallelly when this value grater than 1
copy_parallel: 2
# Currenty not used
thumbnail_parallel: 1
# Currenty not used
repository:
  option: {}
  store: "directory"
# Currentry not used
data_path: "/home/ktat/.config/photoclove/"
# Currenty not used
thumbnail_store: ""
```

## Configuration Options

### download_dir
**New in recent updates**: Configures the directory where styled images are downloaded from the image editor.

- **Default**: User's default Downloads directory
- **Configurable**: Can be set through Preferences → DownloadDir
- **Usage**: Used by the image editor download functionality
- **Required**: Auto-created if the directory doesn't exist

### Backward Compatibility
The `download_dir` field is optional. If not present in existing configuration files, PhotoClove will automatically use the default Downloads directory and the configuration will be updated when changed through the preferences.

## ~/.photoclove.oauth.tokens

OAuth tokens are stored in `~/.photoclove.oauth.tokens`.

```
oauth_provider_tokens:
- provider: Google
  access_token: '...'
  refresh_token: '...'
```