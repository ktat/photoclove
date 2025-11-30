import { useCallback } from 'react';
import { logger } from '../../../services/LoggerService.js';

/**
 * Custom hook for handling keyboard shortcuts in PhotosListMini
 *
 * @param {Object} handlers - Object containing handler functions
 * @param {Function} handlers.nextPhoto - Navigate to next photo
 * @param {Function} handlers.prevPhoto - Navigate to previous photo
 * @param {Function} handlers.togglePhotoSelected - Toggle photo selection
 * @param {Function} handlers.changeStar - Change star rating
 * @param {Function} handlers.toggleShowSideMenu - Toggle side menu visibility
 * @param {Function} handlers.showRemoveFromAlbumModal - Show remove from album modal
 * @param {Function} handlers.showDeleteFileModal - Show delete file modal
 * @param {Function} handlers.setPhotosListMiniClosed - Set mini list closed state
 * @param {Function} handlers.setShowHelp - Set show help state
 * @param {Function} handlers.setPhotoZoom - Set photo zoom level
 * @param {Function} handlers.SetImgStyle - Set image style
 * @param {Function} handlers.setPhotoZoomReady - Set photo zoom ready state
 * @param {Object} state - Current state values
 * @param {boolean} state.isAlbumMode - Whether in album mode
 * @param {string} state.currentPhotoPath - Current photo path
 * @param {Function} state.isSelected - Check if photo is selected
 * @param {Function} state.toggleSelection - Toggle photo selection
 * @param {boolean} state.showSideMenu - Show side menu flag
 * @param {boolean} state.showHelp - Show help flag
 * @param {boolean} state.photoZoomReady - Photo zoom ready flag
 * @returns {Object} Keyboard navigation handlers
 */
export function useKeyboardShortcuts(handlers, state) {
    const preventScroll = useCallback((e) => {
        e.preventDefault();
    }, []);

    const photoNavigation = useCallback((e) => {
        const f = state.currentPhotoPath;

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
            handlers.togglePhotoSelected();
        } else if (e.keyCode === 83) { // s - increase star
            handlers.changeStar(true);
        } else if (e.keyCode === 68) { // d - decrease star
            handlers.changeStar(false);
        } else if (e.keyCode === 73) { // i - toggle show photo info
            handlers.toggleShowSideMenu(!state.showSideMenu);
        } else if (e.keyCode === 70) { // f - c & s (favorite: select and star)
            let additionalMessage = "Photo is selected";
            if (state.isSelected(f)) {
                additionalMessage = "Photo is already selected";
            } else {
                state.toggleSelection(state.currentPhotoPath);
            }
            handlers.changeStar(true, additionalMessage);
        } else if (e.keyCode === 191) { // ? - show help
            handlers.setShowHelp(!state.showHelp);
        } else if (e.keyCode === 46) { // Del
            e.preventDefault();

            if (state.isAlbumMode) {
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
                // Date/Search mode: DEL deletes file
                logger.info('useKeyboardShortcuts', 'delete_key_pressed', 'DEL pressed in library mode', {
                    photoPath: f
                });
                handlers.showDeleteFileModal();
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
            document.querySelector("#dummy-for-focus").focus();
        } else if (!state.photoZoomReady && e.ctrlKey) {
            handlers.setPhotoZoomReady(true);
            window.addEventListener('wheel', preventScroll, { passive: false });
        }
    }, [handlers, state, preventScroll]);

    const photoNavigationUp = useCallback((e) => {
        if (e.ctrlKey || e.keyCode === 67 || e.keyCode === 73 || e.keyCode === 83 || e.keyCode === 68) {
            return;
        }
        logger.debug('useKeyboardShortcuts', 'navigation_up', 'Key up event in photo navigation');
    }, []);

    return {
        photoNavigation,
        photoNavigationUp,
        preventScroll
    };
}
