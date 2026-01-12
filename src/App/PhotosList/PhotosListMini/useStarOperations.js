/**
 * useStarOperations - Hook for star rating and selection feedback operations
 */
import { useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook for managing star rating changes and selection feedback
 * @param {Object} options
 * @param {string} options.currentPhotoPath - Current photo path
 * @param {Function} options.setStar - Set star state function
 * @param {Function} options.toggleSelection - Toggle photo selection function
 * @param {Function} options.isSelected - Check if photo is selected function
 * @returns {Object} Star and selection operations
 */
export function useStarOperations({
    currentPhotoPath,
    setStar,
    toggleSelection,
    isSelected
}) {
    // Feedback state
    const [selectedInfoHidden, setSelectedInfoHidden] = useState(true);
    const [unselectedInfoHidden, setUnselectedInfoHidden] = useState(true);
    const [selectedContent, setSelectedContent] = useState("");
    const [unselectedContent, setUnselectedContent] = useState("");

    /**
     * Change star rating
     * @param {boolean} isIncrease - Whether to increase or decrease star
     * @param {string} additionalMessage - Additional message to display
     */
    const changeStar = useCallback((isIncrease, additionalMessage) => {
        invoke("get_photo_info", { pathStr: currentPhotoPath }).then((r) => {
            let data = JSON.parse(r);
            let star = 0;
            let curStar = 0;

            if (data.meta) {
                curStar = data.meta.star.data || 0;
                if (isIncrease) {
                    star = curStar < 5 ? curStar + 1 : 5;
                } else if (curStar > 0) {
                    star = curStar - 1;
                }
            }

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
    }, [currentPhotoPath, setStar]);

    /**
     * Toggle photo selection with feedback
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
     * Favorite operation - select and increase star
     */
    const favoritePhoto = useCallback(() => {
        let additionalMessage = "Photo is selected";
        if (isSelected(currentPhotoPath)) {
            additionalMessage = "Photo is already selected";
        } else {
            toggleSelection(currentPhotoPath);
        }
        changeStar(true, additionalMessage);
    }, [currentPhotoPath, isSelected, toggleSelection, changeStar]);

    return {
        // Operations
        changeStar,
        togglePhotoSelected,
        favoritePhoto,
        // Feedback state
        selectedInfoHidden,
        unselectedInfoHidden,
        selectedContent,
        unselectedContent
    };
}

export default useStarOperations;
