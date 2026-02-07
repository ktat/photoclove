/**
 * Unified exports for share utilities
 * Maintains backward compatibility with the original ShareUtils.js
 */

// Text generation
export { generateStatsShareText } from './StatsTextGenerator.js';

// Clipboard operations
export { copyTextToClipboard, copyImageToClipboard, saveImageAsFile } from './ClipboardUtils.js';

// Social media sharing
export { getShareUrl, shareToSocial } from './SocialMediaShare.js';

// Image generation
export { generateStatsImage } from './StatsImageGenerator.js';

// Image processing
export {
    loadImageFromPath,
    addPhotoCloveWatermark,
    addUserWatermark,
    addDiagonalWatermark,
    drawRoundedImage,
    generateShareablePhoto
} from './ImageProcessingUtils.js';

// Collage generation
export { 
    getCollageLayout, 
    generateCollage, 
    getSupportedCollageLayouts 
} from './CollageGenerator.js';

// Backward compatibility - re-export all functions as they were in the original file
export * from './StatsTextGenerator.js';
export * from './ClipboardUtils.js';
export * from './SocialMediaShare.js';
export * from './StatsImageGenerator.js';
export * from './ImageProcessingUtils.js';
export * from './CollageGenerator.js';