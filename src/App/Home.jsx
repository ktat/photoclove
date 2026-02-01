import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
import { useUI } from "../context/UIContext.jsx";
import { usePhoto } from "../context/PhotoContext.jsx";
import { logger } from "../services/LoggerService.js";
import GettingStartedChecklist from "./Home/GettingStartedChecklist.jsx";
import "./Home.css";

function Home(props) {
    const { t } = useTranslation('common');
    const [searchQuery, setSearchQuery] = useState("");
    const { toggleSearchPage, showDatePhotos } = useUI();
    const { updateCurrentDate } = usePhoto();

    // Memories state
    const [memoriesGroups, setMemoriesGroups] = useState([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);
    // View mode: 'photo' for large splash image, 'list' for memories list
    const [viewMode, setViewMode] = useState('photo');

    const showMemoriesOnHome = props.config?.startup_images?.show_memories_on_home !== false &&
        props.config?.startup_images?.mode === 'memories';

    // Load memories when component mounts and showMemoriesOnHome is enabled
    useEffect(() => {
        if (showMemoriesOnHome) {
            loadMemories();
        }
    }, [showMemoriesOnHome]);

    const loadMemories = async () => {
        setMemoriesLoading(true);
        try {
            const response = await invoke("get_photos_unified", {
                request: {
                    type: "search",
                    search_type: "memories",
                    query: null,
                    star: null,
                    has_comment: null,
                    extension: null,
                    page: null,
                    limit: null,
                    offset: null,
                    sort_value: null,
                    params: null
                }
            });
            const result = JSON.parse(response);
            setMemoriesGroups(result.groups || []);
        } catch (error) {
            logger.error('Home', 'load_memories_error', 'Failed to load memories', { error: error.message });
            setMemoriesGroups([]);
        } finally {
            setMemoriesLoading(false);
        }
    };

    const handleQuickSearch = () => {
        if (searchQuery.trim()) {
            toggleSearchPage(true, searchQuery);
        }
    };

    const handleAdvancedSearch = () => {
        toggleSearchPage(true, searchQuery, true); // isAdvanced = true, carry over query
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleQuickSearch();
        }
    };

    const handleMemoryPhotoClick = (photo) => {
        // Navigate to the date of the clicked photo
        const photoDate = photo.time?.split(' ')[0] || photo.dir?.path?.split('/').slice(-3).join('-');
        if (photoDate) {
            updateCurrentDate(photoDate.replace(/\//g, '-'));
            showDatePhotos(photoDate.replace(/\//g, '-'));
        }
    };

    return (
        <div id="home-container">
            <div>
                <div className="home-search-container">
                    <div className="home-search-bar">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={t('search.placeholder', 'Search photos...')}
                            className="home-search-input"
                        />
                        <button
                            onClick={handleQuickSearch}
                            className="home-search-button"
                            disabled={!searchQuery.trim()}
                        >
                            {t('search.button', 'Search')}
                        </button>
                        <button
                            onClick={handleAdvancedSearch}
                            className="home-advanced-search-button"
                        >
                            {t('search.detailedSearch', 'Detailed Search')}
                        </button>
                    </div>
                </div>

                {/* Getting Started Checklist */}
                <GettingStartedChecklist config={props.config} />

                {/* On This Day Memories Section with View Toggle */}
                {showMemoriesOnHome && (
                    <div className="home-memories-section">
                        <div className="home-memories-header">
                            <h3 className="home-memories-title">
                                {t('memories.onThisDay', 'On This Day')}
                            </h3>
                            <div className="home-view-toggle">
                                <button
                                    className={`home-view-toggle-btn ${viewMode === 'photo' ? 'active' : ''}`}
                                    onClick={() => setViewMode('photo')}
                                    title={t('memories.photoView', 'Photo view')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                </button>
                                <button
                                    className={`home-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                    title={t('memories.listView', 'List view')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="8" y1="6" x2="21" y2="6"/>
                                        <line x1="8" y1="12" x2="21" y2="12"/>
                                        <line x1="8" y1="18" x2="21" y2="18"/>
                                        <line x1="3" y1="6" x2="3.01" y2="6"/>
                                        <line x1="3" y1="12" x2="3.01" y2="12"/>
                                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {viewMode === 'list' ? (
                            // List View - Show memories by year
                            memoriesLoading ? (
                                <div className="home-memories-loading">
                                    {t('common.loading', 'Loading...')}
                                </div>
                            ) : memoriesGroups.length === 0 ? (
                                <div className="home-memories-empty">
                                    {t('memories.noMemories', 'No memories found for today.')}
                                </div>
                            ) : (
                                <div className="home-memories-groups">
                                    {memoriesGroups.map((group) => (
                                        <div key={group.year} className="home-memories-group">
                                            <div className="home-memories-group-header">
                                                <span className="home-memories-years-ago">
                                                    {group.years_ago === 1
                                                        ? t('memories.yearsAgoSingular', '1 year ago')
                                                        : t('memories.yearsAgoPlural', '{{count}} years ago', { count: group.years_ago })}
                                                </span>
                                                <span className="home-memories-date">{group.year}</span>
                                            </div>
                                            <div className="home-memories-thumbnails">
                                                {group.photos.slice(0, 4).map((photo) => (
                                                    <div
                                                        key={photo.file.path}
                                                        className="home-memory-thumbnail"
                                                        onClick={() => handleMemoryPhotoClick(photo)}
                                                        title={t('memories.viewPhoto', 'View photo')}
                                                    >
                                                        <img
                                                            src={convertFileSrc(photo.file.path)}
                                                            alt=""
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                                {group.photos.length > 4 && (
                                                    <div className="home-memories-more">
                                                        +{group.photos.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            // Photo View - Show large startup image
                            <div className="home-memories-photo-view">
                                <img
                                    className="home-memories-large-photo"
                                    src={props.welcomeImage}
                                    alt=""
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Show splash container only when memories mode is not enabled */}
                {!showMemoriesOnHome && (
                    <div className="splash-container">
                        <img className="splash" src={props.welcomeImage} width="100%" />
                    </div>
                )}
            </div>
        </div >
    )
}

export default Home;
