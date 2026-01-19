import React from 'react';
import classNames from 'classnames';
import styles from '../Preferences.module.css';
import previewStyles from './ThemePreview.module.css';

const AppearanceTab = ({ config, setConfig }) => {
    return (
        <div className={styles['preferences-section']}>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Theme changes are applied immediately for preview. Click "Save Changes" to persist.
            </p>
            <h2 className={styles['section-title']}>Color Theme</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>App Theme:</label>
                    <select
                        value={config.color_theme || 'dark'}
                        onChange={(e) => {
                            setConfig(prev => ({ ...prev, color_theme: e.target.value }));
                            document.documentElement.setAttribute('data-theme', e.target.value);
                        }}
                    >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                    </select>
                </div>
                <p className={styles['setting-description']}>
                    Change the overall color scheme of the application.
                </p>
            </div>

            <h2 className={styles['section-title']}>Photo Grid Theme</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>Grid Style:</label>
                    <select
                        value={config.photo_grid_theme || 'default'}
                        onChange={(e) => {
                            setConfig(prev => ({ ...prev, photo_grid_theme: e.target.value }));
                            document.documentElement.setAttribute('data-grid-theme', e.target.value);
                        }}
                    >
                        <option value="default">Default</option>
                        <option value="filmstrip">Film Strip (Negative)</option>
                        <option value="slide-mount">Slide Mount</option>
                        <option value="lightbox">Light Box</option>
                        <option value="slide-35mm">35mm Slide</option>
                    </select>
                </div>
                <p className={styles['setting-description']}>
                    Choose how photos are displayed in the grid.
                </p>
            </div>

            {/* Theme Preview Section */}
            <h2 className={styles['section-title']}>Preview</h2>
            <div className={styles['setting-group']}>
                <div
                    className={previewStyles['theme-preview-container']}
                    data-theme={config.color_theme || 'dark'}
                    data-grid-theme={config.photo_grid_theme || 'default'}
                >
                    <div className={previewStyles['theme-preview-grid']}>
                        <div className={previewStyles['preview-card']}>
                            <div className={previewStyles['preview-thumbnail']}></div>
                            <div className={previewStyles['preview-menu']}></div>
                        </div>
                        <div className={previewStyles['preview-card']}>
                            <div className={previewStyles['preview-thumbnail']}></div>
                            <div className={previewStyles['preview-menu']}></div>
                        </div>
                        <div className={classNames(previewStyles['preview-card'], previewStyles.selected)}>
                            <div className={classNames(previewStyles['preview-thumbnail'], previewStyles.selected)}></div>
                            <div className={previewStyles['preview-menu']}>
                                <span className={previewStyles['preview-check']}>✓</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearanceTab;
