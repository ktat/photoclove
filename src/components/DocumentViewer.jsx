import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

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
      // Lists
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading {title}...</div>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 bg-red-50 p-4 rounded-md">
              {error}
            </div>
          )}
          
          {!isLoading && !error && content && (
            <div
              className="prose prose-sm max-w-none"
              style={{
                fontSize: 'var(--font-size-base)',
                lineHeight: '1.6',
                color: 'var(--color-text-secondary)'
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;