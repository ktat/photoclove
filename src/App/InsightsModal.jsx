/**
 * InsightsModal - Photography Insights Dashboard
 *
 * Displays aggregated statistics about the photo library including:
 * - Shooting time patterns
 * - Camera settings distribution
 * - Equipment usage
 * - Organization metrics
 * - Storage usage
 */

import React, { useState, useEffect } from "react";
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
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState('shooting_time');

    useEffect(() => {
        loadInsights();
    }, []);

    const loadInsights = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await InsightsService.getInsights();
            setInsights(data);
            logger.info('InsightsModal', 'load_complete', 'Insights loaded successfully');
        } catch (err) {
            // Tauri errors may be strings or objects
            const errorMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err) || 'Failed to load insights');
            setError(errorMsg);
            logger.error('InsightsModal', 'load_error', 'Failed to load insights', { error: err });
        } finally {
            setLoading(false);
        }
    };

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
            <button
                onClick={loadInsights}
                disabled={loading}
                className={styles.refreshBtn}
            >
                {loading ? t('common:status.loading', 'Loading...') : t('common:button.refresh', 'Refresh')}
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
            {loading ? (
                <ModalLoading message={t('insights:loading', 'Loading insights...')} />
            ) : error ? (
                <ModalError message={error} />
            ) : (
                <div className={styles.content}>
                    {renderSection()}
                </div>
            )}
        </BaseModal>
    );
}

export default InsightsModal;
