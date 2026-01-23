import React, { useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const ContextualDeleteModal = ({
  isOpen,
  operation, // 'removeFromAlbum' | 'deleteFile' | 'moveToTrash' | 'restoreFromTrash' | 'permanentDelete'
  photoPath, // Single file path (for single file operations)
  photoCount, // Number of files (for batch operations)
  albumName,
  onConfirm,
  onCancel
}) => {
  // Keyboard event handler for ESC and Enter
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        logger.debug('ContextualDeleteModal', 'esc_pressed', 'User pressed ESC to cancel');
        onCancel();
      } else if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        logger.debug('ContextualDeleteModal', 'enter_pressed', 'User pressed Enter to confirm');
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const getModalContent = () => {
    // Determine if this is a batch operation
    const isBatch = photoCount !== undefined && photoCount !== null;
    const count = isBatch ? photoCount : 1;
    const filename = photoPath?.split('/').pop() || 'photo';

    // For batch operations, show count-based message
    const fileLabel = isBatch
      ? `${count} selected file${count !== 1 ? 's' : ''}`
      : `'${filename}'`;

    switch (operation) {
      case 'removeFromAlbum':
        return {
          title: 'Remove from Album',
          message: `Remove ${fileLabel} from album "${albumName}"?`,
          description: 'Files will remain in your library and other albums.',
          confirmText: 'Remove from Album',
          confirmStyle: { backgroundColor: 'var(--color-warning)' }
        };

      case 'deleteFile':
      case 'moveToTrash':
        return {
          title: 'Move to Trash',
          message: `Move ${fileLabel} to trash?`,
          description: 'Files will be removed from library and moved to trash.',
          confirmText: 'Move to Trash',
          confirmStyle: { backgroundColor: 'var(--color-danger)' }
        };

      case 'restoreFromTrash':
        return {
          title: 'Restore from Trash',
          message: `Restore ${fileLabel} to original location?`,
          description: 'Files will be restored from trash to library.',
          confirmText: 'Restore',
          confirmStyle: { backgroundColor: 'var(--color-success)' }
        };

      case 'permanentDelete':
        return {
          title: '⚠️ Permanent Delete',
          message: `Permanently delete ${fileLabel}?`,
          description: '⚠️ This action CANNOT be undone!\nFiles will be completely removed from your system.',
          confirmText: 'Delete Permanently',
          confirmStyle: { backgroundColor: 'var(--color-danger)' }
        };

      default:
        return {
          title: 'Confirm',
          message: `Process ${fileLabel}?`,
          description: '',
          confirmText: 'Confirm',
          confirmStyle: { backgroundColor: 'var(--color-primary)' }
        };
    }
  };

  const content = getModalContent();

  const handleConfirm = () => {
    logger.info('ContextualDeleteModal', 'action_confirmed', 'User confirmed action', {
      operation,
      photoPath,
      photoCount,
      albumName
    });
    onConfirm();
  };

  const handleCancel = () => {
    logger.info('ContextualDeleteModal', 'action_cancelled', 'User cancelled action', {
      operation,
      photoPath,
      photoCount
    });
    onCancel();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }} onClick={handleCancel}>
      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-size-2xl)' }}>{content.title}</h2>

        <p style={{
          fontWeight: 'bold',
          margin: '16px 0',
          fontSize: 'var(--font-size-lg)',
          color: 'var(--color-text-primary)'
        }}>
          {content.message}
        </p>

        <p style={{
          color: 'var(--color-text-muted)',
          marginBottom: '20px',
          lineHeight: '1.4',
          fontSize: 'var(--font-size-base)'
        }}>
          {content.description}
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: 'var(--color-bg-muted)',
              color: 'white',
              fontSize: 'var(--font-size-base)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'white',
              fontSize: 'var(--font-size-base)',
              ...content.confirmStyle
            }}
          >
            {content.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextualDeleteModal;