import { useRef, useCallback, useState } from 'react';
import { logger } from '../services/LoggerService.js';

/**
 * LRU cache for photos lists keyed by viewKey.
 *
 * Stored in useRef to avoid render churn; trigger setter forces re-render
 * only when the consumer explicitly requests a UI update.
 *
 * Cache shape: Map<viewKey, { photos: PhotoJSON[], updatedAt: number }>
 */
export function usePhotosCache(maxKeys, maxTotalPhotos) {
    const cacheRef = useRef(new Map());
    const [, setVersion] = useState(0);
    const triggerRender = useCallback(() => setVersion(v => v + 1), []);

    const get = useCallback((viewKey) => {
        if (!viewKey) return null;
        const entry = cacheRef.current.get(viewKey);
        if (entry) {
            entry.updatedAt = Date.now();
            cacheRef.current.delete(viewKey);
            cacheRef.current.set(viewKey, entry);
        }
        return entry?.photos ?? null;
    }, []);

    const set = useCallback((viewKey, photos, currentViewKey) => {
        if (!viewKey) return;
        cacheRef.current.set(viewKey, {
            photos: [...photos],
            updatedAt: Date.now(),
        });
        evict(cacheRef.current, maxKeys, maxTotalPhotos, currentViewKey);
        logger.debug('usePhotosCache', 'set', 'View cache updated', {
            viewKey,
            size: cacheRef.current.size,
            photosCount: photos.length,
        });
    }, [maxKeys, maxTotalPhotos]);

    const patch = useCallback((viewKey, updater) => {
        if (!viewKey) return;
        const entry = cacheRef.current.get(viewKey);
        if (!entry) return;
        entry.photos = updater(entry.photos);
        entry.updatedAt = Date.now();
    }, []);

    const invalidate = useCallback((viewKey) => {
        if (!viewKey) return;
        cacheRef.current.delete(viewKey);
    }, []);

    const clear = useCallback(() => {
        cacheRef.current.clear();
        triggerRender();
    }, [triggerRender]);

    return { get, set, patch, invalidate, clear };
}

function evict(cache, maxKeys, maxTotalPhotos, currentViewKey) {
    while (cache.size > maxKeys || totalPhotos(cache) > maxTotalPhotos) {
        const oldestKey = findOldestEvictableKey(cache, currentViewKey);
        if (!oldestKey) break;
        cache.delete(oldestKey);
    }
}

function totalPhotos(cache) {
    let total = 0;
    for (const entry of cache.values()) total += entry.photos.length;
    return total;
}

function findOldestEvictableKey(cache, currentViewKey) {
    for (const key of cache.keys()) {
        if (key !== currentViewKey) return key;
    }
    return null;
}
