/**
 * Achievement Service
 *
 * Handles achievement-related API calls and state management.
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from './LoggerService.js';

/**
 * Get all achievements with their current progress
 * @returns {Promise<Object>} Achievement summary with categories
 */
export async function getAchievements() {
  try {
    logger.info('AchievementService', 'get_achievements', 'Fetching achievements');
    const result = await invoke('get_achievements');
    logger.debug('AchievementService', 'get_achievements_success', 'Achievements loaded', {
      total: result.total,
      achieved: result.achieved,
    });
    return result;
  } catch (error) {
    logger.error('AchievementService', 'get_achievements_error', 'Failed to get achievements', {
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Check all achievements and get newly achieved ones
 * @returns {Promise<Object>} Object with newly_achieved array
 */
export async function checkAllAchievements() {
  try {
    logger.info('AchievementService', 'check_all', 'Checking all achievements');
    const result = await invoke('check_all_achievements');
    if (result.newly_achieved?.length > 0) {
      logger.info('AchievementService', 'new_achievements', 'New achievements unlocked', {
        count: result.newly_achieved.length,
        achievements: result.newly_achieved.map((a) => a.id),
      });
    }
    return result;
  } catch (error) {
    logger.error('AchievementService', 'check_all_error', 'Failed to check achievements', {
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Check a specific first-time action achievement
 * @param {string} achievementId - The achievement ID to check
 * @returns {Promise<Object>} Object with newly_achieved array
 */
export async function checkFirstActionAchievement(achievementId) {
  try {
    logger.debug('AchievementService', 'check_first_action', 'Checking first action', {
      achievementId,
    });
    const result = await invoke('check_first_action_achievement', {
      achievementId,
    });
    if (result.newly_achieved?.length > 0) {
      logger.info('AchievementService', 'first_action_achieved', 'First action achievement unlocked', {
        achievementId,
      });
      window.dispatchEvent(new CustomEvent('achievementUnlocked', {
        detail: result.newly_achieved
      }));
    }
    return result;
  } catch (error) {
    logger.error('AchievementService', 'check_first_action_error', 'Failed to check first action', {
      achievementId,
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Check photo count achievements
 * @returns {Promise<Object>} Object with newly_achieved array
 */
export async function checkPhotoCountAchievements() {
  try {
    logger.debug('AchievementService', 'check_photo_count', 'Checking photo count achievements');
    const result = await invoke('check_photo_count_achievements');
    return result;
  } catch (error) {
    logger.error('AchievementService', 'check_photo_count_error', 'Failed to check photo count', {
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Check monthly achievements
 * @returns {Promise<Object>} Object with newly_achieved array
 */
export async function checkMonthlyAchievements() {
  try {
    logger.debug('AchievementService', 'check_monthly', 'Checking monthly achievements');
    const result = await invoke('check_monthly_achievements');
    return result;
  } catch (error) {
    logger.error('AchievementService', 'check_monthly_error', 'Failed to check monthly achievements', {
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Check star count achievements
 * @returns {Promise<Object>} Object with newly_achieved array
 */
export async function checkStarCountAchievements() {
  try {
    logger.debug('AchievementService', 'check_star_count', 'Checking star count achievements');
    const result = await invoke('check_star_count_achievements');
    return result;
  } catch (error) {
    logger.error('AchievementService', 'check_star_count_error', 'Failed to check star count achievements', {
      error: error.toString(),
    });
    throw error;
  }
}

/**
 * Achievement category display names
 */
export const CATEGORY_NAMES = {
  first: 'Getting Started',
  monthly: 'Monthly Pioneer',
  count: 'Photo Milestones',
  date: 'Date Completion',
  special: 'Special',
};

/**
 * Get category icon
 * @param {string} category - Category name
 * @returns {string} Emoji icon
 */
export function getCategoryIcon(category) {
  const icons = {
    first: '📸',
    monthly: '📅',
    count: '📷',
    date: '📆',
    special: '✨',
  };
  return icons[category] || '🏆';
}

export default {
  getAchievements,
  checkAllAchievements,
  checkFirstActionAchievement,
  checkPhotoCountAchievements,
  checkMonthlyAchievements,
  checkStarCountAchievements,
  CATEGORY_NAMES,
  getCategoryIcon,
};
