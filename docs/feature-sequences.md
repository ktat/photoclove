# PhotoClove Feature Sequences

This document describes the frontend/backend interaction sequences for each major feature in PhotoClove.

## Application Startup Sequence

```mermaid
sequenceDiagram
    participant React as Frontend (React)
    participant Tauri as Tauri Bridge
    participant Rust as Backend (Rust)
    participant FS as File System
    participant DB as SQLite DB

    React->>Tauri: App initialization
    Tauri->>Rust: Initialize AppState
    Rust->>DB: Initialize SQLite connection
    Rust->>FS: Verify directory structure
    React->>Tauri: get_config()
    Rust->>FS: Read config.json
    Tauri-->>React: Return config object
    React->>React: Determine initial view (Welcome/Home)
    
    Note over React: If useCount <= 2
    React->>React: Show Welcome component
    
    Note over React: Otherwise
    React->>Tauri: Setup menu event listeners
    React->>React: Show main interface
```

## Photo Import Feature

### 1. Import Directory Selection

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant FS as File System

    User->>React: Click "Import" menu
    React->>React: Show Importer component
    React->>Tauri: show_importer(path="", page=1)
    Rust->>FS: Scan export_from directories
    Rust->>FS: List directories and files
    Tauri-->>React: Return directory structure JSON
    React->>React: Render directory tree + file grid
    
    User->>React: Navigate to subdirectory
    React->>Tauri: show_importer(new_path, page=1)
    Rust->>FS: Scan selected directory
    Tauri-->>React: Return updated structure
    React->>React: Update directory view
```

### 2. Photo Selection and Import

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant JobQueue as Job Queue Service
    participant FS as File System
    participant DB as SQLite DB

    User->>React: Select photos for import
    React->>React: Update selectedForImport state
    React->>React: Show SelectedPhotoInfo component
    
    User->>React: Click "Import Selected"
    React->>Tauri: import_photos(file_list)
    Rust->>JobQueue: Submit import jobs
    JobQueue->>DB: Create job records
    Tauri-->>React: Return job_unit_id
    React->>React: Start progress polling
    
    loop Background Processing
        JobQueue->>FS: Copy file to UUID directory
        JobQueue->>Rust: Extract EXIF data
        JobQueue->>FS: Generate thumbnail
        JobQueue->>DB: Save photo metadata
        JobQueue->>Tauri: Emit progress events
        Tauri-->>React: Update progress UI
    end
    
    JobQueue->>Tauri: Emit "import finish" event
    React->>Tauri: get_dates() // Refresh date list
    React->>React: Update UI with new photos
```

## Photo Viewing Feature

### 1. Date List Loading

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant DB as SQLite DB
    participant FS as File System

    User->>React: Click "Load Date List" or app startup
    React->>Tauri: get_dates()
    Rust->>DB: Check if metadata exists
    
    alt SQLite has metadata
        Rust->>DB: get_available_dates()
        DB-->>Rust: Return date list
    else Fallback to filesystem
        Rust->>FS: Scan directory structure
        FS-->>Rust: Return date directories
    end
    
    Tauri-->>React: Return dates JSON
    React->>React: Update dateList state
    React->>React: Render DateList component
    
    React->>Tauri: get_dates_num(batch_dates)
    Rust->>DB: Count photos per date
    Tauri-->>React: Return photo counts
    React->>React: Display photo counts in date list
```

### 2. Photo Grid Display

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant DB as SQLite DB
    participant FS as File System

    User->>React: Click on date in DateList
    React->>React: Set currentDate state
    React->>Tauri: get_photos_with_filter(date, page, sort, filters)
    Rust->>DB: get_photo_meta_data_in_date(date)
    Rust->>FS: List files in date directory
    Rust->>Rust: Apply filters (star, comment, extension)
    Rust->>Rust: Sort and paginate results
    Tauri-->>React: Return Photos JSON with pagination info
    
    React->>React: Update photos state
    React->>React: Render photo grid
    
    loop For each photo
        React->>React: Generate thumbnail path
        React->>React: Set img src to Tauri file URL
        Note over React: Thumbnails loaded via convertFileSrc()
    end
    
    alt User scrolls to load more
        React->>Tauri: get_photos_with_filter(date, next_page)
        Rust->>Rust: Get next page of photos
        Tauri-->>React: Return next page
        React->>React: Append to existing photos
    end
```

### 3. Full Photo Display

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant DB as SQLite DB

    User->>React: Click photo thumbnail
    React->>React: Set currentPhotoPath, showPhotoDisplay=true
    React->>React: Show PhotosListMini component
    React->>Tauri: get_photo_info(photo_path)
    Rust->>FS: Read photo file
    Rust->>Rust: Extract EXIF data
    Rust->>DB: Get metadata (star, comment, CSS style)
    Tauri-->>React: Return PhotoMetaWithExif JSON
    React->>React: Display full-size photo + metadata
    
    User->>React: Navigate to next/previous
    React->>Tauri: get_next_photo(current_path, date, sort)
    Rust->>FS: Find next photo in sorted list
    Tauri-->>React: Return next photo path
    React->>React: Update currentPhotoPath
    React->>React: Load new photo
```

## Photo Editing Feature

### 1. Photo Transformations

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant PhotoEditor as Photo Editor
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant DB as SQLite DB

    User->>React: Click edit button on photo
    React->>PhotoEditor: Show PhotoEditor component
    PhotoEditor->>PhotoEditor: Initialize CSS transform controls
    
    User->>PhotoEditor: Adjust brightness/contrast/rotation
    PhotoEditor->>PhotoEditor: Update CSS style state
    PhotoEditor->>PhotoEditor: Apply real-time preview
    
    User->>PhotoEditor: Click "Save Style"
    PhotoEditor->>Tauri: save_css_style(photo_path, css_string)
    Rust->>DB: UPDATE photos SET css_style = ?
    Tauri-->>PhotoEditor: Return success
    PhotoEditor->>React: Update photo display
    
    User->>PhotoEditor: Click "Save As Copy"
    PhotoEditor->>PhotoEditor: Render styled image to canvas
    PhotoEditor->>PhotoEditor: Convert canvas to base64
    PhotoEditor->>Tauri: save_styled_copy_from_frontend(path, css, image_data)
    Rust->>FS: Generate unique filename with CSS hash
    Rust->>FS: Decode and save image file
    Rust->>DB: Insert new photo record
    Rust->>Rust: Generate thumbnail asynchronously
    Tauri-->>PhotoEditor: Return new file path
    PhotoEditor->>React: Trigger refreshDates event
    React->>React: Refresh photo grid
```

## Configuration Management

### 1. Preferences Update

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant FS as File System

    User->>React: Click "Preferences" menu
    React->>React: Show Preferences component
    React->>Tauri: get_config()
    Rust->>FS: Read config.json
    Tauri-->>React: Return current config
    React->>React: Populate form fields
    
    User->>React: Modify settings (paths, thumbnails, etc.)
    React->>React: Update config state
    
    User->>React: Click "SAVE"
    React->>Tauri: save_config(updated_config)
    Rust->>FS: Write config.json
    Tauri-->>React: Return success
    React->>React: Show restart message
    React->>React: Close preferences if first-time setup
```

## Job Queue Management

### 1. Job Monitoring

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant JobQueue as Job Queue Service
    participant DB as SQLite DB

    User->>React: Click "Job Queue" menu
    React->>React: Show JobQueue component
    React->>Tauri: get_all_job_units()
    JobQueue->>DB: SELECT * FROM job_units
    Tauri-->>React: Return job units JSON
    
    React->>Tauri: get_all_jobs()
    JobQueue->>DB: SELECT * FROM job_queue
    Tauri-->>React: Return jobs JSON
    React->>React: Display job status table
    
    loop Progress Monitoring
        React->>Tauri: get_job_progress(job_unit_id)
        JobQueue->>DB: Check job statuses
        Tauri-->>React: Return progress info
        React->>React: Update progress bars
    end
    
    User->>React: Click "Retry" on failed job
    React->>Tauri: retry_job(job_id)
    JobQueue->>DB: UPDATE job status to pending
    Tauri-->>React: Return success
    
    User->>React: Click "Delete" job unit
    React->>Tauri: delete_job_unit(job_unit_id)
    JobQueue->>DB: DELETE jobs and job unit
    Tauri-->>React: Return success
    React->>React: Refresh job list
```

## Database Management

### 1. Database Creation/Update

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant DB as SQLite DB
    participant FS as File System

    User->>React: Click "Create DB" menu
    React->>Tauri: Show confirmation dialog
    User->>React: Confirm database creation
    React->>Tauri: create_db()
    Tauri-->>React: Emit "create_db start" event
    
    Rust->>FS: Scan all date directories
    loop For each date directory
        Rust->>FS: List all photos
        Rust->>Rust: Extract EXIF data
        Rust->>DB: INSERT photo metadata
    end
    
    Tauri-->>React: Emit "create_db finish" event
    React->>React: Show completion message
    React->>React: Refresh photo data
```

## Error Handling Patterns

### 1. Network/File Errors

```mermaid
sequenceDiagram
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant Error as Error Handler

    React->>Tauri: Any command
    Rust->>Error: Operation fails
    Error->>Error: Log error details
    Error-->>Tauri: Return error result
    Tauri-->>React: Promise rejection
    React->>React: Show user-friendly error message
    React->>React: Update footer with error status
```

### 2. Concurrent Operation Locking

```mermaid
sequenceDiagram
    participant User1 as User Action 1
    participant User2 as User Action 2
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant Rust as Backend
    participant Lock as Locking System

    User1->>React: Trigger operation
    React->>Tauri: lock(true)
    Rust->>Lock: Acquire global lock
    Lock-->>Tauri: Return true (acquired)
    React->>Tauri: Proceed with operation
    
    User2->>React: Trigger another operation
    React->>Tauri: lock(true)
    Rust->>Lock: Try to acquire lock
    Lock-->>Tauri: Return false (busy)
    React->>React: Show "operation in progress" message
    
    Tauri->>React: Operation 1 completes
    React->>Tauri: lock(false)
    Rust->>Lock: Release global lock
    React->>React: Allow new operations
```

## Performance Optimization Strategies

### 1. Lazy Loading and Caching

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Cache as Image Cache
    participant Tauri as Tauri Bridge

    User->>React: Scroll to new photos
    React->>Cache: Check if thumbnail cached
    
    alt Thumbnail in cache
        Cache-->>React: Return cached image
    else Not in cache
        React->>Tauri: Request thumbnail via convertFileSrc
        Tauri-->>React: Return thumbnail URL
        React->>Cache: Store in cache
    end
    
    React->>React: Display thumbnail
```

### 2. Background Processing

```mermaid
sequenceDiagram
    participant User
    participant React as Frontend
    participant Tauri as Tauri Bridge
    participant JobQueue as Job Queue
    participant Worker as Background Worker

    User->>React: Trigger heavy operation
    React->>Tauri: Submit job
    Tauri->>JobQueue: Queue job
    JobQueue->>Worker: Process asynchronously
    Tauri-->>React: Return immediately
    React->>React: Show progress indicator
    
    Worker->>Worker: Process job
    Worker->>Tauri: Emit progress events
    Tauri-->>React: Update progress UI
    Worker->>JobQueue: Mark job complete
    Tauri-->>React: Emit completion event
    React->>React: Update final UI state
```

This document provides a comprehensive view of how the frontend and backend interact for each major feature in PhotoClove, showing the asynchronous nature of operations and the layered architecture pattern used throughout the application.