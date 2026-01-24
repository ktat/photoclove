import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';

// Storage provider options
const STORAGE_PROVIDERS = [
    { id: 'aws_s3', label: 'Amazon S3', hasEndpoint: false },
    { id: 'wasabi', label: 'Wasabi', hasEndpoint: true },
    { id: 'minio', label: 'MinIO', hasEndpoint: true },
    { id: 'cloudflare_r2', label: 'Cloudflare R2', hasEndpoint: true },
    { id: 'digitalocean', label: 'DigitalOcean Spaces', hasEndpoint: true },
    { id: 'custom', label: 'Other (Custom Endpoint)', hasEndpoint: true }
];

// Common AWS regions
const AWS_REGIONS = [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (Ohio)' },
    { id: 'us-west-1', label: 'US West (N. California)' },
    { id: 'us-west-2', label: 'US West (Oregon)' },
    { id: 'eu-west-1', label: 'EU (Ireland)' },
    { id: 'eu-west-2', label: 'EU (London)' },
    { id: 'eu-central-1', label: 'EU (Frankfurt)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { id: 'sa-east-1', label: 'South America (São Paulo)' }
];

// Max file size options
const MAX_FILE_SIZE_OPTIONS = [
    { value: null, label: 'No limit' },
    { value: 50, label: '50 MB' },
    { value: 100, label: '100 MB' },
    { value: 200, label: '200 MB' },
    { value: 500, label: '500 MB' }
];

function S3BackupTab({ config, setConfig, addFooterMessage }) {
    const [awsProfiles, setAwsProfiles] = useState(['default']);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [syncStats, setSyncStats] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

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
        max_file_size_mb: null,
        last_sync_at: null
    };

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
        setConfig(prev => ({
            ...prev,
            s3: { ...s3Config, ...updates }
        }));
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            // Save config first
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
                maxFileSizeMb: s3Config.max_file_size_mb
            });

            const result = await invoke("test_s3_connection");
            const data = JSON.parse(result);
            setTestResult({ success: data.success, message: data.message });

            if (data.success) {
                addFooterMessage("s3_test", "S3 connection successful");
            } else {
                addFooterMessage("s3_test_error", `S3 connection failed: ${data.message}`);
            }
        } catch (error) {
            setTestResult({ success: false, message: error.toString() });
            addFooterMessage("s3_test_error", `S3 connection failed: ${error}`);
            logger.error('S3BackupTab', 'test_connection_error', 'Connection test failed', { error });
        } finally {
            setIsTesting(false);
        }
    };

    const handleFullSync = async () => {
        if (!window.confirm("This will sync all unsynced photos to S3. Continue?")) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await invoke("enqueue_s3_full_sync");
            const data = JSON.parse(result);
            addFooterMessage("s3_sync", `Sync started: ${data.to_sync} photos to upload`);
        } catch (error) {
            addFooterMessage("s3_sync_error", `Failed to start sync: ${error}`);
            logger.error('S3BackupTab', 'full_sync_error', 'Failed to start full sync', { error });
        } finally {
            setIsSyncing(false);
        }
    };

    const selectedProvider = STORAGE_PROVIDERS.find(p => p.id === s3Config.storage_type) || STORAGE_PROVIDERS[0];
    const showEndpointField = selectedProvider.hasEndpoint || s3Config.storage_type === 'custom';
    const showProfileSelector = s3Config.storage_type === 'aws_s3' && s3Config.auth_method === 'aws_credentials';

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>S3 Backup</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Backup photos to Amazon S3 or S3-compatible storage services.
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
                    <label htmlFor="s3-enabled">Enable S3 Backup</label>
                </div>
            </div>

            {s3Config.enabled && (
                <>
                    {/* Storage Provider */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Storage Provider</h3>
                        <div className={styles['setting-row']}>
                            <label>Provider</label>
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
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Storage Settings</h3>

                        {showEndpointField && (
                            <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                <label>Endpoint URL</label>
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
                            <label>Bucket URI</label>
                            <input
                                type="text"
                                value={s3Config.bucket_uri}
                                onChange={(e) => updateS3Config({ bucket_uri: e.target.value })}
                                placeholder="s3://my-bucket/photos/"
                                style={{ width: '300px' }}
                            />
                        </div>

                        <div className={styles['setting-row']}>
                            <label>Region</label>
                            <select
                                value={s3Config.region}
                                onChange={(e) => updateS3Config({ region: e.target.value })}
                                style={{ width: '250px' }}
                            >
                                {AWS_REGIONS.map(region => (
                                    <option key={region.id} value={region.id}>{region.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Authentication */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Authentication</h3>

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
                                    <label htmlFor="auth-aws-credentials">Use AWS CLI credentials (~/.aws/credentials)</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-iam-role"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'iam_role'}
                                        onChange={() => updateS3Config({ auth_method: 'iam_role' })}
                                    />
                                    <label htmlFor="auth-iam-role">Use IAM Role (EC2/ECS)</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-access-key"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'access_key'}
                                        onChange={() => updateS3Config({ auth_method: 'access_key' })}
                                    />
                                    <label htmlFor="auth-access-key">Enter Access Key manually</label>
                                </div>
                            </div>
                        )}

                        {showProfileSelector && (
                            <div className={styles['setting-row']}>
                                <label>AWS Profile</label>
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

                        {s3Config.storage_type !== 'aws_s3' && (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                Use Access Key ID and Secret Access Key from your storage provider's dashboard.
                            </p>
                        )}
                    </div>

                    {/* Sync Options */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Sync Options</h3>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-auto-sync"
                                checked={s3Config.auto_sync}
                                onChange={(e) => updateS3Config({ auto_sync: e.target.checked })}
                            />
                            <label htmlFor="s3-auto-sync">Auto sync on import</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-db"
                                checked={s3Config.backup_db}
                                onChange={(e) => updateS3Config({ backup_db: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-db">Backup database (metadata, tags, edits)</label>
                        </div>

                        <div className={styles['setting-row']} style={{ marginTop: 'var(--space-3)' }}>
                            <label>Max file size</label>
                            <select
                                value={s3Config.max_file_size_mb || ''}
                                onChange={(e) => updateS3Config({ max_file_size_mb: e.target.value ? parseInt(e.target.value) : null })}
                                style={{ width: '150px' }}
                            >
                                {MAX_FILE_SIZE_OPTIONS.map(option => (
                                    <option key={option.value || 'none'} value={option.value || ''}>{option.label}</option>
                                ))}
                            </select>
                            <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                (Files larger than this will be skipped)
                            </span>
                        </div>
                    </div>

                    {/* Sync Status */}
                    {syncStats && (
                        <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Sync Status</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                <span>Total: <strong>{syncStats.total_photos}</strong></span>
                                <span>Synced: <strong style={{ color: 'var(--color-success)' }}>{syncStats.synced}</strong></span>
                                <span>Pending: <strong style={{ color: 'var(--color-warning)' }}>{syncStats.not_synced}</strong></span>
                            </div>
                            {syncStats.last_sync_at && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    Last sync: {new Date(syncStats.last_sync_at).toLocaleString()}
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
                            {isTesting ? 'Testing...' : 'Test Connection'}
                        </button>

                        <button
                            onClick={handleFullSync}
                            disabled={isSyncing || !s3Config.bucket_uri}
                            style={primaryButtonStyle(isSyncing)}
                        >
                            {isSyncing ? 'Syncing...' : 'Full Sync'}
                        </button>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div style={{
                            marginTop: 'var(--space-3)',
                            padding: 'var(--space-3)',
                            background: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {testResult.success ? 'Connection successful!' : `Connection failed: ${testResult.message}`}
                        </div>
                    )}
                </>
            )}

            {!s3Config.enabled && (
                <p className={styles['setting-description']} style={{ fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
                    Enable S3 Backup to configure cloud storage settings.
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
