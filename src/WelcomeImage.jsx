import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "./services/LoggerService.js";

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
}

/**
 * Fetches a memory photo for the "On This Day" feature.
 * Returns null if no memories available.
 *
 * @returns {Promise<string|null>} Image URL or null if no memories
 */
export async function getMemoriesStartupImage() {
    try {
        const response = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "memories_startup",
                query: null,
                star: null,
                has_comment: null,
                extension: null,
                page: null,
                limit: null,
                offset: null,
                sort_value: null,
                params: null
            }
        });

        const result = JSON.parse(response);
        if (result.has_memories && result.path) {
            return convertFileSrc(result.path);
        }
        return null;
    } catch (error) {
        logger.error('WelcomeImage', 'get_memories_startup_error', 'Failed to get memories startup image', { error: error.message });
        return null;
    }
}
