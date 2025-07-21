import React from 'react';
import { logger } from '../services/LoggerService.js';

const ContextualDeleteModal = ({ 
  isOpen, 
  operation, // 'removeFromAlbum' | 'deleteFile'
  photoPath,
  albumName,
  onConfirm,
  onCancel 
}) => {
  if (!isOpen) return null;

  const getModalContent = () => {
    const filename = photoPath?.split('/').pop() || 'photo';
    
    if (operation === 'removeFromAlbum') {
      return {
        title: 'Remove from Album',
        message: `Remove '${filename}' from album '${albumName}'?`,
        description: 'The photo will remain in your library and other albums.',
        confirmText: 'Remove from Album',
        confirmStyle: { backgroundColor: '#F59E0B' } // Orange
      };
    } else {
      return {
        title: 'Delete Photo File',
        message: `Permanently delete '${filename}'?`,
        description: albumName 
          ? `This will delete the file from your computer AND remove it from album '${albumName}'.`
          : 'This will permanently remove the photo from your library.',
        confirmText: 'Delete Permanently',
        confirmStyle: { backgroundColor: '#DC2626' } // Red
      };
    }
  };

  const content = getModalContent();

  const handleConfirm = () => {
    logger.info('ContextualDeleteModal', 'action_confirmed', 'User confirmed action', {
      operation,
      photoPath,
      albumName
    });
    onConfirm();
  };

  const handleCancel = () => {
    logger.info('ContextualDeleteModal', 'action_cancelled', 'User cancelled action', {
      operation,
      photoPath
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
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>{content.title}</h2>
        
        <p style={{
          fontWeight: 'bold',
          margin: '16px 0',
          fontSize: '16px',
          color: '#1F2937'
        }}>
          {content.message}
        </p>
        
        <p style={{
          color: '#6B7280',
          marginBottom: '20px',
          lineHeight: '1.4',
          fontSize: '14px'
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
              backgroundColor: '#6B7280',
              color: 'white',
              fontSize: '14px'
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
              fontSize: '14px',
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