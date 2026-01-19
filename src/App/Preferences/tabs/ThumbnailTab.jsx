import React from 'react';
import PickFolderSingle from '../../../FolderPicker.jsx';
import styles from '../Preferences.module.css';

const ThumbnailTab = ({ config, setConfig }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Thumbnail Settings</h2>
            <div className={styles['setting-group']}>
                <PickFolderSingle
                    label="Store Path:"
                    folder={config.thumbnail_store}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, thumbnail_store: folder }))}
                />
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="use-exif-thumbnail-check"
                        checked={config.use_exif_thumbnail || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, use_exif_thumbnail: e.target.checked }))}
                    />
                    <label htmlFor="use-exif-thumbnail-check">
                        Use EXIF thumbnails when available (faster import)
                    </label>
                </div>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="thumbnail-orientation-correction-check"
                        checked={config.thumbnail_orientation_correction || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_orientation_correction: e.target.checked }))}
                    />
                    <label htmlFor="thumbnail-orientation-correction-check">
                        Apply EXIF orientation correction to thumbnails
                    </label>
                </div>
            </div>

            <h2 className={styles['section-title']}>Compression</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>Compress Quality:</label>
                    <select
                        value={config.thumbnail_compression_quality || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_compression_quality: parseFloat(e.target.value) }))}
                    >
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => (
                            <option key={i} value={v / 100}>{v}%</option>
                        ))}
                    </select>
                </div>
                <div className={styles['setting-row']}>
                    <label>Minimize Ratio:</label>
                    <select
                        value={config.thumbnail_ratio || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_ratio: parseFloat(e.target.value) }))}
                    >
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => (
                            <option key={i} value={v / 100}>{v}%</option>
                        ))}
                    </select>
                </div>
                <div className={styles['setting-row']}>
                    <label>Ignore File Size:</label>
                    <select
                        value={config.thumbnail_ignore_file_size || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_ignore_file_size: parseFloat(e.target.value) }))}
                    >
                        {[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => (
                            <option key={i} value={1024 * 1024 * v}>{v}MB</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default ThumbnailTab;
