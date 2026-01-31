import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../services/LoggerService.js';
import BaseModal, { ModalLoading, ModalError } from '../components/BaseModal.jsx';
import styles from './LicensesView.module.css';

// Compare semantic versions (e.g., "1.2.3" vs "1.2.4")
// Returns: positive if a > b, negative if a < b, 0 if equal
const compareVersions = (a, b) => {
  const partsA = a.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = b.split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
};

// AI Models and their licenses
const AI_MODELS = [
  // AI Tagging Models
  {
    name: 'MobileNet (ImageNet)',
    category: 'AI Tagging',
    license: 'Apache 2.0',
    repository: 'https://github.com/onnx/models',
    description: 'Image classification model for basic object and scene detection',
  },
  {
    name: 'OpenCLIP (ViT-B/32)',
    category: 'AI Tagging',
    license: 'MIT',
    repository: 'https://huggingface.co/immich-app/ViT-B-32__laion2b-s34b-b79k',
    description: 'Vision-language model trained on LAION-2B dataset',
  },
  {
    name: 'SigLIP (Base)',
    category: 'AI Tagging',
    license: 'Apache 2.0',
    repository: 'https://huggingface.co/Xenova/siglip-base-patch16-224',
    description: 'Improved CLIP variant by Google with better accuracy',
  },
  // Face Detection Models
  {
    name: 'SCRFD (det_10g)',
    category: 'Face Detection',
    license: 'MIT',
    repository: 'https://github.com/deepinsight/insightface',
    description: 'High-performance face detection model from InsightFace',
  },
  {
    name: 'ArcFace (w600k_r50)',
    category: 'Face Detection',
    license: 'MIT',
    repository: 'https://github.com/deepinsight/insightface',
    description: 'Face recognition/embedding model from InsightFace',
  },
];

// Music credits
const MUSIC_CREDITS = [
  {
    name: 'SoundHelix',
    license: 'Royalty-free',
    repository: 'https://www.soundhelix.com/',
    description: 'Royalty-free sample music for slideshow background',
    tracks: [
      'Calm: Peaceful Morning, Gentle Waves, Forest Dreams',
      'Upbeat: Happy Journey, Sunny Days, Adventure Time',
      'Romantic: Love Story, Sweet Memories, Together Forever',
      'Family: Family Time, Precious Moments, Growing Up',
      'Nostalgic: Memories, Time Gone By, Golden Days',
      'Ambient: City Lights, Night Sky, Urban Dreams',
    ],
  },
];

const LicensesView = ({ onClose }) => {
  const { t } = useTranslation('common');
  const [npmLicenses, setNpmLicenses] = useState([]);
  const [rustLicenses, setRustLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('npm');

  useEffect(() => {
    const loadLicenses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load npm licenses
        const npmResponse = await fetch('/licenses-npm.json');
        if (npmResponse.ok) {
          const npmData = await npmResponse.json();
          // Convert object format to array format
          const npmArray = Object.entries(npmData)
            .filter(([name]) => name !== 'photoclove@0.0.0') // Exclude the project itself
            .map(([name, info]) => {
              const [packageName, version] = name.match(/^(.+)@([^@]+)$/)?.slice(1) || [name, ''];
              return {
                name: packageName,
                version,
                license: info.licenses || 'Unknown',
                repository: info.repository || '',
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
          setNpmLicenses(npmArray);
        }

        // Load rust licenses
        const rustResponse = await fetch('/licenses-rust.json');
        if (rustResponse.ok) {
          const rustData = await rustResponse.json();
          // Deduplicate by keeping only the latest version of each package
          const deduped = Object.values(
            rustData.reduce((acc, pkg) => {
              const existing = acc[pkg.name];
              if (!existing || compareVersions(pkg.version, existing.version) > 0) {
                acc[pkg.name] = pkg;
              }
              return acc;
            }, {})
          );
          setRustLicenses(deduped.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        logger.error('LicensesView', 'licenses_load_failed', 'Error loading licenses', {
          error: err.message || err.toString()
        });
        setError('Failed to load license information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadLicenses();
  }, []);

  const renderLicenseItem = (pkg, type) => (
    <div
      key={`${type}-${pkg.name}-${pkg.version}`}
      className={styles.licenseItem}
      onClick={() => pkg.repository && window.open(pkg.repository, '_blank')}
      role={pkg.repository ? 'link' : 'listitem'}
      tabIndex={pkg.repository ? 0 : -1}
    >
      <div className={styles.packageInfo}>
        <span className={styles.packageName}>{pkg.name}</span>
        <span className={styles.packageVersion}>v{pkg.version}</span>
      </div>
      <span className={styles.licenseType}>{pkg.license}</span>
    </div>
  );

  const renderAIModelItem = (model) => (
    <div
      key={model.name}
      className={styles.licenseItem}
      onClick={() => model.repository && window.open(model.repository, '_blank')}
      role="link"
      tabIndex={0}
    >
      <div className={styles.packageInfo}>
        <span className={styles.packageName}>{model.name}</span>
        <span className={styles.packageCategory}>{model.category}</span>
      </div>
      <div className={styles.modelDetails}>
        <span className={styles.modelDescription}>{model.description}</span>
        <span className={styles.licenseType}>{model.license}</span>
      </div>
    </div>
  );

  const renderMusicItem = (music) => (
    <div
      key={music.name}
      className={styles.licenseItem}
      onClick={() => music.repository && window.open(music.repository, '_blank')}
      role="link"
      tabIndex={0}
    >
      <div className={styles.packageInfo}>
        <span className={styles.packageName}>{music.name}</span>
        <span className={styles.licenseType}>{music.license}</span>
      </div>
      <div className={styles.musicDetails}>
        <span className={styles.modelDescription}>{music.description}</span>
        <div className={styles.trackList}>
          {music.tracks.map((track, idx) => (
            <div key={idx} className={styles.trackItem}>{track}</div>
          ))}
        </div>
      </div>
    </div>
  );

  const currentLicenses = activeTab === 'npm' ? npmLicenses : rustLicenses;

  const tabs = (
    <div className={styles.tabs}>
      <button
        className={`${styles.tab} ${activeTab === 'npm' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('npm')}
      >
        JavaScript ({npmLicenses.length})
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'rust' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('rust')}
      >
        Rust ({rustLicenses.length})
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'ai' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('ai')}
      >
        {t('licenses.aiModels', 'AI Models')} ({AI_MODELS.length})
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'music' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('music')}
      >
        {t('licenses.music', 'Music')} ({MUSIC_CREDITS.length})
      </button>
    </div>
  );

  return (
    <BaseModal
      title={t('licenses.title', 'Licenses & Credits')}
      onClose={onClose}
      tabs={tabs}
      footerNote={t('licenses.footerNote', 'Click on an item to view its source')}
    >
      {isLoading && <ModalLoading message="Loading licenses..." />}

      {error && <ModalError message={error} />}

      {!isLoading && !error && (activeTab === 'npm' || activeTab === 'rust') && (
        <div className={styles.licenseList}>
          {currentLicenses.map(pkg => renderLicenseItem(pkg, activeTab))}
          {currentLicenses.length === 0 && (
            <div className={styles.empty}>{t('licenses.noLicenses', 'No licenses found.')}</div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className={styles.licenseList}>
          {AI_MODELS.map(model => renderAIModelItem(model))}
        </div>
      )}

      {activeTab === 'music' && (
        <div className={styles.licenseList}>
          {MUSIC_CREDITS.map(music => renderMusicItem(music))}
        </div>
      )}
    </BaseModal>
  );
};

export default LicensesView;
