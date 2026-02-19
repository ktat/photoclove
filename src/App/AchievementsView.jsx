/**
 * Achievements View Component
 *
 * Displays all achievements organized by category with progress indicators.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal, { ModalLoading, ModalError } from '../components/BaseModal.jsx';
import { getAchievements, getCategoryIcon } from '../services/AchievementService.js';
import { logger } from '../services/LoggerService.js';
import styles from './AchievementsView.module.css';

const AchievementsView = ({ onClose }) => {
  const { t } = useTranslation('common');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAchievements = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getAchievements();
      setData(result);
    } catch (err) {
      logger.error('AchievementsView', 'load_error', 'Failed to load achievements', {
        error: err.toString(),
      });
      setError(t('achievements.loadError', 'Failed to load achievements'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const renderAchievementBadge = (achievement) => {
    const isAchieved = achievement.achieved_at != null;
    const progressPercent = achievement.threshold > 0
      ? Math.min(100, Math.round((achievement.current_value / achievement.threshold) * 100))
      : 0;

    return (
      <div
        key={achievement.id}
        className={`${styles.badge} ${isAchieved ? styles.achieved : styles.locked}`}
        title={`${achievement.name}\n${achievement.description}`}
      >
        <span className={styles.badgeIcon}>
          {isAchieved ? achievement.icon : '🔒'}
        </span>
        {isAchieved && (
          <span className={styles.checkmark}>✓</span>
        )}
        {!isAchieved && achievement.threshold > 1 && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
            <span className={styles.progressText}>{progressPercent}%</span>
          </div>
        )}
        <span className={styles.badgeName}>{achievement.name}</span>
      </div>
    );
  };

  const renderCategory = (category) => {
    const categoryIcon = getCategoryIcon(category.category);

    return (
      <div key={category.category} className={styles.category}>
        <div className={styles.categoryHeader}>
          <span className={styles.categoryIcon}>{categoryIcon}</span>
          <span className={styles.categoryName}>{category.name}</span>
          <span className={styles.categoryProgress}>
            {category.achieved}/{category.total}
          </span>
        </div>
        <div className={styles.badgeGrid}>
          {category.achievements.map(renderAchievementBadge)}
        </div>
      </div>
    );
  };

  return (
    <BaseModal
      title={
        <span className={styles.modalTitle}>
          🏆 {t('achievements.title', 'Achievements')}
          {data && (
            <span className={styles.totalProgress}>
              {data.achieved}/{data.total}
            </span>
          )}
        </span>
      }
      onClose={onClose}
    >
      {isLoading && <ModalLoading message={t('achievements.loading', 'Loading achievements...')} />}

      {error && <ModalError message={error} />}

      {!isLoading && !error && data && (
        <div className={styles.content}>
          {data.categories.map(renderCategory)}
        </div>
      )}
    </BaseModal>
  );
};

export default AchievementsView;
