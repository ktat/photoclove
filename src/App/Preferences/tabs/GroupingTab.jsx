import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../services/LoggerService.js';
import styles from '../Preferences.module.css';

const GroupingTab = ({
    config,
    setConfig,
    isRecalculatingGroups,
    setIsRecalculatingGroups,
    groupingProgress,
    setGroupingProgress,
    addFooterMessage
}) => {
    const { t } = useTranslation('preferences');

    const handleRecalculate = async () => {
        setIsRecalculatingGroups(true);
        setGroupingProgress({ message: 'Submitting job...', progress: 0 });
        try {
            const jobUnitId = await invoke('recalculate_grouping', {
                thresholdSeconds: config.grouping?.burst_threshold_seconds ?? 2,
                minGroupSize: config.grouping?.min_group_size ?? 2
            });
            addFooterMessage("grouping", `Recalculation started (Job: ${jobUnitId.substring(0, 8)}...)`);
            logger.info('Preferences', 'recalculate_groups_submitted', 'Grouping job submitted', { jobUnitId });
        } catch (error) {
            logger.error('Preferences', 'recalculate_groups_failed', 'Failed to submit grouping job', { error: error.message || error });
            addFooterMessage("grouping", `Error: ${error}`);
            setIsRecalculatingGroups(false);
            setGroupingProgress({ message: '', progress: 0 });
        }
    };

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('grouping.burstDetection')}</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                {t('grouping.burstThresholdDescription')}
            </p>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="grouping-enabled-check"
                        checked={config.grouping?.enabled ?? true}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            grouping: { ...prev.grouping, enabled: e.target.checked }
                        }))}
                    />
                    <label htmlFor="grouping-enabled-check">
                        {t('grouping.burstDetection')}
                    </label>
                </div>
            </div>

            <h2 className={styles['section-title']}>{t('grouping.burstThreshold')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>{t('grouping.burstThreshold')}:</label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={config.grouping?.burst_threshold_seconds ?? 2}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            grouping: { ...prev.grouping, burst_threshold_seconds: parseInt(e.target.value) || 2 }
                        }))}
                    />
                </div>
                <p className={styles['setting-description']}>
                    Photos taken within this time interval are considered as burst shots.
                </p>
                <div className={styles['setting-row']}>
                    <label>Minimum Group Size:</label>
                    <input
                        type="number"
                        min="2"
                        max="10"
                        value={config.grouping?.min_group_size ?? 2}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            grouping: { ...prev.grouping, min_group_size: parseInt(e.target.value) || 2 }
                        }))}
                    />
                </div>
                <p className={styles['setting-description']}>
                    Minimum number of photos required to form a group.
                </p>
            </div>

            <h2 className={styles['section-title']}>🔄 Recalculate Groups</h2>
            <div className={styles['setting-group']}>
                <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-3)' }}>
                    After changing threshold settings, recalculate groups to apply new values. Manual groups will be preserved.
                </p>
                <button
                    className={styles['btn-secondary']}
                    disabled={isRecalculatingGroups}
                    onClick={handleRecalculate}
                >
                    {isRecalculatingGroups ? '⏳ Recalculating...' : '🔄 Recalculate Groups'}
                </button>
                {isRecalculatingGroups && groupingProgress.message && (
                    <div className={styles['progress-container']} style={{ marginTop: 'var(--space-3)' }}>
                        <div className={styles['progress-bar']}>
                            <div
                                className={styles['progress-fill']}
                                style={{ width: `${groupingProgress.progress}%` }}
                            />
                        </div>
                        <p className={styles['progress-message']}>{groupingProgress.message}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupingTab;
