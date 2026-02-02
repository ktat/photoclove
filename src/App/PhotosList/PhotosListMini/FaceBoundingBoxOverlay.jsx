/**
 * FaceBoundingBoxOverlay Component
 *
 * Renders face bounding boxes as an overlay on the photo.
 * Boxes are positioned using normalized coordinates (0-1) from the face detection model.
 */
import React from 'react';

function FaceBoundingBoxOverlay({ faces, imageWidth, imageHeight, selectedFaceId, hoveredFaceId, onFaceClick }) {
    if (!faces || faces.length === 0 || !imageWidth || !imageHeight) {
        return null;
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: imageWidth,
                height: imageHeight,
                pointerEvents: 'none',
                zIndex: 10
            }}
        >
            {faces.map((face, index) => {
                // Face bbox is in normalized coordinates (0-1)
                const x = face.bbox_x * imageWidth;
                const y = face.bbox_y * imageHeight;
                const width = face.bbox_width * imageWidth;
                const height = face.bbox_height * imageHeight;

                // Use face.id or index as identifier (same as PhotoFaces)
                const faceId = face.id || index;
                const isSelected = selectedFaceId === faceId;
                const isHovered = hoveredFaceId === faceId;
                const confidence = Math.round((face.confidence || 0) * 100);

                // Color based on confidence
                let borderColor = 'rgba(0, 255, 0, 0.8)'; // Green for high confidence
                if (confidence < 70) {
                    borderColor = 'rgba(255, 165, 0, 0.8)'; // Orange for medium
                }
                if (confidence < 50) {
                    borderColor = 'rgba(255, 0, 0, 0.8)'; // Red for low
                }

                // Override for selected or hovered state
                if (isHovered) {
                    borderColor = 'rgba(255, 255, 0, 1)'; // Yellow for hovered
                }
                if (isSelected) {
                    borderColor = 'rgba(0, 150, 255, 1)'; // Blue for selected
                }

                // Border width changes for highlighted faces
                const borderWidth = isHovered || isSelected ? 4 : 2;

                return (
                    <div
                        key={face.id || index}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onFaceClick) {
                                onFaceClick(face);
                            }
                        }}
                        style={{
                            position: 'absolute',
                            left: x,
                            top: y,
                            width: width,
                            height: height,
                            border: `${borderWidth}px solid ${borderColor}`,
                            borderRadius: 'var(--radius-sm)',
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.15s, border-width 0.15s'
                        }}
                        title={`${face.person_name || 'Unknown'} (${confidence}%)`}
                    >
                        {/* Confidence label */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: borderColor,
                                color: 'white',
                                padding: '1px 4px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {confidence}%
                        </div>

                        {/* Face number indicator */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-18px',
                                left: '0',
                                backgroundColor: borderColor,
                                color: 'white',
                                padding: '1px 4px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 'bold'
                            }}
                        >
                            #{index + 1}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default FaceBoundingBoxOverlay;
