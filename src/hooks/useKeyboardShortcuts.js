/**
 * Custom hook for keyboard shortcuts
 * Consolidates multiple keyboard event listeners into one
 */

import { useEffect } from 'react';

/**
 * @param {Object} shortcuts - Map of shortcut definitions
 * @param {Object} shortcuts[key] - Shortcut configuration
 * @param {boolean} shortcuts[key].ctrl - Requires Ctrl key
 * @param {boolean} shortcuts[key].shift - Requires Shift key
 * @param {string} shortcuts[key].key - Key to match
 * @param {Function} shortcuts[key].action - Action to execute
 */
export function useKeyboardShortcuts(shortcuts) {
    useEffect(() => {
        const handleKeyDown = (event) => {
            for (const shortcut of Object.values(shortcuts)) {
                const ctrlMatch = shortcut.ctrl ? event.ctrlKey : true;
                const shiftMatch = shortcut.shift ? event.shiftKey : true;
                const keyMatch = event.key === shortcut.key;

                if (ctrlMatch && shiftMatch && keyMatch) {
                    event.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}

export default useKeyboardShortcuts;
