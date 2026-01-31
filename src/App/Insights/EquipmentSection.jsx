/**
 * EquipmentSection - Camera and lens usage statistics
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import styles from '../InsightsModal.module.css';

function EquipmentSection({ data }) {
    const { t } = useTranslation('insights');

    if (!data) return null;

    const { cameras, lenses } = data;

    const renderEquipmentList = (items, emptyMessage) => {
        if (!items || items.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📷</div>
                    <div className={styles.emptyMessage}>{emptyMessage}</div>
                </div>
            );
        }

        return (
            <div className={styles.equipmentList}>
                {items.map((item, index) => (
                    <div key={index} className={styles.equipmentItem}>
                        <span className={styles.equipmentRank}>{index + 1}</span>
                        <div className={styles.equipmentInfo}>
                            <div className={styles.equipmentModel}>{item.model}</div>
                            {item.make && (
                                <div className={styles.equipmentMake}>{item.make}</div>
                            )}
                        </div>
                        <span className={styles.equipmentCount}>
                            {item.count.toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('equipment.title', 'Your Equipment')}</h3>
            <p className={styles.sectionDescription}>
                {t('equipment.description', 'Cameras and lenses you use most frequently')}
            </p>

            <div className={styles.twoColumns}>
                <div className={styles.chartContainer}>
                    <h4 className={styles.chartTitle}>
                        📷 {t('equipment.cameras', 'Cameras')}
                    </h4>
                    {renderEquipmentList(
                        cameras,
                        t('equipment.noCameras', 'No camera data available')
                    )}
                </div>

                <div className={styles.chartContainer}>
                    <h4 className={styles.chartTitle}>
                        🔭 {t('equipment.lenses', 'Lenses')}
                    </h4>
                    {renderEquipmentList(
                        lenses,
                        t('equipment.noLenses', 'No lens data available')
                    )}
                </div>
            </div>
        </div>
    );
}

export default EquipmentSection;
