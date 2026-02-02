/**
 * ShareUtils - Utilities for sharing stats and images
 */

import { open } from '@tauri-apps/plugin-shell';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

/**
 * Generate share text from insights data
 * @param {Object} insights - Insights data from InsightsService
 * @param {string} period - 'all' | 'weekly' | 'monthly' | 'yearly'
 * @returns {string} Formatted share text
 */
export function generateStatsShareText(insights, period = 'all') {
    if (!insights) return '';

    const lines = [];
    const now = new Date();

    // Header based on period
    if (period.startsWith('weekly:')) {
        const weekStart = period.replace('weekly:', '');
        const startDate = new Date(weekStart); const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        lines.push(`📊 Week of ${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} Stats`);
    } else if (period === 'weekly') {
        lines.push('📊 This Week\'s Photography Stats');
    } else if (period.startsWith('monthly:')) {
        const [year, month] = period.replace('monthly:', '').split('-');
        lines.push(`📊 ${new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Photography Stats`);
    } else if (period === 'monthly') {
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        lines.push(`📊 ${monthName} Photography Stats`);
    } else if (period.startsWith('yearly:')) {
        lines.push(`📊 ${period.replace('yearly:', '')} Year in Review`);
    } else if (period === 'yearly') {
        lines.push(`📊 ${now.getFullYear()} Year in Review`);
    } else {
        lines.push('📊 My Photography Stats');
    }
    lines.push('');

    // Organization stats
    if (insights.organization) {
        const org = insights.organization;
        lines.push(`📷 Total Photos: ${(org.total_photos || 0).toLocaleString()}`);

        // Best shots (5-star photos)
        if (org.starred_photos > 0) {
            lines.push(`⭐ Best Shots: ${org.starred_photos}`);
        }

        // Tags and albums
        if (org.total_tags > 0) {
            lines.push(`🏷️ Tags: ${org.total_tags}`);
        }
        if (org.total_albums > 0) {
            lines.push(`📚 Albums: ${org.total_albums}`);
        }
    }

    // Shooting time stats
    if (insights.shooting_time) {
        const st = insights.shooting_time;
        if (st.peak_hour !== undefined && st.peak_hour !== null) {
            lines.push(`🕐 Peak Hour: ${st.peak_hour}:00`);
        }
        if (st.peak_weekday) {
            lines.push(`📅 Peak Day: ${st.peak_weekday}`);
        }
    }

    // Equipment stats
    if (insights.equipment) {
        const eq = insights.equipment;
        if (eq.cameras && eq.cameras.length > 0) {
            const topCamera = eq.cameras[0];
            lines.push(`🏆 Top Camera: ${topCamera.name || topCamera.model || 'Unknown'}`);
        }
        if (eq.lenses && eq.lenses.length > 0) {
            const topLens = eq.lenses[0];
            lines.push(`🔭 Top Lens: ${topLens.name || topLens.model || 'Unknown'}`);
        }
    }

    lines.push('');
    lines.push('#PhotoClove #PhotographyStats');
    lines.push('https://github.com/ktat/photoclove');

    return lines.join('\n');
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        logger.info('ShareUtils', 'copy_text_success', 'Text copied to clipboard');
        return true;
    } catch (error) {
        logger.error('ShareUtils', 'copy_text_error', 'Failed to copy text', { error: error.message });
        return false;
    }
}

/**
 * Copy image to clipboard
 * @param {Blob} blob - Image blob
 * @returns {Promise<boolean>} Success status
 */
export async function copyImageToClipboard(blob) {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        logger.info('ShareUtils', 'copy_image_success', 'Image copied to clipboard');
        return true;
    } catch (error) {
        logger.error('ShareUtils', 'copy_image_error', 'Failed to copy image', { error: error.message });
        return false;
    }
}

/**
 * Save image blob as file using Tauri backend
 * @param {Blob} blob - Image blob
 * @param {string} filename - Filename to save as
 * @returns {Promise<string>} Full path to saved file
 */
export async function saveImageAsFile(blob, filename = 'photoclove-stats.png') {
    try {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        // Save via Tauri command
        const savedPath = await invoke('save_image_to_download_dir', {
            imageData: base64Data,
            filename: filename
        });

        logger.info('ShareUtils', 'save_image_success', 'Image saved', { filename, savedPath });
        return savedPath;
    } catch (error) {
        logger.error('ShareUtils', 'save_image_error', 'Failed to save image', { filename, error: error.message });
        throw error;
    }
}

/**
 * Generate Web Intent URL for sharing
 * @param {string} platform - 'twitter' | 'facebook' | 'bluesky'
 * @param {string} text - Text to share
 * @returns {string} Share URL
 */
export function getShareUrl(platform, text) {
    const encodedText = encodeURIComponent(text);

    switch (platform) {
        case 'twitter':
        case 'x':
            return `https://twitter.com/intent/tweet?text=${encodedText}`;
        case 'facebook':
            return `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`;
        case 'bluesky':
            return `https://bsky.app/intent/compose?text=${encodedText}`;
        case 'threads':
            // Threads doesn't have a Web Intent API - open compose page
            return 'https://www.threads.net/';
        case 'instagram':
            // Instagram doesn't support text sharing - open site
            return 'https://www.instagram.com/';
        default:
            return null;
    }
}

/**
 * Open share URL in browser
 * @param {string} platform - Platform name
 * @param {string} text - Text to share
 */
export async function shareToSocial(platform, text) {
    const url = getShareUrl(platform, text);
    if (url) {
        try {
            await open(url);
            logger.info('ShareUtils', 'share_to_social', 'Opened share URL', { platform });
        } catch (error) {
            logger.error('ShareUtils', 'share_to_social_error', 'Failed to open URL', { platform, error: error.message });
        }
    }
}

/**
 * Generate stats image using Canvas API
 * @param {Object} insights - Insights data
 * @param {Object} options - Rendering options
 * @returns {Promise<Blob>} PNG image blob
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

    // Header based on period (match generateStatsShareText)
    let headerText = '📊 My Photography Stats';
    const now = new Date();
    if (period.startsWith('weekly:')) {
        const weekStart = period.replace('weekly:', '');
        const startDate = new Date(weekStart); const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        headerText = `📊 Week of ${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} Stats`;
    } else if (period === 'weekly') {
        headerText = '📊 This Week\'s Photography Stats';
    } else if (period.startsWith('monthly:')) {
        const monthStr = period.replace('monthly:', '');
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        headerText = `📊 ${monthName} Photography Stats`;
    } else if (period === 'monthly') {
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        headerText = `📊 ${monthName} Photography Stats`;
    } else if (period.startsWith('yearly:')) {
        const year = period.replace('yearly:', '');
        headerText = `📊 ${year} Year in Review`;
    } else if (period === 'yearly') {
        headerText = `📊 ${now.getFullYear()} Year in Review`;
    }

    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(headerText, 30, 50);

    // Stats
    let y = 100;
    const lineHeight = 40;
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';

    if (insights.organization) {
        const org = insights.organization;

        ctx.fillStyle = textColor;
        ctx.fillText(`📷 Total Photos: ${(org.total_photos || 0).toLocaleString()}`, 30, y);
        y += lineHeight;

        if (org.starred_photos > 0) {
            ctx.fillText(`⭐ Best Shots: ${org.starred_photos}`, 30, y);
            y += lineHeight;
        }
        if (org.total_tags > 0) { ctx.fillText(`🏷️ Tags: ${org.total_tags}`, 30, y); y += lineHeight;
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

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('#PhotoClove #PhotographyStats', 30, height - 30);
    ctx.fillText('github.com/ktat/photoclove', width - 220, height - 30);

    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
}

// ============================================================
// Photo Sharing & Collage Generation Functions
// ============================================================

/**
 * Load image from Tauri file path
 * @param {string} filePath - Local file path
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
export async function loadImageFromPath(filePath) {
    const src = convertFileSrc(filePath);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            logger.debug('ShareUtils', 'load_image_success', 'Image loaded', { filePath });
            resolve(img);
        };
        img.onerror = (error) => {
            logger.error('ShareUtils', 'load_image_error', 'Failed to load image', { filePath, error });
            reject(new Error(`Failed to load image: ${filePath}`));
        };
        img.src = src;
    });
}

/**
 * Draw PhotoClove watermark on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Watermark options
 */
export function addPhotoCloveWatermark(ctx, width, height, options = {}) {
    const {
        position = 'bottom-right',
        opacity = 0.6,
        size = 'auto',
        color = '#ffffff'
    } = options;

    // Calculate font size based on canvas size
    const fontSize = size === 'auto' ? Math.max(12, Math.min(width, height) / 30) : size;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

    const text = 'PhotoClove';
    const metrics = ctx.measureText(text);
    const padding = fontSize * 0.8;

    let x, y;
    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + fontSize;
            break;
        case 'top-right':
            x = width - metrics.width - padding;
            y = padding + fontSize;
            break;
        case 'bottom-left':
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
        default:
            x = width - metrics.width - padding;
            y = height - padding;
            break;
    }

    // Draw shadow for visibility on any background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = fontSize / 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(text, x, y);
    ctx.restore();

    logger.debug('ShareUtils', 'watermark_added', 'PhotoClove watermark drawn', { position, fontSize });
}

/**
 * Draw user custom watermark on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} text - User watermark text
 * @param {Object} options - Watermark options
 */
export function addUserWatermark(ctx, width, height, text, options = {}) {
    if (!text || text.trim() === '') return;

    const {
        position = 'bottom-left',  // Different default from PhotoClove watermark
        opacity = 0.7,
        size = 'auto',
        color = '#ffffff'
    } = options;

    // Calculate font size based on canvas size
    const fontSize = size === 'auto' ? Math.max(12, Math.min(width, height) / 35) : size;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

    const metrics = ctx.measureText(text);
    const padding = fontSize * 0.8;

    let x, y;
    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + fontSize;
            break;
        case 'top-right':
            x = width - metrics.width - padding;
            y = padding + fontSize;
            break;
        case 'bottom-left':
        default:
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
            x = width - metrics.width - padding;
            y = height - padding;
            break;
    }

    // Draw shadow for visibility on any background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = fontSize / 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(text, x, y);
    ctx.restore();

    logger.debug('ShareUtils', 'user_watermark_added', 'User watermark drawn', { position, fontSize, text });
}

/**
 * Draw image with rounded corners using clipping
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLImageElement} img - Image to draw
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {number} radius - Corner radius
 */
export function drawRoundedImage(ctx, img, x, y, width, height, radius) {
    ctx.save();

    // Create rounded rectangle path
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();

    // Calculate center crop to fill the area
    const imgRatio = img.width / img.height;
    const targetRatio = width / height;

    let sourceX = 0, sourceY = 0, sourceW = img.width, sourceH = img.height;

    if (imgRatio > targetRatio) {
        // Image is wider - crop horizontally
        sourceW = img.height * targetRatio;
        sourceX = (img.width - sourceW) / 2;
    } else {
        // Image is taller - crop vertically
        sourceH = img.width / targetRatio;
        sourceY = (img.height - sourceH) / 2;
    }

    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, x, y, width, height);
    ctx.restore();
}

/**
 * Generate shareable photo with optional watermarks
 * @param {string} photoPath - Path to the photo
 * @param {Object} options - Options
 * @returns {Promise<Blob>} Image blob
 */
export async function generateShareablePhoto(photoPath, options = {}) {
    const {
        addPhotoCloveWatermark: addPCWatermark = true,
        addUserWatermark: addUWatermark = false,
        userWatermarkText = '',
        watermarkColor = '#ffffff',
        watermarkOpacity = 0.7,
        maxSize = 2000,
        quality = 0.92
    } = options;

    logger.info('ShareUtils', 'generate_shareable_photo', 'Generating shareable photo', {
        photoPath,
        addPhotoCloveWatermark: addPCWatermark,
        addUserWatermark: addUWatermark
    });

    const img = await loadImageFromPath(photoPath);

    // Calculate output size (preserve aspect ratio, limit max dimension)
    let width = img.width;
    let height = img.height;

    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw the image
    ctx.drawImage(img, 0, 0, width, height);

    // Add user watermark if requested (bottom-left)
    if (addUWatermark && userWatermarkText) {
        addUserWatermark(ctx, width, height, userWatermarkText, {
            position: 'bottom-left',
            color: watermarkColor,
            opacity: watermarkOpacity
        });
    }

    // Add PhotoClove watermark if requested (bottom-right)
    if (addPCWatermark) {
        addPhotoCloveWatermark(ctx, width, height, {
            position: 'bottom-right',
            color: watermarkColor,
            opacity: watermarkOpacity
        });
    }

    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png', quality);
    });
}

/**
 * Get collage layout configuration based on photo count
 * @param {number} count - Number of photos
 * @returns {Object} Layout configuration
 */
export function getCollageLayout(count) {
    const layouts = {
        2: { cols: 2, rows: 1, cells: [[0, 0], [1, 0]] },
        3: { cols: 2, rows: 2, cells: [[0, 0], [1, 0], [0, 1, 2, 1]], spanLast: true }, // 2+1 layout
        4: { cols: 2, rows: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
        5: { cols: 3, rows: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]], incomplete: true },
        6: { cols: 3, rows: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
        7: { cols: 3, rows: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2]], incomplete: true },
        8: { cols: 3, rows: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2]], incomplete: true },
        9: { cols: 3, rows: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] }
    };

    // For counts > 9, use 3x3 grid
    if (count > 9) {
        return layouts[9];
    }

    // For count < 2, return null
    if (count < 2) {
        return null;
    }

    return layouts[count] || layouts[Math.min(count, 9)];
}

/**
 * Generate collage from multiple photos
 * @param {string[]} photoPaths - Array of photo paths
 * @param {Object} options - Collage options
 * @returns {Promise<Blob>} Collage image blob
 */
export async function generateCollage(photoPaths, options = {}) {
    const {
        backgroundColor = '#000000',
        padding = 10,
        cornerRadius = 8,
        addPhotoCloveWatermark: addPCWatermark = true,
        addUserWatermark: addUWatermark = false,
        userWatermarkText = '',
        watermarkColor = '#ffffff',
        watermarkOpacity = 0.7,
        maxSize = 1800,
        cellSize = 400
    } = options;

    const count = Math.min(photoPaths.length, 9);
    const layout = getCollageLayout(count);

    if (!layout) {
        throw new Error('Need at least 2 photos for collage');
    }

    logger.info('ShareUtils', 'generate_collage', 'Generating collage', { count, layout: `${layout.cols}x${layout.rows}` });

    // Load all images in parallel
    const images = await Promise.all(
        photoPaths.slice(0, count).map(path => loadImageFromPath(path))
    );

    // Calculate canvas size
    const width = layout.cols * cellSize + (layout.cols + 1) * padding;
    const height = layout.rows * cellSize + (layout.rows + 1) * padding;

    // Scale down if too large
    let scale = 1;
    if (width > maxSize || height > maxSize) {
        scale = Math.min(maxSize / width, maxSize / height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');

    // Scale context
    ctx.scale(scale, scale);

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw each image
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const cellInfo = layout.cells[i];

        let col = cellInfo[0];
        let row = cellInfo[1];
        let spanCols = cellInfo[2] || 1;
        let spanRows = cellInfo[3] || 1;

        // Special handling for 3-photo layout
        if (layout.spanLast && i === images.length - 1 && count === 3) {
            col = 0;
            row = 1;
            spanCols = 2;
            spanRows = 1;
        }

        const x = padding + col * (cellSize + padding);
        const y = padding + row * (cellSize + padding);
        const w = spanCols * cellSize + (spanCols - 1) * padding;
        const h = spanRows * cellSize + (spanRows - 1) * padding;

        drawRoundedImage(ctx, img, x, y, w, h, cornerRadius);
    }

    // Reset scale for watermarks
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Add user watermark if requested (bottom-left)
    if (addUWatermark && userWatermarkText) {
        addUserWatermark(ctx, canvas.width, canvas.height, userWatermarkText, {
            position: 'bottom-left',
            color: watermarkColor,
            opacity: watermarkOpacity
        });
    }

    // Add PhotoClove watermark if requested (bottom-right)
    if (addPCWatermark) {
        addPhotoCloveWatermark(ctx, canvas.width, canvas.height, {
            position: 'bottom-right',
            color: watermarkColor,
            opacity: watermarkOpacity
        });
    }

    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
}

/**
 * Get supported layouts for UI display
 * @returns {Array} Array of layout options
 */
export function getSupportedCollageLayouts() {
    return [
        { count: 2, label: '2 (1x2)', cols: 2, rows: 1 },
        { count: 3, label: '3 (2+1)', cols: 2, rows: 2 },
        { count: 4, label: '4 (2x2)', cols: 2, rows: 2 },
        { count: 6, label: '6 (3x2)', cols: 3, rows: 2 },
        { count: 9, label: '9 (3x3)', cols: 3, rows: 3 }
    ];
}
