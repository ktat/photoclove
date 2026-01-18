/**
 * AlbumModeIndicator - Shows album mode context in PhotosListMini
 */
import React from 'react';

/**
 * AlbumModeIndicator component displays album mode context
 * @param {Object} props
 * @param {boolean} props.isAlbumMode - Whether in album mode
 * @param {boolean} props.isInBurstGroupMode - Whether viewing photos inside a burst group
 * @param {string} props.albumName - Name of the current album
 */
function AlbumModeIndicator({ isAlbumMode, isInBurstGroupMode, albumName }) {
    // Show when in album mode OR when in burst group mode with an album name
    if (!isAlbumMode && !(isInBurstGroupMode && albumName)) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: 'var(--font-size-base)',
            zIndex: 100
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div>{albumName || 'Album'}</div>
                <div style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.8, marginTop: '2px' }}>
                    DEL: Remove | Ctrl+DEL: Delete
                </div>
            </div>
        </div>
    );
}

export default AlbumModeIndicator;
