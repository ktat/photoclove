/**
 * Social media sharing utilities
 */

import { open } from '@tauri-apps/plugin-shell';
import { logger } from '../../services/LoggerService.js';

/**
 * Get share URL for different platforms
 * @param {string} platform - Social media platform
 * @param {string} text - Text to share
 * @returns {string} Share URL
 */
export function getShareUrl(platform, text) {
    const encodedText = encodeURIComponent(text);
    
    const urls = {
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodedText}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodedText}`,
        reddit: `https://reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${encodedText}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodedText}`,
        whatsapp: `https://wa.me/?text=${encodedText}`,
        mastodon: `https://mastodon.social/share?text=${encodedText}`,
        bluesky: `https://bsky.app/intent/compose?text=${encodedText}`,
        threads: `https://www.threads.net/intent/post?text=${encodedText}`,
        // Instagram has no public web share intent; open the site so the user can paste the copied image.
        instagram: 'https://www.instagram.com/'
    };

    return urls[platform] || null;
}

/**
 * Share to social media platform
 * @param {string} platform - Platform to share to
 * @param {string} text - Text content to share
 */
export async function shareToSocial(platform, text) {
    try {
        const shareUrl = getShareUrl(platform, text);
        
        if (!shareUrl) {
            logger.warn('SocialMediaShare', 'platform_not_supported', 'Platform does not support web sharing', { platform });
            return { success: false, error: 'Platform not supported for web sharing' };
        }

        await open(shareUrl);
        logger.info('SocialMediaShare', 'share_opened', 'Opened share URL', { platform });
        return { success: true };
    } catch (error) {
        logger.error('SocialMediaShare', 'share_failed', 'Failed to open share URL', { 
            platform, 
            error: error.message 
        });
        return { success: false, error: error.message };
    }
}