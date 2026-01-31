/**
 * FaceDetectionService - Face detection and person management
 *
 * Provides face detection capabilities using InsightFace models (SCRFD + ArcFace).
 */
import { invoke } from '@tauri-apps/api/core';
import { logger } from './LoggerService.js';

const CONTEXT = 'FaceDetectionService';

/**
 * Get face detection model status
 * @returns {Promise<Object>} Model status with detector/embedder availability
 */
export async function getModelStatus() {
    try {
        const result = await invoke('get_face_detection_model_status');
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_model_status_failed', 'Failed to get model status', { error: error.toString() });
        throw error;
    }
}

/**
 * Get face detection model download info
 * @returns {Promise<Object>} Model info with download URLs
 */
export async function getModelInfo() {
    try {
        const result = await invoke('get_face_detection_model_info');
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_model_info_failed', 'Failed to get model info', { error: error.toString() });
        throw error;
    }
}

/**
 * Download a face detection model
 * @param {string} modelType - 'detector' or 'embedder'
 * @returns {Promise<Object>} Download result
 */
export async function downloadModel(modelType) {
    logger.info(CONTEXT, 'download_model_start', `Downloading ${modelType} model`);
    try {
        const result = await invoke('download_face_detection_model', { modelType });
        const parsed = JSON.parse(result);
        logger.info(CONTEXT, 'download_model_complete', `Model ${modelType} downloaded`, { result: parsed });
        return parsed;
    } catch (error) {
        logger.error(CONTEXT, 'download_model_failed', `Failed to download ${modelType}`, { error: error.toString() });
        throw error;
    }
}

/**
 * Delete a face detection model
 * @param {string} modelType - 'detector' or 'embedder'
 * @returns {Promise<Object>} Delete result
 */
export async function deleteModel(modelType) {
    logger.info(CONTEXT, 'delete_model_start', `Deleting ${modelType} model`);
    try {
        const result = await invoke('delete_face_detection_model', { modelType });
        const parsed = JSON.parse(result);
        logger.info(CONTEXT, 'delete_model_complete', `Model ${modelType} deleted`, { result: parsed });
        return parsed;
    } catch (error) {
        logger.error(CONTEXT, 'delete_model_failed', `Failed to delete ${modelType}`, { error: error.toString() });
        throw error;
    }
}

/**
 * Detect faces in a photo
 * @param {string} photoPath - Path to the photo
 * @param {boolean} saveToDb - Whether to save results to database
 * @param {boolean} useFullImage - Whether to use full resolution image (skip thumbnail optimization)
 * @returns {Promise<Array>} Array of detected faces
 */
export async function detectFaces(photoPath, saveToDb = true, useFullImage = false) {
    logger.info(CONTEXT, 'detect_faces_start', 'Starting face detection', { photoPath, saveToDb, useFullImage });
    try {
        const result = await invoke('detect_faces_in_photo', { photoPath, saveToDb, useFullImage });
        const faces = JSON.parse(result);
        logger.info(CONTEXT, 'detect_faces_complete', `Detected ${faces.length} faces`, { photoPath, faceCount: faces.length });
        return faces;
    } catch (error) {
        logger.error(CONTEXT, 'detect_faces_failed', 'Face detection failed', { photoPath, error: error.toString() });
        throw error;
    }
}

/**
 * Get detected faces for a photo from database
 * @param {string} photoPath - Path to the photo
 * @returns {Promise<Array>} Array of stored face records
 */
export async function getDetectedFaces(photoPath) {
    try {
        const result = await invoke('get_detected_faces_for_photo', { photoPath });
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_faces_failed', 'Failed to get faces', { photoPath, error: error.toString() });
        throw error;
    }
}

/**
 * Check if a photo has been processed for face detection
 * @param {string} photoPath - Path to the photo
 * @returns {Promise<boolean>} True if photo has faces stored
 */
export async function hasDetectedFaces(photoPath) {
    try {
        return await invoke('has_photo_faces', { photoPath });
    } catch (error) {
        logger.error(CONTEXT, 'has_faces_failed', 'Failed to check faces', { photoPath, error: error.toString() });
        throw error;
    }
}

/**
 * Get face detection statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getStats() {
    try {
        const result = await invoke('get_face_detection_stats');
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_stats_failed', 'Failed to get stats', { error: error.toString() });
        throw error;
    }
}

/**
 * Get all persons
 * @returns {Promise<Array>} Array of person records
 */
export async function getAllPersons() {
    try {
        const result = await invoke('get_all_persons');
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_persons_failed', 'Failed to get persons', { error: error.toString() });
        throw error;
    }
}

/**
 * Get all persons with face counts and thumbnails for list display
 * Sorted by face count (most detected first)
 * @returns {Promise<Array>} Array of person list items
 * Each record contains: person_id, person_name, face_count, photo_count, photo_path, bbox_x, bbox_y, bbox_width, bbox_height
 */
export async function getAllPersonsForList() {
    try {
        const result = await invoke('get_all_persons_for_list');
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_persons_for_list_failed', 'Failed to get persons for list', { error: error.toString() });
        throw error;
    }
}

/**
 * Get photo paths for a specific person
 * @param {number} personId - The person ID
 * @returns {Promise<Array<string>>} Array of photo paths
 */
export async function getPhotosForPerson(personId) {
    try {
        const result = await invoke('get_photos_for_person', { personId });
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_photos_for_person_failed', 'Failed to get photos for person', { personId, error: error.toString() });
        throw error;
    }
}

/**
 * Get all named persons with face thumbnails, sorted by similarity to target face
 * @param {number|null} faceId - Optional face ID to calculate similarity against
 * @returns {Promise<Array>} Array of person records with face thumbnail info
 * Each record contains: person_id, person_name, photo_path, bbox_x, bbox_y, bbox_width, bbox_height, similarity
 */
export async function getPersonsWithFaces(faceId = null) {
    try {
        const result = await invoke('get_persons_with_faces', { faceId });
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_persons_with_faces_failed', 'Failed to get persons with faces', { faceId, error: error.toString() });
        throw error;
    }
}

/**
 * Create a new person
 * @param {string|null} name - Optional name for the person
 * @returns {Promise<number>} The new person's ID
 */
export async function createPerson(name = null) {
    logger.info(CONTEXT, 'create_person', 'Creating person', { name });
    try {
        return await invoke('create_person', { name });
    } catch (error) {
        logger.error(CONTEXT, 'create_person_failed', 'Failed to create person', { name, error: error.toString() });
        throw error;
    }
}

/**
 * Update a person's name
 * @param {number} personId - Person ID
 * @param {string} name - New name
 * @returns {Promise<void>}
 */
export async function updatePersonName(personId, name) {
    logger.info(CONTEXT, 'update_person', 'Updating person name', { personId, name });
    try {
        await invoke('update_person_name', { personId, name });
    } catch (error) {
        logger.error(CONTEXT, 'update_person_failed', 'Failed to update person', { personId, error: error.toString() });
        throw error;
    }
}

/**
 * Assign a face to a person
 * @param {number} faceId - Face ID
 * @param {number} personId - Person ID
 * @returns {Promise<void>}
 */
export async function assignFaceToPerson(faceId, personId) {
    logger.info(CONTEXT, 'assign_face', 'Assigning face to person', { faceId, personId });
    try {
        await invoke('assign_face_to_person', { faceId, personId });
    } catch (error) {
        logger.error(CONTEXT, 'assign_face_failed', 'Failed to assign face', { faceId, personId, error: error.toString() });
        throw error;
    }
}

/**
 * Delete a person
 * @param {number} personId - Person ID
 * @returns {Promise<void>}
 */
export async function deletePerson(personId) {
    logger.info(CONTEXT, 'delete_person', 'Deleting person', { personId });
    try {
        await invoke('delete_person', { personId });
    } catch (error) {
        logger.error(CONTEXT, 'delete_person_failed', 'Failed to delete person', { personId, error: error.toString() });
        throw error;
    }
}

/**
 * Delete a detected face (for removing false positives)
 * @param {number} faceId - Face ID
 * @returns {Promise<void>}
 */
export async function deleteFace(faceId) {
    logger.info(CONTEXT, 'delete_face', 'Deleting face', { faceId });
    try {
        await invoke('delete_detected_face', { faceId });
    } catch (error) {
        logger.error(CONTEXT, 'delete_face_failed', 'Failed to delete face', { faceId, error: error.toString() });
        throw error;
    }
}

/**
 * Set person name for a face
 * Creates a new person if face doesn't have one, or updates existing person name
 * @param {number} faceId - Face ID
 * @param {string} name - Person name
 * @returns {Promise<number>} Person ID
 */
export async function setFacePersonName(faceId, name) {
    logger.info(CONTEXT, 'set_face_person_name', 'Setting person name for face', { faceId, name });
    try {
        const personId = await invoke('set_face_person_name', { faceId, name });
        logger.info(CONTEXT, 'set_face_person_name_complete', 'Person name set', { faceId, personId, name });
        return personId;
    } catch (error) {
        logger.error(CONTEXT, 'set_face_person_name_failed', 'Failed to set person name', { faceId, name, error: error.toString() });
        throw error;
    }
}

/**
 * Get count of unknown (unassigned) faces
 * @returns {Promise<number>} Count of unknown faces
 */
export async function getUnknownFacesCount() {
    try {
        return await invoke('get_unknown_faces_count');
    } catch (error) {
        logger.error(CONTEXT, 'get_unknown_faces_count_failed', 'Failed to get unknown faces count', { error: error.toString() });
        throw error;
    }
}

/**
 * Get unknown (unassigned) faces with pagination
 * Sorted by detection time (newest first)
 * @param {number} limit - Maximum number of faces to return (default: 50)
 * @param {number} offset - Number of faces to skip (default: 0)
 * @returns {Promise<Array>} Array of unknown face records
 * Each record contains: id, photo_path, bbox_x, bbox_y, bbox_width, bbox_height, confidence, created_at
 */
export async function getUnknownFaces(limit = 50, offset = 0) {
    try {
        const result = await invoke('get_unknown_faces', { limit, offset });
        return JSON.parse(result);
    } catch (error) {
        logger.error(CONTEXT, 'get_unknown_faces_failed', 'Failed to get unknown faces', { limit, offset, error: error.toString() });
        throw error;
    }
}

// Export as default object for convenience
export default {
    getModelStatus,
    getModelInfo,
    downloadModel,
    deleteModel,
    detectFaces,
    getDetectedFaces,
    hasDetectedFaces,
    getStats,
    getAllPersons,
    getAllPersonsForList,
    getPersonsWithFaces,
    createPerson,
    updatePersonName,
    assignFaceToPerson,
    getPhotosForPerson,
    deletePerson,
    deleteFace,
    setFacePersonName,
    getUnknownFacesCount,
    getUnknownFaces
};
