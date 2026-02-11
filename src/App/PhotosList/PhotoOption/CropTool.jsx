/**
 * CropTool - Crop overlay component for PhotoEditor
 * Renders the crop selection interface directly over the image
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

const CURSOR_MAP = {
    'corner-tl': 'nwse-resize',
    'corner-br': 'nwse-resize',
    'corner-tr': 'nesw-resize',
    'corner-bl': 'nesw-resize',
    'edge-top': 'ns-resize',
    'edge-bottom': 'ns-resize',
    'edge-left': 'ew-resize',
    'edge-right': 'ew-resize',
    'move': 'move',
    'create': 'crosshair'
};

const CORNER_HANDLE_SIZE = 8;
const EDGE_HANDLE_SIZE = 6;

function HandleBox({ position, size, cursor, onMouseDown }) {
    return (
        <div
            style={{
                position: 'absolute',
                ...position,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: '#ffffff',
                border: '1px solid #333333',
                pointerEvents: 'auto',
                cursor,
                zIndex: 10002
            }}
            onMouseDown={onMouseDown}
        />
    );
}

/**
 * CropTool component
 * @param {Object} props
 * @param {boolean} props.cropMode - Whether crop mode is active
 * @param {{x: number, y: number, width: number, height: number}} props.cropSelection - Current crop selection
 * @param {Object} props.handlers - Mouse event handlers (onMouseDown, onMouseMove, onMouseUp)
 * @param {string} props.interactionZone - Current hover zone for cursor display
 */
function CropTool({ cropMode, cropSelection, handlers, interactionZone }) {
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

    const hasSelection = cropSelection.width > 0 && cropSelection.height > 0;
    const overlayCursor = CURSOR_MAP[interactionZone] || 'crosshair';
    const halfCorner = CORNER_HANDLE_SIZE / 2;
    const halfEdge = EDGE_HANDLE_SIZE / 2;

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
                cursor: overlayCursor,
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

            {/* Resize handles - only shown when there is a valid selection */}
            {hasSelection && (
                <>
                    {/* Corner handles */}
                    <HandleBox
                        position={{ left: `${cropSelection.x}%`, top: `${cropSelection.y}%`, transform: `translate(-${halfCorner}px, -${halfCorner}px)` }}
                        size={CORNER_HANDLE_SIZE} cursor="nwse-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'corner-tl'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x + cropSelection.width}%`, top: `${cropSelection.y}%`, transform: `translate(-${halfCorner}px, -${halfCorner}px)` }}
                        size={CORNER_HANDLE_SIZE} cursor="nesw-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'corner-tr'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x}%`, top: `${cropSelection.y + cropSelection.height}%`, transform: `translate(-${halfCorner}px, -${halfCorner}px)` }}
                        size={CORNER_HANDLE_SIZE} cursor="nesw-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'corner-bl'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x + cropSelection.width}%`, top: `${cropSelection.y + cropSelection.height}%`, transform: `translate(-${halfCorner}px, -${halfCorner}px)` }}
                        size={CORNER_HANDLE_SIZE} cursor="nwse-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'corner-br'); }}
                    />

                    {/* Edge handles (midpoints) */}
                    <HandleBox
                        position={{ left: `${cropSelection.x + cropSelection.width / 2}%`, top: `${cropSelection.y}%`, transform: `translate(-${halfEdge}px, -${halfEdge}px)` }}
                        size={EDGE_HANDLE_SIZE} cursor="ns-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'edge-top'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x + cropSelection.width / 2}%`, top: `${cropSelection.y + cropSelection.height}%`, transform: `translate(-${halfEdge}px, -${halfEdge}px)` }}
                        size={EDGE_HANDLE_SIZE} cursor="ns-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'edge-bottom'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x}%`, top: `${cropSelection.y + cropSelection.height / 2}%`, transform: `translate(-${halfEdge}px, -${halfEdge}px)` }}
                        size={EDGE_HANDLE_SIZE} cursor="ew-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'edge-left'); }}
                    />
                    <HandleBox
                        position={{ left: `${cropSelection.x + cropSelection.width}%`, top: `${cropSelection.y + cropSelection.height / 2}%`, transform: `translate(-${halfEdge}px, -${halfEdge}px)` }}
                        size={EDGE_HANDLE_SIZE} cursor="ew-resize"
                        onMouseDown={(e) => { e.stopPropagation(); handlers.onMouseDown(e, 'edge-right'); }}
                    />
                </>
            )}
        </div>,
        imageWrapper
    );
}

export default CropTool;
