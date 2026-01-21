import React from 'react';

/**
 * PhotoLoading Component
 *
 * Displays a cute loading state with context-aware messages
 * based on the current view mode
 */
function PhotoLoading({ viewModeObj }) {
    const getLoadingConfig = () => {
        if (viewModeObj?.isTrashMode()) {
            return {
                emoji: '🗑️',
                trashContent: '🖼️',
                message: 'Searching in trash',
                subtext: 'Looking for deleted photos',
                customSparkles: ['🔍', null, null],
                staticEmoji: true,
                searchAnimation: true
            };
        }
        if (viewModeObj?.isSearchMode()) {
            return {
                emoji: '🔍',
                message: 'Searching photos',
                subtext: 'Please wait a moment'
            };
        }
        if (viewModeObj?.isAlbumListMode()) {
            return {
                emoji: '📚',
                message: 'Loading albums',
                subtext: 'Please wait a moment'
            };
        }
        if (viewModeObj?.isAlbumMode()) {
            return {
                emoji: '📚',
                message: 'Loading album',
                subtext: 'Please wait a moment'
            };
        }
        if (viewModeObj?.isTagListMode()) {
            return {
                emoji: '🏷️',
                message: 'Loading tags',
                subtext: 'Please wait a moment'
            };
        }
        if (viewModeObj?.isTagMode()) {
            return {
                emoji: '🏷️',
                message: 'Loading tagged photos',
                subtext: 'Please wait a moment'
            };
        }
        if (viewModeObj?.isImportMode()) {
            return {
                emoji: '📥',
                message: 'Scanning for photos',
                subtext: 'Please wait a moment'
            };
        }
        // Default
        return {
            emoji: '📷',
            message: 'Loading your photos',
            subtext: 'Please wait a moment'
        };
    };

    const config = getLoadingConfig();

    return (
        <div id="photoLoading" className="photoLoadingOn">
            <div className="loading-content">
                <div className="loading-icon">
                    {config.trashContent && (
                        <span className="trash-content">{config.trashContent}</span>
                    )}
                    <span className={`camera-emoji${config.staticEmoji ? ' static' : ''}`}>{config.emoji}</span>
                    {(config.customSparkles?.[0] !== null) && (
                        <span className={`sparkle sparkle-1${config.searchAnimation ? ' search-move' : ''}`}>
                            {config.customSparkles?.[0] || '✨'}
                        </span>
                    )}
                    {(config.customSparkles?.[1] !== null) && (
                        <span className={`sparkle sparkle-2${config.searchAnimation ? ' search-move' : ''}`}>
                            {config.customSparkles?.[1] || '✨'}
                        </span>
                    )}
                    {(config.customSparkles?.[2] !== null) && (
                        <span className={`sparkle sparkle-3${config.searchAnimation ? ' search-move' : ''}`}>
                            {config.customSparkles?.[2] || '✨'}
                        </span>
                    )}
                </div>
                <h2 className="loading-text">
                    {config.message}
                    <span className="loading-dots">
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                    </span>
                </h2>
                <p className="loading-subtext">{config.subtext}</p>
            </div>
        </div>
    );
}

export default PhotoLoading;
