import React, { useState } from 'react';
import { logger } from '../services/LoggerService.js';

const AlbumCreationModal = ({ isOpen, onClose, onConfirm, selectedPhotosCount = 0 }) => {
  const [albumName, setAlbumName] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!albumName.trim()) {
      return;
    }
    
    setIsCreating(true);
    try {
      logger.info('AlbumCreationModal', 'create_album_start', 'Creating new album', {
        albumName: albumName.trim(),
        hasDescription: !!albumDescription.trim(),
        selectedPhotosCount
      });
      
      await onConfirm({
        name: albumName.trim(),
        description: albumDescription.trim() || null
      });
      
      // Reset form
      setAlbumName('');
      setAlbumDescription('');
      
      logger.info('AlbumCreationModal', 'create_album_complete', 'Album creation completed', {
        albumName: albumName.trim()
      });
    } catch (error) {
      logger.error('AlbumCreationModal', 'create_album_failed', 'Failed to create album', {
        albumName: albumName.trim(),
        error: error.message
      });
      // Error handling is done in the parent component
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setAlbumName('');
      setAlbumDescription('');
      logger.debug('AlbumCreationModal', 'modal_closed', 'Album creation modal closed by user');
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
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>Create New Album</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'var(--font-size-xl)',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-primary)',
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

          <p style={{
            margin: '0 0 20px 0',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-base)'
          }}>
            Create a new album with {selectedPhotosCount} selected photo{selectedPhotosCount !== 1 ? 's' : ''}
          </p>

          {/* Album Name Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontWeight: 'bold',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)'
            }}>
              Album Name *
            </label>
            <input
              type="text"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="Enter album name..."
              disabled={isCreating}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-border-default)',
                borderRadius: '4px',
                fontSize: 'var(--font-size-base)',
                boxSizing: 'border-box',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Album Description Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontWeight: 'bold',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)'
            }}>
              Description (optional)
            </label>
            <textarea
              value={albumDescription}
              onChange={(e) => setAlbumDescription(e.target.value)}
              placeholder="Enter album description..."
              disabled={isCreating}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-border-default)',
                borderRadius: '4px',
                fontSize: 'var(--font-size-base)',
                boxSizing: 'border-box',
                resize: 'vertical',
                minHeight: '60px',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--color-border-default)',
                borderRadius: '4px',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-base)',
                opacity: isCreating ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!albumName.trim() || isCreating}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: (!albumName.trim() || isCreating) ? 'var(--color-bg-muted)' : 'var(--color-success)',
                color: (!albumName.trim() || isCreating) ? 'var(--color-text-muted)' : 'white',
                cursor: (!albumName.trim() || isCreating) ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'bold'
              }}
            >
              {isCreating ? '📚 Creating...' : '📚 Create Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlbumCreationModal;