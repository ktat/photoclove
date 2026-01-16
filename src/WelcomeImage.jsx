import { convertFileSrc } from "@tauri-apps/api/core";

const DEFAULT_IMAGES = [
    "/bird.jpg",
    "/mountain.jpg",
    "/raityou.jpg",
    "/midagahara.jpg",
    "/kamikochi.jpg",
    "/monkey.jpg"
];

const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

/**
 * Returns a random image path for the welcome/home screen.
 *
 * @param {Object} config - Application config (optional)
 * @returns {string} Image path (URL for custom images, relative path for defaults)
 */
export default function WelcomeImage(config = null) {
    // Check if custom mode is enabled and has enabled images
    if (config?.startup_images?.mode === 'custom') {
        const enabledImages = config.startup_images.images?.filter(img => img.enabled) || [];

        if (enabledImages.length > 0) {
            // Get a random enabled custom image
            const selectedImage = randomItem(enabledImages);
            // Convert file path to a URL that can be displayed
            return convertFileSrc(selectedImage.path);
        }
    }

    // Fallback to default images
    return randomItem(DEFAULT_IMAGES);
};