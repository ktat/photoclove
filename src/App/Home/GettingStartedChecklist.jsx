import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUI } from '../../context/UIContext.jsx';
import { getAchievements } from '../../services/AchievementService.js';
import { logger } from '../../services/LoggerService.js';
import styles from './GettingStartedChecklist.module.css';

const STORAGE_KEY = 'photoclove_getting_started_dismissed';

/**
 * Getting Started checklist for new users
 * Shows progress through 5 key steps to help users discover main features
 */
function GettingStartedChecklist({ config }) {
    const { t } = useTranslation('common');
    const { useCount, togglePreferences, toggleSearchPage, toggleImporter, openTagsList } = useUI();
    const [achievements, setAchievements] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    });

    // Load achievements on mount and periodically
    const loadAchievements = useCallback(async () => {
        try {
            const result = await getAchievements();
            setAchievements(result);
            logger.debug('GettingStartedChecklist', 'load_achievements', 'Achievements loaded', {
                total: result.total,
                achieved: result.achieved
            });
        } catch (error) {
            logger.error('GettingStartedChecklist', 'load_error', 'Failed to load achievements', {
                error: error.message
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAchievements();
        // Refresh achievements every 5 seconds to catch updates
        const interval = setInterval(loadAchievements, 5000);
        return () => clearInterval(interval);
    }, [loadAchievements]);

    // Calculate step completion status
    const getStepStatus = useCallback(() => {
        if (!achievements) return [];

        // Extract all achievements from categories and find achieved ones
        const allAchievements = achievements.categories?.flatMap(cat => cat.achievements) || [];
        const achievedIds = new Set(
            allAchievements
                .filter(a => a.achieved_at != null)
                .map(a => a.id)
        );

        return [
            {
                id: 'setup',
                label: t('gettingStarted.setupFolder', 'Set up your photo folder'),
                completed: useCount >= 1,
                action: () => togglePreferences(true)
            },
            {
                id: 'import',
                label: t('gettingStarted.importPhotos', 'Import your first photos'),
                completed: achievedIds.has('first_import'),
                action: () => toggleImporter(true)
            },
            {
                id: 'view',
                label: t('gettingStarted.browsePhotos', 'View a photo in detail'),
                completed: achievedIds.has('first_view'),
                action: null // User needs to click a photo
            },
            {
                id: 'tag',
                label: t('gettingStarted.addTag', 'Add a tag to a photo'),
                completed: achievedIds.has('first_tag'),
                action: () => openTagsList()
            },
            {
                id: 'search',
                label: t('gettingStarted.trySearch', 'Try searching for photos'),
                completed: achievedIds.has('first_search'),
                action: () => toggleSearchPage(true, '', true)
            }
        ];
    }, [achievements, useCount, t, togglePreferences, toggleSearchPage, toggleImporter, openTagsList]);

    const steps = getStepStatus();
    const completedCount = steps.filter(s => s.completed).length;
    const allComplete = completedCount === steps.length;

    // Handle dismiss
    const handleDismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setDismissed(true);
        logger.info('GettingStartedChecklist', 'dismissed', 'User dismissed getting started checklist');
    }, []);

    // Handle step click
    const handleStepClick = useCallback((step) => {
        if (!step.completed && step.action) {
            logger.info('GettingStartedChecklist', 'step_clicked', 'User clicked incomplete step', {
                stepId: step.id
            });
            step.action();
        }
    }, []);

    // Don't render if dismissed and all complete
    if (dismissed && allComplete) {
        return null;
    }

    // Don't render while loading
    if (loading) {
        return null;
    }

    // All complete view
    if (allComplete) {
        return (
            <div className={styles.container}>
                <div className={styles.completeContainer}>
                    <span className={styles.completeIcon}>🎉</span>
                    <span className={styles.completeText}>
                        {t('gettingStarted.complete', "All set! You've completed the basics.")}
                    </span>
                    <button
                        className={styles.dismissButton}
                        onClick={handleDismiss}
                    >
                        {t('gettingStarted.dismiss', 'Dismiss')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.headerIcon}>🎯</span>
                <span className={styles.headerTitle}>
                    {t('gettingStarted.title', 'Getting Started')}
                </span>
                <span className={styles.progress}>
                    {completedCount}/{steps.length}
                </span>
            </div>
            <div className={styles.stepsList}>
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className={`${styles.step} ${step.completed ? styles.completed : ''} ${!step.completed && step.action ? styles.clickable : ''}`}
                        onClick={() => handleStepClick(step)}
                    >
                        <span className={styles.stepIcon}>
                            {step.completed ? '✅' : '⬜'}
                        </span>
                        <span className={styles.stepLabel}>
                            {step.label}
                        </span>
                        {!step.completed && step.action && (
                            <span className={styles.stepArrow}>→</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GettingStartedChecklist;
