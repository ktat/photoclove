/**
 * ShareStatsDialog - Dialog for sharing photography stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    generateStatsShareText,
    generateStatsImage,
    copyTextToClipboard,
    copyImageToClipboard,
    saveImageAsFile,
    shareToSocial
} from '../utils/ShareUtils.js';
import { logger } from '../services/LoggerService.js';
import styles from './ShareStatsDialog.module.css';

function ShareStatsDialog({ insights, onClose }) {
    const { t } = useTranslation(['common', 'insights']);
    const [shareText, setShareText] = useState('');
    const [imageBlob, setImageBlob] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [copyStatus, setCopyStatus] = useState(null);
    const [generating, setGenerating] = useState(false);

    // Generate share text
    useEffect(() => {
        if (insights) {
            const text = generateStatsShareText(insights);
            setShareText(text);
        }
    }, [insights]);

    // Generate image preview
    useEffect(() => {
        if (insights) {
            setGenerating(true);
            generateStatsImage(insights)
                .then(blob => {
                    setImageBlob(blob);
                    setImageUrl(URL.createObjectURL(blob));
                    setGenerating(false);
                })
                .catch(err => {
                    logger.error('ShareStatsDialog', 'generate_image_error', 'Failed to generate image', { error: err.message });
                    setGenerating(false);
                });
        }

        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [insights]);

    // Handle copy text
    const handleCopyText = useCallback(async () => {
        const success = await copyTextToClipboard(shareText);
        setCopyStatus(success ? 'text' : 'error');
        setTimeout(() => setCopyStatus(null), 2000);
    }, [shareText]);

    // Handle copy image
    const handleCopyImage = useCallback(async () => {
        if (!imageBlob) return;
        const success = await copyImageToClipboard(imageBlob);
        setCopyStatus(success ? 'image' : 'error');
        setTimeout(() => setCopyStatus(null), 2000);
    }, [imageBlob]);

    // Handle save image
    const handleSaveImage = useCallback(() => {
        if (!imageBlob) return;
        const date = new Date().toISOString().split('T')[0];
        saveImageAsFile(imageBlob, `photoclove-stats-${date}.png`);
    }, [imageBlob]);

    // Handle social share
    const handleSocialShare = useCallback((platform) => {
        shareToSocial(platform, shareText);
    }, [shareText]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    return (
        <div className={styles.backdrop} onClick={handleBackdropClick}>
            <div className={styles.dialog}>
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {t('insights:share.title', 'Share Stats')}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Image Preview */}
                    <div className={styles.previewSection}>
                        <h3 className={styles.sectionTitle}>
                            {t('insights:share.preview', 'Preview')}
                        </h3>
                        <div className={styles.imagePreview}>
                            {generating ? (
                                <div className={styles.generating}>
                                    {t('common:status.processing', 'Processing...')}
                                </div>
                            ) : imageUrl ? (
                                <img src={imageUrl} alt="Stats preview" />
                            ) : (
                                <div className={styles.noPreview}>
                                    {t('insights:share.noPreview', 'Unable to generate preview')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Copy/Save Actions */}
                    <div className={styles.actionsSection}>
                        <button
                            className={`${styles.actionBtn} ${copyStatus === 'text' ? styles.success : ''}`}
                            onClick={handleCopyText}
                        >
                            <span className={styles.actionIcon}>📋</span>
                            <span className={styles.actionLabel}>
                                {copyStatus === 'text'
                                    ? t('common:status.copied', 'Copied!')
                                    : t('insights:share.copyText', 'Copy Text')}
                            </span>
                        </button>

                        <button
                            className={`${styles.actionBtn} ${copyStatus === 'image' ? styles.success : ''}`}
                            onClick={handleCopyImage}
                            disabled={!imageBlob}
                        >
                            <span className={styles.actionIcon}>🖼️</span>
                            <span className={styles.actionLabel}>
                                {copyStatus === 'image'
                                    ? t('common:status.copied', 'Copied!')
                                    : t('insights:share.copyImage', 'Copy Image')}
                            </span>
                        </button>

                        <button
                            className={styles.actionBtn}
                            onClick={handleSaveImage}
                            disabled={!imageBlob}
                        >
                            <span className={styles.actionIcon}>💾</span>
                            <span className={styles.actionLabel}>
                                {t('insights:share.saveImage', 'Save Image')}
                            </span>
                        </button>
                    </div>

                    {/* Social Share */}
                    <div className={styles.socialSection}>
                        <h3 className={styles.sectionTitle}>
                            {t('insights:share.shareTo', 'Share to')}
                        </h3>
                        <div className={styles.socialButtons}>
                            <button
                                className={styles.socialBtn}
                                onClick={() => handleSocialShare('twitter')}
                                title="Share on X (Twitter)"
                            >
                                𝕏
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => handleSocialShare('bluesky')}
                                title="Share on Bluesky"
                            >
                                🦋
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => handleSocialShare('threads')}
                                title="Share on Threads"
                            >
                                @
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => handleSocialShare('instagram')}
                                title="Share on Instagram"
                            >
                                📷
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => handleSocialShare('facebook')}
                                title="Share on Facebook"
                            >
                                f
                            </button>
                        </div>
                        <p className={styles.socialHint}>
                            {t('insights:share.socialHint', 'Text only - paste image manually after copying')}
                        </p>
                    </div>

                    {/* Text Preview (collapsible) */}
                    <details className={styles.textPreview}>
                        <summary>{t('insights:share.showText', 'Show share text')}</summary>
                        <pre className={styles.textContent}>{shareText}</pre>
                    </details>
                </div>
            </div>
        </div>
    );
}

export default ShareStatsDialog;
