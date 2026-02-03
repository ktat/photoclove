import { logger } from './LoggerService.js';

/**
 * Music mood categories for slideshow BGM
 * Each mood has associated tags and music tracks
 */
const FREEPD_BASE_URL = 'https://archive.org/download/freepd';

const MOOD_CONFIG = {
  calm: {
    name: 'Calm',
    tags: ['nature', 'landscape', 'sunset', 'sunrise', 'beach', 'ocean', 'lake', 'mountain', 'forest', 'garden', 'flower', 'zen', 'meditation', 'peaceful'],
    tracks: [
      { id: 'calm_1', title: 'Calm Sketch for Piano', file: 'calm_peaceful_morning.mp3', duration: 63, sourcePath: 'Page2/Calm Sketch for Piano.mp3' },
      { id: 'calm_2', title: 'Chill Breathe', file: 'calm_gentle_waves.mp3', duration: 203, sourcePath: 'Page2/Chill Breathe.mp3' },
      { id: 'calm_3', title: 'Ambient Delicate', file: 'calm_forest_dreams.mp3', duration: 210, sourcePath: 'Page2/Ambient L Delicate.mp3' },
    ]
  },
  upbeat: {
    name: 'Upbeat',
    tags: ['travel', 'vacation', 'adventure', 'party', 'celebration', 'festival', 'sport', 'action', 'fun', 'happy', 'joy', 'summer'],
    tracks: [
      { id: 'upbeat_1', title: 'Funshine', file: 'upbeat_happy_journey.mp3', duration: 165, sourcePath: 'upbeat/Funshine.mp3' },
      { id: 'upbeat_2', title: 'Be Chillin', file: 'upbeat_sunny_days.mp3', duration: 202, sourcePath: 'upbeat/Be Chillin.mp3' },
      { id: 'upbeat_3', title: 'Funkeriffic', file: 'upbeat_adventure_time.mp3', duration: 210, sourcePath: 'misc/Funkeriffic.mp3' },
    ]
  },
  romantic: {
    name: 'Romantic',
    tags: ['wedding', 'love', 'couple', 'anniversary', 'valentine', 'romantic', 'date', 'engagement', 'honeymoon'],
    tracks: [
      { id: 'romantic_1', title: 'Piano Magic Motive', file: 'romantic_love_story.mp3', duration: 78, sourcePath: 'romantic/Piano Magic Motive.mp3' },
      { id: 'romantic_2', title: 'Dreamy Piano Fantasy', file: 'romantic_sweet_memories.mp3', duration: 161, sourcePath: 'Page2/Dreamy Piano Fantasy.mp3' },
      { id: 'romantic_3', title: 'Chill China Love', file: 'romantic_together_forever.mp3', duration: 140, sourcePath: 'Page2/Chill China Love.mp3' },
    ]
  },
  family: {
    name: 'Family',
    tags: ['family', 'kids', 'children', 'baby', 'birthday', 'christmas', 'holiday', 'home', 'portrait', 'gathering'],
    tracks: [
      { id: 'family_1', title: 'Cartoon Pizzicato', file: 'family_family_time.mp3', duration: 72, sourcePath: 'Page2/Cartoon Pizzicato.mp3' },
      { id: 'family_2', title: 'Hopeful', file: 'family_precious_moments.mp3', duration: 113, sourcePath: 'comedy/Hopeful.mp3' },
      { id: 'family_3', title: 'City Sunshine', file: 'family_growing_up.mp3', duration: 184, sourcePath: 'upbeat/City Sunshine.mp3' },
    ]
  },
  nostalgic: {
    name: 'Nostalgic',
    tags: ['vintage', 'retro', 'old', 'memories', 'classic', 'historic', 'antique', 'sepia', 'blackandwhite', 'film'],
    tracks: [
      { id: 'nostalgic_1', title: 'Nostalgic Piano', file: 'nostalgic_memories.mp3', duration: 196, sourcePath: 'romantic/Nostalgic Piano.mp3' },
      { id: 'nostalgic_2', title: 'Emotional Piano', file: 'nostalgic_time_gone_by.mp3', duration: 134, sourcePath: 'Page2/Emotional Piano.mp3' },
      { id: 'nostalgic_3', title: 'Lovely Piano Song', file: 'nostalgic_golden_days.mp3', duration: 95, sourcePath: 'romantic/Lovely Piano Song.mp3' },
    ]
  },
  ambient: {
    name: 'Ambient',
    tags: ['night', 'evening', 'city', 'urban', 'street', 'architecture', 'abstract', 'minimal', 'modern'],
    tracks: [
      { id: 'ambient_1', title: 'Ambient Glowing', file: 'ambient_city_lights.mp3', duration: 158, sourcePath: 'Page2/Ambient G Glowing.mp3' },
      { id: 'ambient_2', title: 'Ambient Spaced Out', file: 'ambient_night_sky.mp3', duration: 114, sourcePath: 'Page2/Ambient H Spaced Out.mp3' },
      { id: 'ambient_3', title: 'Chill Urban', file: 'ambient_urban_dreams.mp3', duration: 182, sourcePath: 'Page2/Chill Urban.mp3' },
    ]
  }
};

// Default mood when no tags match
const DEFAULT_MOOD = 'calm';

class SlideshowMusicService {
  constructor() {
    this.audio = null;
    this.currentTrack = null;
    this.currentMood = null;
    this.currentBlobUrl = null; // Track blob URL for cleanup
    this.volume = 0.5;
    this.isMuted = false;
    this.isPlaying = false;
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onError = null; // Callback for errors
    this.availableTracks = new Map(); // Cache of available tracks
    this.musicAvailable = false; // Whether music files are available
    this.errorCount = 0;
    this.maxErrors = 3; // Stop trying after this many errors
  }

  /**
   * Reset state for a new slideshow session
   */
  reset() {
    this.errorCount = 0;
    this.musicAvailable = true;
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    logger.info('SlideshowMusic', 'reset', 'Music service reset for new session');
  }

  /**
   * Initialize the audio element
   */
  init() {
    // Always reset error state on init
    this.errorCount = 0;
    this.musicAvailable = true;

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = false;
      this.audio.volume = this.volume;

      this.audio.addEventListener('ended', () => {
        this.playNextTrack();
      });

      // Audio error handler - only for playback errors, not load errors
      // Load errors are handled in loadTrack via fetch
      this.audio.addEventListener('error', (e) => {
        const audioError = this.audio.error;
        const errorDetails = audioError ? {
          code: audioError.code,
          message: audioError.message || 'Unknown error'
        } : { code: 0, message: 'No error details' };

        logger.warn('SlideshowMusic', 'audio_error', 'Audio playback error', {
          src: this.audio.src?.substring(0, 50),
          errorCode: errorDetails.code,
          errorMessage: errorDetails.message,
          track: this.currentTrack?.title
        });

        // Try next track on playback error
        this.playNextTrack();
      });

      logger.info('SlideshowMusic', 'initialized', 'Music service initialized');
    }
  }

  /**
   * Get a random mood
   * @returns {string} A random mood key
   */
  getRandomMood() {
    const moods = Object.keys(MOOD_CONFIG);
    return moods[Math.floor(Math.random() * moods.length)];
  }

  /**
   * Analyze photos and determine the best mood based on tags
   * @param {Array} photos - Array of Photo objects
   * @returns {string} The detected mood
   */
  analyzeMood(photos) {
    if (!photos || photos.length === 0) {
      return this.getRandomMood();
    }

    // Collect all tags from photos
    const tagCounts = new Map();

    for (const photo of photos) {
      const tags = photo.tags || [];
      for (const tag of tags) {
        // Handle various tag formats: string, {name: string}, or other objects
        let tagName = null;
        if (typeof tag === 'string') {
          tagName = tag;
        } else if (tag && typeof tag.name === 'string') {
          tagName = tag.name;
        }
        if (tagName) {
          const tagLower = tagName.toLowerCase();
          tagCounts.set(tagLower, (tagCounts.get(tagLower) || 0) + 1);
        }
      }
    }

    // Score each mood based on matching tags
    const moodScores = {};

    for (const [moodKey, moodConfig] of Object.entries(MOOD_CONFIG)) {
      let score = 0;
      for (const moodTag of moodConfig.tags) {
        if (tagCounts.has(moodTag)) {
          score += tagCounts.get(moodTag);
        }
        // Also check for partial matches
        for (const [photoTag, count] of tagCounts) {
          if (photoTag.includes(moodTag) || moodTag.includes(photoTag)) {
            score += count * 0.5;
          }
        }
      }
      moodScores[moodKey] = score;
    }

    // Find the mood with highest score
    let bestMood = null;
    let bestScore = 0;

    for (const [mood, score] of Object.entries(moodScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestMood = mood;
      }
    }

    // If no tags matched (score is 0), use random mood
    if (bestScore === 0 || !bestMood) {
      bestMood = this.getRandomMood();
      logger.info('SlideshowMusic', 'mood_random', 'No matching tags, using random mood', {
        photoCount: photos.length,
        mood: bestMood
      });
      return bestMood;
    }

    logger.info('SlideshowMusic', 'mood_analyzed', 'Mood determined from photos', {
      photoCount: photos.length,
      tagCount: tagCounts.size,
      detectedMood: bestMood,
      score: bestScore
    });

    return bestMood;
  }

  /**
   * Get tracks for a specific mood
   * @param {string} mood - The mood key
   * @returns {Array} Array of track objects
   */
  getTracksForMood(mood) {
    return MOOD_CONFIG[mood]?.tracks || MOOD_CONFIG[DEFAULT_MOOD].tracks;
  }

  /**
   * Get all available moods
   * @returns {Array} Array of mood objects with key and name
   */
  getAllMoods() {
    return Object.entries(MOOD_CONFIG).map(([key, config]) => ({
      key,
      name: config.name
    }));
  }

  /**
   * Set the current mood and optionally start playing
   * @param {string} mood - The mood key
   * @param {boolean} autoPlay - Whether to start playing immediately
   */
  async setMood(mood, autoPlay = true) {
    this.init();
    this.currentMood = mood;

    const tracks = this.getTracksForMood(mood);
    if (tracks.length > 0) {
      // Pick a random track from the mood
      const randomIndex = Math.floor(Math.random() * tracks.length);
      await this.loadTrack(tracks[randomIndex]);

      if (autoPlay) {
        this.play();
      }
    }
  }

  /**
   * Load a specific track
   * @param {Object} track - Track object with file property
   */
  async loadTrack(track) {
    this.init();
    this.currentTrack = track;

    // Try multiple path formats for Tauri compatibility
    const origin = window.location.origin;
    const pathFormats = [
      `/music/${track.file}`,                    // Absolute from root
      `${origin}/music/${track.file}`,           // Full origin URL
      `music/${track.file}`,                     // Relative
      `./music/${track.file}`,                   // Explicit relative
    ];

    logger.info('SlideshowMusic', 'loading_track', 'Attempting to load track', {
      track: track.title,
      file: track.file,
      origin: window.location.origin,
      href: window.location.href
    });

    // Test which path works using fetch and load as blob for reliability
    for (const testPath of pathFormats) {
      try {
        const response = await fetch(testPath);
        if (response.ok) {
          // Load as blob to avoid CSP/path issues with Audio element
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);

          // Clean up previous blob URL if exists
          if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
          }
          this.currentBlobUrl = blobUrl;
          this.audio.src = blobUrl;

          logger.info('SlideshowMusic', 'track_loaded', 'Track loaded via blob', {
            track: track.title,
            path: testPath,
            blobUrl: blobUrl.substring(0, 50)
          });

          if (this.onTrackChange) {
            this.onTrackChange(track);
          }
          return;
        }
      } catch (e) {
        logger.warn('SlideshowMusic', 'path_test_failed', 'Path test failed', {
          path: testPath,
          error: e.message,
          errorType: e.name
        });
      }
    }

    // All paths failed
    logger.warn('SlideshowMusic', 'track_load_failed', 'Failed to load track from any path', {
      track: track.title,
      testedPaths: pathFormats
    });

    // Trigger error handling
    this.errorCount++;
    if (this.errorCount >= this.maxErrors && this.onError) {
      this.onError('Music files not found');
    }
  }

  /**
   * Play the next track in the current mood
   */
  async playNextTrack() {
    if (!this.currentMood) return;

    const tracks = this.getTracksForMood(this.currentMood);
    if (tracks.length === 0) return;

    // Get a different track if possible
    let nextTrack;
    if (tracks.length === 1) {
      nextTrack = tracks[0];
    } else {
      do {
        const randomIndex = Math.floor(Math.random() * tracks.length);
        nextTrack = tracks[randomIndex];
      } while (nextTrack.id === this.currentTrack?.id);
    }

    await this.loadTrack(nextTrack);
    if (this.isPlaying) {
      this.play();
    }
  }

  /**
   * Start or resume playback
   */
  play() {
    if (!this.audio || !this.currentTrack) return;

    // Don't try if music is unavailable
    if (!this.musicAvailable && this.errorCount >= this.maxErrors) {
      logger.debug('SlideshowMusic', 'play_skipped', 'Music unavailable, skipping play');
      return;
    }

    this.audio.play().then(() => {
      this.isPlaying = true;
      this.musicAvailable = true;
      this.errorCount = 0; // Reset error count on successful play
      if (this.onPlayStateChange) {
        this.onPlayStateChange(true);
      }
      logger.debug('SlideshowMusic', 'play', 'Playback started', { track: this.currentTrack?.title });
    }).catch(err => {
      logger.warn('SlideshowMusic', 'play_failed', 'Failed to play audio', { error: err.message });
      this.errorCount++;
      if (this.errorCount >= this.maxErrors) {
        this.musicAvailable = false;
        if (this.onError) {
          this.onError('Music files not found');
        }
      }
    });
  }

  /**
   * Pause playback
   */
  pause() {
    if (!this.audio) return;

    this.audio.pause();
    this.isPlaying = false;
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
    logger.debug('SlideshowMusic', 'pause', 'Playback paused');
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   * @param {number} volume - Volume level
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.isMuted ? 0 : this.volume;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.audio) {
      this.audio.volume = this.isMuted ? 0 : this.volume;
    }
    return this.isMuted;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
      currentTrack: this.currentTrack,
      currentMood: this.currentMood,
      musicAvailable: this.musicAvailable
    };
  }

  /**
   * Stop playback and cleanup
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
    }
    logger.info('SlideshowMusic', 'stopped', 'Music stopped');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }
    this.currentTrack = null;
    this.currentMood = null;
    this.errorCount = 0;
    this.musicAvailable = false;
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onError = null;
    logger.info('SlideshowMusic', 'destroyed', 'Music service destroyed');
  }
}

// Export singleton instance
export const slideshowMusic = new SlideshowMusicService();

// Export config for UI
export { MOOD_CONFIG, DEFAULT_MOOD, FREEPD_BASE_URL };
