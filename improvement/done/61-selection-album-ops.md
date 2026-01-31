# Selection Tab Album Operations

## Overview
Extend the existing Selection tab in DirectoryMenu to support album operations. Add context-aware dropdown options for creating albums and adding photos to existing albums, making album management seamlessly integrated with the current photo selection workflow.

## Problem
After improvements #71 (album navigation) and #72 (album management), users need a way to:
- Create new albums from selected photos
- Add selected photos to existing albums  
- Remove photos from albums when in album view mode
- Have different operations available based on current context (date view vs album view)

## Implementation Plan

### 1. Extend DirectoryMenu Selection Dropdown
Add new album operations to the existing Selection tab dropdown:

```jsx
// Context-aware dropdown options
<select onChange={(e) => doOperation(e)}>
  <option value="select">Select an Operation</option>
  
  {/* Album-specific operations (only in album mode) */}
  {isAlbumMode && (
    <option value="removeFromAlbum">Remove from Album</option>
  )}
  
  {/* Standard operations (all modes) */}
  <option value="uploadToGooglePhotos">Upload to Google Photos</option>
  <option value="deleteFiles">Delete files</option>
  
  {/* Album operations (all modes) */}
  <option value="createAlbum">Create Album</option>
  <option value="addToAlbum">Add to Existing Album</option>
</select>
```

### 2. Album Creation Modal Integration
Use the already created AlbumCreationModal component:
- Shows when "Create Album" is selected
- Displays count of selected photos
- Creates album and adds all selected photos
- Provides success feedback

### 3. Album Selector Modal
Create new AlbumSelectorModal for adding photos to existing albums:
- Lists all available albums
- Shows album photo counts
- Allows searching/filtering albums
- Confirms addition and provides feedback

### 4. Context-Aware Operation Handling
Extend the existing `doOperation()` function to handle album operations:

```javascript
function doOperation(e) {
  const selected = e.target.value;
  
  if (selected === "uploadToGooglePhotos") {
    uploadToGooglePhotos();
  } else if (selected === "deleteFiles") {
    deleteFiles();
  } else if (selected === "removeFromAlbum") {
    removeFromCurrentAlbum();           // NEW - Album mode only
  } else if (selected === "createAlbum") {
    showCreateAlbumModal();            // NEW
  } else if (selected === "addToAlbum") {
    showAddToAlbumModal();             // NEW
  }
  
  e.target.value = "";
}
```

### 5. Album Operation Functions
Implement the new album operation functions:

```javascript
// Remove selected photos from current album
async function removeFromCurrentAlbum() {
  if (!props.albumId || props.photoSelection.length === 0) return;
  
  const count = props.photoSelection.length;
  const confirmed = await confirm(
    `Remove ${count} photo${count > 1 ? 's' : ''} from this album?\n\nPhotos will remain in your library.`,
    "Remove from Album"
  );
  
  if (confirmed) {
    try {
      for (const photoPath of props.photoSelection) {
        await invoke("remove_photo_from_album", {
          albumId: props.albumId,
          photoPath: photoPath
        });
      }
      
      props.clearPhotoSelection();
      props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} removed from album`);
      props.refreshPhotos?.(); // Refresh the album view
      
      logger.info('DirectoryMenu', 'photos_removed_from_album', 'Photos removed from album successfully', {
        albumId: props.albumId,
        photoCount: count
      });
    } catch (error) {
      handleTauriError(error, 'Remove from album');
    }
  }
}

// Show album creation modal
function showCreateAlbumModal() {
  if (props.photoSelection.length === 0) return;
  
  setShowAlbumCreationModal(true);
}

// Show add to album modal  
function showAddToAlbumModal() {
  if (props.photoSelection.length === 0) return;
  
  setShowAlbumSelectorModal(true);
}

// Create album from selected photos
async function createAlbumFromSelection(albumData) {
  try {
    const albumId = await invoke("create_album", {
      name: albumData.name,
      description: albumData.description
    });
    
    // Add all selected photos to the new album
    for (const photoPath of props.photoSelection) {
      await invoke("add_photo_to_album", {
        albumId: albumId,
        photoPath: photoPath
      });
    }
    
    const photoCount = props.photoSelection.length;
    props.clearPhotoSelection();
    props.addFooterMessage(`Album "${albumData.name}" created with ${photoCount} photos`);
    
    logger.info('DirectoryMenu', 'album_created_from_selection', 'Album created from selected photos', {
      albumName: albumData.name,
      photoCount
    });
    
    setShowAlbumCreationModal(false);
  } catch (error) {
    handleTauriError(error, 'Create album');
  }
}

// Add selected photos to existing album
async function addPhotosToAlbum(albumId) {
  try {
    for (const photoPath of props.photoSelection) {
      await invoke("add_photo_to_album", {
        albumId: albumId,
        photoPath: photoPath
      });
    }
    
    const photoCount = props.photoSelection.length;
    props.clearPhotoSelection();
    props.addFooterMessage(`${photoCount} photo${photoCount > 1 ? 's' : ''} added to album`);
    
    logger.info('DirectoryMenu', 'photos_added_to_album', 'Photos added to album successfully', {
      albumId,
      photoCount
    });
    
    setShowAlbumSelectorModal(false);
  } catch (error) {
    handleTauriError(error, 'Add to album');
  }
}
```

## Files to Create
- `src/components/AlbumSelectorModal.jsx` - Modal for selecting existing albums

## Files to Modify
- `src/App/PhotosList/DirectoryMenu.jsx` - Extend Selection dropdown and operations
- `src/components/AlbumCreationModal.jsx` - Already created, minor integration updates

## Implementation Details

### AlbumSelectorModal.jsx
```jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

const AlbumSelectorModal = ({ isOpen, onClose, onConfirm, selectedPhotosCount = 0 }) => {
  const [albums, setAlbums] = useState([]);
  const [filteredAlbums, setFilteredAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const loadAlbums = async () => {
    setIsLoading(true);
    try {
      const albumList = await invoke('get_all_albums');
      setAlbums(albumList);
      setFilteredAlbums(albumList);
    } catch (error) {
      logger.error('AlbumSelectorModal', 'load_albums_failed', 'Failed to load albums', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
      setSearchTerm('');
      setSelectedAlbumId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = albums.filter(album => 
      album.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAlbums(filtered);
  }, [searchTerm, albums]);

  const handleSubmit = async () => {
    if (!selectedAlbumId) return;
    
    setIsAdding(true);
    try {
      await onConfirm(selectedAlbumId);
    } catch (error) {
      logger.error('AlbumSelectorModal', 'add_to_album_failed', 'Failed to add photos to album', { 
        albumId: selectedAlbumId, 
        error: error.message 
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ /* Modal overlay styles */ }}>
      <div style={{ /* Modal content styles */ }}>
        {/* Header */}
        <div style={{ /* Header styles */ }}>
          <h2>Add to Album</h2>
          <p>Add {selectedPhotosCount} photo{selectedPhotosCount !== 1 ? 's' : ''} to an existing album</p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search albums..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ /* Search input styles */ }}
          />
        </div>

        {/* Album List */}
        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
          {isLoading ? (
            <div>Loading albums...</div>
          ) : filteredAlbums.length === 0 ? (
            <div>No albums found</div>
          ) : (
            filteredAlbums.map(album => (
              <div 
                key={album.id}
                onClick={() => setSelectedAlbumId(album.id)}
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  backgroundColor: selectedAlbumId === album.id ? '#E3F2FD' : 'transparent',
                  border: selectedAlbumId === album.id ? '2px solid #2196F3' : '1px solid #E0E0E0',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{album.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {album.photo_count} photos
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={isAdding}>
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!selectedAlbumId || isAdding}
            style={{ /* Primary button styles */ }}
          >
            {isAdding ? 'Adding...' : 'Add to Album'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumSelectorModal;
```

### DirectoryMenu Integration
```jsx
// Add modal state
const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);

// Add modals to JSX
return (
  <div id="directory-maintenance">
    {/* Existing DirectoryMenu content */}
    
    {/* Album Creation Modal */}
    <AlbumCreationModal
      isOpen={showAlbumCreationModal}
      onClose={() => setShowAlbumCreationModal(false)}
      onConfirm={createAlbumFromSelection}
      selectedPhotosCount={props.photoSelection.length}
    />
    
    {/* Album Selector Modal */}
    <AlbumSelectorModal
      isOpen={showAlbumSelectorModal}
      onClose={() => setShowAlbumSelectorModal(false)}
      onConfirm={addPhotosToAlbum}
      selectedPhotosCount={props.photoSelection.length}
    />
  </div>
);
```

## Backend Integration
Uses existing album commands from improvement #56:
- `create_album(name, description)` - Create new album
- `get_all_albums()` - List all albums for selector
- `add_photo_to_album(albumId, photoPath)` - Add photo to album
- `remove_photo_from_album(albumId, photoPath)` - Remove photo from album

## User Workflows

### Create Album from Selection
1. User selects multiple photos
2. Opens Selection tab
3. Chooses "Create Album" from dropdown
4. Modal opens → enters album name and description
5. Clicks "Create Album" → album created with selected photos
6. Success message shown, selection cleared

### Add to Existing Album
1. User selects photos
2. Opens Selection tab
3. Chooses "Add to Existing Album"
4. Modal shows list of albums with search
5. Selects target album → clicks "Add to Album"
6. Photos added, success message shown

### Remove from Album (Album Mode Only)
1. User viewing album photos, selects some photos
2. Opens Selection tab
3. Sees "Remove from Album" option (only in album mode)
4. Clicks → confirmation dialog
5. Confirms → photos removed from album, view refreshed

## Success Criteria
- Selection dropdown shows correct options based on context
- Album creation workflow integrates smoothly
- Album selector allows easy album selection and searching
- Remove from album only appears in album view mode
- All operations provide clear feedback and error handling
- Selection cleared appropriately after operations

## Testing Plan
1. Test album creation from various photo selections
2. Test adding photos to existing albums
3. Test album removal in album view mode
4. Test context-aware dropdown options
5. Test modal interactions and error handling
6. Test operation feedback and state management

keep context