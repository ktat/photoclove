import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from 'react-i18next';
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';
import AIModelSelector, { AI_MODELS } from './AIModelSelector.jsx';
import AICustomLabels from './AICustomLabels.jsx';

// Model-specific confidence threshold ranges
// Based on actual model output distributions from testing
const MODEL_THRESHOLD_RANGES = {
    mobilenet: { min: 0.05, max: 0.35 },  // Actual range: 0.020-0.983, median: 0.130 from 123 samples
    openclip: { min: 0.17, max: 0.30 },  // Actual range: 0.174-0.302 from 233 samples
    siglip: { min: 0.15, max: 0.35 }
};

// Convert actual threshold to normalized 0-100 scale
const toNormalizedThreshold = (actual, modelType) => {
    const range = MODEL_THRESHOLD_RANGES[modelType] || MODEL_THRESHOLD_RANGES.mobilenet;
    return Math.round(((actual - range.min) / (range.max - range.min)) * 100);
};

// Convert normalized 0-100 scale to actual threshold
const toActualThreshold = (normalized, modelType) => {
    const range = MODEL_THRESHOLD_RANGES[modelType] || MODEL_THRESHOLD_RANGES.mobilenet;
    return (normalized / 100) * (range.max - range.min) + range.min;
};

// AI Tagging category groups (labels are i18n keys)
const CATEGORY_GROUPS = {
    people: {
        labelKey: "people",
        categories: ["person", "face", "group"]
    },
    animals: {
        labelKey: "animals",
        categories: ["dog", "cat", "bird", "fish", "horse", "cow", "insect", "wildlife"]
    },
    nature: {
        labelKey: "nature",
        categories: ["sea", "beach", "mountain", "forest", "river", "lake", "sky", "sunset"]
    },
    plants: {
        labelKey: "plants",
        categories: ["flower", "tree", "plant", "garden"]
    },
    scenes: {
        labelKey: "scenes",
        categories: ["food", "building", "street", "indoor", "outdoor", "night"]
    },
    events: {
        labelKey: "events",
        categories: ["wedding", "birthday", "travel"]
    }
};

function AITaggingTab({ config, setConfig, addFooterMessage }) {
    const { t } = useTranslation(['preferences', 'common']);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ message: '', progress: 0 });
    const [modelStatuses, setModelStatuses] = useState({});
    const [downloadingModelId, setDownloadingModelId] = useState(null);
    const prevModelTypeRef = React.useRef(null);

    // Fetch model statuses on mount
    useEffect(() => {
        const fetchModelStatuses = async () => {
            try {
                const result = await invoke("get_ai_models");
                const data = JSON.parse(result);
                const statuses = {};
                data.models.forEach(model => {
                    statuses[model.id] = {
                        downloaded: model.downloaded,
                        status: model.status,
                    };
                });
                setModelStatuses(statuses);
            } catch (error) {
                logger.error('AITaggingTab', 'model_statuses_error', 'Failed to load model statuses', { error });
            }
        };
        fetchModelStatuses();
    }, []);

    // Listen for AI tagging progress events
    useEffect(() => {
        let unlistenProgress;
        let unlistenTagsUpdated;

        const setupListeners = async () => {
            unlistenProgress = await listen('ai_tagging_progress', (event) => {
                const [jobUnitId, message, progressValue] = event.payload;
                setProgress({ message, progress: progressValue });
                if (progressValue >= 100) {
                    setIsProcessing(false);
                    setProgress({ message: '', progress: 0 });
                    if (addFooterMessage) {
                        addFooterMessage("ai_tagging", t('preferences:aiTagging.completed'));
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
        confidence_threshold: 0.2,  // Default to middle of mobilenet range (0.05-0.35)
        max_tags_per_image: 5,
        model_type: "mobilenet",
        model_preset: "standard",
        enabled_categories: [],
        custom_labels: [],
        use_exif_thumbnail: true,
        min_thumbnail_size: 160
    };

    const updateAIConfig = (updates) => {
        setConfig(prev => ({
            ...prev,
            ai_tagging: { ...aiConfig, ...updates }
        }));
    };

    // Normalize legacy threshold values on mount
    useEffect(() => {
        const modelType = aiConfig.model_type || 'mobilenet';
        const currentThreshold = aiConfig.confidence_threshold;
        const range = MODEL_THRESHOLD_RANGES[modelType] || MODEL_THRESHOLD_RANGES.mobilenet;

        // If threshold is outside the model's range, it's likely a legacy value (0.5-0.95 range)
        if (currentThreshold > range.max) {
            // Legacy threshold was in 0.5-0.95 range, normalize to 0-100 then convert to model range
            const legacyNormalized = ((currentThreshold - 0.5) / (0.95 - 0.5)) * 100;
            const newThreshold = toActualThreshold(Math.min(100, Math.max(0, legacyNormalized)), modelType);

            logger.info('AITaggingTab', 'threshold_migration', 'Migrating legacy threshold value', {
                oldThreshold: currentThreshold,
                legacyNormalized,
                newThreshold,
                modelType
            });

            setConfig(prev => ({
                ...prev,
                ai_tagging: { ...aiConfig, confidence_threshold: newThreshold }
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Adjust confidence threshold when model type changes
    useEffect(() => {
        if (prevModelTypeRef.current && prevModelTypeRef.current !== aiConfig.model_type) {
            // Model type changed - convert threshold to maintain same "strictness"
            const prevModelType = prevModelTypeRef.current;
            const currentModelType = aiConfig.model_type;
            const currentThreshold = aiConfig.confidence_threshold;

            // Convert from old model range to normalized 0-100
            const normalized = toNormalizedThreshold(currentThreshold, prevModelType);
            // Convert from normalized to new model range
            const newThreshold = toActualThreshold(normalized, currentModelType);

            logger.info('AITaggingTab', 'model_type_changed', 'Adjusting confidence threshold for new model', {
                prevModelType,
                currentModelType,
                oldThreshold: currentThreshold,
                normalized,
                newThreshold
            });

            setConfig(prev => ({
                ...prev,
                ai_tagging: { ...prev.ai_tagging, confidence_threshold: newThreshold }
            }));
        }
        prevModelTypeRef.current = aiConfig.model_type;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiConfig.model_type]);

    const selectedModel = AI_MODELS.find(m => m.id === aiConfig.model_type) || AI_MODELS[0];

    const handleDownloadModel = async (modelId) => {
        setDownloadingModelId(modelId);
        try {
            if (addFooterMessage) addFooterMessage("ai_model_download", t('preferences:aiTagging.downloadingModel', { model: modelId }));
            await invoke("download_ai_model", { modelId });
            setModelStatuses(prev => ({ ...prev, [modelId]: { downloaded: true, status: "ready" } }));
            if (addFooterMessage) addFooterMessage("ai_model_download", t('preferences:aiTagging.downloadSuccess', { model: modelId }));
        } catch (error) {
            logger.error('AITaggingTab', 'model_download_error', 'Failed to download model', { modelId, error });
            if (addFooterMessage) addFooterMessage("ai_model_download_error", t('preferences:aiTagging.downloadFailed', { model: modelId, error }));
        } finally {
            setDownloadingModelId(null);
        }
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
            updateAIConfig({ enabled_categories: current.filter(c => !group.categories.includes(c)) });
        } else {
            updateAIConfig({ enabled_categories: [...new Set([...current, ...group.categories])] });
        }
    };

    const handleSelectAll = () => {
        const allCategories = Object.values(CATEGORY_GROUPS).flatMap(g => g.categories);
        updateAIConfig({ enabled_categories: allCategories });
    };

    const handleSelectNone = () => updateAIConfig({ enabled_categories: [] });

    const handleRunForAll = async () => {
        if (!window.confirm(t('preferences:aiTagging.confirmRunAll'))) {
            return;
        }

        setIsProcessing(true);
        setProgress({ message: t('preferences:aiTagging.startingTagging'), progress: 0 });

        try {
            const result = await invoke("run_ai_tagging_for_all");
            const data = JSON.parse(result);

            if (data.result === "no_photos" || data.result === "no_images") {
                setIsProcessing(false);
                setProgress({ message: '', progress: 0 });
                if (addFooterMessage) addFooterMessage("ai_tagging", t('preferences:aiTagging.noPhotosFound'));
            } else {
                if (addFooterMessage) addFooterMessage("ai_tagging", t('preferences:aiTagging.processingPhotos', { count: data.photo_count }));
            }
        } catch (error) {
            setIsProcessing(false);
            setProgress({ message: '', progress: 0 });
            logger.error('AITaggingTab', 'ai_tagging_all_error', 'Failed to start AI tagging', { error });
            if (addFooterMessage) addFooterMessage("ai_tagging_error", `Error: ${error.message || error}`);
        }
    };

    const enabledCount = (aiConfig.enabled_categories || []).length;
    const totalCategories = Object.values(CATEGORY_GROUPS).flatMap(g => g.categories).length;

    return (
        <div
            className={styles['preferences-section']}
            style={{ cursor: downloadingModelId ? 'wait' : 'default' }}
        >
            <h2 className={styles['section-title']}>{t('preferences:aiTagging.title')}</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                {t('preferences:aiTagging.description')}
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
                    <label htmlFor="ai-tagging-enabled">{t('preferences:aiTagging.enableAI')}</label>
                </div>
                <p style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-warning)',
                    marginTop: 'var(--space-2)',
                    marginLeft: 'var(--space-6)',
                    marginBottom: 0
                }}>
                    ⚠️ {t('preferences:aiTagging.enableWarning')}
                </p>
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
                            <label htmlFor="ai-auto-tag-import">{t('preferences:aiTagging.autoTag')}</label>
                        </div>
                    </div>

                    {/* Minimum Thumbnail Size */}
                    <div className={styles['slider-container']}>
                        <div className={styles['slider-label']}>
                            <span className={styles['slider-label-text']}>{t('preferences:aiTagging.minThumbnailSize')}</span>
                            <span className={styles['slider-value']}>{aiConfig.min_thumbnail_size ?? 160}px</span>
                        </div>
                        <p className={styles['slider-description']}>
                            {t('preferences:aiTagging.minThumbnailDescription')}
                        </p>
                        <input
                            type="range"
                            min="0"
                            max="400"
                            step="20"
                            value={aiConfig.min_thumbnail_size ?? 160}
                            onChange={(e) => {
                                const newValue = parseInt(e.target.value);
                                updateAIConfig({ min_thumbnail_size: newValue });
                            }}
                            className={styles['slider-range']}
                        />
                        <div className={styles['slider-range-labels']}>
                            <span>0 ({t('preferences:aiTagging.alwaysFullImage')})</span>
                            <span>400px</span>
                        </div>
                    </div>

                    {/* Confidence Threshold */}
                    <div className={styles['slider-container']}>
                        <div className={styles['slider-label']}>
                            <span className={styles['slider-label-text']}>{t('preferences:aiTagging.confidenceThreshold')}</span>
                            <span className={styles['slider-value']}>{toNormalizedThreshold(aiConfig.confidence_threshold, aiConfig.model_type)}%</span>
                        </div>
                        <p className={styles['slider-description']}>
                            {t('preferences:aiTagging.confidenceDescription')}
                        </p>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={toNormalizedThreshold(aiConfig.confidence_threshold, aiConfig.model_type)}
                            onChange={(e) => {
                                const normalized = parseInt(e.target.value);
                                const actual = toActualThreshold(normalized, aiConfig.model_type);
                                updateAIConfig({ confidence_threshold: actual });
                            }}
                            className={styles['slider-range']}
                        />
                        <div className={styles['slider-range-labels']}>
                            <span>0% ({t('preferences:aiTagging.lessStrict')})</span>
                            <span>100% ({t('preferences:aiTagging.moreStrict')})</span>
                        </div>
                    </div>

                    {/* Max Tags per Image */}
                    <div className={styles['setting-group']}>
                        <div className={styles['setting-row']}>
                            <label>{t('preferences:aiTagging.maxTagsPerImage')}</label>
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

                    {/* AI Model Selection */}
                    <AIModelSelector
                        selectedModelId={aiConfig.model_type}
                        modelStatuses={modelStatuses}
                        downloadingModelId={downloadingModelId}
                        onModelSelect={(id) => updateAIConfig({ model_type: id })}
                        onDownloadModel={handleDownloadModel}
                    />

                    {/* Model Preset (MobileNet only) */}
                    {aiConfig.model_type === 'mobilenet' && (
                        <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                            <div className={styles['setting-row']}>
                                <label>{t('preferences:aiTagging.modelPreset')}</label>
                                <select
                                    value={aiConfig.model_preset || 'standard'}
                                    onChange={(e) => updateAIConfig({ model_preset: e.target.value })}
                                    style={{ width: '200px' }}
                                >
                                    <option value="light">{t('preferences:aiTagging.presetLight')}</option>
                                    <option value="standard">{t('preferences:aiTagging.presetStandard')}</option>
                                    <option value="accurate">{t('preferences:aiTagging.presetAccurate')}</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Custom Labels (OpenCLIP/SigLIP only) */}
                    {selectedModel.supportsCustomLabels && (
                        <AICustomLabels
                            customLabels={aiConfig.custom_labels || []}
                            onAddLabel={(label) => updateAIConfig({ custom_labels: [...(aiConfig.custom_labels || []), label] })}
                            onRemoveLabel={(label) => updateAIConfig({ custom_labels: (aiConfig.custom_labels || []).filter(l => l !== label) })}
                        />
                    )}

                    {/* Category Selection (MobileNet only) */}
                    {aiConfig.model_type === 'mobilenet' && (
                        <div style={{ marginTop: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h3 style={{ margin: 0 }}>{t('preferences:aiTagging.enabledCategories')} ({enabledCount}/{totalCategories})</h3>
                                <div>
                                    <button onClick={handleSelectAll} style={smallButtonStyle}>{t('preferences:aiTagging.selectAll')}</button>
                                    <button onClick={handleSelectNone} style={{ ...smallButtonStyle, marginLeft: 'var(--space-2)' }}>{t('preferences:aiTagging.selectNone')}</button>
                                </div>
                            </div>

                            {Object.entries(CATEGORY_GROUPS).map(([groupKey, group]) => {
                                const enabledInGroup = group.categories.filter(c => (aiConfig.enabled_categories || []).includes(c)).length;
                                const allEnabled = enabledInGroup === group.categories.length;

                                return (
                                    <div key={groupKey} style={{ marginBottom: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-1)', cursor: 'pointer' }} onClick={() => handleToggleGroup(groupKey)}>
                                            <input type="checkbox" checked={allEnabled} onChange={() => handleToggleGroup(groupKey)} style={{ marginRight: 'var(--space-2)' }} />
                                            <strong>{t(`preferences:aiTagging.categories.${group.labelKey}`)}</strong>
                                            <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                                ({enabledInGroup}/{group.categories.length})
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginLeft: 'var(--space-5)' }}>
                                            {group.categories.map(category => (
                                                <label key={category} style={categoryLabelStyle((aiConfig.enabled_categories || []).includes(category))}>
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
                    )}

                    {/* Apply to All Photos */}
                    <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>{t('preferences:aiTagging.runForAll')}</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
                            {t('preferences:aiTagging.runForAllDescription')}
                        </p>
                        <button
                            onClick={handleRunForAll}
                            disabled={isProcessing}
                            className={styles['btn-warning']}
                        >
                            {isProcessing ? t('preferences:aiTagging.processing') : t('preferences:aiTagging.applyToAll')}
                        </button>

                        {isProcessing && (
                            <div style={{ marginTop: 'var(--space-3)' }}>
                                <div style={{ height: '4px', background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${progress.progress}%`, background: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
                                </div>
                                <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {progress.message}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!aiConfig.enabled && (
                <p className={styles['setting-description']} style={{ fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
                    {t('preferences:aiTagging.enableToConfig')}
                </p>
            )}
        </div>
    );
}

// Inline styles
const smallButtonStyle = {
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--color-text-primary)'
};

const categoryLabelStyle = (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    padding: 'var(--space-1) var(--space-2)',
    background: isSelected ? 'var(--color-primary-selected)' : 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)'
});


export default AITaggingTab;
