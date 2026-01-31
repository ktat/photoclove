/**
 * OrganizationSection - Organization metrics display
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import styles from '../InsightsModal.module.css';

function OrganizationSection({ data }) {
    const { t } = useTranslation('insights');

    if (!data) return null;

    const stats = [
        { label: t('organization.totalPhotos', 'Total Photos'), value: data.total_photos, icon: '📷' },
        { label: t('organization.starredPhotos', 'Starred Photos'), value: data.starred_photos, icon: '⭐' },
        { label: t('organization.totalTags', 'Total Tags'), value: data.total_tags, icon: '🏷️' },
        { label: t('organization.totalAlbums', 'Total Albums'), value: data.total_albums, icon: '📚' },
        { label: t('organization.photosWithTags', 'Photos with Tags'), value: data.photos_with_tags, icon: '🔖' },
        { label: t('organization.photosInAlbums', 'Photos in Albums'), value: data.photos_in_albums, icon: '📁' },
    ];

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('organization.title', 'Library Overview')}</h3>
            <p className={styles.sectionDescription}>
                {t('organization.description', 'Summary of your photo library organization')}
            </p>

            <div className={styles.statsGrid}>
                {stats.map((stat, index) => (
                    <div key={index} className={styles.statCard}>
                        <span className={styles.statIcon}>{stat.icon}</span>
                        <span className={styles.statValue}>{(stat.value || 0).toLocaleString()}</span>
                        <span className={styles.statLabel}>{stat.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default OrganizationSection;
