# Implement Job Queue for Delete Operations with Rollback

## Priority: High

## Background
Currently, delete operations (move_to_trash_batch) are synchronous and can fail partway through, leaving UI and database in inconsistent state. If backend fails, UI has already been updated.

## Current Problems

### Issue 1: No Rollback on Failure
```javascript
// DirectoryMenu.jsx - current implementation
const updatedPhotos = allPhotos.filter(p => !photoSelection.includes(p.path));
setAllPhotos(updatedPhotos);  // UI updated immediately

await invoke("move_to_trash_batch", { paths });  // If this fails, UI is wrong
```

If backend fails:
- UI shows photos as deleted
- Database still has them
- User sees inconsistent state
- No way to recover automatically

### Issue 2: No Progress Indication
For large batch operations (100+ photos):
- User sees no progress
- Cannot estimate completion time
- Cannot cancel operation
- UI appears frozen

### Issue 3: File System Failures Not Handled
Possible failures:
- Disk full
- File locked by another process
- Permission denied
- Network drive disconnected

Current behavior: Partial success, no rollback, inconsistent state

## Solution: Job Queue with Rollback

### Architecture

```
User Action
    ↓
Create Job (queued)
    ↓
Update UI (optimistic)
    ↓
Job Execution (background)
    ├─ Success → Job completed
    │    ↓
    │   UI stays updated
    │
    └─ Failure → Job failed
         ↓
        Rollback UI
         ↓
        Notify user + offer reload
```

### Implementation

#### 1. Backend Job Processing

```rust
// src-tauri/src/entity/job_queue.rs
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum JobType {
    MoveToTrash { paths: Vec<String> },
    RestoreFromTrash { paths: Vec<String> },
    DeletePermanently { paths: Vec<String> },
    // ... other job types
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub progress: f32,  // 0.0 to 1.0
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
    pub result: Option<String>,  // JSON result data
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}
```

```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn queue_move_to_trash(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();

    let job = Job {
        id: job_id.clone(),
        job_type: JobType::MoveToTrash { paths },
        status: JobStatus::Queued,
        progress: 0.0,
        created_at: Utc::now().to_rfc3339(),
        started_at: None,
        completed_at: None,
        error: None,
        result: None,
    };

    // Add to job queue
    state.job_queue.add_job(job).await?;

    // Return job ID immediately
    Ok(serde_json::to_string(&json!({ "job_id": job_id }))?)
}

// Background processor
async fn process_move_to_trash_job(
    job_id: String,
    paths: Vec<String>,
    state: Arc<AppState>,
) -> Result<BatchResult, String> {
    // Update job status
    state.job_queue.update_status(&job_id, JobStatus::Running).await?;

    let mut succeeded = Vec::new();
    let mut failed = Vec::new();
    let total = paths.len();

    for (idx, path) in paths.iter().enumerate() {
        // Update progress
        let progress = (idx as f32 + 1.0) / total as f32;
        state.job_queue.update_progress(&job_id, progress).await?;

        match move_single_to_trash(path, &state).await {
            Ok(_) => succeeded.push(path.clone()),
            Err(e) => {
                failed.push((path.clone(), e));
                // Continue or abort based on error severity
            }
        }
    }

    if failed.is_empty() {
        // All succeeded
        let result = BatchResult { succeeded, failed: vec![], date_changes: /* ... */ };
        state.job_queue.complete_job(&job_id, serde_json::to_string(&result)?).await?;
        Ok(result)
    } else {
        // Some failed - decide whether to rollback all or partial success
        if succeeded.is_empty() {
            // Total failure - rollback and fail job
            for path in &succeeded {
                rollback_trash_move(path, &state).await?;
            }
            let error_msg = format!("All operations failed: {:?}", failed);
            state.job_queue.fail_job(&job_id, &error_msg).await?;
            Err(error_msg)
        } else {
            // Partial success - complete job with partial result
            let result = BatchResult {
                succeeded,
                failed: failed.iter().map(|(p, _)| p.clone()).collect(),
                date_changes: /* ... */
            };
            state.job_queue.complete_job(&job_id, serde_json::to_string(&result)?).await?;
            Ok(result)
        }
    }
}
```

#### 2. Frontend Job Monitoring

```javascript
// DirectoryMenu.jsx
async function deleteFiles() {
    if (props.photoSelection.length === 0) return;

    const paths = [...props.photoSelection];
    const count = paths.length;

    try {
        // Queue job (immediate response)
        const { job_id } = await invoke("queue_move_to_trash", { paths });

        // Optimistic UI update
        const updatedPhotos = props.allPhotosForCurrentFetch.filter(
            p => !paths.includes(p.originalPath)
        );
        props.setAllPhotosForCurrentFetch(updatedPhotos);
        props.clearPhotoSelection();

        props.addFooterMessage(`Deleting ${count} photos...`);

        // Monitor job progress
        const result = await monitorJob(job_id);

        if (result.status === 'completed') {
            // Apply date changes from job result
            const batchResult = JSON.parse(result.result);
            applyDateChanges(batchResult.date_changes);

            if (batchResult.failed.length > 0) {
                props.addFooterMessage(
                    `${batchResult.succeeded.length} deleted, ${batchResult.failed.length} failed`
                );
                // Show failed files to user
            } else {
                props.addFooterMessage(`${count} photos deleted`);
            }
        } else if (result.status === 'failed') {
            // Rollback UI changes
            props.addFooterMessage('Delete operation failed. Reloading...');
            await props.reloadCurrentModeData();  // Force reload to restore correct state
        }
    } catch (error) {
        // Rollback UI changes
        props.addFooterMessage('Delete operation failed. Reloading...');
        await props.reloadCurrentModeData();
    }
}

async function monitorJob(jobId) {
    while (true) {
        const status = await invoke("get_job_status", { jobId });
        const job = JSON.parse(status);

        // Update progress UI if needed
        if (job.progress > 0) {
            updateProgressBar(job.progress);
        }

        if (job.status === 'completed' || job.status === 'failed') {
            return job;
        }

        // Poll every 500ms
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
```

#### 3. Rollback Mechanism

```rust
// Backend rollback for move_to_trash
async fn rollback_trash_move(path: &str, state: &AppState) -> Result<(), String> {
    let file = file::File::new(path.to_string());
    let trash = trash::Trash::new(state.config.trash_path.clone());

    // Restore file from trash
    file_service::restore_from_trash(file, trash, state.config.import_to.clone())?;

    // Restore DB state (delete_flg = 0)
    let photo = photo::Photo::new(file::File::new(path.to_string()), None);
    state.meta_db.restore_photo_from_trash_no_summary(&photo);

    Ok(())
}
```

## Implementation Steps

### Phase 1: Basic Job Queue (Recommended First)
1. ✅ Job entity and storage (already exists in job_queue.rs)
2. Create `queue_move_to_trash` command
3. Implement job processor with progress updates
4. Frontend: Call queue command instead of direct batch
5. Frontend: Monitor job status
6. Test basic flow without rollback

### Phase 2: Rollback on Failure
1. Implement rollback_trash_move function
2. Update job processor to rollback on total failure
3. Frontend: Detect failure and reload data
4. Test failure scenarios:
   - Disk full
   - File locked
   - Permission denied
5. Verify UI consistency after rollback

### Phase 3: Progress UI (Optional)
1. Add progress bar component
2. Show file-by-file progress for large batches
3. Add cancel button
4. Implement job cancellation

## Files to Change
- `src-tauri/src/lib.rs`: Job queue commands
- `src-tauri/src/domain_service/job_queue_service.rs`: Job processor
- `src/App/PhotosList/DirectoryMenu.jsx`: Use job queue
- `src/components/ProgressModal.jsx`: Progress UI (optional)

## Benefits
- **Reliability**: Automatic rollback on failure
- **User Experience**: Progress indication, no frozen UI
- **Consistency**: UI and database always in sync
- **Debuggability**: Job history for troubleshooting

## Testing Scenarios
1. **Success**: 100 photos deleted, all succeed
2. **Partial failure**: 50/100 succeed, UI shows status
3. **Total failure**: 0/100 succeed, UI rolls back
4. **Disk full**: Mid-operation failure, rollback works
5. **Network error**: Frontend handles timeout
6. **Cancel**: User cancels mid-operation

## Alternative: Optimistic Update with Forced Reload on Failure

Simpler approach without full job queue:

```javascript
async function deleteFiles() {
    const paths = [...props.photoSelection];

    // Optimistic update
    const backup = props.allPhotosForCurrentFetch;
    const updated = backup.filter(p => !paths.includes(p.originalPath));
    props.setAllPhotosForCurrentFetch(updated);

    try {
        const result = await invoke("move_to_trash_batch", { paths });
        // Success - apply date changes
        applyDateChanges(JSON.parse(result).date_changes);
    } catch (error) {
        // Failure - restore backup and reload
        props.setAllPhotosForCurrentFetch(backup);
        props.addFooterMessage('Delete failed. Reloading...');
        await props.reloadCurrentModeData();
    }
}
```

This is simpler but less robust (no progress, no partial success handling).

---

keep context
