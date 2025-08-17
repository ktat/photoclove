import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { useError } from '../context/ErrorContext.jsx';
import './AlbumSelectorModal.css';

const AlbumSelectorModal = ({ isOpen, onClose, onConfirm, selectedPhotosCount = 0 }) => {
  const { handleTauriError } = useError();
  const [albums, setAlbums] = useState([]);
  const [filteredAlbums, setFilteredAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const loadAlbums = async () => {
    setIsLoading(true);
    try {
      logger.info('AlbumSelectorModal', 'load_albums_start', 'Loading albums for selection', { selectedPhotosCount });
      const albumsResult = await invoke('get_photos_unified', {
        request: {
          type: 'search',
          search_type: 'all_albums'
        }
      });
      const albumList = JSON.parse(albumsResult);
      
      // Convert tuple format to object format: [id, name, description, cover_photo_path, photo_count]
      const processedAlbums = albumList.map(album => ({
        id: album[0],
        name: album[1],
        description: album[2],
        coverPhoto: album[3] || null,
        photo_count: album[4] || 0
      }));
      
      setAlbums(processedAlbums);
      setFilteredAlbums(processedAlbums);
      logger.info('AlbumSelectorModal', 'load_albums_complete', 'Albums loaded successfully', { albumCount: processedAlbums.length });
    } catch (error) {
      logger.error('AlbumSelectorModal', 'load_albums_failed', 'Failed to load albums', { error: error.message });
      handleTauriError(error, 'Load albums');
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
    logger.debug('AlbumSelectorModal', 'albums_filtered', 'Albums filtered by search term', { 
      searchTerm, 
      filteredCount: filtered.length, 
      totalCount: albums.length 
    });
  }, [searchTerm, albums]);

  const handleSubmit = async () => {
    if (!selectedAlbumId) return;
    
    setIsAdding(true);
    try {
      const selectedAlbum = albums.find(album => album.id === selectedAlbumId);
      logger.info('AlbumSelectorModal', 'add_to_album_start', 'Adding photos to selected album', { 
        albumId: selectedAlbumId,
        albumName: selectedAlbum?.name,
        photoCount: selectedPhotosCount
      });
      
      await onConfirm(selectedAlbumId);
      
      logger.info('AlbumSelectorModal', 'add_to_album_complete', 'Photos added to album successfully', { 
        albumId: selectedAlbumId,
        albumName: selectedAlbum?.name,
        photoCount: selectedPhotosCount
      });
    } catch (error) {
      logger.error('AlbumSelectorModal', 'add_to_album_failed', 'Failed to add photos to album', { 
        albumId: selectedAlbumId, 
        error: error.message 
      });
      // Error handling is done in the parent component
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (!isAdding) {
      logger.debug('AlbumSelectorModal', 'modal_closed', 'Album selector modal closed by user');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--text)' }}>Add to Album</h2>
            <button 
              onClick={handleClose}
              disabled={isAdding}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: isAdding ? 'not-allowed' : 'pointer',
                color: 'var(--text)',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: '14px' }}>
            Add {selectedPhotosCount} photo{selectedPhotosCount !== 1 ? 's' : ''} to an existing album
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search albums..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isAdding}
            className="album-search-input"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text)'
            }}
          />
        </div>

        {/* Album List */}
        <div style={{ 
          flex: 1,
          maxHeight: '300px', 
          overflowY: 'auto', 
          marginBottom: '20px',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          backgroundColor: 'var(--bg)'
        }}>
          {isLoading ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: 'var(--text)',
              fontSize: '14px'
            }}>
              Loading albums...
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: 'var(--text)',
              fontSize: '14px'
            }}>
              {searchTerm ? 'No albums match your search' : 'No albums found'}
            </div>
          ) : (
            filteredAlbums.map(album => (
              <div 
                key={album.id}
                onClick={() => !isAdding && setSelectedAlbumId(album.id)}
                style={{
                  padding: '12px',
                  cursor: isAdding ? 'not-allowed' : 'pointer',
                  backgroundColor: selectedAlbumId === album.id ? 'rgba(33, 150, 243, 0.2)' : 'transparent',
                  border: selectedAlbumId === album.id ? '2px solid #2196F3' : 'none',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background-color 0.2s',
                  opacity: isAdding ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isAdding && selectedAlbumId !== album.id) {
                    e.target.style.backgroundColor = 'var(--bg-elevated)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAdding && selectedAlbumId !== album.id) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ 
                  fontWeight: selectedAlbumId === album.id ? 'bold' : 'normal',
                  fontSize: '14px',
                  marginBottom: '4px',
                  color: 'var(--text)'
                }}>
                  {album.name}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text)'
                }}>
                  📸 {album.photo_count || 0} photos
                  {album.description && (
                    <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                      • {album.description}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button 
            onClick={handleClose} 
            disabled={isAdding}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text)',
              cursor: isAdding ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isAdding ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!selectedAlbumId || isAdding}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: (!selectedAlbumId || isAdding) ? '#ccc' : '#2196F3',
              color: 'white',
              cursor: (!selectedAlbumId || isAdding) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {isAdding ? '📸 Adding...' : '📸 Add to Album'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumSelectorModal;