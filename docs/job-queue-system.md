# Job Queue System

PhotoClove v2.6 introduces a comprehensive asynchronous job queue system that handles photo import, thumbnail creation, and database operations in the background.

## Overview

The job queue system replaces the previous synchronous import process with an asynchronous, event-driven architecture that provides:

- **Non-blocking operations**: Import operations return immediately with a job unit ID
- **Real-time progress tracking**: Live updates on job progress via event system
- **Error recovery**: Automatic recovery of interrupted jobs on application restart
- **Concurrent processing**: Configurable parallel job execution
- **Database persistence**: Job state persisted in SQLite for reliability

## Architecture

### Job Types

The system supports three types of jobs:

1. **Import Jobs**: Copy photos from source to destination directories
2. **Thumbnail Jobs**: Generate thumbnail images for imported photos
3. **CreateDb Jobs**: Update database metadata for processed photos

### Job Units

Jobs are organized into **Job Units** - logical groups of related jobs that represent a complete import operation:

```
Job Unit (UUID: abc123-def456)
├── Import Job (copy files from SD card)
├── Thumbnail Job (generate thumbnails)
└── CreateDb Job (update database metadata)
```

### Job Lifecycle

```
Job States: Pending → Running → Completed/Failed
```

- **Pending**: Job is queued and waiting to be processed
- **Running**: Job is currently being executed
- **Completed**: Job finished successfully
- **Failed**: Job encountered an error during execution

## Database Schema

### Job Unit Table

```sql
CREATE TABLE job_unit (
    id TEXT PRIMARY KEY,              -- UUID identifier
    jobs TEXT NOT NULL,               -- JSON array of job definitions
    created_at TEXT NOT NULL,         -- Creation timestamp
    status TEXT NOT NULL DEFAULT 'pending'  -- Unit status
);
```

### Job Queue Table

```sql
CREATE TABLE job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_unit_id TEXT NOT NULL,        -- Reference to job_unit.id
    job TEXT NOT NULL,                -- JSON job definition
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    started_at TEXT,                  -- When job execution began
    completed_at TEXT,                -- When job finished
    error_message TEXT,               -- Error details if failed
    FOREIGN KEY(job_unit_id) REFERENCES job_unit(id)
);
```

## API Changes

### Import API (Breaking Change)

**Previous (Synchronous)**:
```rust
// Blocked until import completed
fn import_photos() -> Result<bool, ()>
```

**New (Asynchronous)**:
```rust
// Returns immediately with job unit ID
fn import_photos() -> Result<String, String>
```

### Job Management APIs

```rust
// Get job progress for a specific job unit
fn get_job_progress(job_unit_id: String) -> JobProgress

// Get all jobs for a job unit
fn get_jobs_for_unit(job_unit_id: String) -> Vec<QueuedJob>
```

## Event System

The frontend receives real-time updates via Tauri events:

### Job Progress Events

- `import_progress`: Import job progress updates
- `thumbnail_progress`: Thumbnail generation progress  
- `create_db_progress`: Database creation progress

### Job Completion Events

- `job_completed`: Individual job completed successfully
- `job_failed`: Individual job failed with error details
- `import_job_unit_completed`: Entire job unit completed

### Event Payload Examples

```javascript
// Progress event
{
  "job_unit_id": "abc123-def456",
  "current": 5,
  "total": 10,
  "message": "Processing photo 5 of 10"
}

// Completion event
{
  "job_unit_id": "abc123-def456",
  "job_id": 42,
  "status": "completed"
}
```

## Configuration

### Concurrency Settings

The job queue system supports configurable concurrent execution:

- **Default**: Reasonable defaults based on system capabilities
- **Import Jobs**: Typically 1-2 concurrent jobs to avoid I/O contention
- **Thumbnail Jobs**: Higher concurrency based on CPU cores
- **Database Jobs**: Sequential execution to maintain data integrity

### Error Handling

- **Retry Logic**: Failed jobs can be automatically retried
- **Recovery**: Interrupted jobs are detected and reset to pending on startup
- **Cleanup**: Completed jobs are periodically cleaned from the database

## Usage Examples

### Frontend Integration

```javascript
// Start import and get job unit ID
const jobUnitId = await invoke('import_photos', { /* params */ });

// Listen for progress updates
listen('import_progress', (event) => {
  console.log(`Progress: ${event.payload.current}/${event.payload.total}`);
});

// Listen for completion
listen('import_job_unit_completed', (event) => {
  console.log('Import completed!', event.payload);
});
```

### Backend Job Creation

```rust
// Create a new job unit
let job_unit = JobUnit::new(vec![
    Job::new(job_unit_id.clone(), JobType::Import, files.clone()),
    Job::new(job_unit_id.clone(), JobType::Thumbnail, files.clone()),
    Job::new(job_unit_id.clone(), JobType::CreateDb, vec![target_dir]),
]);

// Submit to queue
job_queue_service.submit_job_unit(job_unit).await?;
```

## Performance Benefits

### Compared to Synchronous Import

- **Responsive UI**: Import operations don't block the interface
- **Parallel Processing**: Multiple operations can run concurrently
- **Error Isolation**: Failed jobs don't affect other operations
- **Progress Visibility**: Real-time feedback on long-running operations

### Resource Management

- **Memory Efficiency**: Jobs processed in batches to control memory usage
- **I/O Optimization**: Intelligent scheduling to minimize disk contention
- **CPU Utilization**: Thumbnail generation can utilize multiple CPU cores

## Migration Guide

### For Developers

If you have custom code that calls the import functionality:

**Before (v2.5 and earlier)**:
```rust
match import_photos(params) {
    Ok(success) => println!("Import completed: {}", success),
    Err(()) => println!("Import failed"),
}
```

**After (v2.6+)**:
```rust
match import_photos(params) {
    Ok(job_unit_id) => {
        println!("Import started: {}", job_unit_id);
        // Listen for completion events...
    },
    Err(error) => println!("Failed to start import: {}", error),
}
```

### For Users

- **No UI Changes**: The import interface remains the same
- **Better Feedback**: Progress bars now show real-time updates
- **Background Processing**: You can continue using the app during imports
- **Error Recovery**: Interrupted imports can be resumed automatically

## Troubleshooting

### Common Issues

1. **Jobs Stuck in Running State**
   - Check application logs for error messages
   - Restart application to reset running jobs to pending
   
2. **Performance Issues**
   - Adjust concurrency settings if too many jobs run simultaneously
   - Monitor system resources during large imports

3. **Database Corruption**
   - Job queue tables can be rebuilt without affecting photo metadata
   - Check SQLite database integrity if jobs fail to persist

### Monitoring

```sql
-- Check job status distribution
SELECT status, COUNT(*) FROM job_queue GROUP BY status;

-- Find long-running jobs
SELECT * FROM job_queue 
WHERE status = 'running' 
AND datetime(started_at) < datetime('now', '-1 hour');

-- Get recent job errors
SELECT job_unit_id, error_message, completed_at 
FROM job_queue 
WHERE status = 'failed' 
ORDER BY completed_at DESC 
LIMIT 10;
```

## Future Enhancements

Planned improvements for the job queue system:

- **Priority Queues**: High-priority jobs can jump ahead in queue
- **Job Scheduling**: Ability to schedule jobs for specific times
- **Resource Quotas**: Limit jobs based on available system resources
- **Distributed Processing**: Support for multiple worker processes
- **Web Interface**: Remote monitoring and management of job queues