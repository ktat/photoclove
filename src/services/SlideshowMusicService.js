import { logger } from './LoggerService.js';

/**
 * Music mood categories for slideshow BGM
 * Each mood has associated tags and music tracks
 */
const MOOD_CONFIG = {
  calm: {
    name: 'Calm',
    tags: ['nature', 'landscape', 'sunset', 'sunrise', 'beach', 'ocean', 'lake', 'mountain', 'forest', 'garden', 'flower', 'zen', 'meditation', 'peaceful'],
    tracks: [
      { id: 'calm_1', title: 'Peaceful Morning', file: 'calm_peaceful_morning.mp3', duration: 180 },
      { id: 'calm_2', title: 'Gentle Waves', file: 'calm_gentle_waves.mp3', duration: 240 },
      { id: 'calm_3', title: 'Forest Dreams', file: 'calm_forest_dreams.mp3', duration: 200 },
    ]
  },
  upbeat: {
    name: 'Upbeat',
    tags: ['travel', 'vacation', 'adventure', 'party', 'celebration', 'festival', 'sport', 'action', 'fun', 'happy', 'joy', 'summer'],
    tracks: [
      { id: 'upbeat_1', title: 'Happy Journey', file: 'upbeat_happy_journey.mp3', duration: 150 },
      { id: 'upbeat_2', title: 'Sunny Days', file: 'upbeat_sunny_days.mp3', duration: 180 },
      { id: 'upbeat_3', title: 'Adventure Time', file: 'upbeat_adventure_time.mp3', duration: 160 },
    ]
  },
  romantic: {
    name: 'Romantic',
    tags: ['wedding', 'love', 'couple', 'anniversary', 'valentine', 'romantic', 'date', 'engagement', 'honeymoon'],
    tracks: [
      { id: 'romantic_1', title: 'Love Story', file: 'romantic_love_story.mp3', duration: 210 },
      { id: 'romantic_2', title: 'Sweet Memories', file: 'romantic_sweet_memories.mp3', duration: 195 },
      { id: 'romantic_3', title: 'Together Forever', file: 'romantic_together_forever.mp3', duration: 220 },
    ]
  },
  family: {
    name: 'Family',
    tags: ['family', 'kids', 'children', 'baby', 'birthday', 'christmas', 'holiday', 'home', 'portrait', 'gathering'],
    tracks: [
      { id: 'family_1', title: 'Family Time', file: 'family_family_time.mp3', duration: 175 },
      { id: 'family_2', title: 'Precious Moments', file: 'family_precious_moments.mp3', duration: 190 },
      { id: 'family_3', title: 'Growing Up', file: 'family_growing_up.mp3', duration: 200 },
    ]
  },
  nostalgic: {
    name: 'Nostalgic',
    tags: ['vintage', 'retro', 'old', 'memories', 'classic', 'historic', 'antique', 'sepia', 'blackandwhite', 'film'],
    tracks: [
      { id: 'nostalgic_1', title: 'Memories of Yesterday', file: 'nostalgic_memories.mp3', duration: 200 },
      { id: 'nostalgic_2', title: 'Time Gone By', file: 'nostalgic_time_gone_by.mp3', duration: 185 },
      { id: 'nostalgic_3', title: 'Golden Days', file: 'nostalgic_golden_days.mp3', duration: 210 },
    ]
  },
  ambient: {
    name: 'Ambient',
    tags: ['night', 'evening', 'city', 'urban', 'street', 'architecture', 'abstract', 'minimal', 'modern'],
    tracks: [
      { id: 'ambient_1', title: 'City Lights', file: 'ambient_city_lights.mp3', duration: 240 },
      { id: 'ambient_2', title: 'Night Sky', file: 'ambient_night_sky.mp3', duration: 220 },
      { id: 'ambient_3', title: 'Urban Dreams', file: 'ambient_urban_dreams.mp3', duration: 200 },
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
    this.volume = 0.5;
    this.isMuted = false;
    this.isPlaying = false;
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onError = null; // Callback for errors
    this.availableTracks = new Map(); // Cache of available tracks
    this.musicBasePath = '/music/';
    this.musicAvailable = false; // Whether music files are available
    this.errorCount = 0;
    this.maxErrors = 3; // Stop trying after this many errors
  }

  /**
   * Initialize the audio element
   */
  init() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = false;
      this.audio.volume = this.volume;

      this.audio.addEventListener('ended', () => {
        this.playNextTrack();
      });

      this.audio.addEventListener('error', (e) => {
        this.errorCount++;
        logger.warn('SlideshowMusic', 'audio_error', 'Audio playback error', {
          error: e.message || 'File not found',
          track: this.currentTrack?.title,
          errorCount: this.errorCount
        });

        // Stop trying if too many errors (likely no music files)
        if (this.errorCount >= this.maxErrors) {
          logger.warn('SlideshowMusic', 'music_unavailable', 'Music files not available');
          this.musicAvailable = false;
          this.isPlaying = false;
          if (this.onError) {
            this.onError('Music files not found. Add MP3 files to public/music/ folder.');
          }
          if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
          }
          return;
        }

        // Try next track on error
        this.playNextTrack();
      });

      logger.info('SlideshowMusic', 'initialized', 'Music service initialized');
    }
  }

  /**
   * Analyze photos and determine the best mood based on tags
   * @param {Array} photos - Array of Photo objects
   * @returns {string} The detected mood
   */
  analyzeMood(photos) {
    if (!photos || photos.length === 0) {
      return DEFAULT_MOOD;
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
    let bestMood = DEFAULT_MOOD;
    let bestScore = 0;

    for (const [mood, score] of Object.entries(moodScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestMood = mood;
      }
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

    // In Tauri, we use asset protocol or public folder
    const trackPath = `${this.musicBasePath}${track.file}`;
    this.audio.src = trackPath;

    logger.info('SlideshowMusic', 'track_loaded', 'Track loaded', {
      track: track.title,
      mood: this.currentMood
    });

    if (this.onTrackChange) {
      this.onTrackChange(track);
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
export { MOOD_CONFIG, DEFAULT_MOOD };
