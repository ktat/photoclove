import React, { useState, useMemo, useEffect, useRef } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import Scrollable from "../../Scrollable.jsx";
import { logger } from "../../services/LoggerService.js";
import { useOverlayMargin } from "../../hooks/useOverlayMargin.js";

/**
 * FaceThumbnail - Crops and displays a face from an image
 * Uses createImageBitmap to respect EXIF orientation
 */
function FaceThumbnail({ photoPath, bbox, size = 100 }) {
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

                // Draw cropped face onto canvas
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
                borderRadius: 'var(--radius-md)',
                display: loaded ? 'block' : 'none'
            }}
        />
    );
}

/**
 * FacesList component - Displays a list of detected faces/persons
 * Sorted by face count (most detected first)
 */
function FacesList({
    persons,
    iconSize,
    onPersonClick,
    searchTerm,
    onSearchChange,
    onRefresh
}) {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
    const overlayMargin = useOverlayMargin();

    // Use provided search term if available, otherwise use local state
    const effectiveSearchTerm = searchTerm !== undefined ? searchTerm : localSearchTerm;
    const effectiveOnSearchChange = onSearchChange || setLocalSearchTerm;

    // Filter persons based on search term
    const filteredPersons = useMemo(() => {
        if (!effectiveSearchTerm.trim()) {
            return persons;
        }
        const term = effectiveSearchTerm.toLowerCase();
        return persons.filter(person => {
            const name = person.person_name || 'Unknown';
            return name.toLowerCase().includes(term);
        });
    }, [persons, effectiveSearchTerm]);

    const renderSearchFilter = () => (
        <div style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '4px',
            border: '1px solid var(--color-border-default)'
        }}>
            <input
                type="text"
                placeholder="Search faces..."
                value={effectiveSearchTerm}
                onChange={(e) => effectiveOnSearchChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-base)',
                    backgroundColor: 'var(--color-bg-muted)',
                    color: 'var(--color-text-primary)'
                }}
            />
        </div>
    );

    const renderPersonGrid = () => {
        return (
            <Scrollable className="faces-list">
                {filteredPersons.length === 0 ? (
                    <div style={{ margin: '20px', color: 'var(--color-text-muted)' }}>
                        {effectiveSearchTerm
                            ? 'No faces found matching your search.'
                            : 'No faces detected yet. Use face detection on photos to find faces.'}
                    </div>
                ) : (
                    filteredPersons.map((person) => {
                        const hasThumbnail = person.photo_path && person.bbox_x !== null;

                        return (
                            <div
                                key={person.person_id}
                                className="face-list-tile"
                                onClick={() => onPersonClick(person)}
                                style={{
                                    width: `${iconSize + 50}px`,
                                    height: `${iconSize + 80}px`,
                                    cursor: 'pointer',
                                    border: '1px solid var(--color-border-default)',
                                    borderRadius: '8px',
                                    margin: '10px',
                                    padding: '10px',
                                    display: 'inline-block',
                                    verticalAlign: 'top',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out, border 0.2s ease-out'
                                }}
                            >
                                <div className="face-list-cover" style={{
                                    width: `${iconSize}px`,
                                    height: `${iconSize}px`,
                                    backgroundColor: 'var(--color-bg-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '10px',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                    border: '1px solid var(--color-border-default)'
                                }}>
                                    {hasThumbnail ? (
                                        <FaceThumbnail
                                            photoPath={person.photo_path}
                                            bbox={{
                                                bbox_x: person.bbox_x,
                                                bbox_y: person.bbox_y,
                                                bbox_width: person.bbox_width,
                                                bbox_height: person.bbox_height
                                            }}
                                            size={iconSize}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: `${iconSize * 0.3}px`,
                                            color: 'var(--color-text-muted)'
                                        }}>
                                            👤
                                        </div>
                                    )}
                                </div>
                                <div className="face-list-info" style={{
                                    textAlign: 'center',
                                    fontSize: 'var(--font-size-sm)',
                                    overflow: 'hidden'
                                }}>
                                    <div className="face-list-name" style={{
                                        fontWeight: 'bold',
                                        marginBottom: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: person.person_name ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                        fontStyle: person.person_name ? 'normal' : 'italic'
                                    }} title={person.person_name || 'Unknown'}>
                                        {person.person_name || 'Unknown'}
                                    </div>
                                    <div className="face-list-count" style={{
                                        color: 'var(--color-text-muted)',
                                        fontSize: 'var(--font-size-xs)'
                                    }}>
                                        {person.face_count} {person.face_count === 1 ? 'face' : 'faces'}
                                        {person.photo_count > 0 && (
                                            <span> in {person.photo_count} {person.photo_count === 1 ? 'photo' : 'photos'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </Scrollable>
        );
    };

    return (
        <div
            className="faces-list-view"
            style={{ marginLeft: overlayMargin > 0 ? `${overlayMargin}px` : undefined }}
        >
            {renderSearchFilter()}
            {renderPersonGrid()}
        </div>
    );
}

export default FacesList;
