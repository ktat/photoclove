import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { usePhotoNavigation } from '../App/PhotosList/PhotosListMini/usePhotoNavigation.js';

function makePhotos(count) {
    return Array.from({ length: count }, (_, i) => ({
        originalPath: `/p/${i}.jpg`,
        displayPath: () => `/p/${i}.jpg`
    }));
}

function setup(photos) {
    return renderHook(() => {
        const [cache, setCache] = useState({});
        const nav = usePhotoNavigation({
            photos,
            currentIndex: 0,
            setCurrentIndex: vi.fn(),
            setCurrentPhoto: vi.fn(),
            setImgStyle: vi.fn(),
            currentPhotoSize: [0, 0],
            datePage: {},
            getDateKey: () => 'k',
            num: 100,
            imgCacheMap: cache,
            setImgCacheMap: setCache,
            viewStartIndex: null,
            setViewStartIndex: vi.fn()
        });
        return { cache, nav };
    });
}

describe('usePhotoNavigation setImageCache', () => {
    let objectUrlCounter;

    beforeEach(() => {
        objectUrlCounter = 0;
        global.fetch = vi.fn(async () => ({
            blob: async () => new Blob(['x'])
        }));
        URL.createObjectURL = vi.fn(() => `blob:mock-${++objectUrlCounter}`);
        URL.revokeObjectURL = vi.fn();
    });

    it('caches the navigation window as object URLs', async () => {
        const { result } = setup(makePhotos(10));
        await act(async () => {
            await result.current.nav.setImageCache(0, 1);
        });
        // Forward: index-2..index+4 clamped to 0..4
        expect(Object.keys(result.current.cache).sort()).toEqual(
            ['/p/0.jpg', '/p/1.jpg', '/p/2.jpg', '/p/3.jpg', '/p/4.jpg'].sort()
        );
    });

    it('does not lose or leak entries when two prefetches race', async () => {
        const { result } = setup(makePhotos(10));

        await act(async () => {
            // Two navigations fired before either prefetch resolves
            const first = result.current.nav.setImageCache(0, 1); // window 0..4
            const second = result.current.nav.setImageCache(5, 1); // window 3..9
            await Promise.all([first, second]);
        });

        // Final window is 3..9; entries 0..2 must be evicted WITH revocation,
        // not silently dropped by a stale-snapshot overwrite
        expect(Object.keys(result.current.cache).sort()).toEqual(
            ['/p/3.jpg', '/p/4.jpg', '/p/5.jpg', '/p/6.jpg', '/p/7.jpg', '/p/8.jpg', '/p/9.jpg'].sort()
        );
        const cachedUrls = Object.values(result.current.cache).flat();
        const revokedUrls = URL.revokeObjectURL.mock.calls.map(c => c[0]);
        // Every created URL is either still cached or has been revoked
        for (let i = 1; i <= objectUrlCounter; i++) {
            const url = `blob:mock-${i}`;
            expect(
                cachedUrls.includes(url) || revokedUrls.includes(url),
                `${url} must be cached or revoked (not leaked)`
            ).toBe(true);
        }
    });
});
