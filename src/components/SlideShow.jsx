import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { logger } from '../services/LoggerService.js';
import { slideshowMusic, MOOD_CONFIG, FREEPD_BASE_URL } from '../services/SlideshowMusicService.js';
import { checkFirstActionAchievement } from '../services/AchievementService.js';
import styles from './SlideShow.module.css';

// Video extensions to skip in slideshow
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'];

const SlideShow = ({ photos = [], startIndex = 0, onClose }) => {
  const { t } = useTranslation(['common']);

  // Filter out video files - slideshow is for photos only
  const filteredPhotos = useMemo(() => {
    const result = photos.filter(photo => {
      const name = (photo.name || photo.path || '').toLowerCase();
      return !VIDEO_EXTENSIONS.some(ext => name.endsWith(ext));
    });
    logger.info('SlideShow', 'filtered_videos', 'Filtered videos from slideshow', {
      original: photos.length,
      filtered: result.length,
      skipped: photos.length - result.length
    });
    return result;
  }, [photos]);

  // Adjust startIndex if it points to a video
  const adjustedStartIndex = useMemo(() => {
    if (startIndex >= filteredPhotos.length) {
      return 0;
    }
    return startIndex;
  }, [startIndex, filteredPhotos.length]);

  const [currentIndex, setCurrentIndex] = useState(adjustedStartIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideInterval, setSlideInterval] = useState(5000);

  // Music state
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentMood, setCurrentMood] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [musicError, setMusicError] = useState(null);

  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const autoAdvanceRef = useRef(null);

  const currentPhoto = filteredPhotos[currentIndex];

  // Navigate to next photo
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % filteredPhotos.length);
  }, [filteredPhotos.length]);

  // Navigate to previous photo
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  }, [filteredPhotos.length]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Music controls
  const toggleMusic = useCallback(() => {
    if (isMusicPlaying) {
      slideshowMusic.pause();
    } else {
      slideshowMusic.play();
    }
  }, [isMusicPlaying]);

  const toggleMute = useCallback(() => {
    const muted = slideshowMusic.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    slideshowMusic.setVolume(newVolume);
  }, []);

  const handleMoodChange = useCallback((e) => {
    const newMood = e.target.value;
    setCurrentMood(newMood);
    slideshowMusic.setMood(newMood, isMusicPlaying);
  }, [isMusicPlaying]);

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
        case 'm':
        case 'M':
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, handleClose, toggleFullscreen, togglePlay, toggleMute]);

  // Auto-advance timer
  useEffect(() => {
    if (isPlaying && filteredPhotos.length > 1) {
      autoAdvanceRef.current = setTimeout(() => {
        goToNext();
      }, slideInterval);
    }

    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
      }
    };
  }, [isPlaying, currentIndex, slideInterval, goToNext, filteredPhotos.length]);

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
      totalItems: photos.length,
      photosOnly: filteredPhotos.length,
      startIndex
    });

    // Trigger first slideshow achievement
    checkFirstActionAchievement('first_slideshow').catch(() => {});

    return () => {
      exitFullscreen();
      logger.info('SlideShow', 'ended', 'Slideshow ended');
    };
  }, []);

  // Initialize music on mount
  useEffect(() => {
    if (!musicEnabled) return;

    // Reset music service state for clean start
    slideshowMusic.reset();

    // Set up callbacks
    slideshowMusic.onTrackChange = (track) => {
      setCurrentTrack(track);
    };
    slideshowMusic.onPlayStateChange = (playing) => {
      setIsMusicPlaying(playing);
    };
    slideshowMusic.onError = (error) => {
      setMusicError(error);
      logger.warn('SlideShow', 'music_error', 'Music playback error', { error });
    };

    // Analyze mood from photos and start playing
    const detectedMood = slideshowMusic.analyzeMood(filteredPhotos);
    setCurrentMood(detectedMood);
    slideshowMusic.setVolume(volume);
    slideshowMusic.setMood(detectedMood, true);

    logger.info('SlideShow', 'music_initialized', 'Music initialized', {
      detectedMood,
      photoCount: filteredPhotos.length
    });

    return () => {
      slideshowMusic.destroy();
    };
  }, [musicEnabled]);

  // Close slideshow if no photos (all items were videos)
  useEffect(() => {
    if (filteredPhotos.length === 0) {
      logger.info('SlideShow', 'no_photos', 'No photos to display, closing slideshow');
      onClose();
    }
  }, [filteredPhotos.length, onClose]);

  if (!currentPhoto || filteredPhotos.length === 0) {
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
            {currentIndex + 1} / {filteredPhotos.length}
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

          {/* Music Controls - Always show, but indicate error state */}
          <div className={styles.musicControls}>
            <button
              className={`${styles.musicButton} ${musicError ? styles.disabled : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!musicError) toggleMusic(); }}
              title={musicError ? 'Music unavailable' : (isMusicPlaying ? 'Pause Music' : 'Play Music')}
              disabled={!!musicError}
            >
              {musicError ? '🚫' : (isMusicPlaying ? '🎵' : '🔇')}
            </button>
            <button
              className={`${styles.musicButton} ${musicError ? styles.disabled : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!musicError) toggleMute(); }}
              title={musicError ? 'Music unavailable' : (isMuted ? 'Unmute (M)' : 'Mute (M)')}
              disabled={!!musicError}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              className={styles.volumeSlider}
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              onClick={(e) => e.stopPropagation()}
              title="Volume"
              disabled={!!musicError}
            />
            <select
              className={styles.moodSelect}
              value={currentMood || ''}
              onChange={handleMoodChange}
              onClick={(e) => e.stopPropagation()}
              title="Music Mood"
              disabled={!!musicError}
            >
              {Object.entries(MOOD_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progress}
            style={{ width: `${((currentIndex + 1) / filteredPhotos.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Photo Info */}
      {showControls && currentPhoto.name && (
        <div className={styles.photoInfo}>
          {currentPhoto.name}
        </div>
      )}

      {/* Music Track Info */}
      {showControls && currentTrack && !musicError && (
        <div className={`${styles.trackInfo} ${!isMusicPlaying ? styles.paused : ''}`}>
          <span className={styles.musicIcon}>♪</span>
          <span>{currentTrack.title}</span>
          <span
            className={styles.musicSourceLink}
            title="Music source: FreePD (Public Domain)"
            onClick={(e) => {
              e.stopPropagation();
              const sourceUrl = currentTrack.sourcePath
                ? `${FREEPD_BASE_URL}/${encodeURI(currentTrack.sourcePath)}`
                : 'https://archive.org/details/freepd';
              openUrl(sourceUrl);
            }}
          >
            🔗
          </span>
        </div>
      )}

      {/* Music Error Message */}
      {showControls && musicError && (
        <div className={styles.musicError}>
          {musicError}
        </div>
      )}
    </div>
  );
};

export default SlideShow;
