# Google Photos Upload Feature - Discussion

## Current Implementation Analysis

### Overview
PhotoClove already has a Google Photos upload feature implemented with the following components:

1. **Backend (Rust)**:
   - `src-tauri/src/entity/google_photos.rs`: Core Google Photos API integration
   - `upload_to_google_photos` command in `lib.rs`: Tauri command handler
   - Database support: `google_photos_url` column in photo_metadata table
   - Automatic URL storage after successful uploads

2. **Frontend (React)**:
   - DirectoryMenu.jsx: "Upload to Google Photos" option in Selection tab
   - Authentication via Firebase/OAuth with Google sign-in
   - Token storage in localForage
   - Batch upload support for selected photos

3. **Documentation**:
   - `docs/google-photos-integration.md`: Detailed integration guide
   - OAuth setup instructions
   - API endpoints documentation

### Current Features
- ✅ OAuth2 authentication with Google
- ✅ Batch photo upload to Google Photos
- ✅ Upload token generation and media item creation
- ✅ Google Photos URL storage in database
- ✅ Prevention of duplicate uploads (via stored URLs)
- ✅ User-controlled upload process (no automatic sync)

### Current Limitations & Issues

1. **Incomplete Implementation**:
   - `get_album()` and `create_album()` methods have `todo!()` macros
   - Album management is not fully implemented
   - No download/sync from Google Photos

2. **Error Handling**:
   - Limited error recovery on failed uploads
   - No retry mechanism for network failures
   - Silent failures in some cases (empty catch blocks)

3. **User Experience**:
   - No progress indication during uploads
   - No way to see which photos are already uploaded
   - No batch operation status tracking

4. **Technical Debt**:
   - Hardcoded content type as "image/jpeg" for all uploads
   - No support for video uploads
   - Token refresh mechanism not fully implemented

## Discussion Points

### 1. Should we complete the existing implementation?
**Pros**:
- Foundation already exists
- Database schema supports it
- User authentication flow works

**Cons**:
- Requires significant work to make production-ready
- Google Photos API has quotas and limitations
- Privacy concerns with third-party service integration

### 2. Priority Features to Implement
If we continue with Google Photos integration, which features should we prioritize?

a) **Upload Improvements**:
   - Progress tracking and notifications
   - Resume failed uploads
   - Support for more file types (videos, RAW files)
   - Respect original file metadata

b) **Sync Features**:
   - Two-way sync (download from Google Photos)
   - Conflict resolution
   - Selective sync by album/date

c) **UI/UX Enhancements**:
   - Visual indicators for uploaded photos
   - Upload queue management
   - Batch operation history

d) **Album Management**:
   - Create/manage Google Photos albums
   - Upload to specific albums
   - Album synchronization

### 3. Alternative Approaches

Instead of or in addition to Google Photos, should we consider:

a) **Other Cloud Services**:
   - Amazon Photos integration
   - iCloud Photos support
   - Generic WebDAV/cloud storage

b) **Local Network Sync**:
   - NAS integration
   - Local server sync
   - P2P photo sharing

c) **Plugin Architecture**:
   - Make cloud sync a plugin system
   - Allow users to add their own providers
   - Community-driven integrations

### 4. Security & Privacy Considerations

- How do we handle token storage securely?
- Should we encrypt tokens at rest?
- Privacy policy implications
- GDPR compliance for EU users

### 5. Performance Impact

- Background upload queue system needed?
- Bandwidth management options?
- Impact on app startup time?

## Proposed Solution: Job Queue Integration

### Why Job Queue?
PhotoClove already has a robust job queue system that handles:
- Background processing
- Progress tracking
- Error recovery
- Concurrent operations
- Job persistence

Using the job queue for Google Photos uploads would solve many current issues:

1. **Progress Tracking**: Built-in progress updates
2. **Error Recovery**: Automatic retry mechanism
3. **Background Processing**: Non-blocking uploads
4. **Batch Management**: Queue multiple upload jobs
5. **Persistence**: Jobs survive app restarts

### Implementation Plan

#### 1. Create New Job Type
In `src-tauri/src/entity/job_queue.rs`:
```rust
pub enum JobType {
    // existing types...
    GooglePhotosUpload,
}
```

#### 2. Job Data Structure
```rust
#[derive(Serialize, Deserialize)]
pub struct GooglePhotosUploadJob {
    pub photo_paths: Vec<String>,
    pub access_token: String,
    pub refresh_token: String,
    pub album_id: Option<String>,
    pub chunk_index: usize,
    pub total_chunks: usize,
}
```

#### 3. Modify Backend Command
Change `upload_to_google_photos` to create multiple jobs, one per chunk:
```rust
const GOOGLE_PHOTOS_BATCH_SIZE: usize = 50; // API limit

#[tauri::command]
async fn upload_to_google_photos(
    state: tauri::State<'_, AppState>,
    selected_files: Vec<String>,
    access_token: String,
    refresh_token: String,
) -> Result<Vec<i32>, String> {
    let mut job_ids = Vec::new();
    
    // Split files into chunks of 50 (API batch limit)
    for (chunk_index, chunk) in selected_files.chunks(GOOGLE_PHOTOS_BATCH_SIZE).enumerate() {
        let job_data = GooglePhotosUploadJob {
            photo_paths: chunk.to_vec(),
            access_token: access_token.clone(),
            refresh_token: refresh_token.clone(),
            album_id: None,
            chunk_index,
            total_chunks: (selected_files.len() + GOOGLE_PHOTOS_BATCH_SIZE - 1) / GOOGLE_PHOTOS_BATCH_SIZE,
        };
        
        // Create job for this chunk
        let job_id = state.job_queue_service.create_job(
            JobType::GooglePhotosUpload,
            serde_json::to_string(&job_data)?,
            format!("Google Photos Upload - Batch {} of {}", chunk_index + 1, job_data.total_chunks),
        )?;
        
        job_ids.push(job_id);
    }
    
    Ok(job_ids)
}
```

#### 4. Job Queue Service Handler
In `src-tauri/src/domain_service/job_queue_service.rs`:
```rust
async fn process_google_photos_upload(
    &self,
    job_id: i32,
    job_data: String,
) -> Result<(), String> {
    let data: GooglePhotosUploadJob = serde_json::from_str(&job_data)?;
    
    log::info!(
        target: "google_photos", 
        "Processing upload batch {} of {}", 
        data.chunk_index + 1, 
        data.total_chunks
    );
    
    let google_photos = GooglePhotos::new(
        data.access_token,
        data.refresh_token,
        self.db_path.clone()
    );
    
    // The existing upload_photo method already handles batch upload
    // It collects upload tokens and calls batchCreate API
    match google_photos.upload_photo(
        data.photo_paths.iter().map(|s| s.as_str()).collect()
    ).await {
        Ok(_) => {
            self.update_job_progress(
                job_id, 
                100,
                format!("Completed batch {} of {}", data.chunk_index + 1, data.total_chunks)
            )?;
            Ok(())
        }
        Err(e) => {
            log::error!(
                target: "google_photos", 
                "Failed batch {} of {}: {}", 
                data.chunk_index + 1, 
                data.total_chunks,
                e
            );
            Err(format!("Upload failed: {}", e))
        }
    }
}
```

#### 5. Frontend Updates
```javascript
// DirectoryMenu.jsx
async function uploadToGooglePhotos() {
    if (lockUpload) {
        message("Upload already in progress", "Please wait");
        return;
    }
    
    const files = props.photoSelection;
    const BATCH_SIZE = 50;
    const numBatches = Math.ceil(files.length / BATCH_SIZE);
    
    const answer = await confirm(
        `Upload ${files.length} photos to Google Photos?\n` +
        `This will create ${numBatches} job${numBatches > 1 ? 's' : ''} (${BATCH_SIZE} photos per batch)`, 
        "Confirm Upload"
    );
    
    if (answer) {
        const tokens = await localForage.getItem("GoogleOAuthTokens");
        if (!tokens) {
            message("Please sign in to Google Photos first", "Authentication Required");
            return;
        }
        
        try {
            const jobIds = await invoke("upload_to_google_photos", {
                selectedFiles: files,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            });
            
            message(
                `Created ${jobIds.length} upload job${jobIds.length > 1 ? 's' : ''}. Check Job Queue for progress.`,
                "Upload Started"
            );
            
            props.clearPhotoSelection();
            
            // Open job queue tab to show progress
            props.setShowJobQueue(true);
        } catch (e) {
            message("Failed to start upload: " + e, "Error");
        }
    }
}
```

### Benefits of Chunked Job Queue Approach

1. **Better User Experience**:
   - See upload progress per batch in Job Queue tab
   - Continue using app during uploads
   - Clear visibility of batch progress (e.g., "Batch 3 of 5")

2. **Reliability**:
   - If one batch fails, other batches can still complete
   - Failed batches can be retried individually
   - Jobs persist across app restarts
   - Respects Google Photos API limits (50 photos per batch)

3. **Performance**:
   - Non-blocking UI
   - Multiple batches can run concurrently (if desired)
   - Better memory management (smaller chunks)
   - Prevents timeout on large uploads

4. **Monitoring**:
   - Granular job status per batch
   - Easy to identify which batch failed
   - Better progress tracking
   - Upload history per batch

5. **API Compliance**:
   - Respects Google Photos batchCreate limit of 50 items
   - Prevents API errors from oversized requests
   - Better rate limiting control

### Additional Improvements

1. **Token Refresh in Job**:
   - Implement token refresh logic in job processor
   - Store refreshed tokens back to localStorage

2. **Duplicate Detection**:
   - Check `google_photos_url` before uploading
   - Skip already uploaded photos

3. **Batch API Usage**:
   - Group photos into batches of 50 (API limit)
   - Single batchCreate call per group

4. **Error Categories**:
   - Differentiate between retryable and permanent errors
   - Handle quota exceeded gracefully

## Recommendations

Based on the job queue integration approach:

1. **Phase 1 - Core Integration** (Priority):
   - Implement job queue handler for Google Photos
   - Basic upload functionality with progress
   - Error logging and basic retry

2. **Phase 2 - Enhanced Features**:
   - Token refresh handling
   - Duplicate detection
   - Upload status indicators on photos

3. **Phase 3 - Advanced Features**:
   - Album management
   - Selective sync
   - Download from Google Photos

This approach leverages existing infrastructure and provides a much better user experience than the current synchronous implementation.

## Current Implementation Analysis - Batch Size

After investigating the current code, I found that:

1. **Batch size is set to 50**: The code has `if items.len() == 50` in line 182 of `google_photos.rs`

2. **However, there's a bug in the current implementation**:
   - The `upload_photo` method loops through files and uploads each one individually
   - For each file, it calls `success_response` which creates a new batch list
   - The batching logic in `success_response` doesn't work correctly because:
     - Each call only has 1 item (the current file)
     - The batch list is local to each `success_response` call
     - It will never reach 50 items to trigger the batch

3. **Current flow** (buggy):
   ```
   upload_photo(files: ["photo1.jpg", "photo2.jpg", ..., "photo100.jpg"])
   ├─ Upload photo1.jpg → success_response → batch of 1 item → batchCreate
   ├─ Upload photo2.jpg → success_response → batch of 1 item → batchCreate
   └─ ... (100 separate API calls instead of 2 batches of 50)
   ```

4. **What it should be**:
   - Collect all upload tokens first
   - Then batch them into groups of 50
   - Make batchCreate calls for each group

This explains why the current implementation might be inefficient - it's making individual batchCreate calls for each photo instead of properly batching them!

### Corrected Implementation for Job Queue

The job queue approach would fix this by:
1. Pre-chunking files into groups of 50 at the command level
2. Each job handles exactly one batch of ≤50 files
3. The upload process can be simplified to handle the entire batch at once

This is why separating into multiple jobs (as you suggested) makes more sense than trying to handle all photos in one job.

What do you think about this finding and the job queue-based approach?