import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import styles from './LicensesView.module.css';

const LicensesView = ({ onClose }) => {
  const [npmLicenses, setNpmLicenses] = useState([]);
  const [rustLicenses, setRustLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
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
          setRustLicenses(rustData.sort((a, b) => a.name.localeCompare(b.name)));
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

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (selectedLicense) {
        setSelectedLicense(null);
      } else {
        onClose();
      }
    }
  };

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

  const currentLicenses = activeTab === 'npm' ? npmLicenses : rustLicenses;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Open Source Licenses</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
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
        </div>

        {/* Content */}
        <div className={styles.content}>
          {isLoading && (
            <div className={styles.loading}>
              Loading licenses...
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <div className={styles.licenseList}>
              {currentLicenses.map(pkg => renderLicenseItem(pkg, activeTab))}
              {currentLicenses.length === 0 && (
                <div className={styles.empty}>No licenses found.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerNote}>
            Click on a package to view its repository
          </span>
          <button
            onClick={onClose}
            className={styles.footerButton}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LicensesView;
