/**
 * Custom hook for photo metadata operations in PhotosListMini
 * Handles star rating and selection toggle
 */
import { useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook for managing photo metadata operations (star, selection)
 * @param {Object} options
 * @param {string} options.currentPhotoPath - Current photo path
 * @param {Function} options.setStar - Set star state in parent
 * @param {Function} options.toggleSelection - Toggle photo selection
 * @param {Function} options.isSelected - Check if photo is selected
 * @param {boolean} options.isImportMode - Whether in import mode
 * @param {boolean} options.isTrashMode - Whether in trash mode
 * @returns {Object} Metadata operation functions and state
 */
export function usePhotoMetadataOperations({
    currentPhotoPath,
    setStar,
    toggleSelection,
    isSelected,
    isImportMode,
    isTrashMode
}) {
    // Notification state
    const [selectedInfoHidden, setSelectedInfoHidden] = useState(true);
    const [unselectedInfoHidden, setUnselectedInfoHidden] = useState(true);
    const [selectedContent, setSelectedContent] = useState("");
    const [unselectedContent, setUnselectedContent] = useState("");

    /**
     * Change star rating
     * @param {boolean} isIncrease - Whether to increase (true) or decrease (false) star
     * @param {string} additionalMessage - Optional additional message to display
     */
    const changeStar = useCallback((isIncrease, additionalMessage) => {
        // Disable in import and trash modes
        if (isImportMode || isTrashMode) return;

        invoke("get_photo_info", { pathStr: currentPhotoPath }).then((r) => {
            let data = JSON.parse(r);
            let star = 0;
            let curStar = 0;

            if (data.meta) {
                curStar = data.meta.star.data || 0;
                if (isIncrease) {
                    star = curStar < 5 ? curStar + 1 : 5;
                } else if (!isIncrease && curStar > 0) {
                    star = curStar - 1;
                }
            }

            // Build star display
            let stars = ["☆", "☆", "☆", "☆", "☆"];
            let newStar = [false, false, false, false, false];
            for (let i = 0; i < star; i++) {
                stars[i] = "★";
                newStar[i] = true;
            }

            setStar(newStar);

            let content = "Star: " + stars.join("");
            if (additionalMessage && additionalMessage !== "") {
                content = additionalMessage + "<br />" + content;
            }

            setSelectedContent(content);
            setTimeout(() => {
                setSelectedInfoHidden(true);
            }, 700);
            setSelectedInfoHidden(false);

            invoke("save_star", { pathStr: currentPhotoPath, starNum: star });
        });
    }, [currentPhotoPath, setStar, isImportMode, isTrashMode]);

    /**
     * Toggle photo selection state
     */
    const togglePhotoSelected = useCallback(() => {
        const wasSelected = toggleSelection(currentPhotoPath);

        setTimeout(() => {
            if (wasSelected) {
                setSelectedInfoHidden(true);
            } else {
                setUnselectedInfoHidden(true);
            }
        }, 700);

        if (wasSelected) {
            setSelectedContent("Photo is selected");
            setSelectedInfoHidden(false);
        } else {
            setUnselectedContent("Photo is unselected");
            setUnselectedInfoHidden(false);
        }
    }, [currentPhotoPath, toggleSelection]);

    /**
     * Favorite action: select photo and add 5 stars
     */
    const favoritePhoto = useCallback(() => {
        // Disable in import and trash modes
        if (isImportMode || isTrashMode) return;

        let additionalMessage = "Photo is selected";
        if (isSelected(currentPhotoPath)) {
            additionalMessage = "Photo is already selected";
        } else {
            toggleSelection(currentPhotoPath);
        }
        changeStar(true, additionalMessage);
    }, [currentPhotoPath, isSelected, toggleSelection, changeStar, isImportMode, isTrashMode]);

    /**
     * Increase star rating (shortcut: S key)
     */
    const increaseStar = useCallback(() => {
        if (!isImportMode && !isTrashMode) {
            changeStar(true);
        }
    }, [changeStar, isImportMode, isTrashMode]);

    /**
     * Decrease star rating (shortcut: D key)
     */
    const decreaseStar = useCallback(() => {
        if (!isImportMode && !isTrashMode) {
            changeStar(false);
        }
    }, [changeStar, isImportMode, isTrashMode]);

    return {
        changeStar,
        togglePhotoSelected,
        favoritePhoto,
        increaseStar,
        decreaseStar,
        // Notification state
        selectedInfoHidden,
        unselectedInfoHidden,
        selectedContent,
        unselectedContent,
        setSelectedInfoHidden,
        setUnselectedInfoHidden
    };
}

export default usePhotoMetadataOperations;
