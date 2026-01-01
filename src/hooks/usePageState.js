/**
 * usePageState Hook
 *
 * Manages page state persistence using localStorage
 * Provides save/load functionality with TTL and version management
 *
 * Usage:
 * const { savePageState, loadPageState } = usePageState();
 *
 * // Save state on page transition
 * savePageState(pageId, { viewState, filterState, displayState });
 *
 * // Load state on mount
 * const savedState = loadPageState(pageId);
 */

import { useCallback } from 'react';
import {
    getStorageKey,
    shouldPersistPage,
    PAGE_STATE_VERSION,
    PAGE_STATE_TTL
} from '../constants/pages.js';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for managing page state persistence
 * @returns {Object} { savePageState, loadPageState, clearPageState }
 */
export function usePageState() {
    /**
     * Save page state to localStorage
     * @param {string} pageId - Page identifier from PAGES constant
     * @param {Object} state - State object to save
     * @param {string} [subId] - Optional sub-identifier (e.g., albumId, date)
     * @returns {boolean} Success status
     */
    const savePageState = useCallback((pageId, state, subId = null) => {
        // Skip if page shouldn't persist
        if (!shouldPersistPage(pageId)) {
            logger.debug('usePageState', 'skip_save', 'Page does not persist state', { pageId });
            return false;
        }

        try {
            const key = getStorageKey(pageId, subId);
            const dataToSave = {
                version: PAGE_STATE_VERSION,
                timestamp: Date.now(),
                pageId,
                subId,
                state
            };

            localStorage.setItem(key, JSON.stringify(dataToSave));

            logger.info('usePageState', 'state_saved', 'Page state saved to localStorage', {
                pageId,
                subId,
                key,
                stateKeys: Object.keys(state)
            });

            return true;
        } catch (error) {
            logger.error('usePageState', 'save_failed', 'Failed to save page state', {
                pageId,
                subId,
                error: error.message
            });
            return false;
        }
    }, []);

    /**
     * Load page state from localStorage
     * @param {string} pageId - Page identifier
     * @param {string} [subId] - Optional sub-identifier
     * @returns {Object|null} Loaded state or null if not found/expired/invalid
     */
    const loadPageState = useCallback((pageId, subId = null) => {
        // Skip if page shouldn't persist
        if (!shouldPersistPage(pageId)) {
            logger.debug('usePageState', 'skip_load', 'Page does not persist state', { pageId });
            return null;
        }

        try {
            const key = getStorageKey(pageId, subId);
            const stored = localStorage.getItem(key);

            if (!stored) {
                logger.debug('usePageState', 'no_saved_state', 'No saved state found', {
                    pageId,
                    subId,
                    key
                });
                return null;
            }

            const data = JSON.parse(stored);

            // Validate version
            if (data.version !== PAGE_STATE_VERSION) {
                logger.warn('usePageState', 'version_mismatch', 'State version mismatch, clearing', {
                    pageId,
                    storedVersion: data.version,
                    currentVersion: PAGE_STATE_VERSION
                });
                localStorage.removeItem(key);
                return null;
            }

            // Check TTL
            const age = Date.now() - data.timestamp;
            if (age > PAGE_STATE_TTL) {
                logger.warn('usePageState', 'state_expired', 'Stored state expired, clearing', {
                    pageId,
                    age: Math.floor(age / 1000 / 60), // age in minutes
                    ttl: Math.floor(PAGE_STATE_TTL / 1000 / 60)
                });
                localStorage.removeItem(key);
                return null;
            }

            logger.info('usePageState', 'state_loaded', 'Page state loaded from localStorage', {
                pageId,
                subId,
                key,
                age: Math.floor(age / 1000), // age in seconds
                stateKeys: data.state ? Object.keys(data.state) : []
            });

            return data.state;
        } catch (error) {
            logger.error('usePageState', 'load_failed', 'Failed to load page state', {
                pageId,
                subId,
                error: error.message
            });
            return null;
        }
    }, []);

    /**
     * Clear page state from localStorage
     * @param {string} pageId - Page identifier
     * @param {string} [subId] - Optional sub-identifier
     * @returns {boolean} Success status
     */
    const clearPageState = useCallback((pageId, subId = null) => {
        try {
            const key = getStorageKey(pageId, subId);
            localStorage.removeItem(key);

            logger.info('usePageState', 'state_cleared', 'Page state cleared from localStorage', {
                pageId,
                subId,
                key
            });

            return true;
        } catch (error) {
            logger.error('usePageState', 'clear_failed', 'Failed to clear page state', {
                pageId,
                subId,
                error: error.message
            });
            return false;
        }
    }, []);

    return {
        savePageState,
        loadPageState,
        clearPageState
    };
}
