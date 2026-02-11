/**
 * CropTool - Crop overlay component for PhotoEditor
 * Renders the crop selection interface directly over the image
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * CropTool component
 * @param {Object} props
 * @param {boolean} props.cropMode - Whether crop mode is active
 * @param {{x: number, y: number, width: number, height: number}} props.cropSelection - Current crop selection
 * @param {Object} props.handlers - Mouse event handlers (onMouseDown, onMouseMove, onMouseUp)
 */
function CropTool({ cropMode, cropSelection, handlers }) {
    const { t } = useTranslation('common');
    const [imageWrapper, setImageWrapper] = useState(null);

    useEffect(() => {
        if (cropMode) {
            // Use #imageWrapper which directly contains the image
            const wrapper = document.querySelector('#imageWrapper');
            if (wrapper) {
                // Ensure wrapper is positioned relatively for absolute positioning of overlay
                if (window.getComputedStyle(wrapper).position === 'static') {
                    wrapper.style.position = 'relative';
                }
                setImageWrapper(wrapper);
            }
        } else {
            setImageWrapper(null);
        }
    }, [cropMode]);

    if (!cropMode || !imageWrapper) {
        return null;
    }

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: 'none',
                pointerEvents: 'auto',
                cursor: 'crosshair',
                zIndex: 10000
            }}
            onMouseDown={handlers.onMouseDown}
            onMouseMove={handlers.onMouseMove}
            onMouseUp={handlers.onMouseUp}
        >
            {/* Instruction text */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                color: 'white',
                fontSize: 'var(--font-size-base)',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '8px 12px',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 10001
            }}>
                {t('photoEditor.cropInstruction')}
            </div>

            {/* Crop selection rectangle */}
            <div
                id="crop-selection"
                style={{
                    position: 'absolute',
                    border: '2px dashed #ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    pointerEvents: 'none',
                    left: `${cropSelection.x}%`,
                    top: `${cropSelection.y}%`,
                    width: `${cropSelection.width}%`,
                    height: `${cropSelection.height}%`
                }}
            >
                {/* Size indicator */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                }}>
                    {Math.round(cropSelection.width)}% × {Math.round(cropSelection.height)}%
                </div>
            </div>
        </div>,
        imageWrapper
    );
}

export default CropTool;
