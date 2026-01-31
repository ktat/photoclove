import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import styles from '../Preferences.module.css';
import previewStyles from './ThemePreview.module.css';

const AppearanceTab = ({ config, setConfig }) => {
    const { t } = useTranslation('preferences');

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('appearance.theme')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>{t('appearance.theme')}:</label>
                    <select
                        value={config.color_theme || 'dark'}
                        onChange={(e) => {
                            setConfig(prev => ({ ...prev, color_theme: e.target.value }));
                            document.documentElement.setAttribute('data-theme', e.target.value);
                        }}
                    >
                        <option value="dark">{t('appearance.themeDark')}</option>
                        <option value="light">{t('appearance.themeLight')}</option>
                    </select>
                </div>
            </div>

            <h2 className={styles['section-title']}>{t('appearance.gridSize')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>{t('appearance.gridSize')}:</label>
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
