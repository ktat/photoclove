import React, { useState, useEffect, useCallback, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { logger } from '../services/LoggerService.js';
import styles from './SlideShow.module.css';

const SlideShow = ({ photos = [], startIndex = 0, onClose }) => {
  const { t } = useTranslation(['common']);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideInterval, setSlideInterval] = useState(5000);

  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const autoAdvanceRef = useRef(null);

  const currentPhoto = photos[currentIndex];

  // Navigate to next photo
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  // Navigate to previous photo
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Fullscreen using Tauri API
  const enterFullscreen = useCallback(async () => {
    try {
      await getCurrentWindow().setFullscreen(true);
      setIsFullscreen(true);
    } catch (err) {
      logger.warn('SlideShow', 'fullscreen_failed', 'Failed to enter fullscreen', { error: err.message });
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      await getCurrentWindow().setFullscreen(false);
      setIsFullscreen(false);
    } catch (err) {
      logger.warn('SlideShow', 'exit_fullscreen_failed', 'Failed to exit fullscreen', { error: err.message });
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Handle close
  const handleClose = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    }
    onClose();
  }, [isFullscreen, exitFullscreen, onClose]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          goToNext();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'Escape':
          handleClose();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          togglePlay();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, handleClose, toggleFullscreen, togglePlay]);

  // Auto-advance timer
  useEffect(() => {
    if (isPlaying && photos.length > 1) {
      autoAdvanceRef.current = setTimeout(() => {
        goToNext();
      }, slideInterval);
    }

    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
      }
    };
  }, [isPlaying, currentIndex, slideInterval, goToNext, photos.length]);

  // Show/hide controls on mouse movement
  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Handle click on left/right sides
  const handleClick = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      goToPrevious();
    } else if (x > (width * 2) / 3) {
      goToNext();
    } else {
      togglePlay();
    }
  }, [goToPrevious, goToNext, togglePlay]);

  // Enter fullscreen on mount, exit on unmount
  useEffect(() => {
    enterFullscreen();
    logger.info('SlideShow', 'started', 'Slideshow started', {
      photoCount: photos.length,
      startIndex
    });

    return () => {
      exitFullscreen();
      logger.info('SlideShow', 'ended', 'Slideshow ended');
    };
  }, []);

  if (!currentPhoto) {
    return null;
  }

  const photoPath = currentPhoto.displayPath();
  const imgSrc = convertFileSrc(photoPath);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {/* Photo Display */}
      <div className={styles.photoWrapper}>
        <img
          src={imgSrc}
          alt={currentPhoto.name || ''}
          className={styles.photo}
          draggable={false}
        />
      </div>

      {/* Controls Overlay */}
      <div className={`${styles.controls} ${showControls ? styles.visible : ''}`}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </div>
          <div className={styles.topActions}>
            <button
              className={styles.controlButton}
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
            <button
              className={styles.controlButton}
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              title={t('common:button.close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <button
            className={styles.controlButton}
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            title="Previous (←)"
          >
            ◀
          </button>
          <button
            className={`${styles.controlButton} ${styles.playButton}`}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            title={isPlaying ? 'Pause (P)' : 'Play (P)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className={styles.controlButton}
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            title="Next (→)"
          >
            ▶
          </button>

          {/* Interval selector */}
          <select
            className={styles.intervalSelect}
            value={slideInterval}
            onChange={(e) => { e.stopPropagation(); setSlideInterval(Number(e.target.value)); }}
            onClick={(e) => e.stopPropagation()}
          >
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progress}
            style={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Photo Info */}
      {showControls && currentPhoto.name && (
        <div className={styles.photoInfo}>
          {currentPhoto.name}
        </div>
      )}
    </div>
  );
};

export default SlideShow;
