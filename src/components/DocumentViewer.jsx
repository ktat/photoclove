import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import styles from './DocumentViewer.module.css';

const DocumentViewer = ({ title, fileName, onClose }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to load language-specific version first (Japanese)
        const lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
        const langFileName = lang === 'ja' ? `${fileName}-ja.md` : `${fileName}.md`;

        let response = await fetch(`/${langFileName}`);

        // Fallback to English if Japanese version not found
        if (!response.ok && lang === 'ja') {
          response = await fetch(`/${fileName}.md`);
        }

        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.status}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        logger.error('DocumentViewer', 'document_load_failed', 'Error loading document', {
          fileName,
          title,
          error: err.message || err.toString()
        });
        setError(`Failed to load ${title}. Please try again.`);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [fileName, title]);

  // Convert markdown to basic HTML (simple implementation)
  const renderMarkdown = (text) => {
    return text
      // Headers
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists - wrap consecutive list items
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      // Remove br tags inside, before, and after ul
      .replace(/<ul>(.*?)<\/ul>/gs, (match) => match.replace(/<br\/>/g, ''))
      .replace(/<br\/><ul>/g, '<ul>')
      .replace(/<\/ul><br\/>/g, '</ul>')
      // Wrap in paragraphs
      .replace(/^(?!<[h|u|l])/gm, '<p>')
      .replace(/$/gm, '</p>')
      // Clean up extra paragraph tags
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[h|u])/g, '$1')
      .replace(/(<\/[h|u]>)<\/p>/g, '$1');
  };

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

        {/* Content */}
        <div className={styles.content}>
          {isLoading && (
            <div className={styles.loading}>
              Loading {title}...
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {!isLoading && !error && content && (
            <div
              className={styles.prose}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
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

export default DocumentViewer;
