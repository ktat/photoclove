import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import BaseModal, { ModalLoading, ModalError } from './BaseModal.jsx';
import styles from './DocumentViewer.module.css';

// GitHub raw content base URL
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ktat/photoclove/main/public';

const DocumentViewer = ({ title, fileName, onClose }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
        const langFileName = lang === 'ja' ? `${fileName}-ja.md` : `${fileName}.md`;
        const englishFileName = `${fileName}.md`;

        let text = null;

        // Try to fetch from GitHub first (latest version)
        try {
          // Try language-specific version from GitHub
          let response = await fetch(`${GITHUB_RAW_BASE}/${langFileName}`);

          // Fallback to English if Japanese version not found on GitHub
          if (!response.ok && lang === 'ja') {
            response = await fetch(`${GITHUB_RAW_BASE}/${englishFileName}`);
          }

          if (response.ok) {
            text = await response.text();
            logger.info('DocumentViewer', 'document_loaded_github', 'Loaded from GitHub', {
              fileName: langFileName
            });
          }
        } catch (githubErr) {
          logger.warn('DocumentViewer', 'github_fetch_failed', 'GitHub fetch failed, trying local', {
            error: githubErr.message
          });
        }

        // Fallback to local copy if GitHub fetch failed
        if (!text) {
          let response = await fetch(`/${langFileName}`);

          // Fallback to English if Japanese version not found locally
          if (!response.ok && lang === 'ja') {
            response = await fetch(`/${englishFileName}`);
          }

          if (!response.ok) {
            throw new Error(`Failed to load document: ${response.status}`);
          }

          text = await response.text();
          logger.info('DocumentViewer', 'document_loaded_local', 'Loaded from local', {
            fileName: langFileName
          });
        }

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

  return (
    <BaseModal title={title} onClose={onClose}>
      {isLoading && <ModalLoading message={`Loading ${title}...`} />}

      {error && <ModalError message={error} />}

      {!isLoading && !error && content && (
        <div
          className={styles.prose}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </BaseModal>
  );
};

export default DocumentViewer;
