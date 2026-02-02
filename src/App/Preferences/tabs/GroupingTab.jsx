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
        setGroupingProgress({ message: t('grouping.submittingJob'), progress: 0 });
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
                    {t('grouping.burstThresholdDescription')}
                </p>
                <div className={styles['setting-row']}>
                    <label>{t('grouping.minGroupSize')}:</label>
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
                    {t('grouping.minGroupSizeDescription')}
                </p>
            </div>

            {/* AI-Enhanced Burst Detection - only shown when AI Tagging is enabled */}
            {config.ai_tagging?.enabled && (
                <>
                    <h2 className={styles['section-title']}>🤖 {t('grouping.aiEnhancedDetection')}</h2>
                    <div className={styles['setting-group']}>
                        <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-3)' }}>
                            {t('grouping.aiEnhancedDescription')}
                        </p>
                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="ai-burst-enabled-check"
                                checked={config.grouping?.use_ai_tagging ?? false}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    grouping: { ...prev.grouping, use_ai_tagging: e.target.checked }
                                }))}
                            />
                            <label htmlFor="ai-burst-enabled-check">
                                {t('grouping.useAiTagging')}
                            </label>
                        </div>

                        {config.grouping?.use_ai_tagging && (
                            <div className={styles['setting-row']} style={{ marginTop: 'var(--space-3)' }}>
                                <label>{t('grouping.minMatchingTags')}:</label>
                                <select
                                    value={config.grouping?.min_matching_tags ?? 2}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        grouping: { ...prev.grouping, min_matching_tags: parseInt(e.target.value) }
                                    }))}
                                    style={{ width: '80px', marginLeft: 'var(--space-2)' }}
                                >
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                                <p className={styles['setting-description']} style={{ marginLeft: 'var(--space-2)', marginBottom: 0 }}>
                                    {t('grouping.minMatchingTagsDescription')}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            <h2 className={styles['section-title']}>🔄 {t('grouping.recalculateGroups')}</h2>
            <div className={styles['setting-group']}>
                <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-3)' }}>
                    {t('grouping.recalculateDescription')}
                </p>
                <button
                    className={styles['btn-secondary']}
                    disabled={isRecalculatingGroups}
                    onClick={handleRecalculate}
                >
                    {isRecalculatingGroups ? `⏳ ${t('grouping.recalculating')}` : `🔄 ${t('grouping.recalculateGroups')}`}
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
