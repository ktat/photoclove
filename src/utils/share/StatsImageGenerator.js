/**
 * Statistics image generation for sharing
 */

import { logger } from '../../services/LoggerService.js';

/**
 * Generate shareable image from insights data
 * @param {Object} insights - Insights data from InsightsService
 * @param {Object} options - Generation options
 * @returns {Promise<Blob>} Generated image blob
 */
export async function generateStatsImage(insights, options = {}) {
    const {
        width = 600,
        height = 400,
        backgroundColor = '#1a1a2e',
        textColor = '#ffffff',
        accentColor = '#4ade80',
        period = 'all'
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Header based on period
    let headerText = generateHeaderText(period);
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(headerText, 30, 50);

    // Stats content
    renderStatsContent(ctx, insights, textColor, 100, 40);

    // Footer
    renderFooter(ctx, width, height);

    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
}

/**
 * Generate header text based on period
 * @param {string} period - Time period
 * @returns {string} Header text
 */
function generateHeaderText(period) {
    const now = new Date();
    
    if (period.startsWith('weekly:')) {
        const weekStart = period.replace('weekly:', '');
        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `📊 Week of ${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} Stats`;
    } else if (period === 'weekly') {
        return '📊 This Week\'s Photography Stats';
    } else if (period.startsWith('monthly:')) {
        const monthStr = period.replace('monthly:', '');
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `📊 ${monthName} Photography Stats`;
    } else if (period === 'monthly') {
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `📊 ${monthName} Photography Stats`;
    } else if (period.startsWith('yearly:')) {
        const year = period.replace('yearly:', '');
        return `📊 ${year} Year in Review`;
    } else if (period === 'yearly') {
        return `📊 ${now.getFullYear()} Year in Review`;
    } else {
        return '📊 My Photography Stats';
    }
}

/**
 * Render stats content on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} insights - Insights data
 * @param {string} textColor - Text color
 * @param {number} startY - Starting Y position
 * @param {number} lineHeight - Line height
 */
function renderStatsContent(ctx, insights, textColor, startY, lineHeight) {
    let y = startY;
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = textColor;

    if (insights.organization) {
        const org = insights.organization;

        ctx.fillText(`📷 Total Photos: ${(org.total_photos || 0).toLocaleString()}`, 30, y);
        y += lineHeight;

        if (org.starred_photos > 0) {
            ctx.fillText(`⭐ Best Shots: ${org.starred_photos}`, 30, y);
            y += lineHeight;
        }
        if (org.total_tags > 0) {
            ctx.fillText(`🏷️ Tags: ${org.total_tags}`, 30, y);
            y += lineHeight;
        }
    }

    if (insights.shooting_time) {
        const st = insights.shooting_time;
        if (st.peak_hour !== undefined && st.peak_hour !== null) {
            ctx.fillText(`🕐 Peak Hour: ${st.peak_hour}:00`, 30, y);
            y += lineHeight;
        }
        if (st.peak_weekday) {
            ctx.fillText(`📅 Peak Day: ${st.peak_weekday}`, 30, y);
            y += lineHeight;
        }
    }

    if (insights.equipment && insights.equipment.cameras && insights.equipment.cameras.length > 0) {
        const topCamera = insights.equipment.cameras[0];
        ctx.fillText(`🏆 Top Camera: ${topCamera.name || topCamera.model || 'Unknown'}`, 30, y);
        y += lineHeight;
    }
}

/**
 * Render footer on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function renderFooter(ctx, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('#PhotoClove #PhotographyStats', 30, height - 30);
    ctx.fillText('github.com/ktat/photoclove', width - 220, height - 30);
}