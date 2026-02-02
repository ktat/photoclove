/**
 * InsightsService - Photography Insights API Service
 *
 * Provides methods for fetching photography statistics and insights.
 * Uses caching and job queue for background calculation.
 * Supports time period filtering: all, weekly, monthly, yearly with specific values.
 *
 * Period string format:
 * - "all" - All time
 * - "yearly:2023" - Specific year
 * - "monthly:2023-04" - Specific month
 * - "weekly:2023-04-10" - Specific week (starting from date, must be Monday)
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "./LoggerService.js";

/**
 * Period types for insights filtering
 */
export const PERIOD_TYPES = {
    ALL: 'all',
    YEARLY: 'yearly',
    MONTHLY: 'monthly',
    WEEKLY: 'weekly',
};

// Backward compatibility alias
export const TIME_PERIODS = PERIOD_TYPES;

/**
 * Build period string from type and value
 * @param {string} type - Period type (all, yearly, monthly, weekly)
 * @param {string|number|null} value - Period value (year, month string, or week start date)
 * @returns {string} Period string for backend
 */
export function buildPeriodString(type, value = null) {
    if (type === PERIOD_TYPES.ALL || !value) {
        return 'all';
    }
    return `${type}:${value}`;
}

/**
 * Parse period string into type and value
 * @param {string} periodStr - Period string (e.g., "yearly:2023")
 * @returns {{ type: string, value: string|null }} Parsed period
 */
export function parsePeriodString(periodStr) {
    if (!periodStr || periodStr === 'all') {
        return { type: PERIOD_TYPES.ALL, value: null };
    }
    const [type, ...valueParts] = periodStr.split(':');
    const value = valueParts.join(':') || null;
    return { type, value };
}

const InsightsService = {
    /**
     * Get cached photography insights (fast)
     * @param {string} period - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
     * @returns {Promise<Object|null>} Cached insights data or null if not available
     */
    async getCachedInsights(period = TIME_PERIODS.ALL) {
        logger.info('InsightsService', 'get_cached_insights', 'Fetching cached insights', { period });
        try {
            const result = await invoke("get_cached_insights", { period });
            if (result) {
                const data = JSON.parse(result);
                logger.info('InsightsService', 'get_cached_insights_success', 'Cached insights found', { period });
                return data;
            }
            logger.info('InsightsService', 'get_cached_insights_miss', 'No cached insights', { period });
            return null;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_cached_insights_error', 'Failed to get cached insights', {
                error: errorMsg,
                period
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Get cache status (whether cache exists and how old it is)
     * @param {string} period - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
     * @returns {Promise<Object>} Cache status with available, age_secs, path
     */
    async getCacheStatus(period = TIME_PERIODS.ALL) {
        logger.info('InsightsService', 'get_cache_status', 'Checking cache status', { period });
        try {
            const result = await invoke("get_insights_cache_status", { period });
            logger.info('InsightsService', 'get_cache_status_success', 'Cache status retrieved', {
                available: result.available,
                age_secs: result.age_secs,
                period
            });
            return result;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_cache_status_error', 'Failed to get cache status', {
                error: errorMsg,
                period
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Queue insights refresh job
     * @param {string} period - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
     * @returns {Promise<string>} Job unit ID for tracking
     */
    async queueRefresh(period = TIME_PERIODS.ALL) {
        logger.info('InsightsService', 'queue_refresh', 'Queueing insights refresh', { period });
        try {
            const jobUnitId = await invoke("queue_insights_refresh", { period });
            logger.info('InsightsService', 'queue_refresh_success', 'Refresh job queued', {
                jobUnitId,
                period
            });
            return jobUnitId;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'queue_refresh_error', 'Failed to queue refresh', {
                error: errorMsg,
                period
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Listen for insights update events
     * @param {Function} callback - Called when insights are updated (receives { path, period })
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
     * @param {string} period - Time period: "all", "weekly", "monthly", "yearly" (default: "all")
     * @returns {Promise<Object>} Photography insights data
     */
    async getInsights(period = TIME_PERIODS.ALL) {
        logger.info('InsightsService', 'get_insights', 'Fetching photography insights directly', { period });
        try {
            const result = await invoke("get_photography_insights", { period });
            const data = JSON.parse(result);
            logger.info('InsightsService', 'get_insights_success', 'Insights loaded', {
                totalPhotos: data.organization?.total_photos,
                period
            });
            return data;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_insights_error', 'Failed to fetch insights', {
                error: errorMsg,
                rawError: error,
                period
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
    },

    /**
     * Get available periods based on photo dates in database
     * @returns {Promise<Object>} Available periods { years, months, weeks, min_date, max_date }
     */
    async getAvailablePeriods() {
        logger.info('InsightsService', 'get_available_periods', 'Fetching available periods');
        try {
            const result = await invoke("get_available_periods");
            const data = JSON.parse(result);
            logger.info('InsightsService', 'get_available_periods_success', 'Available periods retrieved', {
                years: data.years?.length,
                months: data.months?.length,
                weeks: data.weeks?.length
            });
            return data;
        } catch (error) {
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            logger.error('InsightsService', 'get_available_periods_error', 'Failed to get available periods', {
                error: errorMsg
            });
            throw new Error(errorMsg);
        }
    },

    /**
     * Format period value for display
     * @param {string} type - Period type
     * @param {string|number} value - Period value
     * @returns {string} Formatted display string
     */
    formatPeriodDisplay(type, value) {
        if (type === PERIOD_TYPES.ALL) {
            return 'All Time';
        }
        if (type === PERIOD_TYPES.YEARLY) {
            return String(value);
        }
        if (type === PERIOD_TYPES.MONTHLY) {
            // Format "2023-04" as "April 2023" or similar
            const [year, month] = String(value).split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
        }
        if (type === PERIOD_TYPES.WEEKLY) {
            // Format as date range
            const startDate = new Date(value);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            const options = { month: 'short', day: 'numeric' };
            const yearOptions = { year: 'numeric' };
            return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, { ...options, ...yearOptions })}`;
        }
        return String(value);
    }
};

export default InsightsService;
