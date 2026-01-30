import React, { useState, useEffect } from 'react';
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

const LicensesView = ({ onClose }) => {
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
    </div>
  );

  return (
    <BaseModal
      title="Open Source Licenses"
      onClose={onClose}
      tabs={tabs}
      footerNote="Click on a package to view its repository"
    >
      {isLoading && <ModalLoading message="Loading licenses..." />}

      {error && <ModalError message={error} />}

      {!isLoading && !error && (
        <div className={styles.licenseList}>
          {currentLicenses.map(pkg => renderLicenseItem(pkg, activeTab))}
          {currentLicenses.length === 0 && (
            <div className={styles.empty}>No licenses found.</div>
          )}
        </div>
      )}
    </BaseModal>
  );
};

export default LicensesView;
