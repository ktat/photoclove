/**
 * Image processing and watermark utilities
 */

import { logger as _logger } from '../../services/LoggerService.js';

/**
 * Add PhotoClove watermark to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height  
 * @param {Object} options - Watermark options
 */
export function addPhotoCloveWatermark(ctx, width, height, options = {}) {
    const {
        position = 'bottom-right',
        opacity = 0.7,
        fontSize = Math.max(12, Math.min(width, height) * 0.025),
        color = '#ffffff',
        padding = 10
    } = options;

    // Save current context state
    ctx.save();

    // Set watermark styles
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif`;
    ctx.textBaseline = 'bottom';

    // Calculate text metrics
    const text = 'PhotoClove';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate position
    let x, y;
    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
        case 'top-right':
            x = width - textWidth - padding;
            y = padding + textHeight;
            break;
        case 'bottom-left':
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
        default:
            x = width - textWidth - padding;
            y = height - padding;
            break;
        case 'center':
            x = (width - textWidth) / 2;
            y = (height + textHeight) / 2;
            break;
    }

    // Draw text shadow for better readability
    ctx.globalAlpha = opacity * 0.8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, x + 1, y + 1);

    // Draw main text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Restore context state
    ctx.restore();
}

/**
 * Add custom user watermark to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} text - Watermark text
 * @param {Object} options - Watermark options
 */
export function addUserWatermark(ctx, width, height, text, options = {}) {
    if (!text || text.trim() === '') return;

    const {
        position = 'bottom-left',
        opacity = 0.6,
        fontSize = Math.max(14, Math.min(width, height) * 0.03),
        color = '#ffffff',
        padding = 12,
        fontFamily = 'Arial, sans-serif',
        fontWeight = 'normal'
    } = options;

    // Save current context state
    ctx.save();

    // Set watermark styles
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'bottom';

    // Calculate text metrics
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate position
    let x, y;
    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
        case 'top-right':
            x = width - textWidth - padding;
            y = padding + textHeight;
            break;
        case 'bottom-left':
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
            x = width - textWidth - padding;
            y = height - padding;
            break;
        case 'center':
            x = (width - textWidth) / 2;
            y = (height + textHeight) / 2;
            break;
        default:
            x = padding;
            y = height - padding;
            break;
    }

    // Draw text shadow for better readability
    ctx.globalAlpha = opacity * 0.8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, x + 1, y + 1);

    // Draw main text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Restore context state
    ctx.restore();
}

/**
 * Draw image with rounded corners
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLImageElement} img - Image element
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
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
    
    // Clip to the rounded rectangle
    ctx.clip();
    
    // Draw the image
    ctx.drawImage(img, x, y, width, height);
    
    ctx.restore();
}

/**
 * Create a gradient background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} color1 - Start color
 * @param {string} color2 - End color
 * @param {string} direction - 'vertical' | 'horizontal' | 'diagonal'
 */
export function createGradientBackground(ctx, width, height, color1, color2, direction = 'vertical') {
    let gradient;
    
    switch (direction) {
        case 'horizontal':
            gradient = ctx.createLinearGradient(0, 0, width, 0);
            break;
        case 'diagonal':
            gradient = ctx.createLinearGradient(0, 0, width, height);
            break;
        case 'vertical':
        default:
            gradient = ctx.createLinearGradient(0, 0, 0, height);
            break;
    }
    
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Apply image filters
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} filters - Filter options
 */
export function applyImageFilters(ctx, width, height, filters = {}) {
    const {
        brightness = 1,
        contrast = 1,
        saturation = 1,
        sepia = 0,
        blur = 0
    } = filters;

    // Build CSS filter string
    const filterParts = [];
    
    if (brightness !== 1) {
        filterParts.push(`brightness(${brightness})`);
    }
    if (contrast !== 1) {
        filterParts.push(`contrast(${contrast})`);
    }
    if (saturation !== 1) {
        filterParts.push(`saturate(${saturation})`);
    }
    if (sepia > 0) {
        filterParts.push(`sepia(${sepia})`);
    }
    if (blur > 0) {
        filterParts.push(`blur(${blur}px)`);
    }

    if (filterParts.length > 0) {
        ctx.filter = filterParts.join(' ');
    }
}

/**
 * Reset canvas filters
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
export function resetFilters(ctx) {
    ctx.filter = 'none';
}

/**
 * Load image from URL/path
 * @param {string} src - Image source
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Get optimal image size for canvas
 * @param {HTMLImageElement} img - Image element
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {boolean} maintainAspectRatio - Whether to maintain aspect ratio
 * @returns {Object} Object with width and height
 */
export function getOptimalImageSize(img, maxWidth, maxHeight, maintainAspectRatio = true) {
    let width = img.width;
    let height = img.height;

    if (!maintainAspectRatio) {
        return { width: maxWidth, height: maxHeight };
    }

    const aspectRatio = width / height;

    if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
    }

    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
}