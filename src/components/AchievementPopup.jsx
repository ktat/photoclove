/**
 * Achievement Popup Component
 *
 * Displays a celebratory popup when an achievement is unlocked.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AchievementPopup.module.css';

const AchievementPopup = ({ achievement, onClose }) => {
  const { t } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for exit animation
  };

  if (!achievement) return null;

  return (
    <div data-testid="achievement-popup" className={`${styles.overlay} ${isVisible ? styles.visible : ''}`} onClick={handleClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confetti}>
          <span className={styles.confettiItem}>🎉</span>
          <span className={styles.confettiItem}>🎊</span>
        </div>

        <div className={styles.content}>
          <div className={styles.header}>
            {t('achievements.congratulations', 'Congratulations!')}
          </div>

          <div className={styles.iconWrapper}>
            <span className={styles.icon}>{achievement.icon}</span>
          </div>

          <div className={styles.name}>{achievement.name}</div>

          <div className={styles.description}>{achievement.description}</div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={handleClose}>
            {t('button.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AchievementPopup;
