# Google Photos Upload - Job Queue Integration

## Objective
Integrate Google Photos upload functionality with the existing job queue system to provide better user experience and reliability.

## Implementation Plan

### 1. Add New Job Type
In `src-tauri/src/entity/job_queue.rs`:
```rust
pub enum JobType {
    ImportPhotos,
    CreateThumbnails,
    // Add new type
    GooglePhotosUpload,
}
```

### 2. Define Job Data Structure
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

### 3. Update Backend Command
Replace current `upload_to_google_photos` in `src-tauri/src/lib.rs`:
```rust
const GOOGLE_PHOTOS_BATCH_SIZE: usize = 50;

#[tauri::command]
async fn upload_to_google_photos(
    state: tauri::State<'_, AppState>,
    selected_files: Vec<String>,
    access_token: String,
    refresh_token: String,
) -> Result<Vec<i32>, String> {
    let mut job_ids = Vec::new();
    let total_chunks = (selected_files.len() + GOOGLE_PHOTOS_BATCH_SIZE - 1) / GOOGLE_PHOTOS_BATCH_SIZE;
    
    for (chunk_index, chunk) in selected_files.chunks(GOOGLE_PHOTOS_BATCH_SIZE).enumerate() {
        let job_data = GooglePhotosUploadJob {
            photo_paths: chunk.to_vec(),
            access_token: access_token.clone(),
            refresh_token: refresh_token.clone(),
            album_id: None,
            chunk_index,
            total_chunks,
        };
        
        let job_id = state.job_queue_service.create_job(
            JobType::GooglePhotosUpload,
            serde_json::to_string(&job_data)?,
            format!("Google Photos Upload - Batch {} of {}", chunk_index + 1, total_chunks),
        )?;
        
        job_ids.push(job_id);
    }
    
    Ok(job_ids)
}
```

### 4. Implement Job Processor
In `src-tauri/src/domain_service/job_queue_service.rs`, add to `process_job` match:
```rust
JobType::GooglePhotosUpload => {
    self.process_google_photos_upload(job_id, job_data).await
}
```

And implement the handler:
```rust
async fn process_google_photos_upload(
    &self,
    job_id: i32,
    job_data: String,
) -> Result<(), String> {
    let data: GooglePhotosUploadJob = serde_json::from_str(&job_data)?;
    
    log::info!(
        target: "google_photos", 
        "upload_job_start; job_id={}; batch={}/{}; photos={}", 
        job_id,
        data.chunk_index + 1, 
        data.total_chunks,
        data.photo_paths.len()
    );
    
    // Create GooglePhotos instance
    let google_photos = GooglePhotos::new(
        data.access_token,
        data.refresh_token,
        self.config.import_to.clone() // db_path
    );
    
    // Collect upload tokens for all photos in this batch
    let mut upload_tokens = Vec::new();
    let mut failed_uploads = Vec::new();
    
    for (index, photo_path) in data.photo_paths.iter().enumerate() {
        // Update progress
        let progress = (index * 100) / data.photo_paths.len();
        self.update_job_progress(
            job_id, 
            progress as i32,
            format!("Uploading photo {} of {}", index + 1, data.photo_paths.len())
        )?;
        
        // Upload individual photo to get upload token
        match google_photos.upload_single_photo(photo_path).await {
            Ok(upload_token) => {
                upload_tokens.push((photo_path.clone(), upload_token));
            }
            Err(e) => {
                log::error!(
                    target: "google_photos", 
                    "upload_failed; job_id={}; photo={}; error={}", 
                    job_id, photo_path, e
                );
                failed_uploads.push(photo_path.clone());
            }
        }
    }
    
    // Batch create media items with collected tokens
    if !upload_tokens.is_empty() {
        match google_photos.batch_create_media_items(upload_tokens).await {
            Ok(_) => {
                log::info!(
                    target: "google_photos", 
                    "batch_create_success; job_id={}; count={}", 
                    job_id, 
                    data.photo_paths.len() - failed_uploads.len()
                );
            }
            Err(e) => {
                return Err(format!("Batch create failed: {}", e));
            }
        }
    }
    
    // Complete job
    self.update_job_progress(
        job_id, 
        100,
        format!(
            "Completed batch {} of {}. Uploaded: {}, Failed: {}", 
            data.chunk_index + 1, 
            data.total_chunks,
            data.photo_paths.len() - failed_uploads.len(),
            failed_uploads.len()
        )
    )?;
    
    Ok(())
}
```

### 5. Update Frontend
In `src/App/PhotosList/DirectoryMenu.jsx`:
```javascript
async function uploadToGooglePhotos() {
    const files = props.photoSelection;
    const BATCH_SIZE = 50;
    const numBatches = Math.ceil(files.length / BATCH_SIZE);
    
    const answer = await confirm(
        `Upload ${files.length} photos to Google Photos?\n` +
        `This will create ${numBatches} job${numBatches > 1 ? 's' : ''} (max ${BATCH_SIZE} photos per job)`, 
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
                `Created ${jobIds.length} upload job${jobIds.length > 1 ? 's' : ''}`,
                "Upload Started"
            );
            
            props.clearPhotoSelection();
            props.setShowJobQueue(true); // Show job queue
        } catch (e) {
            message("Failed to start upload: " + e, "Error");
        }
    }
}
```

### 6. Fix Google Photos Entity
Need to refactor `src-tauri/src/entity/google_photos.rs` to properly support batching:
- Split `upload_photo` into `upload_single_photo` (returns upload token)
- Create `batch_create_media_items` method that properly batches tokens
- Fix the current batching bug

## Benefits
1. **Non-blocking**: UI remains responsive during uploads
2. **Progress tracking**: Users can see upload progress in Job Queue
3. **Reliability**: Jobs persist across app restarts
4. **Error recovery**: Failed batches can be retried
5. **API compliance**: Properly respects 50-photo batch limit

## Testing Plan
1. Test with <50 photos (single job)
2. Test with >50 photos (multiple jobs)
3. Test job persistence (close app during upload)
4. Test error handling (invalid token, network failure)
5. Verify database URL storage after successful uploads