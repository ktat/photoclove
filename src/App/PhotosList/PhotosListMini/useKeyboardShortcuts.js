/**
 * useKeyboardShortcuts - Hook for handling keyboard shortcuts in PhotosListMini
 */
import { useCallback } from 'react';
import { logger } from '../../../services/LoggerService.js';

/**
 * Custom hook for handling keyboard shortcuts in PhotosListMini
 *
 * @param {Object} handlers - Handler functions
 * @param {Function} handlers.nextPhoto - Navigate to next photo
 * @param {Function} handlers.prevPhoto - Navigate to previous photo
 * @param {Function} handlers.togglePhotoSelected - Toggle photo selection with feedback
 * @param {Function} handlers.changeStar - Change star rating
 * @param {Function} handlers.favoritePhoto - Favorite operation (select + star)
 * @param {Function} handlers.setShowSideMenu - Toggle side menu visibility
 * @param {Function} handlers.showRemoveFromAlbumModal - Show remove from album modal
 * @param {Function} handlers.showDeleteFileModal - Show delete file modal
 * @param {Function} handlers.showPermanentDeleteModal - Show permanent delete modal
 * @param {Function} handlers.setPhotosListMiniClosed - Set mini list closed state
 * @param {Function} handlers.setShowHelp - Set show help state
 * @param {Function} handlers.setPhotoZoom - Set photo zoom level
 * @param {Function} handlers.SetImgStyle - Set image style
 * @param {Function} handlers.setPhotoZoomReady - Set photo zoom ready state
 * @param {Object} state - Current state values
 * @param {boolean} state.isImportMode - Whether in import mode
 * @param {boolean} state.isTrashMode - Whether in trash mode
 * @param {boolean} state.isAlbumMode - Whether in album mode
 * @param {string} state.albumId - Album ID if in album mode
 * @param {string} state.currentPhotoPath - Current photo path
 * @param {boolean} state.showSideMenu - Show side menu flag
 * @param {boolean} state.showHelp - Show help flag
 * @param {boolean} state.photoZoomReady - Photo zoom ready flag
 * @param {boolean} state.burstRestrictionsActive - Whether burst mode restrictions are active for current photo
 * @returns {Object} Keyboard navigation handlers
 */
export function useKeyboardShortcuts(handlers, state) {
    const preventScroll = useCallback((e) => {
        e.preventDefault();
    }, []);

    const photoNavigation = useCallback((e) => {
        const f = state.currentPhotoPath;
        const { isImportMode, isTrashMode, isAlbumMode, burstRestrictionsActive } = state;

        if (e.keyCode === 39) { // right arrow
            e.preventDefault();
            handlers.nextPhoto();
        } else if (e.keyCode === 37) { // left arrow
            e.preventDefault();
            handlers.prevPhoto();
        } else if (e.keyCode === 38) { // up arrow - open mini list
            e.preventDefault();
            handlers.setPhotosListMiniClosed(false);
        } else if (e.keyCode === 40) { // down arrow - close mini list
            e.preventDefault();
            handlers.setPhotosListMiniClosed(true);
        } else if (e.keyCode === 67) { // c - choose as selected
            // Disable for burst representatives when burst mode is ON
            if (burstRestrictionsActive) {
                logger.info('useKeyboardShortcuts', 'selection_blocked', 'Selection blocked for burst representative', {
                    photoPath: f,
                    reason: 'burst_mode_active'
                });
                // Show notification via togglePhotoSelected with blocked flag
                handlers.togglePhotoSelected(true); // Pass true to indicate blocked
            } else {
                handlers.togglePhotoSelected();
            }
        } else if (e.keyCode === 83) { // s - increase star
            // Disable in import, trash modes, and for burst representatives
            if (!isImportMode && !isTrashMode && !burstRestrictionsActive) {
                handlers.changeStar(true);
            } else if (burstRestrictionsActive) {
                logger.info('useKeyboardShortcuts', 'star_blocked', 'Star operation blocked for burst representative', {
                    photoPath: f
                });
                handlers.showBlockedMessage("Cannot change star for burst group photo. Open burst group to edit individual photos.");
            }
        } else if (e.keyCode === 68) { // d - decrease star
            // Disable in import, trash modes, and for burst representatives
            if (!isImportMode && !isTrashMode && !burstRestrictionsActive) {
                handlers.changeStar(false);
            } else if (burstRestrictionsActive) {
                logger.info('useKeyboardShortcuts', 'star_blocked', 'Star operation blocked for burst representative', {
                    photoPath: f
                });
                handlers.showBlockedMessage("Cannot change star for burst group photo. Open burst group to edit individual photos.");
            }
        } else if (e.keyCode === 73) { // i - toggle show photo info
            handlers.setShowSideMenu(!state.showSideMenu);
        } else if (e.keyCode === 70) { // f - favorite (select + star)
            // Disable in import, trash modes, and for burst representatives
            if (!isImportMode && !isTrashMode && !burstRestrictionsActive) {
                handlers.favoritePhoto();
            } else if (burstRestrictionsActive) {
                logger.info('useKeyboardShortcuts', 'favorite_blocked', 'Favorite operation blocked for burst representative', {
                    photoPath: f
                });
                handlers.showBlockedMessage("Cannot favorite burst group photo. Open burst group to favorite individual photos.");
            }
        } else if (e.keyCode === 191) { // ? - show help
            handlers.setShowHelp(!state.showHelp);
        } else if (e.keyCode === 46) { // Del
            // Disable in import mode (cannot delete import photos) and for burst representatives
            if (!isImportMode) {
                e.preventDefault();

                if (burstRestrictionsActive) {
                    logger.info('useKeyboardShortcuts', 'delete_blocked', 'Delete operation blocked for burst representative', {
                        photoPath: f
                    });
                    handlers.showBlockedMessage("Cannot delete burst group photo. Open burst group to delete individual photos.");
                } else if (isTrashMode) {
                    // Trash mode: DEL permanently deletes
                    logger.info('useKeyboardShortcuts', 'delete_key_pressed', 'DEL pressed in trash mode - permanent delete', {
                        photoPath: f
                    });
                    handlers.showPermanentDeleteModal();
                } else if (isAlbumMode) {
                    if (e.ctrlKey) {
                        // Ctrl+DEL: Delete file AND remove from album
                        logger.info('useKeyboardShortcuts', 'delete_key_pressed', 'Ctrl+DEL pressed in album mode', {
                            albumId: state.albumId,
                            photoPath: f
                        });
                        handlers.showDeleteFileModal();
                    } else {
                        // DEL only: Remove from album (safer default)
                        logger.info('useKeyboardShortcuts', 'delete_key_pressed', 'DEL pressed in album mode', {
                            albumId: state.albumId,
                            photoPath: f
                        });
                        handlers.showRemoveFromAlbumModal();
                    }
                } else {
                    // Date/Search mode: DEL moves to trash
                    logger.info('useKeyboardShortcuts', 'delete_key_pressed', 'DEL pressed in library mode', {
                        photoPath: f
                    });
                    handlers.showDeleteFileModal();
                }
            }
        } else if (e.ctrlKey && e.keyCode === 48) { // ctrl+0 - reset zoom
            handlers.setPhotoZoom("auto");
            // Reset to wrapper size
            const wrapperDiv = document.querySelector('#imageWrapper');
            if (wrapperDiv) {
                const wrapperWidth = parseFloat(wrapperDiv.style.width);
                const wrapperHeight = parseFloat(wrapperDiv.style.height);
                handlers.SetImgStyle({ width: wrapperWidth + 'px', height: wrapperHeight + 'px', opacity: '100%' });
            } else {
                handlers.SetImgStyle({ width: '100%', height: '100%', opacity: '100%' });
            }
            document.querySelector("#dummy-for-focus")?.focus();
        } else if (!state.photoZoomReady && e.ctrlKey) {
            handlers.setPhotoZoomReady(true);
            window.addEventListener('wheel', preventScroll, { passive: false });
        }
    }, [handlers, state, preventScroll]);

    const photoNavigationUp = useCallback((e) => {
        if (e.ctrlKey) {
            handlers.setPhotoZoomReady(false);
            window.removeEventListener('wheel', preventScroll, { passive: false });
        }
    }, [handlers, preventScroll]);

    return {
        photoNavigation,
        photoNavigationUp,
        preventScroll
    };
}

export default useKeyboardShortcuts;
