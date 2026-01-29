import React from "react";

// Available AI models
export const AI_MODELS = [
    {
        id: "mobilenet",
        name: "MobileNet (ImageNet)",
        license: "Apache 2.0",
        size: "~15MB",
        speed: "Fast",
        accuracy: 2,
        description: "Fast classification with 32 predefined categories. Good for basic object and scene detection.",
        supportsCustomLabels: false,
    },
    {
        id: "openclip",
        name: "OpenCLIP (ViT-B/32)",
        license: "MIT",
        size: "~350MB",
        speed: "Medium",
        accuracy: 4,
        description: "Flexible tagging with custom labels. Can detect people, scenes, events, and any custom concept.",
        supportsCustomLabels: true,
        recommended: true,
    },
    {
        id: "siglip",
        name: "SigLIP (Base)",
        license: "Apache 2.0",
        size: "~400MB",
        speed: "Medium",
        accuracy: 5,
        description: "Improved CLIP variant with better accuracy. Supports custom labels and multilingual text.",
        supportsCustomLabels: true,
    },
];

function AIModelSelector({ selectedModelId, modelStatuses, downloadingModelId, onModelSelect, onDownloadModel }) {
    const isAnyDownloading = downloadingModelId !== null;

    return (
        <div style={{ marginTop: 'var(--space-4)' }}>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>AI Model</h3>
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
                                        Recommended
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
                                        Not Downloaded
                                    </span>
                                )}
                            </div>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                margin: 'var(--space-2) 0 var(--space-2) var(--space-5)',
                            }}>
                                {model.description}
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-4)',
                                marginLeft: 'var(--space-5)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-muted)',
                            }}>
                                <span>License: {model.license}</span>
                                <span>Size: {model.size}</span>
                                <span>Speed: {model.speed}</span>
                                <span>Accuracy: {'★'.repeat(model.accuracy)}{'☆'.repeat(5 - model.accuracy)}</span>
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
                                    {isDownloadingThis ? 'Downloading...' : 'Download Model'}
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
