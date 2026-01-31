# Fix Trash Mode Info Tab Metadata Display

## Priority: Medium

## Problem

In trash mode, the Info tab has two issues:

1. **Missing EXIF metadata**: Only "File Name" is displayed; all other EXIF fields (ISO, FNumber, Shutter Speed, etc.) are empty
2. **Incorrect file path for copy**: The copy icon (📋) copies the original file path instead of the trash path

## Current Behavior

### PhotoInfo.jsx Implementation
**File**: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx:19-47`

```javascript
async function getPhotoInfo(path) {
    if (props.imgCacheMap[path] && props.imgCacheMap[path][1]) {
        setPhotoInfo(props.imgCacheMap[path][1])
    } else if (props.showSideMenu) {
        await invoke("get_photo_info", { pathStr: path }).then((r) => {
            let data = JSON.parse(r);
            // ... process metadata
            setPhotoInfo(data);
        });
    }
}
```

**Display** (PhotoInfo.jsx:108-140):
- Copy icon copies `props.currentPhotoPath` (line 111)
- File name shows `props.currentPhotoPath.replace(/^.+\//, '')` (line 116)
- EXIF fields show `photoInfo.exif ? photoInfo.exif.iso : ""` etc.

### In Trash Mode

When viewing a photo in trash mode:
- `props.currentPhotoPath` = original path (e.g., `/mnt/picture/2024/photo.jpg`)
- Actual file location = trash path (e.g., `~/.local/share/photoclove/.trash/photo.jpg`)
- `photoInfo.exif` = undefined or empty object
- Result: Only file name displays, no EXIF data

## Root Cause Analysis

### Backend: `get_photo_info` Command

The `get_photo_info` command likely:
1. Receives the original path (`pathStr`)
2. Tries to read EXIF from that path
3. Fails because file is in trash, not at original location
4. Returns empty EXIF data

### Database State

When photos are moved to trash:
- `photo_metadata` table retains all EXIF data
- `trash_photos` table records mapping: original_path → trash_path
- EXIF metadata is NOT deleted

**Therefore**: The metadata exists in the database and can be retrieved.

## Proposed Solution

### Backend Changes

#### 1. Update `get_photo_info` to Handle Trash Photos

**File**: `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn get_photo_info(
    path_str: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    log::info!(target: "photo_info", "get_photo_info; path={}", path_str);

    // Check if photo is in trash
    let trash_path = state.meta_db.get_trash_path(&path_str)?;

    let (actual_path, is_trashed) = if let Some(tp) = trash_path {
        (tp, true)
    } else {
        (path_str.clone(), false)
    };

    // Get EXIF from database (always available)
    let photo_metadata = state.meta_db.get_photo_metadata(&path_str)?;

    // Try to read file info from actual path
    let file_info = if Path::new(&actual_path).exists() {
        read_file_info(&actual_path)?
    } else {
        // File doesn't exist, use metadata from DB only
        None
    };

    let result = PhotoInfoResult {
        original_path: path_str,
        current_path: actual_path,
        is_trashed,
        exif: photo_metadata.exif,
        meta: photo_metadata.meta,
        file_info,
    };

    Ok(serde_json::to_string(&result)?)
}
```

#### 2. Add Repository Method

**File**: `src-tauri/src/repository/meta_db/sqlite.rs`

```rust
pub fn get_trash_path(&self, original_path: &str) -> Result<Option<String>, String> {
    let conn = self.pool.get().map_err(|e| e.to_string())?;

    let trash_path = conn.query_row(
        "SELECT trash_path FROM trash_photos WHERE original_path = ?1",
        [original_path],
        |row| row.get::<_, String>(0)
    ).optional()
    .map_err(|e| e.to_string())?;

    Ok(trash_path)
}
```

### Frontend Changes

#### 1. Update PhotoInfo.jsx to Use Returned Paths

**File**: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`

```javascript
async function getPhotoInfo(path) {
    if (props.imgCacheMap[path] && props.imgCacheMap[path][1]) {
        setPhotoInfo(props.imgCacheMap[path][1])
    } else if (props.showSideMenu) {
        await invoke("get_photo_info", { pathStr: path }).then((r) => {
            let data = JSON.parse(r);

            // Store both original and current (trash) paths
            if (data.meta) {
                if (data.meta.star.data > 0) {
                    const newStar = [false, false, false, false, false];
                    for (let i = 0; i < data.meta.star.data; i++) {
                        newStar[i] = true;
                    }
                    props.setStar(newStar);
                } else {
                    props.setStar([false, false, false, false, false]);
                }
                if (data.meta.comment) {
                    setComment(data.meta.comment.data);
                } else {
                    setComment("");
                }
            } else {
                props.setStar([false, false, false, false, false]);
                setComment("");
            }
            setPhotoInfo(data);
        });
    }
}

// ... in render:

<tr><th>File Name</th>
    <td>
        <a href="#" onClick={() => {
            // Copy trash path if trashed, otherwise original path
            const pathToCopy = photoInfo.is_trashed
                ? photoInfo.current_path
                : props.currentPhotoPath;
            writeText(pathToCopy);
            props.addFooterMessage("clipboard", "Copy file path to clipboard", false, 5000);
        }}>📋</a>
        <a
            onMouseEnter={() => {
                const displayPath = photoInfo.is_trashed
                    ? `${photoInfo.current_path} (trashed)`
                    : props.currentPhotoPath;
                props.addFooterMessage("current_photo_path", "File Path: " + displayPath, false, 10000)
            }}>
            {props.currentPhotoPath.replace(/^.+\//, '')}
        </a>
        <a href="#" onClick={(e) => {
            e.preventDefault();
            const pathToOpen = photoInfo.is_trashed
                ? photoInfo.current_path
                : props.currentPhotoPath;
            openUrl(fileUrl(pathToOpen));
        }}>🚀</a>
    </td>
</tr>
```

## Implementation Steps

### Phase 1: Backend - Database Access
1. Add `get_trash_path()` method to `meta_db/sqlite.rs`
2. Test retrieval of trash paths from database

### Phase 2: Backend - Command Update
1. Update `get_photo_info` command to check trash status
2. Return both original_path and current_path (trash_path if trashed)
3. Always retrieve EXIF from database, regardless of file location
4. Add `is_trashed` flag to response
5. Test with both regular and trashed photos

### Phase 3: Frontend - Display Update
1. Update `PhotoInfo.jsx` to handle new response format
2. Use `current_path` for copy icon when `is_trashed === true`
3. Show trash path in hover message when trashed
4. Use `current_path` for file open (🚀) when trashed
5. Test UI with trash mode photos

### Phase 4: Testing
1. Move photo to trash
2. Open Info tab in trash mode
3. Verify all EXIF fields display correctly
4. Verify copy icon copies trash path
5. Verify hover shows trash path with "(trashed)" indicator
6. Verify 🚀 icon opens correct path

## Files to Change

### Backend
- `src-tauri/src/lib.rs`: Update `get_photo_info` command
- `src-tauri/src/repository/meta_db/sqlite.rs`: Add `get_trash_path()` method
- `src-tauri/src/entity/photo.rs` (if needed): Add `PhotoInfoResult` struct

### Frontend
- `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`: Update to use trash paths

## Expected Behavior After Fix

### In Trash Mode:
1. **Info tab shows all EXIF data**: ISO, FNumber, Shutter Speed, etc. are populated from database
2. **Copy icon copies trash path**: e.g., `~/.local/share/photoclove/.trash/photo.jpg`
3. **Hover message shows trash path**: "File Path: ~/.local/share/photoclove/.trash/photo.jpg (trashed)"
4. **Open file (🚀) uses trash path**: Opens the file from trash location
5. **File name display**: Still shows original file name for clarity

### In Normal Mode:
- No changes - continues to work as before
- Copy icon copies original path
- Hover shows original path
- All EXIF data displays normally

## Benefits

✅ **Complete metadata in trash mode**: Users can view all photo information for trashed photos
✅ **Correct file path operations**: Copy and open operations use actual file location
✅ **Better UX**: Clear indication when viewing trashed photos
✅ **Database-driven**: Leverages existing metadata, doesn't require re-reading EXIF
✅ **Consistent behavior**: Works the same way for all modes

## Notes

- The database already contains all necessary metadata
- No data migration required
- Stars and comments already work correctly with original paths
- This fix only affects Info tab display and path operations
