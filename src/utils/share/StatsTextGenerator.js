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
            lines.push(`⭐ Best Shots: ${org.starred_photos}`);
        }

        // Albums and tags
        if (org.total_albums > 0) {
            lines.push(`📁 Albums: ${org.total_albums}`);
        }
        if (org.total_tags > 0) {
            lines.push(`🏷️ Tags: ${org.total_tags}`);
        }
        lines.push('');
    }

    // Storage stats
    if (insights.storage) {
        const storage = insights.storage;
        const totalGB = storage.total_size_gb || 0;
        if (totalGB > 0) {
            lines.push(`💾 Collection Size: ${totalGB.toFixed(1)} GB`);
            if (storage.average_size_mb) {
                lines.push(`📊 Avg Photo Size: ${storage.average_size_mb.toFixed(1)} MB`);
            }
            lines.push('');
        }
    }

    // Equipment stats (simplified)
    if (insights.equipment && insights.equipment.cameras && insights.equipment.cameras.length > 0) {
        const topCamera = insights.equipment.cameras[0];
        if (topCamera && topCamera.count > 5) {
            lines.push(`📸 Most Used Camera: ${topCamera.name} (${topCamera.count} photos)`);
        }

        if (insights.equipment.lenses && insights.equipment.lenses.length > 0) {
            const topLens = insights.equipment.lenses[0];
            if (topLens && topLens.count > 5) {
                lines.push(`🔍 Favorite Lens: ${topLens.name} (${topLens.count} photos)`);
            }
        }
        lines.push('');
    }

    // Shooting patterns
    if (insights.shooting_time) {
        const shooting = insights.shooting_time;

        // Find peak shooting hour
        if (shooting.by_hour && shooting.by_hour.length > 0) {
            const peakHour = shooting.by_hour.reduce((prev, current) =>
                prev.count > current.count ? prev : current
            );
            if (peakHour && peakHour.count > 5) {
                const timeOfDay = peakHour.hour < 12 ? 'morning' :
                               peakHour.hour < 17 ? 'afternoon' : 'evening';
                lines.push(`🕐 Peak Shooting: ${timeOfDay} (${peakHour.hour}:00)`);
            }
        }

        // Find favorite day
        if (shooting.by_day_of_week && shooting.by_day_of_week.length > 0) {
            const favoriteDay = shooting.by_day_of_week.reduce((prev, current) =>
                prev.count > current.count ? prev : current
            );
            if (favoriteDay && favoriteDay.count > 3) {
                lines.push(`📅 Most Active Day: ${favoriteDay.day_name} (${favoriteDay.count} photos)`);
            }
        }
    }

    // Camera settings highlights
    if (insights.camera_settings) {
        const settings = insights.camera_settings;

        // Most used ISO
        if (settings.iso && settings.iso.length > 0) {
            const topISO = settings.iso[0];
            if (topISO && topISO.count > 5) {
                lines.push(`📷 Preferred ISO: ${topISO.display}`);
            }
        }

        // Most used aperture
        if (settings.aperture && settings.aperture.length > 0) {
            const topAperture = settings.aperture[0];
            if (topAperture && topAperture.count > 5) {
                lines.push(`🔍 Favorite Aperture: ${topAperture.display}`);
            }
        }
    }

    // Add footer
    lines.push('');
    lines.push('🎯 Captured with PhotoClove');

    return lines.join('\n');
}
