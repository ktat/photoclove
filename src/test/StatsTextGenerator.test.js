import { describe, it, expect } from 'vitest';
import { generateStatsShareText } from '../utils/share/index.js';

const insights = {
    organization: {
        total_photos: 1234,
        starred_photos: 42,
        total_albums: 3,
        total_tags: 7
    },
    storage: {
        total_size_gb: 1.5,
        average_size_mb: 2.3
    },
    equipment: {
        cameras: [{ name: 'Canon EOS R5', count: 100 }],
        lenses: [{ name: 'RF 24-70mm', count: 80 }]
    }
};

describe('generateStatsShareText', () => {
    it('joins lines with real newlines (not literal backslash-n)', () => {
        const text = generateStatsShareText(insights, 'all');
        expect(text).toContain('\n');
        expect(text).not.toContain('\\n');
    });

    it('keeps the established share text format', () => {
        const text = generateStatsShareText(insights, 'all');
        expect(text).toContain('📊 My Photography Stats');
        expect(text).toContain('📷 Total Photos: 1,234');
        // Best Shots shows the raw count (no percentage)
        expect(text).toContain('⭐ Best Shots: 42');
        expect(text).toContain('📁 Albums: 3');
        expect(text).toContain('🏷️ Tags: 7');
        expect(text).toContain('💾 Collection Size: 1.5 GB');
        expect(text).toContain('📊 Avg Photo Size: 2.3 MB');
        expect(text).toContain('📸 Most Used Camera: Canon EOS R5 (100 photos)');
        expect(text).toContain('🔍 Favorite Lens: RF 24-70mm (80 photos)');
        expect(text).toContain('🎯 Captured with PhotoClove');
    });

    it('returns empty string without insights', () => {
        expect(generateStatsShareText(null)).toBe('');
    });
});
