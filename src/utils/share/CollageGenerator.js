/**
 * Photo collage generation utilities
 */

import { logger } from '../../services/LoggerService.js';
import { loadImageFromPath, drawRoundedImage, addPhotoCloveWatermark, addUserWatermark } from './ImageProcessingUtils.js';

/**
 * Get collage layout configuration for a given photo count
 * @param {number} count - Number of photos
 * @returns {Object|null} Layout configuration
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

    logger.info('CollageGenerator', 'generate_collage', 'Generating collage', { 
        count, 
        layout: `${layout.cols}x${layout.rows}` 
    });

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
        let spanCols = cellInfo[2] !== undefined ? cellInfo[2] : 1;
        let spanRows = cellInfo[3] !== undefined ? cellInfo[3] : 1;

        // Special handling for 3-photo layout
        if (layout.spanLast && i === images.length - 1 && count === 3) {
            col = 0;
            row = 1;
            spanCols = 2;
            spanRows = 1;
        }

        const x = padding + col * (cellSize + padding);
        const y = padding + row * (cellSize + padding);
        const cellWidth = cellSize * spanCols + padding * (spanCols - 1);
        const cellHeight = cellSize * spanRows + padding * (spanRows - 1);

        // Draw image with rounded corners
        drawRoundedImage(ctx, img, x, y, cellWidth, cellHeight, cornerRadius);
    }

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

    logger.info('CollageGenerator', 'collage_generated', 'Collage generation complete', {
        finalSize: `${canvas.width}x${canvas.height}`,
        scale: scale.toFixed(2)
    });

    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
}

/**
 * Get supported collage layouts information
 * @returns {Object[]} Array of layout info objects
 */
export function getSupportedCollageLayouts() {
    return [
        { count: 2, description: '2 photos side by side', grid: '2x1' },
        { count: 3, description: '2 photos top, 1 wide bottom', grid: '2x2 (spanning)' },
        { count: 4, description: '2x2 grid', grid: '2x2' },
        { count: 5, description: '3 photos top, 2 bottom', grid: '3x2 (incomplete)' },
        { count: 6, description: '3x2 grid', grid: '3x2' },
        { count: 7, description: '3x3 grid (incomplete)', grid: '3x3 (incomplete)' },
        { count: 8, description: '3x3 grid (incomplete)', grid: '3x3 (incomplete)' },
        { count: 9, description: '3x3 grid', grid: '3x3' }
    ];
}