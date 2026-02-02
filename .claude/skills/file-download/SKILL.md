---
name: file-download
description: File download implementation pattern for Tauri applications. Use this skill when implementing file save/download functionality in PhotoClove.
---

# File Download Implementation

PhotoClove uses Tauri backend to save files to the user's download directory. This pattern is required because browser-based download approaches don't work reliably in Tauri.

## Architecture Overview

```
Frontend (React)          Backend (Rust/Tauri)
     │                           │
     │  1. Convert Blob to       │
     │     Base64 string         │
     │                           │
     │  2. Invoke Tauri command  │
     │ ────────────────────────> │
     │                           │
     │                           │  3. Decode Base64
     │                           │  4. Write to Download dir
     │                           │  5. Return saved path
     │ <──────────────────────── │
     │                           │
     │  6. Show success feedback │
```

## Frontend Implementation

### 1. Save Function (ShareUtils.js)

```javascript
import { invoke } from '@tauri-apps/api/core';

export async function saveImageAsFile(blob, filename = 'image.png') {
    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    // Save via Tauri command
    const savedPath = await invoke('save_image_to_download_dir', {
        imageData: base64Data,
        filename: filename
    });

    return savedPath;
}
```

### 2. Button Handler (Component)

**IMPORTANT**: The handler MUST be `async` and use `await`:

```javascript
const [saveStatus, setSaveStatus] = useState(null);

const handleSaveImage = useCallback(async () => {
    if (!imageBlob) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `photoclove-image-${date}.png`;

    try {
        await saveImageAsFile(imageBlob, filename);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
        logger.error('Component', 'save_error', 'Failed to save', { error: error.message });
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
    }
}, [imageBlob]);
```

### 3. Button UI with Feedback

```jsx
<button
    className={`${styles.actionBtn} ${saveStatus === 'saved' ? styles.success : ''}`}
    onClick={handleSaveImage}
    disabled={!imageBlob}
>
    <span className={styles.actionIcon}>💾</span>
    <span>
        {saveStatus === 'saved' ? 'Saved!' : 'Save Image'}
    </span>
</button>
```

## Backend Implementation (Rust)

### Tauri Command

```rust
// In src-tauri/src/commands/file_commands.rs or similar

#[tauri::command]
pub async fn save_image_to_download_dir(
    image_data: String,  // Base64 encoded
    filename: String,
) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::fs;

    // Get download directory
    let download_dir = dirs::download_dir()
        .ok_or("Could not find download directory")?;

    // Decode base64
    let bytes = general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Create full path
    let file_path = download_dir.join(&filename);

    // Write file
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    log::info!(target: "file", "save_image; path={}", file_path.display());

    Ok(file_path.to_string_lossy().to_string())
}
```

### Register Command in lib.rs

```rust
.invoke_handler(tauri::generate_handler![
    // ... other commands
    save_image_to_download_dir,
])
```

## Common Mistakes

### 1. Missing `async`/`await`

```javascript
// ❌ BAD - Won't wait for save to complete
const handleSave = () => {
    saveImageAsFile(blob, 'file.png');
};

// ✅ GOOD - Properly waits and handles result
const handleSave = async () => {
    await saveImageAsFile(blob, 'file.png');
};
```

### 2. No Error Handling

```javascript
// ❌ BAD - Silent failure
const handleSave = async () => {
    await saveImageAsFile(blob, 'file.png');
};

// ✅ GOOD - Catches and reports errors
const handleSave = async () => {
    try {
        await saveImageAsFile(blob, 'file.png');
        // success feedback
    } catch (error) {
        // error feedback
    }
};
```

### 3. No User Feedback

Always show:
- Success state ("Saved!")
- Error state if save fails
- Loading state for large files

## File Locations

| File | Purpose |
|------|---------|
| `src/utils/ShareUtils.js` | `saveImageAsFile()` function |
| `src-tauri/src/commands/file_commands.rs` | Tauri command implementation |
| `src-tauri/src/lib.rs` | Command registration |

## Testing

1. Generate or select an image
2. Click Save button
3. Check Downloads folder for the file
4. Verify button shows "Saved!" feedback
