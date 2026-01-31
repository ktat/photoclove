# Use Job Queue for Large Batch Delete Operations

## Priority: Medium

## Background
Currently, delete/restore operations are executed synchronously. While improvement-112 added rollback functionality for reliability, large batch operations (50+ photos) can still cause UI freezing and lack progress indication.

The application already has a Job Queue system used for Import, Thumbnail generation, CreateDb, and GooglePhotosUpload. Integrating delete operations with this existing infrastructure would provide:
- Progress indication for large batches
- Non-blocking UI
- Consistent job management
- Job history and debugging

## Current Implementation (After improvement-112)

```javascript
// DirectoryMenu.jsx
async function deleteFiles() {
    // Optimistic UI update
    const deletedPaths = [...props.photoSelection];
    const photosBackup = [...props.allPhotosForCurrentFetch];

    // Remove from UI immediately
    props.setAllPhotosForCurrentFetch(updatedPhotos);

    try {
        // Synchronous batch operation
        const result = await invoke("move_to_trash_batch", { paths: deletedPaths });
        // Success - apply date changes
    } catch (error) {
        // Rollback on failure
        props.setAllPhotosForCurrentFetch(photosBackup);
        await props.reloadCurrentModeData();
    }
}
```

**Problems with current approach for large batches:**
- UI appears frozen during operation (no progress)
- Cannot cancel mid-operation
- User doesn't know how long it will take
- Blocks other operations

## Proposed Solution: Hybrid Approach

Use **threshold-based routing**:
- **Small batches (<50 photos)**: Direct execution (fast, immediate feedback)
- **Large batches (≥50 photos)**: Job Queue (progress, non-blocking)

## Implementation

### 1. Add new JobType to job_queue.rs

```rust
// src-tauri/src/entity/job_queue.rs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobType {
    #[serde(rename = "import")]
    Import,
    #[serde(rename = "thumbnail")]
    Thumbnail,
    #[serde(rename = "create_db")]
    CreateDb,
    #[serde(rename = "google_photos_upload")]
    GooglePhotosUpload,

    // New job types for batch operations
    #[serde(rename = "move_to_trash")]
    MoveToTrash,
    #[serde(rename = "restore_from_trash")]
    RestoreFromTrash,
    #[serde(rename = "delete_permanently")]
    DeletePermanently,
}
```

### 2. Backend: Queue command

```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn queue_batch_trash_operation(
    paths: Vec<String>,
    operation: String, // "move_to_trash" | "restore" | "delete_permanently"
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_unit_id = Uuid::new_v4().to_string();

    let job_type = match operation.as_str() {
        "move_to_trash" => JobType::MoveToTrash,
        "restore" => JobType::RestoreFromTrash,
        "delete_permanently" => JobType::DeletePermanently,
        _ => return Err("Invalid operation type".to_string()),
    };

    let job = Job {
        job_unit_id: job_unit_id.clone(),
        job_type,
        target: paths,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Add to job queue
    state.meta_db.insert_job(&job)?;

    // Return job unit ID for monitoring
    Ok(serde_json::to_string(&json!({ "job_unit_id": job_unit_id }))?)
}
```

### 3. Backend: Job processor

```rust
// src-tauri/src/domain_service/job_queue_service.rs
async fn process_trash_job(
    job: &QueuedJob,
    state: &AppState,
) -> Result<(), String> {
    let paths = &job.job.target;
    let total = paths.len();

    match job.job.job_type {
        JobType::MoveToTrash => {
            let mut succeeded = 0;
            let mut failed_paths = Vec::new();
            let mut date_changes = HashMap::new();

            for (idx, path) in paths.iter().enumerate() {
                // Update progress
                let progress = ((idx + 1) as f64 / total as f64 * 100.0) as i32;
                state.meta_db.update_job_progress(&job.job_unit_id, progress)?;

                // Process single file
                match move_single_to_trash(path, state).await {
                    Ok(date_key) => {
                        succeeded += 1;
                        *date_changes.entry(date_key).or_insert(0) -= 1;
                    }
                    Err(e) => {
                        failed_paths.push(path.clone());
                        log::error!("Failed to move to trash: {} - {}", path, e);
                    }
                }
            }

            // Store result
            let result = BatchOperationResult {
                succeeded,
                failed: failed_paths.len(),
                failed_paths,
                date_changes,
                message: format!("Moved {} photos to trash", succeeded),
            };

            state.meta_db.update_job_result(
                &job.job_unit_id,
                &serde_json::to_string(&result)?,
            )?;

            Ok(())
        }
        JobType::RestoreFromTrash => {
            // Similar implementation
            todo!()
        }
        JobType::DeletePermanently => {
            // Similar implementation
            todo!()
        }
        _ => Err("Invalid job type for trash operation".to_string()),
    }
}
```

### 4. Frontend: Hybrid routing

```javascript
// DirectoryMenu.jsx
const LARGE_BATCH_THRESHOLD = 50;

async function deleteFiles() {
    if (props.photoSelection.length === 0) return;

    const count = props.photoSelection.length;
    const confirmed = await confirm(
        `Move ${count} photo${count > 1 ? 's' : ''} to trash?`,
        "Move to Trash"
    );

    if (!confirmed) return;

    // Route based on batch size
    if (count >= LARGE_BATCH_THRESHOLD) {
        await deleteFilesViaJobQueue(props.photoSelection, count);
    } else {
        await deleteFilesDirect(props.photoSelection, count);
    }
}

async function deleteFilesDirect(paths, count) {
    // Current implementation (improvement-112)
    // Direct execution with rollback on failure
    const photosBackup = [...props.allPhotosForCurrentFetch];

    // Optimistic UI update
    const updatedPhotos = props.allPhotosForCurrentFetch.filter(
        photo => !paths.includes(photo.originalPath)
    );
    props.setAllPhotosForCurrentFetch(updatedPhotos);
    props.clearPhotoSelection();

    try {
        const resultStr = await invoke("move_to_trash_batch", { paths });
        const result = JSON.parse(resultStr);

        if (result.date_changes) {
            applyDateChanges(result.date_changes);
        }

        props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} moved to trash`);
    } catch (error) {
        // Rollback
        props.setAllPhotosForCurrentFetch(photosBackup);
        props.addFooterMessage('Delete operation failed. Reloading...');
        await props.reloadCurrentModeData();
    }
}

async function deleteFilesViaJobQueue(paths, count) {
    try {
        // Queue the job
        const { job_unit_id } = await invoke("queue_batch_trash_operation", {
            paths,
            operation: "move_to_trash"
        });

        // Optimistic UI update
        const updatedPhotos = props.allPhotosForCurrentFetch.filter(
            photo => !paths.includes(photo.originalPath)
        );
        props.setAllPhotosForCurrentFetch(updatedPhotos);
        props.clearPhotoSelection();

        props.addFooterMessage(
            `Queued ${count} photos for deletion. Check Job Queue for progress.`
        );

        // Optionally show job queue
        if (props.setShowJobQueue) {
            props.setShowJobQueue(true);
        }

        // Monitor job completion (optional - user can check Job Queue UI)
        monitorJobCompletion(job_unit_id);

    } catch (error) {
        props.addFooterMessage('Failed to queue delete operation');
        handleTauriError(error, 'Queue delete operation');
    }
}

async function monitorJobCompletion(jobUnitId) {
    // Poll job status and apply date changes when complete
    const checkInterval = setInterval(async () => {
        try {
            const status = await invoke("get_job_status", { jobUnitId });
            const job = JSON.parse(status);

            if (job.status === 'completed') {
                clearInterval(checkInterval);

                // Apply date changes from job result
                if (job.result) {
                    const result = JSON.parse(job.result);
                    if (result.date_changes) {
                        applyDateChanges(result.date_changes);
                    }

                    if (result.failed > 0) {
                        props.addFooterMessage(
                            `Delete job completed: ${result.succeeded} succeeded, ${result.failed} failed`
                        );
                    }
                }
            } else if (job.status === 'failed') {
                clearInterval(checkInterval);
                props.addFooterMessage('Delete job failed. Reloading...');
                await props.reloadCurrentModeData();
            }
        } catch (error) {
            clearInterval(checkInterval);
            console.error('Failed to check job status:', error);
        }
    }, 2000); // Check every 2 seconds
}
```

### 5. UI Enhancement: Show threshold to user

```javascript
// Before confirmation
const message = count >= LARGE_BATCH_THRESHOLD
    ? `Move ${count} photos to trash?\n\nThis will be queued as a background job. You can monitor progress in the Job Queue.`
    : `Move ${count} photo${count > 1 ? 's' : ''} to trash?`;

const confirmed = await confirm(message, "Move to Trash");
```

## Implementation Steps

### Phase 1: Backend Infrastructure
1. Add new JobType variants (MoveToTrash, RestoreFromTrash, DeletePermanently)
2. Implement `queue_batch_trash_operation` command
3. Implement job processors for each operation type
4. Test job execution and progress updates

### Phase 2: Frontend Integration
1. Implement hybrid routing (threshold-based)
2. Update deleteFiles() to route based on count
3. Implement deleteFilesViaJobQueue()
4. Add job monitoring for date changes
5. Test with various batch sizes

### Phase 3: Apply to Restore and Delete Permanently
1. Implement restoreViaJobQueue()
2. Implement permanentDeleteViaJobQueue()
3. Test all three operations

### Phase 4: UX Polish
1. Add progress indication during job execution
2. Show "View in Job Queue" link in success message
3. Consider adding cancel button for queued jobs
4. Add configuration for threshold (allow users to adjust)

## Files to Change

### Backend
- `src-tauri/src/entity/job_queue.rs`: Add new JobType variants
- `src-tauri/src/lib.rs`: Add queue_batch_trash_operation command
- `src-tauri/src/domain_service/job_queue_service.rs`: Add processors
- `src-tauri/src/repository/meta_db/sqlite.rs`: Ensure job methods exist

### Frontend
- `src/App/PhotosList/DirectoryMenu.jsx`: Hybrid routing and queue integration
- `src/constants/config.js`: Add LARGE_BATCH_THRESHOLD constant

## Benefits

✅ **Better UX for large batches**: Progress indication, non-blocking UI
✅ **Consistent with existing jobs**: Same UI/UX as Import, Thumbnail jobs
✅ **Cancellable**: Users can cancel queued jobs
✅ **Debuggable**: Job history in database
✅ **Optimal performance**: Small batches still fast and direct

## Testing Scenarios

1. **Small batch (10 photos)**: Direct execution, immediate feedback
2. **Medium batch (40 photos)**: Direct execution (below threshold)
3. **Large batch (100 photos)**: Queued job, progress in Job Queue UI
4. **Very large batch (500 photos)**: Queued job, smooth progress updates
5. **Mixed operations**: Queue delete, then restore, ensure proper sequencing
6. **Failure handling**: Job fails mid-way, proper error reporting

## Alternative: Make it configurable

Add user preference for threshold:

```javascript
// In Preferences
<input
    type="number"
    value={batchJobThreshold}
    onChange={(e) => setBatchJobThreshold(parseInt(e.target.value))}
    min="10"
    max="1000"
/>
<label>Queue jobs for batches larger than (photos)</label>
```

This allows power users to adjust based on their system performance.

---

keep context
