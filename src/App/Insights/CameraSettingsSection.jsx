/**
 * CameraSettingsSection - Camera settings distribution charts
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from '../InsightsModal.module.css';

function CameraSettingsSection({ data }) {
    const { t } = useTranslation('insights');

    if (!data) return null;

    const { iso_distribution, aperture_distribution, shutter_speed_distribution, focal_length_distribution } = data;

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ color: 'var(--color-primary)' }}>
                        {payload[0].value.toLocaleString()} {t('photos', 'photos')}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Render a distribution chart
    const renderDistributionChart = (title, icon, data, labelFormatter = (v) => v) => {
        const chartData = (data || []).slice(0, 15).map(item => ({
            value: labelFormatter(item.value),
            count: item.count
        }));

        if (chartData.length === 0) {
            return (
                <div className={styles.chartContainer}>
                    <h4 className={styles.chartTitle}>{icon} {title}</h4>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyMessage}>{t('noData', 'No data available')}</div>
                    </div>
                </div>
            );
        }

        // Find the most common value
        const topValue = chartData.reduce((max, item) => item.count > max.count ? item : max, { count: 0 });

        return (
            <div className={styles.chartContainer}>
                <h4 className={styles.chartTitle}>
                    {icon} {title}
                    {topValue.count > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                            ({t('mostUsed', 'Most used')}: {topValue.value})
                        </span>
                    )}
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                        <XAxis
                            dataKey="value"
                            stroke="var(--color-text-muted)"
                            tick={{ fontSize: 9 }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                        />
                        <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="var(--color-primary)" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Format aperture value (e.g., "2.8" -> "f/2.8")
    const formatAperture = (value) => {
        if (!value) return value;
        return value.startsWith('f/') ? value : `f/${value}`;
    };

    // Format focal length (e.g., "35" -> "35mm")
    const formatFocalLength = (value) => {
        if (!value) return value;
        return value.endsWith('mm') ? value : `${value}mm`;
    };

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('cameraSettings.title', 'Camera Settings')}</h3>
            <p className={styles.sectionDescription}>
                {t('cameraSettings.description', 'Your most frequently used camera settings')}
            </p>

            <div className={styles.twoColumns}>
                {renderDistributionChart(
                    t('cameraSettings.iso', 'ISO'),
                    '🔆',
                    iso_distribution
                )}
                {renderDistributionChart(
                    t('cameraSettings.aperture', 'Aperture'),
                    '📸',
                    aperture_distribution,
                    formatAperture
                )}
            </div>

            <div className={styles.twoColumns}>
                {renderDistributionChart(
                    t('cameraSettings.shutterSpeed', 'Shutter Speed'),
                    '⚡',
                    shutter_speed_distribution
                )}
                {renderDistributionChart(
                    t('cameraSettings.focalLength', 'Focal Length'),
                    '🔭',
                    focal_length_distribution,
                    formatFocalLength
                )}
            </div>
        </div>
    );
}

export default CameraSettingsSection;
