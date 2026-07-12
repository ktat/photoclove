import React, { useEffect } from 'react';
import { logger } from '../../services/LoggerService.js';

/**
 * PhotoLoading Component
 *
 * Displays a cute loading state with context-aware messages
 * based on the current view mode
 */
function PhotoLoading({ viewModeObj }) {
    // Render-loop probe: requestAnimationFrame stops firing when the webview
    // rendering pipeline stalls (the exact condition where the loading
    // animation appears frozen). Logs each stall >300ms with its duration so
    // the freeze window and its length are visible in the frontend log.
    useEffect(() => {
        const mountedAt = performance.now();
        let last = mountedAt;
        let rafId;
        let stallCount = 0;
        const tick = (now) => {
            const gap = now - last;
            if (gap > 300) {
                stallCount += 1;
                logger.warn('PhotoLoading', 'frame_stall', 'Loading animation frames stalled', {
                    stallMs: Math.round(gap),
                    sinceMountMs: Math.round(now - mountedAt)
                });
            }
            last = now;
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        logger.info('PhotoLoading', 'overlay_mounted', 'Loading overlay mounted', {});
        return () => {
            cancelAnimationFrame(rafId);
            logger.info('PhotoLoading', 'overlay_unmounted', 'Loading overlay unmounted', {
                shownMs: Math.round(performance.now() - mountedAt),
                stallCount
            });
        };
    }, []);
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
