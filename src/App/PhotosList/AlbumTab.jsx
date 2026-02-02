import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../../services/LoggerService.js';
import { useError } from '../../context/ErrorContext.jsx';
import { unifiedCollectionService } from '../../services/UnifiedCollectionService.js';

const AlbumTab = ({ albumId, currentPhotoPath, onAlbumUpdate, onAlbumDelete }) => {
  const { handleTauriError } = useError();
  const [albumInfo, setAlbumInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [syncSettings, setSyncSettings] = useState({
    enabled: false,
    frequency: 'manual',
    maintainStructure: true
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadAlbumInfo = async () => {
    if (!albumId) return;
    
    setIsLoading(true);
    try {
      logger.info('AlbumTab', 'load_album_info_start', 'Loading album information', { albumId });
      
      // Get all albums and find the one with matching ID
      const albums = await unifiedCollectionService.getAlbums();
      const album = albums.find(a => a.id === albumId);
      
      if (!album) {
        throw new Error(`Album with id ${albumId} not found`);
      }
      
      // Convert to format expected by the component
      const albumInfo = {
        id: album.id,
        name: album.name,
        description: album.description,
        cover_photo_path: album.coverPhotoPath,
        photo_count: album.photoCount,
        created_at: album.createdAt,
        updated_at: album.updatedAt
      };
      
      setAlbumInfo(albumInfo);
      setEditedName(album.name);
      setEditedDescription(album.description || '');
      
      // TODO: Load sync settings when implemented
      // const syncConfig = await invoke('get_album_sync_settings', { albumId });
      // setSyncSettings(syncConfig);
      
      logger.info('AlbumTab', 'load_album_info_complete', 'Album information loaded', { 
        albumId, 
        albumName: album.name,
        photoCount: album.photoCount 
      });
    } catch (error) {
      logger.error('AlbumTab', 'load_failed', 'Failed to load album info', { 
        albumId, 
        error: error.message 
      });
      handleTauriError(error, 'Load album information');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAlbumInfo = async () => {
    if (!editedName.trim()) return;
    
    setIsLoading(true);
    try {
      logger.info('AlbumTab', 'save_album_info_start', 'Saving album information', { 
        albumId, 
        newName: editedName.trim(),
        hasDescription: !!editedDescription.trim()
      });
      
      await unifiedCollectionService.updateCollection(albumId, {
        name: editedName.trim(),
        description: editedDescription.trim() || null
      });
      
      await loadAlbumInfo(); // Refresh
      setIsEditing(false);
      onAlbumUpdate?.();
      
      logger.info('AlbumTab', 'album_updated', 'Album information saved successfully', { 
        albumId, 
        name: editedName.trim() 
      });
    } catch (error) {
      logger.error('AlbumTab', 'save_failed', 'Failed to save album info', { 
        albumId, 
        error: error.message 
      });
      handleTauriError(error, 'Save album information');
    } finally {
      setIsLoading(false);
    }
  };

  const setCoverPhoto = async () => {
    if (!currentPhotoPath) return;
    
    setIsLoading(true);
    try {
      logger.info('AlbumTab', 'set_cover_start', 'Setting album cover photo', { 
        albumId, 
        photoPath: currentPhotoPath 
      });
      
      await unifiedCollectionService.updateCollection(albumId, {
        coverPhotoPath: currentPhotoPath
      });
      
      await loadAlbumInfo();
      onAlbumUpdate?.();
      
      logger.info('AlbumTab', 'cover_updated', 'Album cover photo updated successfully', { 
        albumId, 
        photoPath: currentPhotoPath 
      });
    } catch (error) {
      logger.error('AlbumTab', 'cover_failed', 'Failed to update cover photo', { 
        albumId, 
        photoPath: currentPhotoPath,
        error: error.message 
      });
      handleTauriError(error, 'Set album cover');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAlbum = async () => {
    if (!albumInfo) return;
    
    const confirmed = await confirm(
      `Delete album "${albumInfo.name}"?\n\nThis will remove the album but keep all ${albumInfo.photo_count || 0} photos in your library.`,
      'Delete Album'
    );
    
    if (confirmed) {
      setIsLoading(true);
      try {
        logger.info('AlbumTab', 'delete_album_start', 'Deleting album', { 
          albumId, 
          albumName: albumInfo.name 
        });
        
        await unifiedCollectionService.deleteCollection(albumId);
        onAlbumDelete?.(albumId);
        
        logger.info('AlbumTab', 'album_deleted', 'Album deleted successfully', { 
          albumId, 
          name: albumInfo.name 
        });
      } catch (error) {
        logger.error('AlbumTab', 'delete_failed', 'Failed to delete album', { 
          albumId, 
          error: error.message 
        });
        handleTauriError(error, 'Delete album');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const cancelEdit = () => {
    setEditedName(albumInfo?.name || '');
    setEditedDescription(albumInfo?.description || '');
    setIsEditing(false);
  };

  // Load album info when albumId changes
  useEffect(() => {
    loadAlbumInfo();
  }, [albumId]);

  if (!albumId) {
    return <div>No album selected</div>;
  }

  if (isLoading && !albumInfo) {
    return <div>Loading album information...</div>;
  }

  return (
    <div className="album-tab" style={{ padding: 'var(--space-4)' }}>
      {/* Album Information Section */}
      <div className="album-info-section" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>Album Information</h3>
        
        {isEditing ? (
          <div className="album-edit-form">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Album Name:
              </label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Album name"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-base)'
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Description:
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Album description (optional)"
                rows={3}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-base)',
                  resize: 'vertical'
                }}
              />
            </div>
            <div className="edit-buttons" style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={saveAlbumInfo} 
                disabled={!editedName.trim() || isLoading}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: !editedName.trim() || isLoading ? 'var(--color-bg-muted)' : 'var(--color-primary-selected)',
                  color: !editedName.trim() || isLoading ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  border: !editedName.trim() || isLoading ? '1px solid var(--color-border-default)' : '1px solid var(--color-primary)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: !editedName.trim() || isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? '💾 Saving...' : '💾 Save'}
              </button>
              <button 
                onClick={cancelEdit}
                disabled={isLoading}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--color-bg-muted)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="album-display">
            <div className="album-name" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <strong style={{ fontSize: 'var(--font-size-lg)' }}>{albumInfo?.name}</strong>
              <button 
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--font-size-xs)'
                }}
              >
                ✏️ Edit
              </button>
            </div>
            {albumInfo?.description && (
              <div className="album-description" style={{
                marginBottom: '12px',
                color: 'var(--color-text-muted)',
                fontStyle: 'italic'
              }}>
                {albumInfo.description}
              </div>
            )}
            <div className="album-stats" style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-muted)'
            }}>
              <div style={{ marginBottom: '4px' }}>
                📸 {albumInfo?.photo_count || 0} photos
              </div>
              <div>
                📅 Created: {albumInfo?.created_at ? 
                  new Date(albumInfo.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cover Photo Section */}
      {currentPhotoPath && (
        <div className="cover-section" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)' }}>Cover Photo</h3>
          <button 
            onClick={setCoverPhoto}
            disabled={isLoading}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: isLoading ? 'var(--color-bg-muted)' : 'var(--color-success)',
              color: isLoading ? 'var(--color-text-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-base)'
            }}
          >
            {isLoading ? '🖼️ Setting...' : '🖼️ Set Current Photo as Cover'}
          </button>
        </div>
      )}

      {/* Google Photos Sync Section */}
      <div className="sync-section" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)' }}>Google Photos Sync</h3>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)', fontStyle: 'italic' }}>
          Sync configuration will be available in a future update.
        </div>
        {/* TODO: Implement sync settings when improvement #64 is ready
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={syncSettings.enabled}
            onChange={(e) => setSyncSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            style={{ marginRight: '8px' }}
          />
          Enable sync for this album
        </label>
        {syncSettings.enabled && (
          <div className="sync-options" style={{ marginLeft: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Sync frequency:
              <select
                value={syncSettings.frequency}
                onChange={(e) => setSyncSettings(prev => ({ ...prev, frequency: e.target.value }))}
                style={{ marginLeft: '8px' }}
              >
                <option value="manual">Manual only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={syncSettings.maintainStructure}
                onChange={(e) => setSyncSettings(prev => ({ ...prev, maintainStructure: e.target.checked }))}
                style={{ marginRight: '8px' }}
              />
              Maintain album structure in Google Photos
            </label>
          </div>
        )}
        */}
      </div>

      {/* Album Operations */}
      <div className="album-operations">
        <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)' }}>Album Operations</h3>
        <button 
          onClick={deleteAlbum}
          disabled={isLoading}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: isLoading ? 'var(--color-bg-muted)' : 'var(--color-danger)',
            color: isLoading ? 'var(--color-text-muted)' : 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-base)'
          }}
        >
          {isLoading ? '🗑️ Deleting...' : '🗑️ Delete Album'}
        </button>
      </div>
    </div>
  );
};

export default AlbumTab;