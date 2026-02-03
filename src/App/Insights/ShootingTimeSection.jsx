/**
 * ShootingTimeSection - Hour and day of week distribution charts
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import styles from '../InsightsModal.module.css';

function ShootingTimeSection({ data }) {
    const { t } = useTranslation('insights');

    if (!data) return null;

    const { by_hour, by_day_of_week } = data;

    // Fill in missing hours (0-23)
    const hourData = Array.from({ length: 24 }, (_, i) => {
        const found = by_hour?.find(h => h.hour === i);
        return { hour: i, count: found?.count || 0, label: `${i}:00` };
    });

    // Day names localized
    const dayNames = [
        t('days.sun', 'Sun'),
        t('days.mon', 'Mon'),
        t('days.tue', 'Tue'),
        t('days.wed', 'Wed'),
        t('days.thu', 'Thu'),
        t('days.fri', 'Fri'),
        t('days.sat', 'Sat')
    ];

    // Fill in missing days (0-6)
    const dayData = Array.from({ length: 7 }, (_, i) => {
        const found = by_day_of_week?.find(d => d.day === i);
        return {
            day: i,
            day_name: dayNames[i],
            count: found?.count || 0
        };
    });

    // Find peak hour and day
    const peakHour = hourData.reduce((max, h) => h.count > max.count ? h : max, { count: 0 });
    const peakDay = dayData.reduce((max, d) => d.count > max.count ? d : max, { count: 0 });

    // Color intensity based on count
    const maxHourCount = Math.max(...hourData.map(h => h.count), 1);
    const getHourBarColor = (count) => {
        const intensity = count / maxHourCount;
        return `rgba(74, 158, 255, ${0.3 + intensity * 0.7})`;
    };

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

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('shootingTime.title', 'Shooting Time Patterns')}</h3>
            <p className={styles.sectionDescription}>
                {t('shootingTime.description', 'When you take most of your photos')}
            </p>

            {/* Hour of Day Chart */}
            <div className={styles.chartContainer}>
                <h4 className={styles.chartTitle}>
                    🕐 {t('shootingTime.hourTitle', 'Time of Day')}
                    {peakHour.count > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                            ({t('shootingTime.peak', 'Peak')}: {peakHour.hour}:00)
                        </span>
                    )}
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={hourData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                        <XAxis
                            dataKey="hour"
                            stroke="var(--color-text-muted)"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(h) => h % 4 === 0 ? `${h}` : ''}
                        />
                        <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name={t('photos', 'Photos')}>
                            {hourData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getHourBarColor(entry.count)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Day of Week Chart */}
            <div className={styles.chartContainer}>
                <h4 className={styles.chartTitle}>
                    📅 {t('shootingTime.dayTitle', 'Day of Week')}
                    {peakDay.count > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                            ({t('shootingTime.peak', 'Peak')}: {peakDay.day_name})
                        </span>
                    )}
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dayData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                        <XAxis
                            dataKey="day_name"
                            stroke="var(--color-text-muted)"
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="var(--color-primary)" name={t('photos', 'Photos')} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default ShootingTimeSection;
