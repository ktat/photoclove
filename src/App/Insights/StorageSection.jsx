/**
 * StorageSection - Storage usage display
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import InsightsService from '../../services/InsightsService.js';
import styles from '../InsightsModal.module.css';

function StorageSection({ data }) {
    const { t } = useTranslation('insights');

    if (!data) return null;

    const storageItems = [
        {
            label: t('storage.totalSize', 'Photo Library Size'),
            value: InsightsService.formatBytes(data.total_size_bytes || 0),
            icon: '📁'
        },
        {
            label: t('storage.thumbnailSize', 'Thumbnail Cache'),
            value: InsightsService.formatBytes(data.thumbnail_size_bytes || 0),
            icon: '🖼️'
        },
        {
            label: t('storage.faceThumbnailSize', 'Face Thumbnails'),
            value: InsightsService.formatBytes(data.face_thumbnail_size_bytes || 0),
            icon: '👤'
        },
    ];

    const totalCache = (data.thumbnail_size_bytes || 0) + (data.face_thumbnail_size_bytes || 0);

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('storage.title', 'Storage Usage')}</h3>
            <p className={styles.sectionDescription}>
                {t('storage.description', 'Disk space used by your photo library and caches')}
            </p>

            <div className={styles.chartContainer}>
                {storageItems.map((item, index) => (
                    <div key={index} className={styles.storageItem}>
                        <span className={styles.storageLabel}>
                            <span style={{ marginRight: 'var(--space-2)' }}>{item.icon}</span>
                            {item.label}
                        </span>
                        <span className={styles.storageValue}>{item.value}</span>
                    </div>
                ))}

                <div className={styles.storageItem} style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)', paddingTop: 'var(--space-3)' }}>
                    <span className={styles.storageLabel}>
                        <span style={{ marginRight: 'var(--space-2)' }}>💾</span>
                        {t('storage.totalCache', 'Total Cache')}
                    </span>
                    <span className={styles.storageValue}>{InsightsService.formatBytes(totalCache)}</span>
                </div>
            </div>
        </div>
    );
}

export default StorageSection;
