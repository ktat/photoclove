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
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
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
            marginBottom: 'var(--space-5)'
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
                width: 'var(--space-6)',
                height: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>

          <p style={{
            margin: '0 0 var(--space-5) 0',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-base)'
          }}>
            Create a new album with {selectedPhotosCount} selected photo{selectedPhotosCount !== 1 ? 's' : ''}
          </p>

          {/* Album Name Input */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
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
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-base)',
                boxSizing: 'border-box',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Album Description Input */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
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
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
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
            gap: 'var(--space-3)',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
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
                padding: 'var(--space-2) var(--space-4)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
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