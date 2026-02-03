/**
 * Statistics text generation for sharing
 */

/**
 * Generate share text from insights data
 * @param {Object} insights - Insights data from InsightsService
 * @param {string} period - 'all' | 'weekly' | 'monthly' | 'yearly'
 * @returns {string} Formatted share text
 */
export function generateStatsShareText(insights, period = 'all') {
    if (!insights) return '';

    const lines = [];
    const now = new Date();

    // Header based on period
    if (period.startsWith('weekly:')) {
        const weekStart = period.replace('weekly:', '');
        const startDate = new Date(weekStart); const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        lines.push(`📊 Week of ${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} Stats`);
    } else if (period === 'weekly') {
        lines.push('📊 This Week\'s Photography Stats');
    } else if (period.startsWith('monthly:')) {
        const [year, month] = period.replace('monthly:', '').split('-');
        lines.push(`📊 ${new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Photography Stats`);
    } else if (period === 'monthly') {
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        lines.push(`📊 ${monthName} Photography Stats`);
    } else if (period.startsWith('yearly:')) {
        lines.push(`📊 ${period.replace('yearly:', '')} Year in Review`);
    } else if (period === 'yearly') {
        lines.push(`📊 ${now.getFullYear()} Year in Review`);
    } else {
        lines.push('📊 My Photography Stats');
    }
    lines.push('');

    // Organization stats
    if (insights.organization) {
        const org = insights.organization;
        lines.push(`📷 Total Photos: ${(org.total_photos || 0).toLocaleString()}`);

        // Best shots (5-star photos)
        if (org.starred_photos > 0) {
            const percentage = Math.round((org.starred_photos / org.total_photos) * 100);
            lines.push(`⭐ Best Shots: ${org.starred_photos.toLocaleString()} (${percentage}%)`);
        }

        // Tags and Albums
        if (org.total_tags > 0) {
            lines.push(`🏷️ Tags: ${org.total_tags.toLocaleString()}`);
        }
        if (org.total_albums > 0) {
            lines.push(`📂 Albums: ${org.total_albums.toLocaleString()}`);
        }
        lines.push('');
    }

    // Camera settings
    if (insights.camera_settings) {
        const settings = insights.camera_settings;
        lines.push('⚙️ Camera Settings:');

        // Most used ISO
        if (settings.iso && settings.iso.length > 0) {
            const topIso = settings.iso[0];
            lines.push(`• Most used ISO: ${topIso.display}`);
        }

        // Most used aperture
        if (settings.aperture && settings.aperture.length > 0) {
            const topAperture = settings.aperture[0];
            lines.push(`• Favorite aperture: ${topAperture.display}`);
        }

        lines.push('');
    }

    // Equipment
    if (insights.equipment) {
        const eq = insights.equipment;
        lines.push('📸 Equipment:');

        // Top camera
        if (eq.cameras && eq.cameras.length > 0) {
            const topCamera = eq.cameras[0];
            lines.push(`• Main camera: ${topCamera.name} (${topCamera.percentage.toFixed(0)}%)`);
        }

        // Top lens
        if (eq.lenses && eq.lenses.length > 0) {
            const topLens = eq.lenses[0];
            lines.push(`• Favorite lens: ${topLens.name}`);
        }
        lines.push('');
    }

    // Storage stats
    if (insights.storage) {
        const storage = insights.storage;
        lines.push(`💾 Storage: ${storage.total_size_gb.toFixed(1)}GB`);
        if (storage.average_size_mb) {
            lines.push(`📏 Average file size: ${storage.average_size_mb.toFixed(1)}MB`);
        }
        lines.push('');
    }

    lines.push('📱 Generated with PhotoClove');

    return lines.join('\\n');
}