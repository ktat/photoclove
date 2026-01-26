import React, { useState, useEffect } from "react";
import { logger } from "../../../services/LoggerService.js";
import FaceDetectionService from "../../../services/FaceDetectionService.js";
import styles from '../Preferences.module.css';

function FaceDetectionTab({ config, setConfig, addFooterMessage }) {
    const [modelStatus, setModelStatus] = useState(null);
    const [modelInfo, setModelInfo] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadingModel, setDownloadingModel] = useState(null);
    const [stats, setStats] = useState(null);

    // Fetch model status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const [status, info, statistics] = await Promise.all([
                    FaceDetectionService.getModelStatus(),
                    FaceDetectionService.getModelInfo(),
                    FaceDetectionService.getStats().catch(() => null)
                ]);
                setModelStatus(status);
                setModelInfo(info);
                setStats(statistics);
            } catch (error) {
                logger.error('FaceDetectionTab', 'fetch_status_error', 'Failed to fetch model status', { error });
            }
        };
        fetchStatus();
    }, []);

    const handleDownloadModel = async (modelType) => {
        setIsDownloading(true);
        setDownloadingModel(modelType);
        try {
            if (addFooterMessage) {
                addFooterMessage("face_model_download", `Downloading ${modelType} model... This may take a few minutes.`);
            }
            await FaceDetectionService.downloadModel(modelType);

            // Refresh status
            const newStatus = await FaceDetectionService.getModelStatus();
            setModelStatus(newStatus);

            if (addFooterMessage) {
                addFooterMessage("face_model_download", `${modelType} model downloaded successfully`);
            }
        } catch (error) {
            logger.error('FaceDetectionTab', 'model_download_error', 'Failed to download model', { modelType, error });
            if (addFooterMessage) {
                addFooterMessage("face_model_download_error", `Failed to download ${modelType}: ${error}`);
            }
        } finally {
            setIsDownloading(false);
            setDownloadingModel(null);
        }
    };

    const handleDeleteModel = async (modelType) => {
        if (!window.confirm(`Are you sure you want to delete the ${modelType} model?`)) {
            return;
        }

        try {
            await FaceDetectionService.deleteModel(modelType);
            const newStatus = await FaceDetectionService.getModelStatus();
            setModelStatus(newStatus);
            if (addFooterMessage) {
                addFooterMessage("face_model_delete", `${modelType} model deleted`);
            }
        } catch (error) {
            logger.error('FaceDetectionTab', 'model_delete_error', 'Failed to delete model', { modelType, error });
        }
    };

    const getModelDetails = (type) => {
        if (!modelInfo?.models) return null;
        return modelInfo.models.find(m =>
            type === 'detector' ? m.filename.includes('scrfd') : m.filename.includes('arcface')
        );
    };

    const detectorModel = getModelDetails('detector');
    const embedderModel = getModelDetails('embedder');

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Face Detection</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Detect and recognize faces in your photos using InsightFace AI models.
            </p>

            {/* Model Status */}
            <div className={styles['setting-group']}>
                <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>Model Status</h3>

                {/* Detector Model */}
                <div style={modelCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h4 style={{ margin: 0, marginBottom: 'var(--space-1)' }}>
                                {detectorModel?.name || 'Face Detector (SCRFD)'}
                            </h4>
                            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {detectorModel?.description || 'Detects faces in photos'}
                            </p>
                            <p style={{ margin: 0, marginTop: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                Size: ~{detectorModel?.size_mb || 30} MB
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={statusBadgeStyle(modelStatus?.detector_available)}>
                                {modelStatus?.detector_available ? 'Ready' : 'Not Downloaded'}
                            </span>
                            {modelStatus?.detector_available ? (
                                <button
                                    onClick={() => handleDeleteModel('detector')}
                                    style={deleteButtonStyle}
                                >
                                    Delete
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleDownloadModel('detector')}
                                    disabled={isDownloading}
                                    style={downloadButtonStyle(isDownloading && downloadingModel === 'detector')}
                                >
                                    {isDownloading && downloadingModel === 'detector' ? 'Downloading...' : 'Download'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Embedder Model */}
                <div style={modelCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h4 style={{ margin: 0, marginBottom: 'var(--space-1)' }}>
                                {embedderModel?.name || 'Face Embedder (ArcFace)'}
                            </h4>
                            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {embedderModel?.description || 'Generates face embeddings for recognition'}
                            </p>
                            <p style={{ margin: 0, marginTop: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                Size: ~{embedderModel?.size_mb || 120} MB
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={statusBadgeStyle(modelStatus?.embedder_available)}>
                                {modelStatus?.embedder_available ? 'Ready' : 'Not Downloaded'}
                            </span>
                            {modelStatus?.embedder_available ? (
                                <button
                                    onClick={() => handleDeleteModel('embedder')}
                                    style={deleteButtonStyle}
                                >
                                    Delete
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleDownloadModel('embedder')}
                                    disabled={isDownloading}
                                    style={downloadButtonStyle(isDownloading && downloadingModel === 'embedder')}
                                >
                                    {isDownloading && downloadingModel === 'embedder' ? 'Downloading...' : 'Download'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {!modelStatus?.is_ready && (
                    <p style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                        Both models are required for face detection and recognition.
                    </p>
                )}
            </div>

            {/* Detection Settings */}
            <div className={styles['setting-group']} style={{ marginTop: 'var(--space-5)' }}>
                <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>Detection Settings</h3>

                {/* Confidence Threshold */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={labelStyle}>
                        Confidence Threshold: {Math.round((config?.face_detection?.confidence_threshold || 0.7) * 100)}%
                    </label>
                    <p style={descriptionStyle}>
                        Only faces with confidence above this threshold will be detected. Higher values reduce false positives.
                    </p>
                    <input
                        type="range"
                        min="30"
                        max="95"
                        value={Math.round((config?.face_detection?.confidence_threshold || 0.7) * 100)}
                        onChange={(e) => {
                            const newValue = parseInt(e.target.value) / 100;
                            setConfig({
                                ...config,
                                face_detection: {
                                    ...config?.face_detection,
                                    confidence_threshold: newValue
                                }
                            });
                        }}
                        style={sliderStyle}
                    />
                    <div style={sliderLabelsStyle}>
                        <span>30% (More faces)</span>
                        <span>95% (Fewer false positives)</span>
                    </div>
                </div>

                {/* Max Faces */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={labelStyle}>
                        Maximum Faces per Photo: {config?.face_detection?.max_faces || 50}
                    </label>
                    <p style={descriptionStyle}>
                        Maximum number of faces to detect in a single photo.
                    </p>
                    <input
                        type="range"
                        min="5"
                        max="100"
                        value={config?.face_detection?.max_faces || 50}
                        onChange={(e) => {
                            const newValue = parseInt(e.target.value);
                            setConfig({
                                ...config,
                                face_detection: {
                                    ...config?.face_detection,
                                    max_faces: newValue
                                }
                            });
                        }}
                        style={sliderStyle}
                    />
                    <div style={sliderLabelsStyle}>
                        <span>5</span>
                        <span>100</span>
                    </div>
                </div>

                {/* Generate Embeddings */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={config?.face_detection?.generate_embeddings !== false}
                            onChange={(e) => {
                                setConfig({
                                    ...config,
                                    face_detection: {
                                        ...config?.face_detection,
                                        generate_embeddings: e.target.checked
                                    }
                                });
                            }}
                            style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: 'var(--font-size-sm)' }}>Generate face embeddings for recognition</span>
                    </label>
                    <p style={{ ...descriptionStyle, marginLeft: 'var(--space-6)' }}>
                        Enables face recognition and grouping. Disable to save processing time if you only need face detection.
                    </p>
                </div>

                {/* Minimum Thumbnail Size */}
                <div style={{ marginBottom: 'var(--space-2)' }}>
                    <label style={labelStyle}>
                        Minimum Thumbnail Size: {config?.face_detection?.min_thumbnail_size || 160}px
                    </label>
                    <p style={descriptionStyle}>
                        Use EXIF thumbnail for faster detection when thumbnail is larger than this size.
                        Set to 0 to always use full image (slower but more accurate).
                    </p>
                    <input
                        type="range"
                        min="0"
                        max="400"
                        step="20"
                        value={config?.face_detection?.min_thumbnail_size ?? 160}
                        onChange={(e) => {
                            const newValue = parseInt(e.target.value);
                            setConfig({
                                ...config,
                                face_detection: {
                                    ...config?.face_detection,
                                    min_thumbnail_size: newValue
                                }
                            });
                        }}
                        style={sliderStyle}
                    />
                    <div style={sliderLabelsStyle}>
                        <span>0 (Always full image)</span>
                        <span>400px</span>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            {stats && (
                <div className={styles['setting-group']} style={{ marginTop: 'var(--space-5)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>Statistics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
                        <div style={statCardStyle}>
                            <div style={statNumberStyle}>{stats.total_faces}</div>
                            <div style={statLabelStyle}>Faces Detected</div>
                        </div>
                        <div style={statCardStyle}>
                            <div style={statNumberStyle}>{stats.photos_with_faces}</div>
                            <div style={statLabelStyle}>Photos with Faces</div>
                        </div>
                        <div style={statCardStyle}>
                            <div style={statNumberStyle}>{stats.total_persons}</div>
                            <div style={statLabelStyle}>People</div>
                        </div>
                        <div style={statCardStyle}>
                            <div style={statNumberStyle}>{stats.named_persons}</div>
                            <div style={statLabelStyle}>Named People</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className={styles['setting-group']} style={{ marginTop: 'var(--space-5)' }}>
                <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>About Face Detection</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                    Face detection uses InsightFace models to find and recognize faces in your photos:
                </p>
                <ul style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, paddingLeft: 'var(--space-5)' }}>
                    <li><strong>SCRFD</strong> - High-performance face detection model</li>
                    <li><strong>ArcFace</strong> - Face embedding model for recognition (512-dimensional vectors)</li>
                </ul>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)' }}>
                    Models are from InsightFace buffalo_l pack (non-commercial research only). Total download size: ~191 MB.
                </p>
            </div>
        </div>
    );
}

// Inline styles
const modelCardStyle = {
    padding: 'var(--space-4)',
    background: 'var(--color-bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-default)',
    marginBottom: 'var(--space-3)'
};

const statusBadgeStyle = (isReady) => ({
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    background: isReady ? 'var(--color-success)' : 'var(--color-bg-muted)',
    color: isReady ? 'white' : 'var(--color-text-secondary)'
});

const downloadButtonStyle = (isDownloading) => ({
    padding: 'var(--space-1) var(--space-3)',
    background: isDownloading ? 'var(--color-bg-muted)' : 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: isDownloading ? 'not-allowed' : 'pointer',
    fontSize: 'var(--font-size-sm)',
    opacity: isDownloading ? 0.6 : 1
});

const deleteButtonStyle = {
    padding: 'var(--space-1) var(--space-3)',
    background: 'transparent',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)'
};

const statCardStyle = {
    padding: 'var(--space-3)',
    background: 'var(--color-bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-default)',
    textAlign: 'center'
};

const statNumberStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: 'var(--color-primary)'
};

const statLabelStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-1)'
};

const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    marginBottom: 'var(--space-1)'
};

const descriptionStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 0,
    marginBottom: 'var(--space-2)'
};

const sliderStyle = {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    cursor: 'pointer',
    accentColor: 'var(--color-primary)'
};

const sliderLabelsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-1)'
};

export default FaceDetectionTab;
