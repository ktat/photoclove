import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';

// AI Tagging category groups
const CATEGORY_GROUPS = {
    people: {
        label: "People",
        categories: ["person", "face", "group"]
    },
    animals: {
        label: "Animals",
        categories: ["dog", "cat", "bird", "fish", "horse", "cow", "insect", "wildlife"]
    },
    nature: {
        label: "Nature",
        categories: ["sea", "beach", "mountain", "forest", "river", "lake", "sky", "sunset"]
    },
    plants: {
        label: "Plants",
        categories: ["flower", "tree", "plant", "garden"]
    },
    scenes: {
        label: "Scenes",
        categories: ["food", "building", "street", "indoor", "outdoor", "night"]
    },
    events: {
        label: "Events",
        categories: ["wedding", "birthday", "travel"]
    }
};

function AITaggingTab({ config, setConfig, addFooterMessage }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ message: '', progress: 0 });

    // Listen for AI tagging progress events
    React.useEffect(() => {
        let unlistenProgress;
        let unlistenTagsUpdated;

        const setupListeners = async () => {
            unlistenProgress = await listen('ai_tagging_progress', (event) => {
                const [jobUnitId, message, progressValue] = event.payload;
                setProgress({ message, progress: progressValue });
                logger.debug('AITaggingTab', 'ai_tagging_progress', 'Progress update', { jobUnitId, message, progressValue });

                if (progressValue >= 100) {
                    setIsProcessing(false);
                    setProgress({ message: '', progress: 0 });
                    if (addFooterMessage) {
                        addFooterMessage("ai_tagging", "AI tagging completed");
                    }
                }
            });

            unlistenTagsUpdated = await listen('tags_updated', () => {
                logger.info('AITaggingTab', 'tags_updated', 'Tags have been updated');
            });
        };

        setupListeners();

        return () => {
            if (unlistenProgress) unlistenProgress();
            if (unlistenTagsUpdated) unlistenTagsUpdated();
        };
    }, [addFooterMessage]);

    // Get AI tagging config with defaults
    const aiConfig = config.ai_tagging || {
        enabled: false,
        auto_tag_on_import: false,
        confidence_threshold: 0.7,
        max_tags_per_image: 5,
        model_preset: "standard",
        enabled_categories: []
    };

    const updateAIConfig = (updates) => {
        setConfig(prev => ({
            ...prev,
            ai_tagging: {
                ...aiConfig,
                ...updates
            }
        }));
    };

    const handleToggleCategory = (category) => {
        const current = aiConfig.enabled_categories || [];
        const newCategories = current.includes(category)
            ? current.filter(c => c !== category)
            : [...current, category];
        updateAIConfig({ enabled_categories: newCategories });
    };

    const handleToggleGroup = (groupKey) => {
        const group = CATEGORY_GROUPS[groupKey];
        const current = aiConfig.enabled_categories || [];
        const allInGroup = group.categories.every(c => current.includes(c));

        if (allInGroup) {
            // Remove all categories in this group
            updateAIConfig({
                enabled_categories: current.filter(c => !group.categories.includes(c))
            });
        } else {
            // Add all categories in this group
            const newCategories = [...new Set([...current, ...group.categories])];
            updateAIConfig({ enabled_categories: newCategories });
        }
    };

    const handleSelectAll = () => {
        const allCategories = Object.values(CATEGORY_GROUPS)
            .flatMap(g => g.categories);
        updateAIConfig({ enabled_categories: allCategories });
    };

    const handleSelectNone = () => {
        updateAIConfig({ enabled_categories: [] });
    };

    const handleRunForAll = async () => {
        if (!window.confirm("This will run AI tagging for ALL photos in your library. This may take a long time. Continue?")) {
            return;
        }

        setIsProcessing(true);
        setProgress({ message: 'Starting AI tagging for all photos...', progress: 0 });

        try {
            const result = await invoke("run_ai_tagging_for_all");
            const data = JSON.parse(result);

            if (data.result === "no_photos" || data.result === "no_images") {
                setIsProcessing(false);
                setProgress({ message: '', progress: 0 });
                if (addFooterMessage) {
                    addFooterMessage("ai_tagging", "No photos found in library");
                }
            } else {
                logger.info('AITaggingTab', 'ai_tagging_all_started', 'AI tagging job started for all photos', data);
                if (addFooterMessage) {
                    addFooterMessage("ai_tagging", `Processing ${data.photo_count} photos...`);
                }
            }
        } catch (error) {
            setIsProcessing(false);
            setProgress({ message: '', progress: 0 });
            logger.error('AITaggingTab', 'ai_tagging_all_error', 'Failed to start AI tagging for all', { error: error.message || error });
            if (addFooterMessage) {
                addFooterMessage("ai_tagging_error", `Error: ${error.message || error}`);
            }
        }
    };

    const enabledCount = (aiConfig.enabled_categories || []).length;
    const totalCategories = Object.values(CATEGORY_GROUPS).flatMap(g => g.categories).length;

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>AI Auto-Tagging</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Automatically classify and tag photos using AI. Tags are prefixed with <code>ai:</code> (e.g., <code>ai:dog</code>, <code>ai:beach</code>).
            </p>

            {/* Main Toggle */}
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="ai-tagging-enabled"
                        checked={aiConfig.enabled}
                        onChange={(e) => updateAIConfig({ enabled: e.target.checked })}
                    />
                    <label htmlFor="ai-tagging-enabled">Enable AI Auto-Tagging</label>
                </div>
            </div>

            {aiConfig.enabled && (
                <>
                    {/* Auto-tag on Import */}
                    <div className={styles['setting-group']}>
                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="ai-auto-tag-import"
                                checked={aiConfig.auto_tag_on_import}
                                onChange={(e) => updateAIConfig({ auto_tag_on_import: e.target.checked })}
                            />
                            <label htmlFor="ai-auto-tag-import">Auto-tag photos on import</label>
                        </div>
                    </div>

                    {/* Confidence Threshold */}
                    <div className={styles['setting-group']}>
                        <div className={styles['setting-row']}>
                            <label>Confidence Threshold: {(aiConfig.confidence_threshold * 100).toFixed(0)}%</label>
                            <input
                                type="range"
                                min="0.5"
                                max="0.95"
                                step="0.05"
                                value={aiConfig.confidence_threshold}
                                onChange={(e) => updateAIConfig({ confidence_threshold: parseFloat(e.target.value) })}
                                style={{ width: '200px' }}
                            />
                        </div>
                        <p className={styles['setting-description']}>
                            Only apply tags when AI confidence is above this threshold
                        </p>
                    </div>

                    {/* Max Tags per Image */}
                    <div className={styles['setting-group']}>
                        <div className={styles['setting-row']}>
                            <label>Max tags per image</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={aiConfig.max_tags_per_image}
                                onChange={(e) => updateAIConfig({ max_tags_per_image: parseInt(e.target.value) || 5 })}
                                style={{ width: '80px' }}
                            />
                        </div>
                    </div>

                    {/* Model Preset */}
                    <div className={styles['setting-group']}>
                        <div className={styles['setting-row']}>
                            <label>Model Preset</label>
                            <select
                                value={aiConfig.model_preset || 'standard'}
                                onChange={(e) => updateAIConfig({ model_preset: e.target.value })}
                                style={{ width: '200px' }}
                            >
                                <option value="light">Light (Fast, ~50ms/photo)</option>
                                <option value="standard">Standard (Balanced, ~100ms/photo)</option>
                                <option value="accurate">Accurate (Slow, ~200ms/photo)</option>
                            </select>
                        </div>
                    </div>

                    {/* Category Selection */}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                            <h3 style={{ margin: 0 }}>Enabled Categories ({enabledCount}/{totalCategories})</h3>
                            <div>
                                <button
                                    onClick={handleSelectAll}
                                    style={{
                                        marginRight: 'var(--space-2)',
                                        padding: 'var(--space-1) var(--space-2)',
                                        fontSize: 'var(--font-size-xs)',
                                        background: 'var(--color-bg-surface)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-primary)'
                                    }}
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={handleSelectNone}
                                    style={{
                                        padding: 'var(--space-1) var(--space-2)',
                                        fontSize: 'var(--font-size-xs)',
                                        background: 'var(--color-bg-surface)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-primary)'
                                    }}
                                >
                                    Select None
                                </button>
                            </div>
                        </div>

                        {Object.entries(CATEGORY_GROUPS).map(([groupKey, group]) => {
                            const enabledInGroup = group.categories.filter(c =>
                                (aiConfig.enabled_categories || []).includes(c)
                            ).length;
                            const allEnabled = enabledInGroup === group.categories.length;

                            return (
                                <div key={groupKey} style={{ marginBottom: 'var(--space-3)' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: 'var(--space-1)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => handleToggleGroup(groupKey)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={allEnabled}
                                            onChange={() => handleToggleGroup(groupKey)}
                                            style={{ marginRight: 'var(--space-2)' }}
                                        />
                                        <strong>{group.label}</strong>
                                        <span style={{
                                            marginLeft: 'var(--space-2)',
                                            color: 'var(--color-text-muted)',
                                            fontSize: 'var(--font-size-xs)'
                                        }}>
                                            ({enabledInGroup}/{group.categories.length})
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 'var(--space-2)',
                                        marginLeft: 'var(--space-5)'
                                    }}>
                                        {group.categories.map(category => (
                                            <label
                                                key={category}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: 'var(--space-1) var(--space-2)',
                                                    background: (aiConfig.enabled_categories || []).includes(category)
                                                        ? 'var(--color-primary-selected)'
                                                        : 'var(--color-bg-surface)',
                                                    border: '1px solid var(--color-border-default)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    fontSize: 'var(--font-size-sm)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={(aiConfig.enabled_categories || []).includes(category)}
                                                    onChange={() => handleToggleCategory(category)}
                                                    style={{ marginRight: 'var(--space-1)' }}
                                                />
                                                {category}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Apply to All Photos */}
                    <div style={{
                        marginTop: 'var(--space-5)',
                        padding: 'var(--space-4)',
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
                            Run AI Tagging for Existing Photos
                        </h3>
                        <p style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-sm)',
                            marginBottom: 'var(--space-3)'
                        }}>
                            Apply AI tags to all photos in your library. For date-specific tagging, use the Maintenance menu when viewing photos by date.
                        </p>
                        <button
                            onClick={handleRunForAll}
                            disabled={isProcessing}
                            style={{
                                padding: 'var(--space-2) var(--space-4)',
                                background: isProcessing ? 'var(--color-bg-muted)' : 'var(--color-warning)',
                                color: 'var(--color-bg-base)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.6 : 1,
                                fontWeight: 500
                            }}
                        >
                            {isProcessing ? 'Processing...' : 'Apply to All Photos'}
                        </button>

                        {/* Progress Bar */}
                        {isProcessing && (
                            <div style={{ marginTop: 'var(--space-3)' }}>
                                <div style={{
                                    height: '4px',
                                    background: 'var(--color-bg-muted)',
                                    borderRadius: 'var(--radius-sm)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${progress.progress}%`,
                                        background: 'var(--color-primary)',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                                <p style={{
                                    marginTop: 'var(--space-2)',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    {progress.message}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!aiConfig.enabled && (
                <p className={styles['setting-description']} style={{ fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
                    Enable AI Auto-Tagging to configure options and run on existing photos.
                </p>
            )}
        </div>
    );
}

export default AITaggingTab;
