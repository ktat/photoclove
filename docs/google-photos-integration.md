# Google Photos Integration Documentation

PhotoClove integrates with Google Photos for photo backup and synchronization.

## Features

### Photo Upload
- Batch upload of selected photos
- Uses Google Photos API batchCreate endpoint
- Supports multiple file formats (JPEG, PNG, etc.)

### URL Storage
- Stores Google Photos URLs in the database
- Enables tracking of uploaded photos
- Prevents duplicate uploads

### Authentication
- OAuth2 authentication flow
- Access token and refresh token management
- Token storage in browser localStorage

## Implementation Details

### Upload Process
1. User selects photos from the photo list
2. Authentication tokens are retrieved from localStorage
3. Photos are uploaded using the `/uploads` endpoint
4. Upload tokens are obtained for each photo
5. Photos are created using `mediaItems:batchCreate`
6. Response URLs are stored in the database

### Database Integration
- `google_photos_url` column in photo_metadata table
- `save_google_photos_url(photo_path, url)` method
- Automatic URL storage on successful upload

### API Endpoints Used
- `https://photoslibrary.googleapis.com/v1/uploads`: File upload
- `https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate`: Create media items
- `https://photoslibrary.googleapis.com/v1/albums`: Album management

## Configuration

### OAuth Setup
1. Create Google Cloud Project
2. Enable Google Photos Library API
3. Configure OAuth consent screen
4. Create OAuth2 credentials
5. Add authorized redirect URIs

### Required Scopes
- `https://www.googleapis.com/auth/photoslibrary.appendonly`
- `https://www.googleapis.com/auth/photoslibrary.readonly`

## Usage

### Upload Photos
1. Select photos from the photo list
2. Go to Selection tab in DirectoryMenu
3. Choose "Upload to Google Photos" from operations dropdown
4. Confirm upload action
5. Photos are uploaded and URLs are stored

### Track Upload Status
- Uploaded photos have their Google Photos URLs stored
- Can be used to avoid duplicate uploads
- URLs can be used to access photos directly in Google Photos

## Error Handling

### Common Issues
- **401 Unauthorized**: Token expired, requires re-authentication
- **403 Forbidden**: Insufficient permissions
- **413 Payload Too Large**: File size exceeds limits
- **500 Internal Server Error**: Google Photos API issues

### Retry Logic
- Automatic retry on transient failures
- Token refresh on authentication errors
- User notification on persistent failures

## Security Considerations

### Token Management
- Tokens stored in browser localStorage
- Automatic token refresh when expired
- Secure token transmission over HTTPS

### Data Privacy
- Only selected photos are uploaded
- No automatic photo scanning
- User controls all upload operations

## Future Enhancements

- Album creation and management
- Download from Google Photos
- Sync status indicators
- Batch operation progress tracking
- Automated backup scheduling