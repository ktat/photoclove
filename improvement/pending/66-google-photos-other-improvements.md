# Google Photos - Other Improvements (Future)

## Additional Features for Future Consideration

### 1. Token Management
- Implement automatic token refresh in job processor
- Store refreshed tokens back to localStorage
- Handle token expiration gracefully

### 2. Duplicate Detection
- Check `google_photos_url` column before uploading
- Skip photos already uploaded to Google Photos
- Show upload status indicators on photo thumbnails

### 3. Album Management
- Complete the `todo!()` implementations in google_photos.rs
- Add album creation/selection in upload dialog
- Support uploading to specific albums

### 4. Error Handling Improvements
- Categorize errors (retryable vs permanent)
- Implement exponential backoff for retries
- Better user feedback for specific error types

### 5. UI/UX Enhancements
- Show Google Photos icon on uploaded photos
- Add "View in Google Photos" option
- Batch operation history view
- Upload queue management interface

### 6. Advanced Features
- Two-way sync (download from Google Photos)
- Selective sync by date/album
- Background sync scheduling
- Bandwidth throttling options

### 7. Security Enhancements
- Encrypt tokens at rest
- Implement secure token storage
- Add option to clear stored credentials

### 8. Alternative Cloud Services
Consider implementing similar integrations for:
- Amazon Photos
- iCloud Photos
- OneDrive
- Dropbox
- Generic WebDAV

### 9. Plugin Architecture
- Make cloud sync extensible
- Allow community plugins
- Standardized cloud provider interface

### 10. Performance Optimizations
- Parallel upload of multiple batches
- Smart chunking based on file sizes
- Resume interrupted uploads
- Optimize for different file types (JPEG, RAW, video)