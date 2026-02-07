/**
 * Image processing utilities for sharing
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import { logger } from '../../services/LoggerService.js';

/**
 * Load image from file path
 * @param {string} filePath - File path to load
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
export async function loadImageFromPath(filePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            logger.debug('ImageProcessingUtils', 'image_loaded', 'Image loaded successfully', { 
                path: filePath,
                size: `${img.width}x${img.height}` 
            });
            resolve(img);
        };
        
        img.onerror = (error) => {
            logger.error('ImageProcessingUtils', 'image_load_failed', 'Failed to load image', { 
                path: filePath, 
                error: error.message 
            });
            reject(new Error(`Failed to load image: ${filePath}`));
        };
        
        img.src = convertFileSrc(filePath);
    });
}

/**
 * Add PhotoClove watermark to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Watermark options
 */
export function addPhotoCloveWatermark(ctx, width, height, options = {}) {
    const {
        color = '#ffffff',
        opacity = 0.7,
        position = 'bottom-right',
        padding = 20,
        fontSize = 14
    } = options;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

    const text = 'PhotoClove';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    let x, y;
    
    switch (position) {
        case 'bottom-left':
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
            x = width - textWidth - padding;
            y = height - padding;
            break;
        case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
        case 'top-right':
            x = width - textWidth - padding;
            y = padding + textHeight;
            break;
        default:
            x = width - textWidth - padding;
            y = height - padding;
    }

    // Add subtle background
    ctx.globalAlpha = opacity * 0.3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - 8, y - textHeight - 4, textWidth + 16, textHeight + 8);
    
    // Draw text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    
    ctx.restore();

    logger.debug('ImageProcessingUtils', 'watermark_added', 'PhotoClove watermark added', { position });
}

/**
 * Add user watermark to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} text - Watermark text
 * @param {Object} options - Watermark options
 */
export function addUserWatermark(ctx, width, height, text, options = {}) {
    if (!text) return;

    const {
        color = '#ffffff',
        opacity = 0.7,
        position = 'bottom-left',
        padding = 20,
        fontSize = 16
    } = options;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    let x, y;
    
    switch (position) {
        case 'bottom-left':
            x = padding;
            y = height - padding;
            break;
        case 'bottom-right':
            x = width - textWidth - padding;
            y = height - padding;
            break;
        case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
        case 'top-right':
            x = width - textWidth - padding;
            y = padding + textHeight;
            break;
        default:
            x = padding;
            y = height - padding;
    }

    // Add subtle background
    ctx.globalAlpha = opacity * 0.3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - 8, y - textHeight - 4, textWidth + 16, textHeight + 8);
    
    // Draw text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    
    ctx.restore();

    logger.debug('ImageProcessingUtils', 'user_watermark_added', 'User watermark added', { text, position });
}

/**
 * Draw rounded rectangle image
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLImageElement} img - Image to draw
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 */
export function drawRoundedImage(ctx, img, x, y, width, height, radius) {
    ctx.save();
    
    // Create clipping path
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.clip();
    
    // Calculate scaling to cover the area
    const imgAspect = img.width / img.height;
    const cellAspect = width / height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspect > cellAspect) {
        // Image is wider, scale by height
        drawHeight = height;
        drawWidth = height * imgAspect;
        drawX = x - (drawWidth - width) / 2;
        drawY = y;
    } else {
        // Image is taller, scale by width
        drawWidth = width;
        drawHeight = width / imgAspect;
        drawX = x;
        drawY = y - (drawHeight - height) / 2;
    }
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
}

/**
 * Generate shareable photo with watermarks
 * @param {string} photoPath - Path to the photo
 * @param {Object} options - Generation options
 * @returns {Promise<Blob>} Generated image blob
 */
export async function generateShareablePhoto(photoPath, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        addPhotoCloveWatermark: addPCWatermark = true,
        addUserWatermark: addUWatermark = false,
        userWatermarkText = '',
        watermarkColor = '#ffffff',
        watermarkOpacity = 0.7
    } = options;

    try {
        const img = await loadImageFromPath(photoPath);
        
        // Calculate scaled size
        let { width, height } = img;
        const aspectRatio = width / height;
        
        if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
        }
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Add watermarks
        if (addPCWatermark) {
            addPhotoCloveWatermark(ctx, width, height, {
                color: watermarkColor,
                opacity: watermarkOpacity
            });
        }

        if (addUWatermark && userWatermarkText) {
            addUserWatermark(ctx, width, height, userWatermarkText, {
                color: watermarkColor,
                opacity: watermarkOpacity
            });
        }

        logger.info('ImageProcessingUtils', 'photo_processed', 'Shareable photo generated', {
            originalSize: `${img.width}x${img.height}`,
            finalSize: `${width}x${height}`
        });

        // Convert to blob
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });
    } catch (error) {
        logger.error('ImageProcessingUtils', 'photo_processing_failed', 'Failed to generate shareable photo', { 
            photoPath, 
            error: error.message 
        });
        throw error;
    }
}