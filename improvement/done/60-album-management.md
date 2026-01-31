# Album Management Tab

## Overview
Add an Album management tab to the PhotosList right panel when viewing album photos. This provides users with album-specific operations like renaming, editing description, setting cover photo, and configuring sync settings.

## Problem
After improvement #71 allows users to view albums, they need a way to manage album properties and settings. Currently there's no interface for album metadata editing or configuration.

## Implementation Plan

### 1. Album Tab in Right Panel
Add new "Album" tab alongside existing Details and Selection tabs when viewing an album:

```jsx
// In PhotosList right panel
<div className="tabs">
  <div className={`tab ${activeTab === 'details' ? 'active' : ''}`}>Details</div>
  <div className={`tab ${activeTab === 'selection' ? 'active' : ''}`}>Selection</div>
  {isAlbumMode && (
    <div className={`tab ${activeTab === 'album' ? 'active' : ''}`}>Album</div>
  )}
</div>
```

### 2. Album Information Display
Show current album metadata and allow editing:
- Album name (editable)
- Album description (editable textarea) 
- Photo count (read-only)
- Creation date (read-only)
- Last modified (read-only)

### 3. Cover Photo Selection
Allow users to set album cover from current album photos:
- Show current cover photo
- "Set as Cover" button for currently viewed photo
- Preview of how cover will look in album list

### 4. Album Operations
Provide album-level operations:
- **Rename Album**: Inline editing of album name
- **Update Description**: Expandable textarea for description
- **Delete Album**: Confirmation dialog with photo count
- **Export Album**: Save album as folder structure

### 5. Google Photos Sync Configuration
Per-album Google Photos sync settings:
- Enable/disable sync for this album
- Sync frequency (manual, daily, weekly)
- Maintain album structure in Google Photos
- Override global sync settings

## Files to Create
- `src/App/PhotosList/AlbumTab.jsx` - Album management interface

## Files to Modify  
- `src/App/PhotosList.jsx` - Add Album tab integration
- `src/App/PhotosList/PhotoOption.jsx` - Add "Set as Cover" button
- `src/context/PhotoContext.jsx` - Add album management state

## Implementation Details

### AlbumTab.jsx Component
```jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../../services/LoggerService.js';

const AlbumTab = ({ albumId, currentPhotoPath, onAlbumUpdate, onAlbumDelete }) => {
  const [albumInfo, setAlbumInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [syncSettings, setSyncSettings] = useState({
    enabled: false,
    frequency: 'manual',
    maintainStructure: true
  });

  const loadAlbumInfo = async () => {
    try {
      const album = await invoke('get_album_by_id', { albumId });
      setAlbumInfo(album);
      setEditedName(album.name);
      setEditedDescription(album.description || '');
      // Load sync settings
    } catch (error) {
      logger.error('AlbumTab', 'load_failed', 'Failed to load album info', { albumId, error: error.message });
    }
  };

  const saveAlbumInfo = async () => {
    try {
      await invoke('update_album', {
        albumId,
        name: editedName.trim(),
        description: editedDescription.trim() || null
      });
      
      await loadAlbumInfo(); // Refresh
      setIsEditing(false);
      onAlbumUpdate?.();
      
      logger.info('AlbumTab', 'album_updated', 'Album information saved', { albumId, name: editedName.trim() });
    } catch (error) {
      logger.error('AlbumTab', 'save_failed', 'Failed to save album info', { albumId, error: error.message });
    }
  };

  const setCoverPhoto = async () => {
    try {
      await invoke('update_album_cover', { albumId, photoPath: currentPhotoPath });
      await loadAlbumInfo();
      logger.info('AlbumTab', 'cover_updated', 'Album cover photo updated', { albumId, photoPath: currentPhotoPath });
    } catch (error) {
      logger.error('AlbumTab', 'cover_failed', 'Failed to update cover photo', { albumId, error: error.message });
    }
  };

  const deleteAlbum = async () => {
    const confirmed = await confirm(
      `Delete album "${albumInfo.name}"?\n\nThis will remove the album but keep all ${albumInfo.photoCount} photos in your library.`,
      'Delete Album'
    );
    
    if (confirmed) {
      try {
        await invoke('delete_album', { albumId });
        onAlbumDelete?.(albumId);
        logger.info('AlbumTab', 'album_deleted', 'Album deleted successfully', { albumId, name: albumInfo.name });
      } catch (error) {
        logger.error('AlbumTab', 'delete_failed', 'Failed to delete album', { albumId, error: error.message });
      }
    }
  };

  return (
    <div className="album-tab">
      {/* Album Information Section */}
      <div className="album-info-section">
        <h3>Album Information</h3>
        
        {isEditing ? (
          <div className="album-edit-form">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Album name"
              className="album-name-input"
            />
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Album description (optional)"
              rows={3}
              className="album-description-input"
            />
            <div className="edit-buttons">
              <button onClick={saveAlbumInfo} disabled={!editedName.trim()}>
                💾 Save
              </button>
              <button onClick={() => setIsEditing(false)}>
                ❌ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="album-display">
            <div className="album-name">
              <strong>{albumInfo?.name}</strong>
              <button onClick={() => setIsEditing(true)} className="edit-button">
                ✏️ Edit
              </button>
            </div>
            {albumInfo?.description && (
              <div className="album-description">{albumInfo.description}</div>
            )}
            <div className="album-stats">
              <div>📸 {albumInfo?.photoCount} photos</div>
              <div>📅 Created: {new Date(albumInfo?.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Cover Photo Section */}
      {currentPhotoPath && (
        <div className="cover-section">
          <h3>Cover Photo</h3>
          <button onClick={setCoverPhoto} className="set-cover-button">
            🖼️ Set Current Photo as Cover
          </button>
        </div>
      )}

      {/* Google Photos Sync Section */}
      <div className="sync-section">
        <h3>Google Photos Sync</h3>
        <label>
          <input
            type="checkbox"
            checked={syncSettings.enabled}
            onChange={(e) => setSyncSettings(prev => ({ ...prev, enabled: e.target.checked }))}
          />
          Enable sync for this album
        </label>
        {syncSettings.enabled && (
          <div className="sync-options">
            <label>
              Sync frequency:
              <select
                value={syncSettings.frequency}
                onChange={(e) => setSyncSettings(prev => ({ ...prev, frequency: e.target.value }))}
              >
                <option value="manual">Manual only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={syncSettings.maintainStructure}
                onChange={(e) => setSyncSettings(prev => ({ ...prev, maintainStructure: e.target.checked }))}
              />
              Maintain album structure in Google Photos
            </label>
          </div>
        )}
      </div>

      {/* Album Operations */}
      <div className="album-operations">
        <h3>Album Operations</h3>
        <button onClick={deleteAlbum} className="delete-album-button">
          🗑️ Delete Album
        </button>
      </div>
    </div>
  );
};

export default AlbumTab;
```

### PhotosList Integration
```javascript
// Add Album tab to right panel
const renderRightPanel = () => {
  return (
    <div className="right-panel">
      <div className="tabs">
        <div className={`tab ${activeTab === 'details' ? 'active' : ''}`} 
             onClick={() => setActiveTab('details')}>Details</div>
        <div className={`tab ${activeTab === 'selection' ? 'active' : ''}`}
             onClick={() => setActiveTab('selection')}>Selection</div>
        {isAlbumMode && (
          <div className={`tab ${activeTab === 'album' ? 'active' : ''}`}
               onClick={() => setActiveTab('album')}>Album</div>
        )}
      </div>
      
      <div className="tab-content">
        {activeTab === 'album' && isAlbumMode && (
          <AlbumTab
            albumId={currentAlbumId}
            currentPhotoPath={currentPhoto?.path}
            onAlbumUpdate={handleAlbumUpdate}
            onAlbumDelete={handleAlbumDelete}
          />
        )}
        {/* Other tab content */}
      </div>
    </div>
  );
};
```

## Backend Integration
Uses existing album commands and adds new ones:
- `get_album_by_id(albumId)` - Get album details
- `update_album(albumId, name, description)` - Update album metadata
- `update_album_cover(albumId, photoPath)` - Set cover photo
- `delete_album(albumId)` - Delete album

## User Workflows

### Edit Album Information
1. User viewing album photos clicks "Album" tab
2. Sees current album name, description, stats
3. Clicks "Edit" button → inline editing form
4. Makes changes → clicks "Save"
5. Changes saved and UI updates

### Set Cover Photo
1. User viewing photo in album
2. Opens Album tab
3. Clicks "Set Current Photo as Cover"
4. Cover updated and visible in album list

### Configure Sync Settings
1. User opens Album tab
2. Toggles sync enable/disable
3. Configures frequency and options
4. Settings auto-save

### Delete Album
1. User clicks "Delete Album" button
2. Confirmation dialog shows album name and photo count
3. Confirms deletion → album removed, returns to album list

## Visual Design
- Clean, organized sections with clear headings
- Inline editing for album name/description
- Visual indicators for sync status
- Prominent but safe delete button placement

## Success Criteria
- Album tab appears only when viewing album photos
- All album operations work reliably
- Changes reflect immediately in UI
- Deletion safely removes album but preserves photos
- Sync settings persist and apply correctly

## Future Enhancements
- Album templates and smart albums
- Bulk album operations
- Album export to various formats
- Advanced sync configurations

keep context