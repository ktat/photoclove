import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';
import {
    STORAGE_PROVIDERS,
    MAX_FILE_SIZE_OPTIONS,
    getRegionsForStorageType,
    parseBucketUri,
    buildBucketUri
} from './S3Constants.js';

function S3BackupTab({ config, setConfig, addFooterMessage }) {
    const { t } = useTranslation('preferences');
    const [awsProfiles, setAwsProfiles] = useState(['default']);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [syncStats, setSyncStats] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [accessKeyId, setAccessKeyId] = useState('');
    const [secretAccessKey, setSecretAccessKey] = useState('');
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
    const [credentialsPreview, setCredentialsPreview] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [customRegion, setCustomRegion] = useState('');

    // Get S3 config with defaults
    const s3Config = config.s3 || {
        enabled: false,
        storage_type: 'aws_s3',
        bucket_uri: '',
        region: 'ap-northeast-1',
        auth_method: 'aws_credentials',
        profile: null,
        custom_endpoint: null,
        auto_sync: false,
        backup_db: true,
        backup_thumbnails: true,
        max_file_size_mb: null,
        last_sync_at: null
    };

    // Parse bucket URI into bucket name and prefix
    const { bucketName, prefix } = parseBucketUri(s3Config.bucket_uri);

    // Check if current region is in the predefined list, if not, set as custom region
    useEffect(() => {
        const regions = getRegionsForStorageType(s3Config.storage_type);
        const regionExists = regions.some(r => r.id === s3Config.region);
        if (!regionExists && s3Config.region) {
            setCustomRegion(s3Config.region);
        } else {
            setCustomRegion('');
        }
    }, [s3Config.storage_type, s3Config.region]);

    // Load AWS profiles on mount
    useEffect(() => {
        const loadProfiles = async () => {
            try {
                const result = await invoke("list_aws_profiles");
                const profiles = JSON.parse(result);
                setAwsProfiles(profiles);
                logger.debug('S3BackupTab', 'profiles_loaded', 'AWS profiles loaded', { count: profiles.length });
            } catch (error) {
                logger.error('S3BackupTab', 'profiles_load_error', 'Failed to load AWS profiles', { error });
            }
        };
        loadProfiles();
    }, []);

    // Check if credentials are stored for the current provider
    useEffect(() => {
        const checkCredentials = async () => {
            try {
                const result = await invoke("get_s3_credentials_preview", { provider: s3Config.storage_type });
                const data = JSON.parse(result);
                setHasStoredCredentials(data.has_credentials);
                setCredentialsPreview(data.access_key_preview);
            } catch (error) {
                logger.error('S3BackupTab', 'check_credentials_error', 'Failed to check credentials', { error });
            }
        };
        checkCredentials();
    }, [s3Config.storage_type]);

    // Load sync stats when enabled
    useEffect(() => {
        if (s3Config.enabled) {
            loadSyncStats();
        }
    }, [s3Config.enabled]);

    const loadSyncStats = async () => {
        try {
            const result = await invoke("get_s3_sync_stats");
            const stats = JSON.parse(result);
            setSyncStats(stats);
        } catch (error) {
            logger.error('S3BackupTab', 'sync_stats_error', 'Failed to load sync stats', { error });
        }
    };

    const updateS3Config = (updates) => {
        // Auto-set auth_method when storage_type changes
        if (updates.storage_type) {
            if (updates.storage_type === 'aws_s3') {
                updates = { ...updates, auth_method: updates.auth_method || 'aws_credentials' };
            } else {
                updates = { ...updates, auth_method: 'access_key' };
            }
        }

        setConfig(prev => ({
            ...prev,
            s3: { ...s3Config, ...updates }
        }));
    };

    const updateBucketName = (newBucketName) => {
        const bucket_uri = buildBucketUri(newBucketName, prefix);
        updateS3Config({ bucket_uri });
    };

    const updatePrefix = (newPrefix) => {
        const bucket_uri = buildBucketUri(bucketName, newPrefix);
        updateS3Config({ bucket_uri });
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            await invoke("save_s3_config", {
                enabled: s3Config.enabled,
                storageType: s3Config.storage_type,
                bucketUri: s3Config.bucket_uri,
                region: s3Config.region,
                authMethod: s3Config.auth_method,
                profile: s3Config.profile,
                customEndpoint: s3Config.custom_endpoint,
                autoSync: s3Config.auto_sync,
                backupDb: s3Config.backup_db,
                backupThumbnails: s3Config.backup_thumbnails,
                maxFileSizeMb: s3Config.max_file_size_mb
            });

            const result = await invoke("test_s3_connection");
            const data = JSON.parse(result);
            setTestResult({ success: data.success, message: data.message });

            if (data.success) {
                setStatusMessage({ type: 'success', text: t('s3Backup.connectionSuccess') });
                addFooterMessage?.("s3_test", t('s3Backup.connectionSuccess'));
            } else {
                setStatusMessage({ type: 'error', text: `${t('s3Backup.connectionFailed')}: ${data.message}` });
                addFooterMessage?.("s3_test_error", `${t('s3Backup.connectionFailed')}: ${data.message}`);
            }
        } catch (error) {
            setTestResult({ success: false, message: error.toString() });
            setStatusMessage({ type: 'error', text: `${t('s3Backup.connectionFailed')}: ${error}` });
            addFooterMessage?.("s3_test_error", `${t('s3Backup.connectionFailed')}: ${error}`);
            logger.error('S3BackupTab', 'test_connection_error', 'Connection test failed', { error });
        } finally {
            setIsTesting(false);
        }
    };

    const handleFullSync = async () => {
        if (!window.confirm(t('s3Backup.fullSyncConfirm'))) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await invoke("enqueue_s3_full_sync");
            const data = JSON.parse(result);
            setStatusMessage({ type: 'success', text: t('s3Backup.syncStarted', { count: data.to_sync }) });
            addFooterMessage?.("s3_sync", t('s3Backup.syncStarted', { count: data.to_sync }));
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.syncFailed')}: ${error}` });
            addFooterMessage?.("s3_sync_error", `${t('s3Backup.syncFailed')}: ${error}`);
            logger.error('S3BackupTab', 'full_sync_error', 'Failed to start full sync', { error });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveCredentials = async () => {
        if (!accessKeyId || !secretAccessKey) {
            setStatusMessage({ type: 'error', text: t('s3Backup.credentialsRequired') });
            addFooterMessage?.("s3_credentials_error", t('s3Backup.credentialsRequired'));
            return;
        }

        try {
            await invoke("store_s3_credentials", {
                provider: s3Config.storage_type,
                accessKeyId,
                secretAccessKey
            });
            setHasStoredCredentials(true);
            setAccessKeyId('');
            setSecretAccessKey('');

            const result = await invoke("get_s3_credentials_preview", { provider: s3Config.storage_type });
            const data = JSON.parse(result);
            setCredentialsPreview(data.access_key_preview);

            setStatusMessage({ type: 'success', text: t('s3Backup.credentialsSaved', { provider: selectedProvider.label }) });
            addFooterMessage?.("s3_credentials", t('s3Backup.credentialsSaved', { provider: selectedProvider.label }));
            logger.info('S3BackupTab', 'credentials_saved', 'S3 credentials saved to keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.credentialsSaveFailed')}: ${error}` });
            addFooterMessage?.("s3_credentials_error", `${t('s3Backup.credentialsSaveFailed')}: ${error}`);
            logger.error('S3BackupTab', 'credentials_save_error', 'Failed to save credentials', { error });
        }
    };

    const handleDeleteCredentials = async () => {
        if (!window.confirm(t('s3Backup.deleteCredentialsConfirm', { provider: selectedProvider.label }))) {
            return;
        }

        try {
            await invoke("delete_s3_credentials", { provider: s3Config.storage_type });
            setHasStoredCredentials(false);
            setCredentialsPreview(null);
            setStatusMessage({ type: 'success', text: t('s3Backup.credentialsDeleted', { provider: selectedProvider.label }) });
            addFooterMessage?.("s3_credentials", t('s3Backup.credentialsDeleted', { provider: selectedProvider.label }));
            logger.info('S3BackupTab', 'credentials_deleted', 'S3 credentials deleted from keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.credentialsDeleteFailed')}: ${error}` });
            addFooterMessage?.("s3_credentials_error", `${t('s3Backup.credentialsDeleteFailed')}: ${error}`);
            logger.error('S3BackupTab', 'credentials_delete_error', 'Failed to delete credentials', { error });
        }
    };

    const selectedProvider = STORAGE_PROVIDERS.find(p => p.id === s3Config.storage_type) || STORAGE_PROVIDERS[0];
    const showEndpointField = selectedProvider.hasEndpoint || s3Config.storage_type === 'custom';
    const showProfileSelector = s3Config.storage_type === 'aws_s3' && s3Config.auth_method === 'aws_credentials';
    const needsAccessKey = s3Config.storage_type !== 'aws_s3' || s3Config.auth_method === 'access_key';
    const regions = getRegionsForStorageType(s3Config.storage_type);

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('s3Backup.title')}</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                {t('s3Backup.description')}
            </p>

            {/* Main Toggle */}
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="s3-enabled"
                        checked={s3Config.enabled}
                        onChange={(e) => updateS3Config({ enabled: e.target.checked })}
                    />
                    <label htmlFor="s3-enabled">{t('s3Backup.enable')}</label>
                </div>
            </div>

            {s3Config.enabled && (
                <>
                    {/* Storage Provider */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.storageProvider')}</h3>
                        <div className={styles['setting-row']}>
                            <label>{t('s3Backup.provider')}</label>
                            <select
                                value={s3Config.storage_type}
                                onChange={(e) => updateS3Config({ storage_type: e.target.value })}
                                style={{ width: '200px' }}
                            >
                                {STORAGE_PROVIDERS.map(provider => (
                                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Storage Settings */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.storageSettings')}</h3>

                        {showEndpointField && (
                            <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                <label>{t('s3Backup.endpointUrl')}</label>
                                <input
                                    type="text"
                                    value={s3Config.custom_endpoint || ''}
                                    onChange={(e) => updateS3Config({ custom_endpoint: e.target.value || null })}
                                    placeholder="https://s3.example.com"
                                    style={{ width: '300px' }}
                                />
                            </div>
                        )}

                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                            <label>{t('s3Backup.bucketName')}</label>
                            <input
                                type="text"
                                value={bucketName}
                                onChange={(e) => updateBucketName(e.target.value)}
                                placeholder="my-bucket"
                                style={{ width: '300px' }}
                            />
                        </div>

                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                            <label>{t('s3Backup.prefix')}</label>
                            <div style={{ width: '300px' }}>
                                <input
                                    type="text"
                                    value={prefix}
                                    onChange={(e) => updatePrefix(e.target.value)}
                                    placeholder="photos/backup"
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.prefixDescription')}
                                </div>
                            </div>
                        </div>

                        <div className={styles['setting-row']}>
                            <label>{t('s3Backup.region')}</label>
                            <div style={{ width: '300px' }}>
                                <select
                                    value={customRegion ? '' : s3Config.region}
                                    onChange={(e) => {
                                        setCustomRegion('');
                                        updateS3Config({ region: e.target.value });
                                    }}
                                    disabled={customRegion !== ''}
                                    style={{ width: '100%', opacity: customRegion ? 0.6 : 1 }}
                                >
                                    {regions.map(region => (
                                        <option key={region.id} value={region.id}>{region.label}</option>
                                    ))}
                                </select>
                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {t('s3Backup.customRegionHint')}
                                </div>
                                <input
                                    type="text"
                                    value={customRegion}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setCustomRegion(value);
                                        if (value) {
                                            updateS3Config({ region: value });
                                        }
                                    }}
                                    placeholder="e.g., us-west-3, eu-south-2"
                                    style={{ width: '100%', marginTop: 'var(--space-1)' }}
                                />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.customRegionDescription')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authentication */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.authentication')}</h3>

                        {s3Config.storage_type === 'aws_s3' && (
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-aws-credentials"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'aws_credentials'}
                                        onChange={() => updateS3Config({ auth_method: 'aws_credentials' })}
                                    />
                                    <label htmlFor="auth-aws-credentials">{t('s3Backup.authAwsCredentials')}</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-iam-role"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'iam_role'}
                                        onChange={() => updateS3Config({ auth_method: 'iam_role' })}
                                    />
                                    <label htmlFor="auth-iam-role">{t('s3Backup.authIamRole')}</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-access-key"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'access_key'}
                                        onChange={() => updateS3Config({ auth_method: 'access_key' })}
                                    />
                                    <label htmlFor="auth-access-key">{t('s3Backup.authAccessKey')}</label>
                                </div>
                            </div>
                        )}

                        {showProfileSelector && (
                            <div className={styles['setting-row']}>
                                <label>{t('s3Backup.awsProfile')}</label>
                                <select
                                    value={s3Config.profile || 'default'}
                                    onChange={(e) => updateS3Config({ profile: e.target.value === 'default' ? null : e.target.value })}
                                    style={{ width: '200px' }}
                                >
                                    {awsProfiles.map(profile => (
                                        <option key={profile} value={profile}>{profile}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {needsAccessKey && (
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                    {t('s3Backup.accessKeyCredentials', { provider: selectedProvider.label })}
                                </h4>

                                {hasStoredCredentials ? (
                                    <div>
                                        <div style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                            <strong style={{ color: 'var(--color-success)' }}>✓ {t('s3Backup.credentialsStored')}</strong>
                                            {credentialsPreview && (
                                                <div style={{ marginTop: 'var(--space-1)' }}>
                                                    {t('s3Backup.accessKey')}: <code style={{ fontSize: 'var(--font-size-xs)' }}>{credentialsPreview}</code>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleDeleteCredentials}
                                            style={{
                                                padding: 'var(--space-2) var(--space-3)',
                                                background: 'var(--color-danger)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-sm)'
                                            }}
                                        >
                                            {t('s3Backup.deleteCredentials')}
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                            <label>{t('s3Backup.accessKeyId')}</label>
                                            <div style={{ width: '300px' }}>
                                                <input
                                                    type="text"
                                                    value={accessKeyId}
                                                    onChange={(e) => setAccessKeyId(e.target.value)}
                                                    placeholder={t('s3Backup.accessKeyIdPlaceholder')}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                                    {t('s3Backup.accessKeyIdExample')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                            <label>{t('s3Backup.secretAccessKey')}</label>
                                            <div style={{ width: '300px' }}>
                                                <input
                                                    type="password"
                                                    value={secretAccessKey}
                                                    onChange={(e) => setSecretAccessKey(e.target.value)}
                                                    placeholder={t('s3Backup.secretAccessKeyPlaceholder')}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                                    {t('s3Backup.secretAccessKeyDescription')}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSaveCredentials}
                                            disabled={!accessKeyId || !secretAccessKey}
                                            style={{
                                                padding: 'var(--space-2) var(--space-4)',
                                                background: (!accessKeyId || !secretAccessKey) ? 'var(--color-bg-muted)' : 'var(--color-primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: (!accessKeyId || !secretAccessKey) ? 'not-allowed' : 'pointer',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 500
                                            }}
                                        >
                                            {t('s3Backup.saveCredentials')}
                                        </button>
                                        <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                            {t('s3Backup.credentialsSecurityNote')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sync Options */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.syncOptions')}</h3>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-auto-sync"
                                checked={s3Config.auto_sync}
                                onChange={(e) => updateS3Config({ auto_sync: e.target.checked })}
                            />
                            <label htmlFor="s3-auto-sync">{t('s3Backup.autoSync')}</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-db"
                                checked={s3Config.backup_db}
                                onChange={(e) => updateS3Config({ backup_db: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-db">{t('s3Backup.backupDatabase')}</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-thumbnails"
                                checked={s3Config.backup_thumbnails}
                                onChange={(e) => updateS3Config({ backup_thumbnails: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-thumbnails">{t('s3Backup.backupThumbnails')}</label>
                        </div>

                        <div className={styles['setting-row']} style={{ marginTop: 'var(--space-3)' }}>
                            <label>{t('s3Backup.maxFileSize')}</label>
                            <div style={{ width: '300px' }}>
                                <select
                                    value={s3Config.max_file_size_mb || ''}
                                    onChange={(e) => updateS3Config({ max_file_size_mb: e.target.value ? parseInt(e.target.value) : null })}
                                    style={{ width: '150px' }}
                                >
                                    {MAX_FILE_SIZE_OPTIONS.map(option => (
                                        <option key={option.value || 'none'} value={option.value || ''}>{option.label}</option>
                                    ))}
                                </select>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.maxFileSizeDescription')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status */}
                    {syncStats && (
                        <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.syncStatus')}</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                <span>{t('s3Backup.total')}: <strong>{syncStats.total_photos}</strong></span>
                                <span>{t('s3Backup.synced')}: <strong style={{ color: 'var(--color-success)' }}>{syncStats.synced}</strong></span>
                                <span>{t('s3Backup.pending')}: <strong style={{ color: 'var(--color-warning)' }}>{syncStats.not_synced}</strong></span>
                            </div>
                            {syncStats.last_sync_at && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    {t('s3Backup.lastSync')}: {new Date(syncStats.last_sync_at).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Test & Sync Buttons */}
                    <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting || !s3Config.bucket_uri}
                            style={buttonStyle(isTesting)}
                        >
                            {isTesting ? t('s3Backup.testing') : t('s3Backup.testConnection')}
                        </button>

                        <button
                            onClick={handleFullSync}
                            disabled={isSyncing || !s3Config.bucket_uri}
                            style={primaryButtonStyle(isSyncing)}
                        >
                            {isSyncing ? t('s3Backup.syncing') : t('s3Backup.fullSync')}
                        </button>
                    </div>

                    {/* Status Message */}
                    {statusMessage && (
                        <div style={{
                            marginTop: 'var(--space-3)',
                            padding: 'var(--space-3)',
                            background: statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {statusMessage.text}
                        </div>
                    )}
                </>
            )}

            {!s3Config.enabled && (
                <p className={styles['setting-description']} style={{ fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
                    {t('s3Backup.enableToConfig')}
                </p>
            )}
        </div>
    );
}

// Inline styles
const buttonStyle = (isDisabled) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1
});

const primaryButtonStyle = (isDisabled) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: isDisabled ? 'var(--color-bg-muted)' : 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    fontWeight: 500
});

export default S3BackupTab;
