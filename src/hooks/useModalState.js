/**
 * useModalState - Hook for managing multiple modal states
 *
 * Provides a unified way to manage modal states across components,
 * ensuring only one modal is open at a time.
 */
import { useState, useCallback, useMemo } from 'react';

/**
 * Hook for managing multiple modal states
 * @param {string[]} modalNames - Array of modal name identifiers
 * @returns {Object} Modal state management functions and state
 */
export function useModalState(modalNames) {
    const initialState = useMemo(() => {
        return modalNames.reduce((acc, name) => {
            acc[name] = false;
            return acc;
        }, {});
    }, [modalNames.join(',')]);

    const [modalState, setModalState] = useState(initialState);

    /**
     * Open a specific modal, closing all others
     * @param {string} name - The modal name to open
     */
    const openModal = useCallback((name) => {
        setModalState(prev => {
            const newState = {};
            for (const key of Object.keys(prev)) {
                newState[key] = key === name;
            }
            return newState;
        });
    }, []);

    /**
     * Close all modals
     */
    const closeModal = useCallback(() => {
        setModalState(prev => {
            const newState = {};
            for (const key of Object.keys(prev)) {
                newState[key] = false;
            }
            return newState;
        });
    }, []);

    /**
     * Close a specific modal by name
     * @param {string} name - The modal name to close
     */
    const closeModalByName = useCallback((name) => {
        setModalState(prev => ({
            ...prev,
            [name]: false
        }));
    }, []);

    /**
     * Check if a specific modal is open
     * @param {string} name - The modal name to check
     * @returns {boolean} Whether the modal is open
     */
    const isOpen = useCallback((name) => {
        return modalState[name] || false;
    }, [modalState]);

    /**
     * Toggle a specific modal
     * @param {string} name - The modal name to toggle
     */
    const toggleModal = useCallback((name) => {
        setModalState(prev => {
            if (prev[name]) {
                // If currently open, close all
                const newState = {};
                for (const key of Object.keys(prev)) {
                    newState[key] = false;
                }
                return newState;
            } else {
                // If currently closed, open this one and close others
                const newState = {};
                for (const key of Object.keys(prev)) {
                    newState[key] = key === name;
                }
                return newState;
            }
        });
    }, []);

    /**
     * Get the name of the currently open modal (if any)
     * @returns {string|null} The name of the open modal, or null if none
     */
    const getOpenModal = useCallback(() => {
        for (const [name, isOpen] of Object.entries(modalState)) {
            if (isOpen) return name;
        }
        return null;
    }, [modalState]);

    return {
        modalState,
        openModal,
        closeModal,
        closeModalByName,
        isOpen,
        toggleModal,
        getOpenModal
    };
}

export default useModalState;
