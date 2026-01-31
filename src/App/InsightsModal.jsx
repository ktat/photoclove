/**
 * InsightsModal - Photography Insights Dashboard
 *
 * Displays aggregated statistics about the photo library including:
 * - Shooting time patterns
 * - Camera settings distribution
 * - Equipment usage
 * - Organization metrics
 * - Storage usage
 *
 * Uses background job queue for calculation and caching for fast display.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import BaseModal, { ModalLoading, ModalError } from "../components/BaseModal.jsx";
import { logger } from "../services/LoggerService.js";
import InsightsService from "../services/InsightsService.js";
import ShootingTimeSection from "./Insights/ShootingTimeSection.jsx";
import CameraSettingsSection from "./Insights/CameraSettingsSection.jsx";
import EquipmentSection from "./Insights/EquipmentSection.jsx";
import OrganizationSection from "./Insights/OrganizationSection.jsx";
import StorageSection from "./Insights/StorageSection.jsx";
import styles from './InsightsModal.module.css';

function InsightsModal({ onClose }) {
    const { t } = useTranslation(['insights', 'common']);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState('shooting_time');
    const [cacheAge, setCacheAge] = useState(null);

    // Load insights from cache or trigger refresh
    const loadInsights = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // First, try to get cached insights
            const cached = await InsightsService.getCachedInsights();

            if (cached) {
                setInsights(cached);
                // Get cache age
                const status = await InsightsService.getCacheStatus();
                setCacheAge(status.age_secs);
                logger.info('InsightsModal', 'load_from_cache', 'Loaded from cache', {
                    age_secs: status.age_secs
                });
            } else {
                // No cache, trigger refresh
                logger.info('InsightsModal', 'no_cache', 'No cache found, triggering refresh');
                await triggerRefresh();
            }
        } catch (err) {
            const errorMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err) || 'Failed to load insights');
            setError(errorMsg);
            logger.error('InsightsModal', 'load_error', 'Failed to load insights', { error: err });
        } finally {
            setLoading(false);
        }
    }, []);

    // Trigger background refresh
    const triggerRefresh = async () => {
        try {
            setRefreshing(true);
            setError(null);
            logger.info('InsightsModal', 'refresh_start', 'Queueing refresh job');
            await InsightsService.queueRefresh();
            // Job will emit 'insights_updated' event when done
        } catch (err) {
            const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to queue refresh');
            setError(errorMsg);
            setRefreshing(false);
            logger.error('InsightsModal', 'refresh_error', 'Failed to queue refresh', { error: err });
        }
    };

    // Handle refresh button click
    const handleRefresh = async () => {
        if (refreshing) return;
        await triggerRefresh();
    };

    // Listen for insights_updated event
    useEffect(() => {
        let unlisten;

        const setupListener = async () => {
            unlisten = await InsightsService.onInsightsUpdated(async () => {
                logger.info('InsightsModal', 'insights_updated', 'Received update event');
                // Reload from cache
                try {
                    const cached = await InsightsService.getCachedInsights();
                    if (cached) {
                        setInsights(cached);
                        setCacheAge(0); // Just updated
                    }
                } catch (err) {
                    logger.error('InsightsModal', 'reload_error', 'Failed to reload after update', { error: err });
                } finally {
                    setRefreshing(false);
                    setLoading(false);
                }
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Initial load
    useEffect(() => {
        loadInsights();
    }, [loadInsights]);

    const sections = [
        { id: 'shooting_time', label: t('insights:sections.shootingTime', 'Shooting Time'), icon: '📅' },
        { id: 'camera_settings', label: t('insights:sections.cameraSettings', 'Camera Settings'), icon: '📷' },
        { id: 'equipment', label: t('insights:sections.equipment', 'Equipment'), icon: '🔧' },
        { id: 'organization', label: t('insights:sections.organization', 'Organization'), icon: '📊' },
        { id: 'storage', label: t('insights:sections.storage', 'Storage'), icon: '💾' },
    ];

    const renderSection = () => {
        if (!insights) return null;

        switch (activeSection) {
            case 'shooting_time':
                return <ShootingTimeSection data={insights.shooting_time} />;
            case 'camera_settings':
                return <CameraSettingsSection data={insights.camera_settings} />;
            case 'equipment':
                return <EquipmentSection data={insights.equipment} />;
            case 'organization':
                return <OrganizationSection data={insights.organization} />;
            case 'storage':
                return <StorageSection data={insights.storage} />;
            default:
                return null;
        }
    };

    const tabs = (
        <div className={styles.tabs}>
            {sections.map(section => (
                <button
                    key={section.id}
                    className={`${styles.tab} ${activeSection === section.id ? styles.active : ''}`}
                    onClick={() => setActiveSection(section.id)}
                >
                    <span className={styles.tabIcon}>{section.icon}</span>
                    <span className={styles.tabLabel}>{section.label}</span>
                </button>
            ))}
        </div>
    );

    const footerContent = (
        <div className={styles.footerActions}>
            {cacheAge !== null && (
                <span className={styles.cacheAge}>
                    {InsightsService.formatAge(cacheAge)}
                </span>
            )}
            <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={styles.refreshBtn}
            >
                {refreshing ? t('common:status.processing', 'Processing...') : t('common:button.refresh', 'Refresh')}
            </button>
            <button onClick={onClose} className={styles.closeBtn}>
                {t('common:button.close', 'Close')}
            </button>
        </div>
    );

    return (
        <BaseModal
            title={t('insights:title', 'Photography Insights')}
            onClose={onClose}
            tabs={tabs}
            footer={footerContent}
        >
            {loading && !insights ? (
                <ModalLoading message={refreshing ? t('common:status.processing', 'Processing...') : t('insights:loading', 'Loading insights...')} />
            ) : error && !insights ? (
                <ModalError message={error} />
            ) : (
                <div className={styles.content}>
                    {refreshing && (
                        <div className={styles.refreshingOverlay}>
                            <span>{t('common:status.processing', 'Processing...')}</span>
                        </div>
                    )}
                    {renderSection()}
                </div>
            )}
        </BaseModal>
    );
}

export default InsightsModal;
