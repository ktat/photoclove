/**
 * InsightsService - Photography Insights API Service
 *
 * Provides methods for fetching photography statistics and insights.
 * Uses caching and job queue for background calculation.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "./LoggerService.js";

const InsightsService = {
    /**
     * Get cached photography insights (fast)
     * @returns {Promise<Object|null>} Cached insights data or null if not available
     */
    async getCachedInsights() {
        logger.info('InsightsService', 'get_cached_insights', 'Fetching cached insights');
        try {
            const result = await invoke("get_cached_insights");
            if (result) {
                const data = JSON.parse(result);
                logger.info('InsightsService', 'get_cached_insights_success', 'Cached insights found');
                return data;
            }
            logger.info('InsightsService', 'get_cached_insights_miss', 'No cached insights');
            return null;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_cached_insights_error', 'Failed to get cached insights', {
                error: errorMsg
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Get cache status (whether cache exists and how old it is)
     * @returns {Promise<Object>} Cache status with available, age_secs, path
     */
    async getCacheStatus() {
        logger.info('InsightsService', 'get_cache_status', 'Checking cache status');
        try {
            const result = await invoke("get_insights_cache_status");
            logger.info('InsightsService', 'get_cache_status_success', 'Cache status retrieved', {
                available: result.available,
                age_secs: result.age_secs
            });
            return result;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_cache_status_error', 'Failed to get cache status', {
                error: errorMsg
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Queue insights refresh job
     * @returns {Promise<string>} Job unit ID for tracking
     */
    async queueRefresh() {
        logger.info('InsightsService', 'queue_refresh', 'Queueing insights refresh');
        try {
            const jobUnitId = await invoke("queue_insights_refresh");
            logger.info('InsightsService', 'queue_refresh_success', 'Refresh job queued', {
                jobUnitId
            });
            return jobUnitId;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'queue_refresh_error', 'Failed to queue refresh', {
                error: errorMsg
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Listen for insights update events
     * @param {Function} callback - Called when insights are updated
     * @returns {Promise<Function>} Unlisten function
     */
    async onInsightsUpdated(callback) {
        return listen("insights_updated", (event) => {
            logger.info('InsightsService', 'insights_updated_event', 'Insights updated', {
                payload: event.payload
            });
            callback(event.payload);
        });
    },

    /**
     * Get photography insights directly (may be slow, fallback)
     * Prefer using getCachedInsights + queueRefresh
     * @returns {Promise<Object>} Photography insights data
     */
    async getInsights() {
        logger.info('InsightsService', 'get_insights', 'Fetching photography insights directly');
        try {
            const result = await invoke("get_photography_insights");
            const data = JSON.parse(result);
            logger.info('InsightsService', 'get_insights_success', 'Insights loaded', {
                totalPhotos: data.organization?.total_photos
            });
            return data;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_insights_error', 'Failed to fetch insights', {
                error: errorMsg,
                rawError: error
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string (e.g., "1.5 GB")
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Format age in seconds to human-readable string
     * @param {number} secs - Age in seconds
     * @returns {string} Formatted string (e.g., "5 minutes ago")
     */
    formatAge(secs) {
        if (secs < 60) return `${secs} seconds ago`;
        if (secs < 3600) return `${Math.floor(secs / 60)} minutes ago`;
        if (secs < 86400) return `${Math.floor(secs / 3600)} hours ago`;
        return `${Math.floor(secs / 86400)} days ago`;
    }
};

export default InsightsService;
