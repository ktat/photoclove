import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

/**
 * FaceThumbnail - Crops and displays a face from an image
 * Uses createImageBitmap to respect EXIF orientation
 * Crops to square without distortion by extending the shorter side
 */
function FaceThumbnail({ photoPath, bbox, size = 50, borderRadius = 'var(--radius-sm)' }) {
    const canvasRef = useRef(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!photoPath || !bbox) return;

        let cancelled = false;

        const loadAndDraw = async () => {
            try {
                // Fetch the image as blob to use createImageBitmap with EXIF orientation
                const response = await fetch(convertFileSrc(photoPath));
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status}`);
                }
                const blob = await response.blob();

                // createImageBitmap with imageOrientation respects EXIF rotation
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
                // bitmap.width/height are the dimensions after EXIF rotation
                const x = bbox.bbox_x * bitmap.width;
                const y = bbox.bbox_y * bitmap.height;
                const width = bbox.bbox_width * bitmap.width;
                const height = bbox.bbox_height * bitmap.height;

                // Add some padding around the face (20%)
                const padding = 0.2;
                let cropX = Math.max(0, x - width * padding);
                let cropY = Math.max(0, y - height * padding);
                let cropWidth = Math.min(bitmap.width - cropX, width * (1 + 2 * padding));
                let cropHeight = Math.min(bitmap.height - cropY, height * (1 + 2 * padding));

                // Make it square by extending the shorter side
                if (cropWidth > cropHeight) {
                    // Wider than tall - extend height
                    const diff = (cropWidth - cropHeight) / 2;
                    cropY = Math.max(0, cropY - diff);
                    cropHeight = cropWidth;
                    // Clamp to image bounds
                    if (cropY + cropHeight > bitmap.height) {
                        cropY = Math.max(0, bitmap.height - cropHeight);
                    }
                } else if (cropHeight > cropWidth) {
                    // Taller than wide - extend width
                    const diff = (cropHeight - cropWidth) / 2;
                    cropX = Math.max(0, cropX - diff);
                    cropWidth = cropHeight;
                    // Clamp to image bounds
                    if (cropX + cropWidth > bitmap.width) {
                        cropX = Math.max(0, bitmap.width - cropWidth);
                    }
                }

                // Draw cropped face onto canvas (square)
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
                    logger.warn('FaceThumbnail', 'load_error', 'Failed to load face thumbnail', {
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
    }, [photoPath, bbox, size]);

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
