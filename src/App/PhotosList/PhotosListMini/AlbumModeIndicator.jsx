/**
 * AlbumModeIndicator - Shows album/tag mode context in PhotosListMini
 */
import React from 'react';

/**
 * AlbumModeIndicator component displays album/tag mode context
 * @param {Object} props
 * @param {boolean} props.isAlbumMode - Whether in album mode
 * @param {boolean} props.isTagMode - Whether in tag mode
 * @param {boolean} props.isInBurstGroupMode - Whether viewing photos inside a burst group
 * @param {string} props.albumName - Name of the current album
 * @param {string} props.tagName - Name of the current tag
 */
function AlbumModeIndicator({ isAlbumMode, isTagMode, isInBurstGroupMode, albumName, tagName }) {
    // Determine which mode we're in and what name to show
    const showAlbum = isAlbumMode || (isInBurstGroupMode && albumName);
    const showTag = isTagMode || (isInBurstGroupMode && tagName && !albumName);

    if (!showAlbum && !showTag) return null;

    const displayName = showAlbum ? (albumName || 'Album') : (tagName || 'Tag');
    const helpText = showAlbum
        ? 'DEL: Remove | Ctrl+DEL: Delete'
        : 'DEL: Remove tag | Ctrl+DEL: Delete';

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
                <div>{displayName}</div>
                <div style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.8, marginTop: '2px' }}>
                    {helpText}
                </div>
            </div>
        </div>
    );
}

export default AlbumModeIndicator;
