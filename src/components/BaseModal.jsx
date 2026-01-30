import React from 'react';
import styles from './BaseModal.module.css';

/**
 * Base modal component providing common modal structure
 *
 * @param {Object} props
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 * @param {Function} props.onClose - Close handler
 * @param {React.ReactNode} [props.tabs] - Optional tabs section
 * @param {React.ReactNode} [props.footer] - Optional custom footer (defaults to close button)
 * @param {string} [props.footerNote] - Optional footer note text
 */
const BaseModal = ({ title, children, onClose, tabs, footer, footerNote }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

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
          <h2 className={styles.title}>{title}</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Optional Tabs */}
        {tabs}

        {/* Content */}
        <div className={styles.content}>
          {children}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {footerNote && (
            <span className={styles.footerNote}>{footerNote}</span>
          )}
          {footer || (
            <button onClick={onClose} className={styles.footerButton}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ModalLoading = ({ message = 'Loading...' }) => (
  <div className={styles.loading}>{message}</div>
);

export const ModalError = ({ message }) => (
  <div className={styles.error}>{message}</div>
);

export default BaseModal;
