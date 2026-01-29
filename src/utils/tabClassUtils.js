/**
 * Utility functions for tab className generation
 * Centralizes tab styling logic to avoid duplication
 */

/**
 * Generate className for Selection tab with highlight logic (Feature #152)
 *
 * @param {boolean} isActive - Whether the tab is currently active/open
 * @param {number} photoSelectionCount - Number of selected photos
 * @param {number} selectedAlbumsCount - Number of selected albums
 * @param {number} selectedTagsCount - Number of selected tags
 * @param {number} selectedPersonsCount - Number of selected persons
 * @param {string} baseClass - Base CSS class name (default: 'vertical-tab-button')
 * @returns {string} Complete className string
 *
 * Color logic:
 * - Active (open) + has selections: Green (#4CAF50)
 * - Active (open) + no selections: Green (#4CAF50)
 * - Not active + has selections: Orange (#FF9800)
 * - Not active + no selections: Default (var(--bg-elevated))
 */
export function getSelectionTabClassName(
    isActive,
    photoSelectionCount = 0,
    selectedAlbumsCount = 0,
    selectedTagsCount = 0,
    selectedPersonsCount = 0,
    baseClass = 'vertical-tab-button'
) {
    const hasSelection = photoSelectionCount + selectedAlbumsCount + selectedTagsCount + selectedPersonsCount > 0;

    let className = baseClass;
    className += ' selection-tab'; // Mark as Selection tab
    if (hasSelection) className += ' has-selection';
    if (isActive) className += ' active';

    return className;
}

/**
 * Check if there are any selections
 *
 * @param {number} photoSelectionCount - Number of selected photos
 * @param {number} selectedAlbumsCount - Number of selected albums
 * @param {number} selectedTagsCount - Number of selected tags
 * @param {number} selectedPersonsCount - Number of selected persons
 * @returns {boolean} True if any items are selected
 */
export function hasAnySelection(
    photoSelectionCount = 0,
    selectedAlbumsCount = 0,
    selectedTagsCount = 0,
    selectedPersonsCount = 0
) {
    return photoSelectionCount + selectedAlbumsCount + selectedTagsCount + selectedPersonsCount > 0;
}
