# Photoclove

Photo manager written in Rust with tauri.

## Motivation

Photo viewer/importer applications tends to be slow when you have a lot of photos.
I try to use some free/paid applications, but they don't much my usecase and they all are very slow.

- I don't need a rich editor.
- I require the features to import fastly and to view photos fastly.

So, I decided to create this by myself.

## Featurs to be ipmlemented

Just a plan, currentrly a few features are only implementead.

- Fast photo viewer
  - Allow photos over network drive(priority is very low because I uses NFS mount on Linux)
- Fast importer
  - only check duplication for the files which has same name prefix and different size.
  - import files created after last import file timestamp in directories.
  - importing in background
- Thumbnail creation in background
- Provide very simple editor
  - rotation
  - crop
  - compression(low priority)
- Additiona photo data
  - Tag
  - Star
  - Comment/Note
  - Album(low priority)
- Search
- Filter
- Upload to cloud services
  - Google Photos
  - Amazon photos
- Preferences editor(low priority)
  - directories(import from)
  - directory(import to)
  - directory date format(currentry, yyyy-mm-dd only)
- i18n(low priority)

## Configuration file

Create config file "~/.photoclove.yml".

For example:

```yaml
# The path in which deleted files are put
trash_path: "/mnt/picture/.photoclove_trash/"
# The path to which photo files are imported
import_to: "/mnt/picture/00 pictures/"
# The path from which photo files are exported
export_from: "/media/ktat/"
# Copy files
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