/**
 * ShareUtils - Utilities for sharing stats and images
 */

import { open } from '@tauri-apps/plugin-shell';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

/**
 * Generate share text from insights data
 * @param {Object} insights - Insights data from InsightsService
 * @param {string} period - 'all' | 'monthly' | 'yearly'
 * @returns {string} Formatted share text
 */
export function generateStatsShareText(insights, period = 'all') {
    if (!insights) return '';

    const lines = [];
    const now = new Date();

    // Header based on period
    if (period === 'monthly') {
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        lines.push(`📊 ${monthName} Photography Stats`);
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
 * Save image blob as file
 * @param {Blob} blob - Image blob
 * @param {string} filename - Filename to save as
 */
export function saveImageAsFile(blob, filename = 'photoclove-stats.png') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logger.info('ShareUtils', 'save_image_success', 'Image saved', { filename });
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
        accentColor = '#4ade80'
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

    // Header
    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('📊 Photography Stats', 30, 50);

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
    ctx.fillText('#PhotoClove', 30, height - 30);
    ctx.fillText('github.com/ktat/photoclove', width - 200, height - 30);

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
        size = 'auto'
    } = options;

    // Calculate font size based on canvas size
    const fontSize = size === 'auto' ? Math.max(12, Math.min(width, height) / 30) : size;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#ffffff';
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

    logger.debug('ShareUtils', 'watermark_added', 'Watermark drawn', { position, fontSize });
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
 * Generate shareable photo with optional watermark
 * @param {string} photoPath - Path to the photo
 * @param {Object} options - Options
 * @returns {Promise<Blob>} Image blob
 */
export async function generateShareablePhoto(photoPath, options = {}) {
    const {
        addWatermark = false,
        maxSize = 2000,
        quality = 0.92
    } = options;

    logger.info('ShareUtils', 'generate_shareable_photo', 'Generating shareable photo', { photoPath, addWatermark });

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

    // Add watermark if requested
    if (addWatermark) {
        addPhotoCloveWatermark(ctx, width, height);
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
        addWatermark = false,
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

    // Add watermark if requested
    if (addWatermark) {
        // Reset scale for watermark
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        addPhotoCloveWatermark(ctx, canvas.width, canvas.height);
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
