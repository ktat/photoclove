/**
 * InsightsService - Photography Insights API Service
 *
 * Provides methods for fetching photography statistics and insights.
 */

import { invoke } from "@tauri-apps/api/core";
import { logger } from "./LoggerService.js";

const InsightsService = {
    /**
     * Get all photography insights statistics
     * @returns {Promise<Object>} Photography insights data
     */
    async getInsights() {
        logger.info('InsightsService', 'get_insights', 'Fetching photography insights');
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
    }
};

export default InsightsService;
