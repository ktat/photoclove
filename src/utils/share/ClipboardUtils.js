/**
 * Clipboard operations for sharing
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../services/LoggerService.js';

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        logger.info('ClipboardUtils', 'copy_text_success', 'Text copied to clipboard');
        return { success: true };
    } catch (error) {
        logger.error('ClipboardUtils', 'copy_text_failed', 'Failed to copy text to clipboard', { error: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Copy image blob to clipboard
 * @param {Blob} blob - Image blob to copy
 */
export async function copyImageToClipboard(blob) {
    try {
        if (!navigator.clipboard || !navigator.clipboard.write) {
            throw new Error('Clipboard API not supported');
        }

        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        
        logger.info('ClipboardUtils', 'copy_image_success', 'Image copied to clipboard');
        return { success: true };
    } catch (error) {
        logger.error('ClipboardUtils', 'copy_image_failed', 'Failed to copy image to clipboard', { error: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Save image blob as file
 * @param {Blob} blob - Image blob to save
 * @param {string} filename - Filename for saved image
 */
export async function saveImageAsFile(blob, filename = 'photoclove-stats.png') {
    try {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Use Tauri to save file
        const result = await invoke('save_image_file', {
            imageData: Array.from(uint8Array),
            filename: filename
        });

        logger.info('ClipboardUtils', 'save_image_success', 'Image saved successfully', { 
            filename, 
            path: result.path,
            size: uint8Array.length 
        });
        
        return { success: true, path: result.path };
    } catch (error) {
        logger.error('ClipboardUtils', 'save_image_failed', 'Failed to save image', { 
            error: error.message, 
            filename 
        });
        return { success: false, error: error.message };
    }
}