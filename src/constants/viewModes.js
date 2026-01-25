/**
 * View Mode Constants
 * Centralized constants for all PhotoClove view modes to avoid string literals
 * and prevent typos in mode comparisons.
 */

export const VIEW_MODES = {
  HOME: 'home',
  DATE: 'date',
  RECENT: 'recent',
  SEARCH: 'search',
  ALBUM_LIST: 'album_list',
  ALBUM: 'album',
  TAG_LIST: 'tag_list',
  TAG: 'tag',
  FACE_LIST: 'face_list',
  PERSON: 'person',
  TRASH: 'trash',
  IMPORT: 'import',
  PREFERENCES: 'preferences',
  JOB_QUEUE: 'job_queue',
  LOGIN: 'login',
  // Burst grouping mode - shows all photos within a burst group
  IN_BURST_GROUP: 'in_burst_group'
};

// Helper functions for common mode checks
export const isPhotoViewingMode = (mode) => {
  return [
    VIEW_MODES.DATE,
    VIEW_MODES.RECENT,
    VIEW_MODES.SEARCH,
    VIEW_MODES.ALBUM,
    VIEW_MODES.TAG,
    VIEW_MODES.PERSON,
    VIEW_MODES.TRASH,
    VIEW_MODES.IN_BURST_GROUP
  ].includes(mode);
};

// Modes that support burst grouping display
export const supportsBurstGrouping = (mode) => {
  return [
    VIEW_MODES.DATE,
    VIEW_MODES.ALBUM,
    VIEW_MODES.TAG
  ].includes(mode);
};

export const isListMode = (mode) => {
  return [
    VIEW_MODES.ALBUM_LIST,
    VIEW_MODES.TAG_LIST,
    VIEW_MODES.FACE_LIST
  ].includes(mode);
};

export const usesPhotosList = (mode) => {
  return isPhotoViewingMode(mode) || isListMode(mode) || mode === VIEW_MODES.IMPORT;
};