import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

const NON_NATIVE_FORMAT_REGEX = /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|3fr|heic|heif|avif)$/i;

/**
 * FaceThumbnail - Displays a face thumbnail
 * Tries to load cached thumbnail first, falls back to canvas crop
 * Uses createImageBitmap to respect EXIF orientation for fallback
 */
function FaceThumbnail({ faceId, photoPath, bbox, size = 50, borderRadius = 'var(--radius-sm)' }) {
    const canvasRef = useRef(null);
    const [thumbnailSrc, setThumbnailSrc] = useState(null);
    const [useFallback, setUseFallback] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Try to get cached thumbnail
    useEffect(() => {
        if (!faceId) {
            setUseFallback(true);
            return;
        }

        let cancelled = false;

        const loadCachedThumbnail = async () => {
            try {
                const cachedPath = await invoke('get_face_thumbnail_path', { faceId });
                if (!cancelled && cachedPath) {
                    setThumbnailSrc(convertFileSrc(cachedPath));
                    setLoaded(true);
                }
            } catch (error) {
                logger.debug('FaceThumbnail', 'cache_miss', 'Falling back to canvas', { faceId, error: error.toString() });
                if (!cancelled) {
                    setUseFallback(true);
                }
            }
        };

        loadCachedThumbnail();

        return () => {
            cancelled = true;
        };
    }, [faceId]);

    // Fallback: use canvas crop (existing logic)
    useEffect(() => {
        if (!useFallback || !photoPath || !bbox) return;

        let cancelled = false;

        const loadAndDraw = async () => {
            try {
                // For HEIC/RAW files, get decoded path from backend since browser can't decode them
                let imageSrc;
                if (NON_NATIVE_FORMAT_REGEX.test(photoPath)) {
                    const decodedPath = await invoke('get_resized_image', {
                        pathStr: photoPath,
                        maxSize: 1600,
                        importDirectory: null,
                        skipResizeFallback: null,
                    });
                    imageSrc = convertFileSrc(decodedPath);
                } else {
                    imageSrc = convertFileSrc(photoPath);
                }

                const response = await fetch(imageSrc);
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status}`);
                }
                const blob = await response.blob();

                const bitmap = await createImageBitmap(blob, {
                    imageOrientation: 'from-image'
                });

                if (cancelled) {
                    bitmap.close();
                    return;
                }

                const canvas = canvasRef.current;
                if (!canvas) {
                    bitmap.close();
                    return;
                }

                const ctx = canvas.getContext('2d');

                // bbox is in normalized coordinates (0-1)
                const x = bbox.bbox_x * bitmap.width;
                const y = bbox.bbox_y * bitmap.height;
                const width = bbox.bbox_width * bitmap.width;
                const height = bbox.bbox_height * bitmap.height;

                // Add padding (20%)
                const padding = 0.2;
                let cropX = Math.max(0, x - width * padding);
                let cropY = Math.max(0, y - height * padding);
                let cropWidth = Math.min(bitmap.width - cropX, width * (1 + 2 * padding));
                let cropHeight = Math.min(bitmap.height - cropY, height * (1 + 2 * padding));

                // Make square
                if (cropWidth > cropHeight) {
                    const diff = (cropWidth - cropHeight) / 2;
                    cropY = Math.max(0, cropY - diff);
                    cropHeight = cropWidth;
                    if (cropY + cropHeight > bitmap.height) {
                        cropY = Math.max(0, bitmap.height - cropHeight);
                    }
                } else if (cropHeight > cropWidth) {
                    const diff = (cropHeight - cropWidth) / 2;
                    cropX = Math.max(0, cropX - diff);
                    cropWidth = cropHeight;
                    if (cropX + cropWidth > bitmap.width) {
                        cropX = Math.max(0, bitmap.width - cropWidth);
                    }
                }

                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(
                    bitmap,
                    cropX, cropY, cropWidth, cropHeight,
                    0, 0, size, size
                );

                bitmap.close();
                setLoaded(true);
            } catch (error) {
                if (!cancelled) {
                    logger.warn('FaceThumbnail', 'fallback_load_error', 'Failed to load face thumbnail', {
                        photoPath,
                        error: error.toString()
                    });
                    setLoaded(false);
                }
            }
        };

        loadAndDraw();

        return () => {
            cancelled = true;
        };
    }, [useFallback, photoPath, bbox, size]);

    // If using cached thumbnail
    if (thumbnailSrc && !useFallback) {
        return (
            <img
                src={thumbnailSrc}
                alt="Face"
                width={size}
                height={size}
                style={{
                    width: size,
                    height: size,
                    borderRadius: borderRadius,
                    objectFit: 'cover',
                    display: loaded ? 'block' : 'none'
                }}
                onError={() => {
                    logger.debug('FaceThumbnail', 'img_load_error', 'Falling back to canvas');
                    setThumbnailSrc(null);
                    setUseFallback(true);
                    setLoaded(false);
                }}
            />
        );
    }

    // Fallback canvas
    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{
                width: size,
                height: size,
                borderRadius: borderRadius,
                display: loaded ? 'block' : 'none'
            }}
        />
    );
}

export default FaceThumbnail;
