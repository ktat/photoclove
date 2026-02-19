import { useEffect, useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import Scrollable from "../Scrollable.jsx";
import '../scrollable.css';
import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { logger } from "../services/LoggerService.js";

function DateList(props) {
    const { t } = useTranslation('common');
    const {
        dateList,
        datePage,
        dateNum,
        hideLoading,
        currentDate,
        updateCurrentDate,
        recentPhotosMode,
        updateRecentPhotosMode
    } = usePhoto();

    const { showDatePhotos, showRecentPhotos, viewMode: currentAppViewMode } = useUI();

    const [selectedStyle, setSelectedStyle] = useState({});

    // Show loading bar: either during initial load (!hideLoading) or when refresh clicked (isRefreshing)
    const [isRefreshing, setIsRefreshing] = useState(false);
    const showLoading = !hideLoading || derivedIsRefreshing;

    // Reset isRefreshing when loading completes - use derived state instead of effect
    const derivedIsRefreshing = isRefreshing && !hideLoading;

    // Sync selectedStyle with currentDate from context (e.g., when navigating from memories)
    // Use useMemo to derive style instead of effect to avoid cascading renders
    const derivedSelectedStyle = useMemo(() => {
        if (currentDate) {
            // Parse date string (handles both "2018-01-31" and "2018/01/31" formats)
            const normalizedDate = currentDate.replace(/-/g, '/');
            const dateParts = normalizedDate.split('/');
            if (dateParts.length === 3) {
                const [year, month, day] = dateParts;
                // Create the same format used by DateList for keys
                const dateKey = new Date(year + '/' + month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                return { ["a-" + dateKey]: "var(--color-text-primary)", ["li-" + dateKey]: "square" };
            }
        }
        return {};
    }, [currentDate]);

    // Merge manually set selectedStyle with derived style
    const finalSelectedStyle = { ...derivedSelectedStyle, ...selectedStyle };

    // Get selected date color based on current ViewMode
    // White when viewing date photos, muted when viewing other modes
    const getSelectedDateColor = () => {
        return currentAppViewMode === 'date' ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
    };
    
    // Filter and view mode state
    const [filterYear, setFilterYear] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');
    const [viewMode, setViewMode] = useState('flat'); // 'flat' or 'hierarchical'
    
    // Collapse/expand state for hierarchical view
    const [expandedYears, setExpandedYears] = useState(new Set());
    const [expandedMonths, setExpandedMonths] = useState(new Set());

    useEffect(() => {
        props.getDates();
    }, [])

    // Get available years and months for filter dropdowns
    const availableYears = useMemo(() => {
        const years = [...new Set(dateList.map(d => d.year))].sort((a, b) => b - a);
        return years;
    }, [dateList]);

    const availableMonths = useMemo(() => {
        if (filterYear === 'all') {
            return [...new Set(dateList.map(d => d.month))].sort((a, b) => a - b);
        }
        return [...new Set(dateList.filter(d => d.year === parseInt(filterYear)).map(d => d.month))].sort((a, b) => a - b);
    }, [dateList, filterYear]);

    // Filter dates based on selected year and month
    const filteredDateList = useMemo(() => {
        let filtered = dateList;
        
        if (filterYear !== 'all') {
            filtered = filtered.filter(d => d.year === parseInt(filterYear));
        }
        
        if (filterMonth !== 'all') {
            filtered = filtered.filter(d => d.month === parseInt(filterMonth));
        }
        
        return filtered;
    }, [dateList, filterYear, filterMonth]);

    // Group dates hierarchically for hierarchical view
    const hierarchicalData = useMemo(() => {
        const grouped = {};
        
        filteredDateList.forEach(dateObj => {
            const { year, month, day } = dateObj;
            
            if (!grouped[year]) {
                grouped[year] = {};
            }
            
            if (!grouped[year][month]) {
                grouped[year][month] = [];
            }
            
            grouped[year][month].push(day);
        });
        
        // Sort everything
        const sortedYears = Object.keys(grouped).sort((a, b) => b - a);
        const result = [];
        
        sortedYears.forEach(year => {
            const sortedMonths = Object.keys(grouped[year]).sort((a, b) => b - a);
            const yearData = {
                year: parseInt(year),
                months: []
            };
            
            sortedMonths.forEach(month => {
                const sortedDays = grouped[year][month].sort((a, b) => b - a);
                yearData.months.push({
                    month: parseInt(month),
                    days: sortedDays
                });
            });
            
            result.push(yearData);
        });
        
        return result;
    }, [filteredDateList]);


    // Helper function to handle date click
    const handleDateClick = (year, month, day) => {
        const date = new Date(year + '/' + month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
        setSelectedStyle({ ["a-" + date]: "var(--color-text-primary)", ["li-" + date]: "square" });
        logger.info('DateList', 'date_click', 'Date clicked - starting navigation', { date });
        updateRecentPhotosMode(false);
        updateCurrentDate(date);
        showDatePhotos(date);
    };

    // Helper function to get photo count for a date
    const getPhotoCount = (year, month, day) => {
        const date = new Date(year + '/' + month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const key = date.replace(/\//g, "-");
        return dateNum[key] || 0;
    };

    // Toggle year expansion
    const toggleYearExpansion = (year) => {
        const newExpanded = new Set(expandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
            // Also collapse all months in this year
            const newExpandedMonths = new Set(expandedMonths);
            hierarchicalData.find(y => y.year === year)?.months.forEach(m => {
                newExpandedMonths.delete(`${year}-${m.month}`);
            });
            setExpandedMonths(newExpandedMonths);
        } else {
            newExpanded.add(year);
        }
        setExpandedYears(newExpanded);
    };

    // Toggle month expansion
    const toggleMonthExpansion = (year, month) => {
        const key = `${year}-${month}`;
        const newExpanded = new Set(expandedMonths);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedMonths(newExpanded);
    };

    // Get total photo count for a year
    const getYearPhotoCount = (yearData) => {
        return yearData.months.reduce((total, monthData) => {
            return total + monthData.days.reduce((monthTotal, day) => {
                return monthTotal + getPhotoCount(yearData.year, monthData.month, day);
            }, 0);
        }, 0);
    };

    // Get total photo count for a month
    const getMonthPhotoCount = (yearData, monthData) => {
        return monthData.days.reduce((total, day) => {
            return total + getPhotoCount(yearData.year, monthData.month, day);
        }, 0);
    };

    return (
        <>
            {/* Fixed Controls - Outside Scroll Area */}
            <div className="dateList-controls" style={{
                borderBottom: '1px solid var(--color-border-default)',
                paddingBottom: 'var(--space-1)',
                marginBottom: 'var(--space-1)',
                display: 'flex',
                flexDirection: props.leftMenuCollapsed ? 'column' : 'row',
                justifyContent: props.leftMenuCollapsed ? 'center' : 'space-between',
                alignItems: 'center',
                gap: props.leftMenuCollapsed ? 'var(--space-4)' : 'var(--space-1)',
                padding: props.leftMenuCollapsed ? 'var(--space-3) 0' : 'var(--space-1) var(--space-4)'
            }}>
                {/* Recent Photos */}
                <div style={{ marginTop: props.leftMenuCollapsed ? 'var(--space-1)' : '0' }}>
                    <a href="#"
                       className="recent-photos-link"
                       style={{
                           color: recentPhotosMode ? "var(--color-film-text, var(--color-text-primary))" : "var(--color-film-link, var(--color-primary))",
                           textDecoration: "none",
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: props.leftMenuCollapsed ? 'center' : 'flex-start',
                           gap: 'var(--space-1)'
                       }}
                       onClick={(e) => {
                           e.preventDefault();
                           logger.info('DateList', 'recent_photos_click', 'Recent Photos clicked - starting navigation');
                           // Keep selectedStyle to preserve date selection visual
                           updateRecentPhotosMode(true);
                           showRecentPhotos();
                       }}
                       onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('date.recent'), e)}
                       onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                        <span className="recent-photos-icon" style={{ fontSize: 'var(--font-size-lg)' }}>⏱️</span>
                        <span className="recent-photos-text">{t('date.recent')}</span>
                    </a>
                </div>

                {/* Right side icons (when expanded) or vertical items (when collapsed) */}
                {props.leftMenuCollapsed ? (
                    <>
                        {/* Insights */}
                        <div className="dateList-insights-link">
                            <a href="#"
                               style={{
                                   color: 'var(--color-film-link, var(--color-primary))',
                                   textDecoration: 'none',
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'center',
                                   gap: 'var(--space-1)'
                               }}
                               onClick={(e) => {
                                   e.preventDefault();
                                   props.setShowInsightsModal && props.setShowInsightsModal(true);
                               }}
                               onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('navigation.insights'), e)}
                               onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                                <span style={{ fontSize: 'var(--font-size-lg)' }}>📊</span>
                                <span className="dateList-link-text">{t('navigation.insights')}</span>
                            </a>
                        </div>

                        {/* Achievements */}
                        <div className="dateList-achievements-link">
                            <a href="#"
                               style={{
                                   color: 'var(--color-film-link, var(--color-primary))',
                                   textDecoration: 'none',
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'center',
                                   gap: 'var(--space-1)'
                               }}
                               onClick={(e) => {
                                   e.preventDefault();
                                   props.setShowAchievementsModal && props.setShowAchievementsModal(true);
                               }}
                               onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('navigation.achievements'), e)}
                               onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                                <span style={{ fontSize: 'var(--font-size-lg)' }}>🏆</span>
                                <span className="dateList-link-text">{t('navigation.achievements')}</span>
                            </a>
                        </div>

                        {/* Calendar Icon - Click to expand sidebar */}
                        <div
                            className="calendar-expand-trigger"
                            style={{
                                textAlign: 'center',
                                fontSize: 'var(--font-size-lg)',
                                padding: '0 0 var(--space-0-5) 0',
                                marginTop: 'calc(-1 * var(--space-1))',
                                cursor: 'pointer'
                            }}
                            onClick={() => props.setLeftMenuCollapsed(false)}
                            onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('date.allTime'), e)}
                            onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}
                        >
                            📅
                        </div>
                    </>
                ) : (
                    /* Icons only on the right when expanded */
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {/* Insights */}
                        <a href="#"
                           style={{
                               color: 'var(--color-film-link, var(--color-primary))',
                               textDecoration: 'none',
                               fontSize: 'var(--font-size-lg)'
                           }}
                           onClick={(e) => {
                               e.preventDefault();
                               props.setShowInsightsModal && props.setShowInsightsModal(true);
                           }}
                           onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('navigation.insights'), e)}
                           onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                            📊
                        </a>

                        {/* Achievements */}
                        <a href="#"
                           style={{
                               color: 'var(--color-film-link, var(--color-primary))',
                               textDecoration: 'none',
                               fontSize: 'var(--font-size-lg)'
                           }}
                           onClick={(e) => {
                               e.preventDefault();
                               props.setShowAchievementsModal && props.setShowAchievementsModal(true);
                           }}
                           onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter(t('navigation.achievements'), e)}
                           onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                            🏆
                        </a>
                    </div>
                )}
            </div>

            {/* Title */}
            <div className="dateList-title">
                <span>List of Date</span>
                {/* Loading indicator (progress bar) or refresh icon */}
                {showLoading ? (
                    <div className="dateList-loading">
                        <div className="dateList-loading-bar"></div>
                    </div>
                ) : (
                    <a href="#" className="dateList-refresh" onClick={(e) => {
                        e.preventDefault();
                        setIsRefreshing(true);
                        props.getDates();
                    }}>
                        <span className="refresh-icon">⟳</span>
                        <span className="refresh-text">
                            <span>C</span><span>l</span><span>i</span><span>c</span><span>k</span>
                            <span className="space"> </span>
                            <span>t</span><span>o</span>
                            <span className="space"> </span>
                            <span>R</span><span>e</span><span>l</span><span>o</span><span>a</span><span>d</span>
                        </span>
                    </a>
                )}
            </div>

            {/* Compact Filter Bar (Option B) */}
            <div className="dateList-filter-bar">
                <div className="filter-bar-item">
                    <select
                        className="filter-bar-select"
                        value={filterYear}
                        onChange={(e) => {
                            setFilterYear(e.target.value);
                            setFilterMonth('all');
                        }}
                    >
                        <option value="all">{t('dateList.year')}</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-bar-item">
                    <select
                        className="filter-bar-select"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                    >
                        <option value="all">{t('dateList.month')}</option>
                        {availableMonths.map(month => {
                            const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                            return (
                                <option key={month} value={month}>{t(`dateList.months.${monthKeys[month - 1]}`)}</option>
                            );
                        })}
                    </select>
                </div>
                <span className="filter-bar-divider"></span>
                <div className="filter-bar-toggle">
                    <button
                        className={viewMode === 'flat' ? 'active' : ''}
                        onClick={() => setViewMode('flat')}
                    >
                        {t('dateList.list')}
                    </button>
                    <button
                        className={viewMode === 'hierarchical' ? 'active' : ''}
                        onClick={() => setViewMode('hierarchical')}
                    >
                        {t('dateList.tree')}
                    </button>
                </div>
            </div>
            
            {/* Scrollable Date List */}
            <div className="dateList">
                <Scrollable>
                    <ul>

                        {/* Flat View */}
                        {viewMode === 'flat' && 
                            filteredDateList.map((l, i) => {
                                const date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                const photoCount = getPhotoCount(l.year, l.month, l.day);
                                return photoCount > 0 && (
                                    <li key={i} style={{ listStyle: finalSelectedStyle["li-" + date] || "none" }}>
                                        <a href="#"
                                           style={{
                                               color: finalSelectedStyle["a-" + date] ? getSelectedDateColor() : "var(--color-film-link, var(--color-primary))",
                                               fontSize: "inherit"
                                           }} 
                                           onClick={(e) => {
                                               e.preventDefault();
                                               handleDateClick(l.year, l.month, l.day);
                                           }}
                                           data-date={date} 
                                           data-page={datePage[date]}>
                                            {date}
                                            {photoCount !== undefined ? " (" + photoCount + ")" : ""}
                                        </a>
                                    </li>
                                );
                            })
                        }

                        {/* Hierarchical View - Clean & Simple */}
                        {viewMode === 'hierarchical' && 
                            hierarchicalData.map((yearData, _yearIndex) => {
                                const yearPhotoCount = getYearPhotoCount(yearData);
                                const isYearExpanded = expandedYears.has(yearData.year);
                                return yearPhotoCount > 0 && (
                                    <li key={`year-${yearData.year}`} style={{ listStyle: "none", marginBottom: "var(--space-0-5)" }}>
                                        {/* Year Header */}
                                        <div 
                                            style={{ 
                                                cursor: "pointer",
                                                fontSize: "inherit",
                                                color: "var(--color-film-link, var(--color-primary))",
                                                padding: "var(--space-0-5) 0"
                                            }}
                                            onClick={() => toggleYearExpansion(yearData.year)}
                                        >
                                            <span style={{ marginRight: "var(--space-1)" }}>
                                                {isYearExpanded ? '▾' : '▸'}
                                            </span>
                                            {yearData.year} ({yearPhotoCount})
                                        </div>

                                        {/* Months Container */}
                                        {isYearExpanded && (
                                            <div style={{ marginLeft: "var(--space-3)" }}>
                                                {yearData.months.map((monthData, _monthIndex) => {
                                                    const monthPhotoCount = getMonthPhotoCount(yearData, monthData);
                                                    const monthKey = `${yearData.year}-${monthData.month}`;
                                                    const isMonthExpanded = expandedMonths.has(monthKey);
                                                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                                    return monthPhotoCount > 0 && (
                                                        <div key={`month-${yearData.year}-${monthData.month}`}>
                                                            {/* Month Header */}
                                                            <div 
                                                                style={{ 
                                                                    cursor: "pointer",
                                                                    fontSize: "inherit",
                                                                    color: "var(--color-film-text, var(--color-text-secondary))",
                                                                    padding: "var(--space-0-5) 0"
                                                                }}
                                                                onClick={() => toggleMonthExpansion(yearData.year, monthData.month)}
                                                            >
                                                                <span style={{ marginRight: "var(--space-1)" }}>
                                                                    {isMonthExpanded ? '▾' : '▸'}
                                                                </span>
                                                                {monthNames[monthData.month - 1]} ({monthPhotoCount})
                                                            </div>

                                                            {/* Days */}
                                                            {isMonthExpanded && (
                                                                <div style={{ marginLeft: "var(--space-3)" }}>
                                                                    {monthData.days.map((day, _dayIndex) => {
                                                                        const date = new Date(yearData.year + '/' + monthData.month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                                                        const photoCount = getPhotoCount(yearData.year, monthData.month, day);
                                                                        const isSelected = finalSelectedStyle["a-" + date];
                                                                        return photoCount > 0 && (
                                                                            <div key={`day-${yearData.year}-${monthData.month}-${day}`} style={{ listStyle: isSelected ? "square" : "none" }}>
                                                                                <a href="#"
                                                                                   style={{
                                                                                       color: isSelected ? getSelectedDateColor() : "var(--color-film-link, var(--color-primary))",
                                                                                       fontSize: "inherit",
                                                                                       textDecoration: "none"
                                                                                   }} 
                                                                                   onClick={(e) => {
                                                                                       e.preventDefault();
                                                                                       handleDateClick(yearData.year, monthData.month, day);
                                                                                   }}>
                                                                                    {date} ({photoCount})
                                                                                </a>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        }
                    </ul>
                </Scrollable>
            </div>

            {/* Sidebar collapse toggle button */}
            <button
                className="sidebar-collapse-toggle"
                onClick={() => props.setLeftMenuCollapsed(!props.leftMenuCollapsed)}
                title={props.leftMenuCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={props.leftMenuCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {props.leftMenuCollapsed ? '▶' : '◀'}
            </button>
        </>
    );
}

export default DateList;
