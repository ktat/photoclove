import React from "react";
import { useTranslation } from 'react-i18next';

// Available AI models (descriptions are i18n keys)
export const AI_MODELS = [
    {
        id: "mobilenet",
        name: "MobileNet (ImageNet)",
        license: "Apache 2.0",
        size: "~15MB",
        speedKey: "fast",
        accuracy: 2,
        descriptionKey: "mobilenetDescription",
        supportsCustomLabels: false,
    },
    {
        id: "openclip",
        name: "OpenCLIP (ViT-B/32)",
        license: "MIT",
        size: "~350MB",
        speedKey: "medium",
        accuracy: 4,
        descriptionKey: "openclipDescription",
        supportsCustomLabels: true,
        recommended: true,
    },
    {
        id: "siglip",
        name: "SigLIP (Base)",
        license: "Apache 2.0",
        size: "~400MB",
        speedKey: "medium",
        accuracy: 5,
        descriptionKey: "siglipDescription",
        supportsCustomLabels: true,
    },
];

function AIModelSelector({ selectedModelId, modelStatuses, downloadingModelId, onModelSelect, onDownloadModel }) {
    const { t } = useTranslation(['preferences']);
    const isAnyDownloading = downloadingModelId !== null;

    return (
        <div style={{ marginTop: 'var(--space-4)' }}>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>{t('preferences:aiTagging.model')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {AI_MODELS.map(model => {
                    const isSelected = selectedModelId === model.id;
                    const status = modelStatuses[model.id] || {};
                    const isDownloaded = status.downloaded || model.id === 'mobilenet';
                    const isDownloadingThis = downloadingModelId === model.id;

                    return (
                        <div
                            key={model.id}
                            onClick={() => !isAnyDownloading && onModelSelect(model.id)}
                            style={{
                                padding: 'var(--space-4)',
                                background: isSelected ? 'var(--color-primary-selected)' : 'var(--color-bg-surface)',
                                border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--color-border-default)',
                                borderRadius: 'var(--radius-lg)',
                                cursor: isAnyDownloading ? 'wait' : 'pointer',
                                position: 'relative',
                                opacity: isAnyDownloading && !isDownloadingThis ? 0.6 : 1,
                                transition: 'all 0.2s ease-out',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <input
                                    type="radio"
                                    checked={isSelected}
                                    onChange={() => onModelSelect(model.id)}
                                    style={{ marginRight: 'var(--space-1)' }}
                                />
                                <strong style={{ fontSize: 'var(--font-size-base)' }}>{model.name}</strong>
                                {model.recommended && (
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        background: 'var(--color-primary)',
                                        color: 'white',
                                        padding: 'var(--space-1) var(--space-2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontWeight: '600',
                                    }}>
                                        {t('preferences:aiTagging.recommended')}
                                    </span>
                                )}
                                {!isDownloaded && (
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        background: 'var(--color-warning)',
                                        color: 'var(--color-bg-base)',
                                        padding: 'var(--space-1) var(--space-2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontWeight: '600',
                                    }}>
                                        {t('preferences:aiTagging.notDownloaded')}
                                    </span>
                                )}
                            </div>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                margin: 'var(--space-2) 0 var(--space-2) var(--space-5)',
                            }}>
                                {t(`preferences:aiTagging.${model.descriptionKey}`)}
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-4)',
                                marginLeft: 'var(--space-5)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-muted)',
                            }}>
                                <span>{t('preferences:aiTagging.license')}: {model.license}</span>
                                <span>{t('preferences:aiTagging.size')}: {model.size}</span>
                                <span>{t('preferences:aiTagging.speed')}: {t(`preferences:aiTagging.speed_${model.speedKey}`)}</span>
                                <span>{t('preferences:aiTagging.accuracy')}: {'★'.repeat(model.accuracy)}{'☆'.repeat(5 - model.accuracy)}</span>
                            </div>
                            {!isDownloaded && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isAnyDownloading) {
                                            onDownloadModel(model.id);
                                        }
                                    }}
                                    disabled={isAnyDownloading}
                                    style={{
                                        marginTop: 'var(--space-2)',
                                        marginLeft: 'var(--space-5)',
                                        padding: 'var(--space-1) var(--space-3)',
                                        background: isAnyDownloading ? 'var(--color-bg-muted)' : 'var(--color-primary)',
                                        color: 'var(--color-bg-base)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: isAnyDownloading ? 'wait' : 'pointer',
                                        opacity: isAnyDownloading && !isDownloadingThis ? 0.5 : 1,
                                        fontSize: 'var(--font-size-sm)',
                                    }}
                                >
                                    {isDownloadingThis ? t('preferences:aiTagging.downloading') : t('preferences:aiTagging.downloadModel')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AIModelSelector;
