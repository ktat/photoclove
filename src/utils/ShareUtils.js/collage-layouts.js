/**
 * Collage layout definitions and utilities
 */

/**
 * Get collage layout configuration for given number of photos
 * @param {number} count - Number of photos (2-9)
 * @returns {Object} Layout configuration
 */
export function getCollageLayout(count) {
    const layouts = {
        2: {
            name: 'Split',
            grid: '1x2',
            positions: [
                { x: 0, y: 0, width: 0.5, height: 1 },
                { x: 0.5, y: 0, width: 0.5, height: 1 }
            ]
        },
        3: {
            name: 'L-Shape',
            grid: '2x2',
            positions: [
                { x: 0, y: 0, width: 0.5, height: 1 },
                { x: 0.5, y: 0, width: 0.5, height: 0.5 },
                { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
            ]
        },
        4: {
            name: 'Grid 2x2',
            grid: '2x2',
            positions: [
                { x: 0, y: 0, width: 0.5, height: 0.5 },
                { x: 0.5, y: 0, width: 0.5, height: 0.5 },
                { x: 0, y: 0.5, width: 0.5, height: 0.5 },
                { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
            ]
        },
        5: {
            name: 'Cross',
            grid: '3x2',
            positions: [
                { x: 0, y: 0, width: 0.4, height: 0.5 },
                { x: 0.6, y: 0, width: 0.4, height: 0.5 },
                { x: 0.2, y: 0.5, width: 0.6, height: 0.5 },
                { x: 0, y: 0.5, width: 0.2, height: 0.5 },
                { x: 0.8, y: 0.5, width: 0.2, height: 0.5 }
            ]
        },
        6: {
            name: 'Grid 3x2',
            grid: '3x2',
            positions: [
                { x: 0, y: 0, width: 0.333, height: 0.5 },
                { x: 0.333, y: 0, width: 0.333, height: 0.5 },
                { x: 0.666, y: 0, width: 0.334, height: 0.5 },
                { x: 0, y: 0.5, width: 0.333, height: 0.5 },
                { x: 0.333, y: 0.5, width: 0.333, height: 0.5 },
                { x: 0.666, y: 0.5, width: 0.334, height: 0.5 }
            ]
        },
        7: {
            name: 'Feature + Grid',
            grid: '3x3',
            positions: [
                { x: 0, y: 0, width: 0.666, height: 0.666 },
                { x: 0.666, y: 0, width: 0.334, height: 0.333 },
                { x: 0.666, y: 0.333, width: 0.334, height: 0.333 },
                { x: 0.666, y: 0.666, width: 0.334, height: 0.334 },
                { x: 0, y: 0.666, width: 0.222, height: 0.334 },
                { x: 0.222, y: 0.666, width: 0.222, height: 0.334 },
                { x: 0.444, y: 0.666, width: 0.222, height: 0.334 }
            ]
        },
        8: {
            name: 'Grid 4x2',
            grid: '4x2',
            positions: [
                { x: 0, y: 0, width: 0.25, height: 0.5 },
                { x: 0.25, y: 0, width: 0.25, height: 0.5 },
                { x: 0.5, y: 0, width: 0.25, height: 0.5 },
                { x: 0.75, y: 0, width: 0.25, height: 0.5 },
                { x: 0, y: 0.5, width: 0.25, height: 0.5 },
                { x: 0.25, y: 0.5, width: 0.25, height: 0.5 },
                { x: 0.5, y: 0.5, width: 0.25, height: 0.5 },
                { x: 0.75, y: 0.5, width: 0.25, height: 0.5 }
            ]
        },
        9: {
            name: 'Grid 3x3',
            grid: '3x3',
            positions: [
                { x: 0, y: 0, width: 0.333, height: 0.333 },
                { x: 0.333, y: 0, width: 0.333, height: 0.333 },
                { x: 0.666, y: 0, width: 0.334, height: 0.333 },
                { x: 0, y: 0.333, width: 0.333, height: 0.333 },
                { x: 0.333, y: 0.333, width: 0.333, height: 0.333 },
                { x: 0.666, y: 0.333, width: 0.334, height: 0.333 },
                { x: 0, y: 0.666, width: 0.333, height: 0.334 },
                { x: 0.333, y: 0.666, width: 0.333, height: 0.334 },
                { x: 0.666, y: 0.666, width: 0.334, height: 0.334 }
            ]
        }
    };

    return layouts[count] || layouts[4]; // Default to 2x2 grid
}

/**
 * Get all supported collage layouts
 * @returns {Array} Array of layout information
 */
export function getSupportedCollageLayouts() {
    return [
        { count: 2, name: 'Split', description: 'Two photos side by side' },
        { count: 3, name: 'L-Shape', description: 'One large photo with two smaller ones' },
        { count: 4, name: 'Grid 2x2', description: 'Four photos in a 2x2 grid' },
        { count: 5, name: 'Cross', description: 'One central photo surrounded by four others' },
        { count: 6, name: 'Grid 3x2', description: 'Six photos in a 3x2 grid' },
        { count: 7, name: 'Feature + Grid', description: 'One large feature photo with six smaller ones' },
        { count: 8, name: 'Grid 4x2', description: 'Eight photos in a 4x2 grid' },
        { count: 9, name: 'Grid 3x3', description: 'Nine photos in a 3x3 grid' }
    ];
}

/**
 * Calculate absolute positions from relative layout
 * @param {Object} layout - Layout configuration
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} padding - Padding between photos
 * @returns {Array} Array of absolute position objects
 */
export function calculateAbsolutePositions(layout, canvasWidth, canvasHeight, padding = 5) {
    return layout.positions.map(pos => ({
        x: Math.round(pos.x * canvasWidth + (pos.x > 0 ? padding / 2 : 0)),
        y: Math.round(pos.y * canvasHeight + (pos.y > 0 ? padding / 2 : 0)),
        width: Math.round(pos.width * canvasWidth - (pos.x > 0 || pos.x + pos.width < 1 ? padding / 2 : 0)),
        height: Math.round(pos.height * canvasHeight - (pos.y > 0 || pos.y + pos.height < 1 ? padding / 2 : 0))
    }));
}

/**
 * Get optimal canvas size for collage
 * @param {number} photoCount - Number of photos
 * @param {number} targetSize - Target size (width or height)
 * @param {string} aspectRatio - 'square' | 'landscape' | 'portrait'
 * @returns {Object} Object with width and height
 */
export function getOptimalCanvasSize(photoCount, targetSize = 800, aspectRatio = 'square') {
    const layout = getCollageLayout(photoCount);
    
    let width, height;
    
    switch (aspectRatio) {
        case 'landscape':
            width = targetSize;
            height = Math.round(targetSize * 0.75); // 4:3 ratio
            break;
        case 'portrait':
            width = Math.round(targetSize * 0.75); // 3:4 ratio
            height = targetSize;
            break;
        case 'square':
        default:
            width = targetSize;
            height = targetSize;
            break;
    }
    
    return { width, height };
}

/**
 * Create collage background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Background options
 */
export function createCollageBackground(ctx, width, height, options = {}) {
    const {
        type = 'solid', // 'solid' | 'gradient' | 'pattern'
        color = '#ffffff',
        gradientColors = ['#f0f0f0', '#ffffff'],
        gradientDirection = 'vertical'
    } = options;

    ctx.save();

    switch (type) {
        case 'gradient':
            let gradient;
            switch (gradientDirection) {
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
            gradient.addColorStop(0, gradientColors[0]);
            gradient.addColorStop(1, gradientColors[1]);
            ctx.fillStyle = gradient;
            break;
        
        case 'pattern':
            // Create a subtle pattern background
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
            
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.lineWidth = 1;
            const spacing = 20;
            
            for (let x = 0; x <= width; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            
            for (let y = 0; y <= height; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            break;
        
        case 'solid':
        default:
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
            break;
    }

    ctx.restore();
}

/**
 * Validate layout for photo count
 * @param {number} photoCount - Number of photos
 * @returns {boolean} Whether layout is valid
 */
export function validateLayout(photoCount) {
    return photoCount >= 2 && photoCount <= 9;
}

/**
 * Get layout preview data for UI
 * @param {number} count - Photo count
 * @returns {Object} Preview data with positions for UI display
 */
export function getLayoutPreview(count) {
    if (!validateLayout(count)) {
        return null;
    }
    
    const layout = getCollageLayout(count);
    const previewSize = 100; // Fixed size for preview
    
    return {
        name: layout.name,
        grid: layout.grid,
        width: previewSize,
        height: previewSize,
        positions: layout.positions.map(pos => ({
            x: pos.x * previewSize,
            y: pos.y * previewSize,
            width: pos.width * previewSize,
            height: pos.height * previewSize
        }))
    };
}