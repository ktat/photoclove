import { useEffect, useState, useMemo } from "react";
import Scrollable from "../Scrollable.jsx";
import '../scrollable.css';
import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { logger } from "../services/LoggerService.js";

const unlisten = {};

function DateList(props) {
    const {
        dateList,
        datePage,
        dateNum,
        hideLoading,
        updateCurrentDate,
        recentPhotosMode,
        updateRecentPhotosMode
    } = usePhoto();
    
    const { toggleSearchPage, showPhotosListView, showDatePhotos, showRecentPhotos, viewMode: currentAppViewMode } = useUI();

    const [selectedStyle, setSelectedStyle] = useState({});

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

    useEffect((e) => {
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
            <div className="dateList-controls" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: '5px', marginBottom: '5px' }}>
                {/* Recent Photos */}
                <div style={{ marginBottom: '3px' }}>
                    <a href="#"
                       className="recent-photos-link"
                       style={{
                           color: recentPhotosMode ? "var(--color-text-primary)" : "var(--color-primary)",
                           textDecoration: "none",
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: '4px'
                       }}
                       onClick={(e) => {
                           e.preventDefault();
                           logger.info('DateList', 'recent_photos_click', 'Recent Photos clicked - starting navigation');
                           // Keep selectedStyle to preserve date selection visual
                           updateRecentPhotosMode(true);
                           showRecentPhotos();
                       }}
                       onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter("Recent Photos", e)}
                       onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}>
                        <span className="recent-photos-icon" style={{ fontSize: 'var(--font-size-lg)' }}>⏱️</span>
                        <span className="recent-photos-text">Recent Photos</span>
                    </a>
                </div>

                {/* Calendar Icon - Click to expand sidebar */}
                <div
                    className="calendar-expand-trigger"
                    style={{
                        textAlign: 'center',
                        fontSize: 'var(--font-size-lg)',
                        padding: '8px 0',
                        cursor: 'pointer',
                        display: props.leftMenuCollapsed ? 'block' : 'none'
                    }}
                    onClick={() => props.setLeftMenuCollapsed(false)}
                    onMouseEnter={(e) => props.handleMouseEnter && props.handleMouseEnter("Calendar", e)}
                    onMouseLeave={() => props.handleMouseLeave && props.handleMouseLeave()}
                >
                    📅
                </div>
            </div>

            <p className="dateListTitle date-list-title">
                List of Date <a href="#" onClick={() => props.getDates()}>⟳</a>
            </p>
            
            {/* Loading indicator */}
            <div style={{ display: hideLoading ? "none" : "inline-block" }}>
                <div className="dateListLoading-crub" style={{ display: hideLoading ? "none" : "inline-block" }}>
                    &#129408;
                </div>
                <div className="dateListLoading-container">
                    {["l", "o", "a", "d", "i", "n", "g"].map((l, i) => {
                        return (<div className="dateListLoading" key={i}>{l}</div>);
                    })}
                </div>
                <div className="dateListLoading-crub" style={{ display: hideLoading ? "none" : "inline-block" }}>
                    &#129408;
                </div>
            </div>

            {/* Date Controls - Outside Scroll Area */}
            <div className="date-filters-controls" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: '3px', marginBottom: '3px' }}>
                {/* Filter Controls */}
                <div className="date-filters" style={{ margin: "3px 0", textAlign: "center" }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: 'var(--font-size-xs)' }}>📅</span>
                            <select
                                value={filterYear}
                                onChange={(e) => {
                                    setFilterYear(e.target.value);
                                    setFilterMonth('all'); // Reset month when year changes
                                }}
                                style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 4px',
                                    width: '55px',
                                    height: '22px',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    color: 'var(--color-text-primary)',
                                    border: '1px solid var(--color-border-default)',
                                    borderRadius: 'var(--radius-sm)'
                                }}
                            >
                                <option value="all">All</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: 'var(--font-size-xs)' }}>🗓️</span>
                            <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 4px',
                                    width: '60px',
                                    height: '22px',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    color: 'var(--color-text-primary)',
                                    border: '1px solid var(--color-border-default)',
                                    borderRadius: 'var(--radius-sm)'
                                }}
                            >
                                <option value="all">All</option>
                                {availableMonths.map(month => {
                                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    return (
                                        <option key={month} value={month}>
                                            {monthNames[month - 1]}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="view-mode-toggle" style={{ margin: "3px 0", textAlign: "center" }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                        <button
                            onClick={() => setViewMode('flat')}
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                padding: '3px 8px',
                                backgroundColor: viewMode === 'flat' ? 'var(--color-primary-selected)' : 'var(--color-bg-elevated)',
                                color: 'var(--color-text-primary)',
                                border: viewMode === 'flat' ? '1px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                                cursor: 'pointer',
                                borderRight: 'none'
                            }}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('hierarchical')}
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                padding: '3px 8px',
                                backgroundColor: viewMode === 'hierarchical' ? 'var(--color-primary-selected)' : 'var(--color-bg-elevated)',
                                color: 'var(--color-text-primary)',
                                border: viewMode === 'hierarchical' ? '1px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                cursor: 'pointer'
                            }}
                        >
                            Tree
                        </button>
                    </div>
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
                                    <li key={i} style={{ listStyle: selectedStyle["li-" + date] || "none" }}>
                                        <a href="#"
                                           style={{
                                               color: selectedStyle["a-" + date] ? getSelectedDateColor() : "var(--color-primary)",
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
                            hierarchicalData.map((yearData, yearIndex) => {
                                const yearPhotoCount = getYearPhotoCount(yearData);
                                const isYearExpanded = expandedYears.has(yearData.year);
                                return yearPhotoCount > 0 && (
                                    <li key={`year-${yearData.year}`} style={{ listStyle: "none", marginBottom: "1px" }}>
                                        {/* Year Header */}
                                        <div 
                                            style={{ 
                                                cursor: "pointer",
                                                fontSize: "inherit",
                                                color: "var(--color-primary)",
                                                padding: "1px 0"
                                            }}
                                            onClick={() => toggleYearExpansion(yearData.year)}
                                        >
                                            <span style={{ fontSize: "var(--font-size-2xs)", marginRight: "4px" }}>
                                                {isYearExpanded ? '▼' : '▶'}
                                            </span>
                                            {yearData.year} ({yearPhotoCount})
                                        </div>

                                        {/* Months Container */}
                                        {isYearExpanded && (
                                            <div style={{ marginLeft: "12px" }}>
                                                {yearData.months.map((monthData, monthIndex) => {
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
                                                                    color: "var(--color-text-secondary)",
                                                                    padding: "1px 0"
                                                                }}
                                                                onClick={() => toggleMonthExpansion(yearData.year, monthData.month)}
                                                            >
                                                                <span style={{ fontSize: "var(--font-size-2xs)", marginRight: "4px" }}>
                                                                    {isMonthExpanded ? '▼' : '▶'}
                                                                </span>
                                                                {monthNames[monthData.month - 1]} ({monthPhotoCount})
                                                            </div>

                                                            {/* Days */}
                                                            {isMonthExpanded && (
                                                                <div style={{ marginLeft: "12px" }}>
                                                                    {monthData.days.map((day, dayIndex) => {
                                                                        const date = new Date(yearData.year + '/' + monthData.month + '/' + day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                                                        const photoCount = getPhotoCount(yearData.year, monthData.month, day);
                                                                        const isSelected = selectedStyle["a-" + date];
                                                                        return photoCount > 0 && (
                                                                            <div key={`day-${yearData.year}-${monthData.month}-${day}`} style={{ listStyle: isSelected ? "square" : "none" }}>
                                                                                <a href="#"
                                                                                   style={{
                                                                                       color: isSelected ? getSelectedDateColor() : "var(--color-primary)",
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
