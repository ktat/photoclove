/**
 * FaceDetectionContext - Shared state for face detection UI
 *
 * Provides state for face bounding box display and interaction
 * between PhotoFaces (sidebar) and PhotoDisplay (main view).
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const FaceDetectionContext = createContext(null);

export function FaceDetectionProvider({ children }) {
    // Detected faces for current photo
    const [detectedFaces, setDetectedFaces] = useState([]);
    // Whether to show face bounding boxes
    const [showFaceBboxes, setShowFaceBboxes] = useState(false);
    // Currently hovered face ID
    const [hoveredFaceId, setHoveredFaceId] = useState(null);
    // Currently selected face ID
    const [selectedFaceId, setSelectedFaceId] = useState(null);
    // Whether Face tab is active
    const [isFaceTabActive, setIsFaceTabActive] = useState(false);

    // Clear all state (called when photo changes)
    const clearFaceState = useCallback(() => {
        setDetectedFaces([]);
        setShowFaceBboxes(false);
        setHoveredFaceId(null);
        setSelectedFaceId(null);
    }, []);

    // Update faces and auto-show boxes
    const updateFaces = useCallback((faces) => {
        setDetectedFaces(faces || []);
        if (faces && faces.length > 0) {
            setShowFaceBboxes(true);
        }
    }, []);

    const value = {
        detectedFaces,
        setDetectedFaces,
        updateFaces,
        showFaceBboxes,
        setShowFaceBboxes,
        hoveredFaceId,
        setHoveredFaceId,
        selectedFaceId,
        setSelectedFaceId,
        isFaceTabActive,
        setIsFaceTabActive,
        clearFaceState
    };

    return (
        <FaceDetectionContext.Provider value={value}>
            {children}
        </FaceDetectionContext.Provider>
    );
}

export function useFaceDetection() {
    const context = useContext(FaceDetectionContext);
    if (!context) {
        // Return default values if context is not available
        return {
            detectedFaces: [],
            setDetectedFaces: () => {},
            updateFaces: () => {},
            showFaceBboxes: false,
            setShowFaceBboxes: () => {},
            hoveredFaceId: null,
            setHoveredFaceId: () => {},
            selectedFaceId: null,
            setSelectedFaceId: () => {},
            isFaceTabActive: false,
            setIsFaceTabActive: () => {},
            clearFaceState: () => {}
        };
    }
    return context;
}

export default FaceDetectionContext;
