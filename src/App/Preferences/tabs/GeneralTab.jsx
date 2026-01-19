import React from 'react';
import classNames from 'classnames';
import PickFolderSingle from '../../../FolderPicker.jsx';
import styles from '../Preferences.module.css';

const GeneralTab = ({ config, setConfig, additionalExportFrom, setAdditionalExportFrom }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Path Settings</h2>
            <div className={styles['setting-group']}>
                <PickFolderSingle
                    label="Data Path:"
                    folder={config.data_path}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, data_path: folder }))}
                />
                <PickFolderSingle
                    label="Trash Path:"
                    folder={config.trash_path}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, trash_path: folder }))}
                />
                <PickFolderSingle
                    label="Download Directory:"
                    folder={config.download_dir}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, download_dir: folder }))}
                />
                <PickFolderSingle
                    label="Import To:"
                    folder={config.import_to}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, import_to: folder }))}
                />
            </div>

            <h2 className={styles['section-title']}>Export From</h2>
            <div className={classNames(styles['setting-group'], styles['folder-list'])}>
                {config.export_from.map((v, i) => (
                    <PickFolderSingle
                        key={i}
                        label={i === 0 ? "Export From:" : ""}
                        folder={config.export_from[i]}
                        setFunc={(folder) => {
                            setConfig(prev => ({
                                ...prev,
                                export_from: prev.export_from.map((item, idx) =>
                                    idx === i ? folder : item
                                )
                            }))
                        }}
                    />
                ))}
                <div className={styles['add-export-path']}>
                    <button
                        className={styles['btn-secondary']}
                        onClick={() => setAdditionalExportFrom(additionalExportFrom + 1)}
                    >
                        + Add Path
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralTab;
