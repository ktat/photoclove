/**
 * Debug Storage Utility
 *
 * Provides debugging tools for inspecting localStorage state
 * Can be accessed from browser DevTools console:
 * - window.debugStorage.list() - List all page states
 * - window.debugStorage.get(key) - Get specific page state
 * - window.debugStorage.clear() - Clear all page states
 */

import { STORAGE_PREFIX, PAGE_STATE_VERSION, PAGE_STATE_TTL } from '../constants/pages.js';

/**
 * List all stored page states
 * @returns {Object[]} Array of {key, value, age, expired} objects
 */
export function listPageStates() {
    const states = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            try {
                const value = JSON.parse(localStorage.getItem(key));
                const age = now - (value?.timestamp || now);
                const expired = age > PAGE_STATE_TTL;

                states.push({
                    key,
                    value,
                    age: formatAge(age),
                    expired,
                    version: value?.version || 'unknown'
                });
            } catch (e) {
                states.push({
                    key,
                    value: 'Invalid JSON',
                    age: 'unknown',
                    expired: true,
                    version: 'unknown'
                });
            }
        }
    }

    return states;
}

/**
 * Get a specific page state
 * @param {string} key - Storage key (with or without prefix)
 * @returns {Object|null} Parsed state or null
 */
export function getPageState(key) {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    try {
        const value = localStorage.getItem(fullKey);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        // Console usage intentional: debugStorage is a DevTools utility for developers
        console.error(`Failed to parse state for key: ${fullKey}`, e);
        return null;
    }
}

/**
 * Clear all page states (or specific state)
 * @param {string} [key] - Optional specific key to clear
 * @returns {number} Number of items cleared
 */
export function clearPageStates(key = null) {
    if (key) {
        const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
        localStorage.removeItem(fullKey);
        return 1;
    }

    // Clear all page states
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
            keys.push(k);
        }
    }

    keys.forEach(k => localStorage.removeItem(k));
    return keys.length;
}

/**
 * Clear expired page states
 * @returns {number} Number of expired items cleared
 */
export function clearExpiredStates() {
    const now = Date.now();
    let cleared = 0;

    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            try {
                const value = JSON.parse(localStorage.getItem(key));
                const age = now - (value?.timestamp || 0);

                // Clear if expired or wrong version
                if (age > PAGE_STATE_TTL || value?.version !== PAGE_STATE_VERSION) {
                    localStorage.removeItem(key);
                    cleared++;
                }
            } catch (e) {
                // Clear invalid JSON
                localStorage.removeItem(key);
                cleared++;
            }
        }
    }

    return cleared;
}

/**
 * Get storage statistics
 * @returns {Object} Statistics about stored states
 */
export function getStorageStats() {
    const states = listPageStates();
    const validStates = states.filter(s => !s.expired && s.version === PAGE_STATE_VERSION);
    const expiredStates = states.filter(s => s.expired || s.version !== PAGE_STATE_VERSION);

    return {
        total: states.length,
        valid: validStates.length,
        expired: expiredStates.length,
        currentVersion: PAGE_STATE_VERSION,
        ttl: formatAge(PAGE_STATE_TTL)
    };
}

/**
 * Format age in milliseconds to human-readable string
 * @param {number} ms - Age in milliseconds
 * @returns {string} Formatted string (e.g., "2d 3h 45m")
 */
function formatAge(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Debug API exposed on window
 */
export const debugStorageAPI = {
    list: listPageStates,
    get: getPageState,
    clear: clearPageStates,
    clearExpired: clearExpiredStates,
    stats: getStorageStats,

    // Convenience methods
    // Console usage intentional: help() outputs to DevTools console for developers
    help() {
        console.log(`
PhotoClove Storage Debug Tools
==============================
Available commands:
- debugStorage.list()           List all page states
- debugStorage.get(key)         Get specific state
- debugStorage.clear()          Clear all page states
- debugStorage.clear(key)       Clear specific state
- debugStorage.clearExpired()   Clear expired states
- debugStorage.stats()          Show storage statistics
- debugStorage.help()           Show this help
        `);
    }
};

// Expose debug API to window in development mode
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.debugStorage = debugStorageAPI;
    // Console usage intentional: notify developers that debug API is available in DevTools
    console.log('Debug storage tools available: window.debugStorage.help()');
}
