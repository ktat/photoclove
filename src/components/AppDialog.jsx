/**
 * AppDialog Component
 *
 * A themed dialog component that replaces Tauri native dialogs.
 * Supports confirm (OK/Cancel) and message (OK only) modes.
 */

import React, { useEffect, useState } from 'react';
import styles from './AppDialog.module.css';

const KIND_ICONS = {
  info: '\u2139\uFE0F',
  success: '\u2713',
  warning: '\u26A0',
  danger: '\u26A0',
  error: '\u2717',
};

const AppDialog = ({
  type = 'message',
  title,
  message,
  description,
  confirmText,
  cancelText,
  kind = 'info',
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(() => onClose(true), 150);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => onClose(false), 150);
  };

  const icon = KIND_ICONS[kind] || KIND_ICONS.info;
  const kindClass = styles[kind] || styles.info;

  return (
    <div
      className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}
      onClick={handleCancel}
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.kindIcon} ${kindClass}`}>{icon}</div>

        {title && <h2 className={styles.title}>{title}</h2>}

        <p className={styles.message}>{message}</p>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.buttons}>
          {type === 'confirm' ? (
            <>
              <button className={styles.cancelButton} onClick={handleCancel}>
                {cancelText || 'Cancel'}
              </button>
              <button className={`${styles.confirmButton} ${kindClass}`} onClick={handleConfirm}>
                {confirmText || 'OK'}
              </button>
            </>
          ) : (
            <button className={`${styles.okButton} ${kindClass}`} onClick={handleConfirm}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppDialog;
