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
import InsightsService, { PERIOD_TYPES, buildPeriodString } from "../services/InsightsService.js";
import ShootingTimeSection from "./Insights/ShootingTimeSection.jsx";
import CameraSettingsSection from "./Insights/CameraSettingsSection.jsx";
import EquipmentSection from "./Insights/EquipmentSection.jsx";
import OrganizationSection from "./Insights/OrganizationSection.jsx";
import StorageSection from "./Insights/StorageSection.jsx";
import ShareStatsDialog from "../components/ShareStatsDialog.jsx";
import styles from './InsightsModal.module.css';

function InsightsModal({ onClose }) {
    const { t } = useTranslation(['insights', 'common']);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState('shooting_time');
    const [cacheAge, setCacheAge] = useState(null);
    const [showShareDialog, setShowShareDialog] = useState(false);

    // Period selection state
    const [periodType, setPeriodType] = useState(PERIOD_TYPES.ALL);
    const [periodValue, setPeriodValue] = useState(null);
    const [weekYear, setWeekYear] = useState(null); // Year for weekly period
    const [availablePeriods, setAvailablePeriods] = useState(null);

    // Period type options
    const periodTypeOptions = [
        { value: PERIOD_TYPES.ALL, label: t('insights:periods.all', 'All Time') },
        { value: PERIOD_TYPES.YEARLY, label: t('insights:periods.yearly', 'Yearly') },
        { value: PERIOD_TYPES.MONTHLY, label: t('insights:periods.monthly', 'Monthly') },
        { value: PERIOD_TYPES.WEEKLY, label: t('insights:periods.weekly', 'Weekly') },
    ];

    // Build the full period string from type and value
    const buildCurrentPeriod = useCallback(() => {
        return buildPeriodString(periodType, periodValue);
    }, [periodType, periodValue]);

    // Load available periods on mount
    useEffect(() => {
        const loadAvailablePeriods = async () => {
            try {
                const periods = await InsightsService.getAvailablePeriods();

                // Convert weeks array to weeks_by_year object
                // weeks from Rust is an array of date strings like "2023-04-10"
                const weeksByYear = {};
                if (periods.weeks && Array.isArray(periods.weeks)) {
                    periods.weeks.forEach(week => {
                        const year = parseInt(week.substring(0, 4), 10);
                        if (!weeksByYear[year]) {
                            weeksByYear[year] = [];
                        }
                        weeksByYear[year].push(week);
                    });
                }
                periods.weeks_by_year = weeksByYear;

                setAvailablePeriods(periods);
                logger.info('InsightsModal', 'available_periods_loaded', 'Available periods loaded', {
                    years: periods.years?.length,
                    months: periods.months?.length,
                    weekYears: Object.keys(periods.weeks_by_year || {}).length
                });
            } catch (err) {
                logger.error('InsightsModal', 'available_periods_error', 'Failed to load available periods', { error: err });
            }
        };
        loadAvailablePeriods();
    }, []);

    // Load insights from cache or trigger refresh
    const loadInsights = useCallback(async (period) => {
        try {
            setLoading(true);
            setError(null);

            // First, try to get cached insights
            const cached = await InsightsService.getCachedInsights(period);

            if (cached) {
                setInsights(cached);
                // Get cache age
                const status = await InsightsService.getCacheStatus(period);
                setCacheAge(status.age_secs);
                logger.info('InsightsModal', 'load_from_cache', 'Loaded from cache', {
                    age_secs: status.age_secs,
                    period
                });
            } else {
                // No cache, trigger refresh
                logger.info('InsightsModal', 'no_cache', 'No cache found, triggering refresh', { period });
                await triggerRefresh(period);
            }
        } catch (err) {
            const errorMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err) || 'Failed to load insights');
            setError(errorMsg);
            logger.error('InsightsModal', 'load_error', 'Failed to load insights', { error: err, period });
        } finally {
            setLoading(false);
        }
    }, []);

    // Trigger background refresh
    const triggerRefresh = async (period) => {
        try {
            setRefreshing(true);
            setError(null);
            logger.info('InsightsModal', 'refresh_start', 'Queueing refresh job', { period });
            await InsightsService.queueRefresh(period);
            // Job will emit 'insights_updated' event when done
        } catch (err) {
            const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to queue refresh');
            setError(errorMsg);
            setRefreshing(false);
            logger.error('InsightsModal', 'refresh_error', 'Failed to queue refresh', { error: err, period });
        }
    };

    // Handle period type change
    const handlePeriodTypeChange = (newType) => {
        if (newType === periodType || refreshing) return;
        logger.info('InsightsModal', 'period_type_change', 'Changing period type', { from: periodType, to: newType });
        setPeriodType(newType);

        // Set default value for the new type
        let newValue = null;
        if (newType === PERIOD_TYPES.YEARLY && availablePeriods?.years?.length > 0) {
            newValue = availablePeriods.years[0]; // Most recent year
        } else if (newType === PERIOD_TYPES.MONTHLY && availablePeriods?.months?.length > 0) {
            newValue = availablePeriods.months[0]; // Most recent month
        } else if (newType === PERIOD_TYPES.WEEKLY && availablePeriods?.weeks_by_year) {
            // For weekly, set year first, then get first week of that year
            const years = Object.keys(availablePeriods.weeks_by_year).map(Number).sort((a, b) => b - a);
            if (years.length > 0) {
                const firstYear = years[0];
                setWeekYear(firstYear);
                const weeksOfYear = availablePeriods.weeks_by_year[firstYear] || [];
                newValue = weeksOfYear[0] || null;
            }
        }
        setPeriodValue(newValue);

        // Load insights with new period
        const newPeriod = buildPeriodString(newType, newValue);
        loadInsights(newPeriod);
    };

    // Handle period value change
    const handlePeriodValueChange = (newValue) => {
        if (newValue === periodValue || refreshing) return;
        logger.info('InsightsModal', 'period_value_change', 'Changing period value', { from: periodValue, to: newValue });
        setPeriodValue(newValue);

        // Load insights with new period
        const newPeriod = buildPeriodString(periodType, newValue);
        loadInsights(newPeriod);
    };

    // Handle week year change (for weekly period)
    const handleWeekYearChange = (newYear) => {
        const yearNum = Number(newYear);
        if (yearNum === weekYear || refreshing) return;
        logger.info('InsightsModal', 'week_year_change', 'Changing week year', { from: weekYear, to: yearNum });
        setWeekYear(yearNum);

        // Set first week of the new year as default
        const weeksOfYear = availablePeriods?.weeks_by_year?.[yearNum] || [];
        const newValue = weeksOfYear[0] || null;
        setPeriodValue(newValue);

        // Load insights with new period
        const newPeriod = buildPeriodString(PERIOD_TYPES.WEEKLY, newValue);
        loadInsights(newPeriod);
    };

    // Handle refresh button click
    const handleRefresh = async () => {
        if (refreshing) return;
        const currentPeriod = buildCurrentPeriod();
        await triggerRefresh(currentPeriod);
    };

    // Listen for insights_updated event
    useEffect(() => {
        let unlisten;
        const currentPeriod = buildCurrentPeriod();

        const setupListener = async () => {
            unlisten = await InsightsService.onInsightsUpdated(async (payload) => {
                const updatedPeriod = payload?.period || 'all';
                logger.info('InsightsModal', 'insights_updated', 'Received update event', {
                    updatedPeriod,
                    currentPeriod
                });

                // Only update if the period matches
                if (updatedPeriod === currentPeriod) {
                    // Reload from cache
                    try {
                        const cached = await InsightsService.getCachedInsights(currentPeriod);
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
                }
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [buildCurrentPeriod]);

    // Initial load
    useEffect(() => {
        loadInsights(buildCurrentPeriod());
    }, []);

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

    // Format week display label
    const formatWeekLabel = (weekStart) => {
        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
    };

    // Format month display label
    // monthData can be either [year, month] array (from Rust tuple) or "YYYY-MM" string
    const formatMonthLabel = (monthData) => {
        let year, month;
        if (Array.isArray(monthData)) {
            [year, month] = monthData;
        } else {
            [year, month] = monthData.split('-').map(Number);
        }
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    };

    // Convert month data to string value for select
    const monthToValue = (monthData) => {
        if (Array.isArray(monthData)) {
            return `${monthData[0]}-${String(monthData[1]).padStart(2, '0')}`;
        }
        return monthData;
    };

    // Render value selector based on period type
    const renderValueSelector = () => {
        if (periodType === PERIOD_TYPES.ALL) {
            return null;
        }

        if (periodType === PERIOD_TYPES.YEARLY) {
            const options = availablePeriods?.years || [];
            if (options.length === 0) {
                return <span className={styles.noDataMessage}>{t('insights:periods.noData', 'No data available')}</span>;
            }
            return (
                <select
                    className={styles.periodValueSelect}
                    value={periodValue || ''}
                    onChange={(e) => handlePeriodValueChange(e.target.value)}
                    disabled={refreshing || loading}
                >
                    {options.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            );
        }

        if (periodType === PERIOD_TYPES.MONTHLY) {
            const options = availablePeriods?.months || [];
            if (options.length === 0) {
                return <span className={styles.noDataMessage}>{t('insights:periods.noData', 'No data available')}</span>;
            }
            return (
                <select
                    className={styles.periodValueSelect}
                    value={periodValue || ''}
                    onChange={(e) => handlePeriodValueChange(e.target.value)}
                    disabled={refreshing || loading}
                >
                    {options.map(option => {
                        const value = monthToValue(option);
                        return (
                            <option key={value} value={value}>{formatMonthLabel(option)}</option>
                        );
                    })}
                </select>
            );
        }

        if (periodType === PERIOD_TYPES.WEEKLY) {
            const weeksByYear = availablePeriods?.weeks_by_year || {};
            const years = Object.keys(weeksByYear).map(Number).sort((a, b) => b - a);

            if (years.length === 0) {
                return <span className={styles.noDataMessage}>{t('insights:periods.noData', 'No data available')}</span>;
            }

            const weeksOfSelectedYear = weeksByYear[weekYear] || [];

            return (
                <>
                    <select
                        className={styles.periodValueSelect}
                        value={weekYear || ''}
                        onChange={(e) => handleWeekYearChange(e.target.value)}
                        disabled={refreshing || loading}
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <select
                        className={styles.periodValueSelect}
                        value={periodValue || ''}
                        onChange={(e) => handlePeriodValueChange(e.target.value)}
                        disabled={refreshing || loading || weeksOfSelectedYear.length === 0}
                    >
                        {weeksOfSelectedYear.map(week => (
                            <option key={week} value={week}>{formatWeekLabel(week)}</option>
                        ))}
                    </select>
                </>
            );
        }

        return null;
    };

    const periodSelector = (
        <div className={styles.periodSelector}>
            <span className={styles.periodLabel}>{t('insights:periods.label', 'Period:')}</span>
            <div className={styles.periodControls}>
                <div className={styles.periodButtons}>
                    {periodTypeOptions.map(option => (
                        <button
                            key={option.value}
                            className={`${styles.periodBtn} ${periodType === option.value ? styles.active : ''}`}
                            onClick={() => handlePeriodTypeChange(option.value)}
                            disabled={refreshing || loading}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {renderValueSelector()}
            </div>
        </div>
    );

    const tabs = (
        <>
            {periodSelector}
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
        </>
    );

    const footerContent = (
        <div className={styles.footerActions}>
            <div className={styles.footerLeft}>
                <button
                    onClick={() => setShowShareDialog(true)}
                    disabled={!insights}
                    className={styles.shareBtn}
                    title={t('insights:share.title', 'Share Stats')}
                >
                    📤 {t('insights:share.button', 'Share')}
                </button>
            </div>
            <div className={styles.footerRight}>
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
        </div>
    );

    return (
        <>
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
            {showShareDialog && (
                <ShareStatsDialog
                    insights={insights}
                    period={buildCurrentPeriod()}
                    onClose={() => setShowShareDialog(false)}
                />
            )}
        </>
    );
}

export default InsightsModal;
