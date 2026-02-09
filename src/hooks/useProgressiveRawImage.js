/**
 * Progressive RAW image loading hook
 *
 * Loads RAW images in two stages:
 * 1. EXIF thumbnail (fast) - embedded preview from camera
 * 2. Full RAW decode (slow) - full sensor data processed
 *
 * Updates imgSrc when higher quality becomes available.
 */
import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

/**
 * @param {Object} photo - Photo entity with isRawFormat() method
 * @param {Object} importState - Import state with currentImportPath
 * @returns {{ imgSrc: string, quality: number }}
 *   - imgSrc: URL to display (updates as higher quality loads)
 *   - quality: 0 = loading, 1 = EXIF thumb, 2 = full decode
 */
export function useProgressiveRawImage(photo, importState) {
    const [imgSrc, setImgSrc] = useState('');
    const [quality, setQuality] = useState(0);
    const cancelledRef = useRef(false);
    const photoPathRef = useRef(null);

    useEffect(() => {
        if (!photo || !photo.isRawFormat || !photo.isRawFormat()) {
            return;
        }

        // Reset when photo changes
        const currentPath = photo.originalPath;
        if (photoPathRef.current === currentPath && imgSrc) {
            return; // Already loading this photo
        }
        photoPathRef.current = currentPath;
        cancelledRef.current = false;

        const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
            ? importState.currentImportPath
            : null;

        const loadProgressive = async () => {
            // Level 1: EXIF thumbnail (fast)
            try {
                const exifPath = await invoke('get_raw_progressive_image', {
                    pathStr: currentPath,
                    maxSize: 1600,
                    qualityLevel: 1,
                    importDirectory: importDir
                });
                if (!cancelledRef.current && photoPathRef.current === currentPath) {
                    setImgSrc(convertFileSrc(exifPath) + '?t=' + Date.now());
                    setQuality(1);
                    logger.debug('useProgressiveRawImage', 'exif_loaded', 'EXIF thumbnail loaded', {
                        path: currentPath
                    });
                }
            } catch (err) {
                logger.debug('useProgressiveRawImage', 'exif_failed', 'No EXIF thumbnail', {
                    path: currentPath,
                    error: err?.message || String(err)
                });
            }

            // Level 2: Full RAW decode (slow)
            try {
                const fullPath = await invoke('get_raw_progressive_image', {
                    pathStr: currentPath,
                    maxSize: 1600,
                    qualityLevel: 2,
                    importDirectory: importDir
                });
                if (!cancelledRef.current && photoPathRef.current === currentPath) {
                    setImgSrc(convertFileSrc(fullPath) + '?t=' + Date.now());
                    setQuality(2);
                    logger.debug('useProgressiveRawImage', 'full_loaded', 'Full decode loaded', {
                        path: currentPath
                    });
                }
            } catch (err) {
                logger.debug('useProgressiveRawImage', 'full_decode_failed', 'Full decode failed', {
                    path: currentPath,
                    error: err?.message || String(err)
                });
            }
        };

        loadProgressive();

        return () => {
            cancelledRef.current = true;
        };
    }, [photo?.originalPath]);

    return { imgSrc, quality };
}
