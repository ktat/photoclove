/**
 * Photo Export Utilities
 * Handles styled image export operations (download and save as copy)
 */

import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { logger } from '../../../../services/LoggerService.js';
import fileUrl from '../../../../PathUtil.jsx';
import { applyFiltersToCanvas, applyTransformsToCanvas } from './imageProcessing.js';

/**
 * Maximum image size for processing to prevent memory issues
 */
const MAX_IMAGE_SIZE = 4096;

/**
 * Create a styled canvas from the main image with applied editor styles
 * @param {HTMLImageElement} mainImage - The source image element
 * @param {Object} editorStyles - The editor styles to apply
 * @returns {Promise<HTMLCanvasElement>} The styled canvas
 */
export function createStyledCanvas(mainImage, editorStyles) {
    return new Promise((resolve, reject) => {
        const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;

        // Calculate dimensions with size limit
        let width = mainImage.naturalWidth || mainImage.width;
        let height = mainImage.naturalHeight || mainImage.height;

        if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            const scaleFactor = Math.min(MAX_IMAGE_SIZE / width, MAX_IMAGE_SIZE / height);
            width = Math.floor(width * scaleFactor);
            height = Math.floor(height * scaleFactor);
            logger.info('PhotoExport', 'resize_image', 'Resizing image for export', {
                originalWidth: mainImage.naturalWidth,
                originalHeight: mainImage.naturalHeight,
                newWidth: width,
                newHeight: height
            });
        }

        // Create main canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Create temporary image for processing
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';

        tempImg.onload = function() {
            // Create temporary canvas for filters
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = tempImg.width;
            tempCanvas.height = tempImg.height;

            // Draw the original image
            tempCtx.drawImage(tempImg, 0, 0);

            // Apply filters
            applyFiltersToCanvas(tempCtx, tempCanvas.width, tempCanvas.height,
                { brightness, contrast, saturation, hue });

            // Apply transforms
            applyTransformsToCanvas(ctx, canvas.width, canvas.height, tempCanvas,
                { rotate, scale });

            resolve(canvas);
        };

        tempImg.onerror = function() {
            reject(new Error('Failed to load image for processing'));
        };

        // Load the original image
        tempImg.src = mainImage.src;
    });
}

/**
 * Convert canvas to base64 data
 * @param {HTMLCanvasElement} canvas - The canvas to convert
 * @param {string} mimeType - The image mime type (e.g., 'image/jpeg')
 * @param {number} quality - The image quality (0-1)
 * @returns {Promise<string>} Base64 encoded image data (without prefix)
 */
export function canvasToBase64(canvas, mimeType = 'image/jpeg', quality = 0.95) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(function(blob) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Remove data:image/...;base64, prefix
                const base64Data = e.target.result.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = function() {
                reject(new Error('Failed to convert image to base64'));
            };
            reader.readAsDataURL(blob);
        }, mimeType, quality);
    });
}

/**
 * Download styled image to user's download directory
 * @param {Object} options - Download options
 * @param {HTMLImageElement} options.mainImage - The source image element
 * @param {Object} options.editorStyles - The editor styles to apply
 * @param {string} options.photoPath - The original photo path
 * @param {Function} options.addFooterMessage - Function to show footer message
 * @param {Function} options.onClickHandler - Optional click handler for the download message
 * @returns {Promise<void>}
 */
export async function downloadStyledImage({ mainImage, editorStyles, photoPath, addFooterMessage, onClickHandler }) {
    try {
        const canvas = await createStyledCanvas(mainImage, editorStyles);

        // Convert canvas to blob and download
        canvas.toBlob(async function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const fileName = photoPath.split('/').pop().replace(/\.[^/.]+$/, '_styled.png');
            link.download = fileName;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Get configurable download directory and show notification
            try {
                const downloadDir = await invoke('get_download_dir');
                const fullPath = `${downloadDir}/${fileName}`;

                // Check and request notification permission if needed
                let permissionGranted = await isPermissionGranted();
                if (!permissionGranted) {
                    const permission = await requestPermission();
                    permissionGranted = permission === 'granted';
                }

                // Show system notification if permission is granted
                if (permissionGranted) {
                    await sendNotification({
                        title: 'Download Complete',
                        body: `Styled image saved to: ${fullPath}`
                    });
                }

                // Show footer message with full path
                addFooterMessage("download", `Styled image downloaded to: ${fullPath} (Click to open)`, false, 8000);

                // Add click handler to footer message with { once: true } to prevent memory leak
                setTimeout(() => {
                    const downloadMessage = document.querySelector('.download');
                    if (downloadMessage) {
                        downloadMessage.style.cursor = 'pointer';
                        downloadMessage.style.textDecoration = 'underline';
                        downloadMessage.title = 'Click to open file';
                        // Use { once: true } to automatically remove listener after first click
                        downloadMessage.addEventListener('click', async () => {
                            try {
                                await invoke('open_file_in_default_app', { filePath: fullPath });
                            } catch (error) {
                                logger.error('PhotoExport', 'file_open_failed', 'Failed to open downloaded file', { error: error.message });
                                // Fallback to plugin opener
                                try {
                                    await openUrl(fileUrl(fullPath));
                                } catch (fallbackError) {
                                    logger.error('PhotoExport', 'fallback_file_open_failed', 'Fallback file opening also failed', { error: fallbackError.message });
                                }
                            }
                        }, { once: true }); // Prevents memory leak by removing listener after first click
                    }
                }, 100);
            } catch (error) {
                logger.error('PhotoExport', 'download_notification_failed', 'Failed to get download directory or show notification', { error: error.message });
                // Fallback to footer message only
                addFooterMessage("download", `Styled image downloaded: ${fileName}`, false, 5000);
            }
        }, 'image/png');

    } catch (error) {
        logger.error('PhotoExport', 'download_failed', 'Download failed', { error: error.message });
        throw error;
    }
}

/**
 * Save styled image as a copy to the photo library
 * @param {Object} options - Save options
 * @param {HTMLImageElement} options.mainImage - The source image element
 * @param {Object} options.editorStyles - The editor styles to apply
 * @param {string} options.photoPath - The original photo path
 * @param {string} options.cssStyle - The CSS style string
 * @param {Function} options.addFooterMessage - Function to show footer message
 * @param {Function} options.onPhotosRefresh - Optional callback to refresh photos
 * @returns {Promise<string>} The new photo path
 */
export async function saveStyledCopy({ mainImage, editorStyles, photoPath, cssStyle, addFooterMessage, onPhotosRefresh }) {
    try {
        const canvas = await createStyledCanvas(mainImage, editorStyles);
        const base64Data = await canvasToBase64(canvas, 'image/jpeg', 0.95);

        // Send to backend to save as copy
        const newPhotoPath = await invoke('save_styled_copy_from_frontend', {
            originalPhotoPath: photoPath,
            cssStyle: cssStyle,
            imageData: base64Data
        });

        // Extract filename from path for display
        const newFilename = newPhotoPath.split('/').pop();
        addFooterMessage('editor', `Styled copy created: ${newFilename}`, false, 5000);

        // Refresh photo list to show the new image
        if (onPhotosRefresh) {
            onPhotosRefresh();
        }

        // Trigger a manual reload by emitting an event
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('refreshDates'));
        }

        return newPhotoPath;

    } catch (error) {
        logger.error('PhotoExport', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
        throw error;
    }
}
