/**
 * Image processing utilities for PhotoEditor
 * Contains shared filter logic for brightness, contrast, saturation, and hue adjustments
 */

/**
 * Apply brightness adjustment to RGB values
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {number} brightness - Brightness value (100 = no change)
 * @returns {{r: number, g: number, b: number}} Adjusted RGB values
 */
export function applyBrightness(r, g, b, brightness) {
    if (brightness === 100) return { r, g, b };

    const multiplier = brightness / 100;
    return {
        r: Math.min(255, r * multiplier),
        g: Math.min(255, g * multiplier),
        b: Math.min(255, b * multiplier)
    };
}

/**
 * Apply contrast adjustment to RGB values
 * Formula: (pixel - 128) * contrast + 128
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {number} contrast - Contrast value (100 = no change)
 * @returns {{r: number, g: number, b: number}} Adjusted RGB values
 */
export function applyContrast(r, g, b, contrast) {
    if (contrast === 100) return { r, g, b };

    const multiplier = contrast / 100;
    return {
        r: Math.min(255, Math.max(0, (r - 128) * multiplier + 128)),
        g: Math.min(255, Math.max(0, (g - 128) * multiplier + 128)),
        b: Math.min(255, Math.max(0, (b - 128) * multiplier + 128))
    };
}

/**
 * Apply saturation adjustment to RGB values
 * Converts to HSL-like adjustment, modifies saturation, converts back
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {number} saturation - Saturation value (100 = no change)
 * @returns {{r: number, g: number, b: number}} Adjusted RGB values
 */
export function applySaturation(r, g, b, saturation) {
    if (saturation === 100) return { r, g, b };

    const multiplier = saturation / 100;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return { r, g, b };

    const avg = (max + min) / 2;
    const adjustedDelta = delta * multiplier;
    const factor = adjustedDelta / delta;

    return {
        r: Math.min(255, Math.max(0, avg + (r - avg) * factor)),
        g: Math.min(255, Math.max(0, avg + (g - avg) * factor)),
        b: Math.min(255, Math.max(0, avg + (b - avg) * factor))
    };
}

/**
 * Apply hue rotation to RGB values
 * Uses simplified RGB hue shift matrix
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {number} hue - Hue rotation in degrees (0 = no change)
 * @returns {{r: number, g: number, b: number}} Adjusted RGB values
 */
export function applyHue(r, g, b, hue) {
    if (hue === 0) return { r, g, b };

    const hueRadians = (hue * Math.PI) / 180;
    const cosHue = Math.cos(hueRadians);
    const sinHue = Math.sin(hueRadians);
    const sqrtOneThird = Math.sqrt(1/3);

    const newR = r * (cosHue + (1 - cosHue) / 3) +
                 g * ((1 - cosHue) / 3 - sinHue * sqrtOneThird) +
                 b * ((1 - cosHue) / 3 + sinHue * sqrtOneThird);
    const newG = r * ((1 - cosHue) / 3 + sinHue * sqrtOneThird) +
                 g * (cosHue + (1 - cosHue) / 3) +
                 b * ((1 - cosHue) / 3 - sinHue * sqrtOneThird);
    const newB = r * ((1 - cosHue) / 3 - sinHue * sqrtOneThird) +
                 g * ((1 - cosHue) / 3 + sinHue * sqrtOneThird) +
                 b * (cosHue + (1 - cosHue) / 3);

    return {
        r: Math.min(255, Math.max(0, newR)),
        g: Math.min(255, Math.max(0, newG)),
        b: Math.min(255, Math.max(0, newB))
    };
}

/**
 * Apply all image filters to canvas image data
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {{brightness: number, contrast: number, saturation: number, hue: number}} filters - Filter values
 */
export function applyFiltersToCanvas(ctx, width, height, filters) {
    const { brightness, contrast, saturation, hue } = filters;

    // Skip if no filters need to be applied
    if (brightness === 100 && contrast === 100 && saturation === 100 && hue === 0) {
        return;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply brightness
        if (brightness !== 100) {
            const result = applyBrightness(r, g, b, brightness);
            r = result.r;
            g = result.g;
            b = result.b;
        }

        // Apply contrast
        if (contrast !== 100) {
            const result = applyContrast(r, g, b, contrast);
            r = result.r;
            g = result.g;
            b = result.b;
        }

        // Apply saturation
        if (saturation !== 100) {
            const result = applySaturation(r, g, b, saturation);
            r = result.r;
            g = result.g;
            b = result.b;
        }

        // Apply hue
        if (hue !== 0) {
            const result = applyHue(r, g, b, hue);
            r = result.r;
            g = result.g;
            b = result.b;
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply rotation and scale transforms to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} canvasWidth - Final canvas width
 * @param {number} canvasHeight - Final canvas height
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas with filtered image
 * @param {{rotate: number, scale: number}} transforms - Transform values
 */
export function applyTransformsToCanvas(ctx, canvasWidth, canvasHeight, sourceCanvas, transforms) {
    const { rotate, scale } = transforms;

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    if (rotate !== 0) {
        ctx.rotate((rotate * Math.PI) / 180);
    }

    if (scale !== 100) {
        const scaleValue = scale / 100;
        ctx.scale(scaleValue, scaleValue);
    }

    // Draw the filtered image centered
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    ctx.restore();
}

/**
 * Process an image with all editor styles (filters and transforms)
 * @param {HTMLImageElement} sourceImage - Source image element
 * @param {Object} editorStyles - Editor styles object
 * @param {number} maxSize - Maximum dimension size (default 4096)
 * @returns {Promise<HTMLCanvasElement>} Canvas with processed image
 */
export function processImage(sourceImage, editorStyles, maxSize = 4096) {
    return new Promise((resolve, reject) => {
        const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;

        // Calculate dimensions, limiting to maxSize
        let width = sourceImage.naturalWidth || sourceImage.width;
        let height = sourceImage.naturalHeight || sourceImage.height;

        if (width > maxSize || height > maxSize) {
            const scaleRatio = Math.min(maxSize / width, maxSize / height);
            width = Math.floor(width * scaleRatio);
            height = Math.floor(height * scaleRatio);
        }

        // Create temporary canvas for filters
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;

        // Draw source image
        tempCtx.drawImage(sourceImage, 0, 0, width, height);

        // Apply filters
        applyFiltersToCanvas(tempCtx, width, height, { brightness, contrast, saturation, hue });

        // Create final canvas for transforms
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        finalCanvas.width = width;
        finalCanvas.height = height;

        // Apply transforms
        applyTransformsToCanvas(finalCtx, width, height, tempCanvas, { rotate, scale });

        resolve(finalCanvas);
    });
}

/**
 * Load an image and process it with editor styles
 * @param {string} imageSrc - Image source URL
 * @param {Object} editorStyles - Editor styles object
 * @param {number} maxSize - Maximum dimension size (default 4096)
 * @returns {Promise<HTMLCanvasElement>} Canvas with processed image
 */
export function loadAndProcessImage(imageSrc, editorStyles, maxSize = 4096) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = async () => {
            try {
                const canvas = await processImage(img, editorStyles, maxSize);
                resolve(canvas);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageSrc;
    });
}
