import React from "react";
import styles from '../Preferences.module.css';

/**
 * S3 Authentication Section Component
 */
function S3AuthenticationSection({
    t,
    s3Config,
    updateS3Config,
    awsProfiles,
    showProfileSelector,
    needsAccessKey,
    selectedProvider,
    hasStoredCredentials,
    credentialsPreview,
    accessKeyId,
    setAccessKeyId,
    secretAccessKey,
    setSecretAccessKey,
    handleSaveCredentials,
    handleDeleteCredentials
}) {
    return (
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
    );
}

export default S3AuthenticationSection;
