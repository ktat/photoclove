import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const TutorialTooltip = ({ 
  isVisible, 
  content, 
  targetElement, 
  onDismiss, 
  onDontShowAgain,
  tutorialId 
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isVisible && targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 10,
        left: rect.left
      });
    }
  }, [isVisible, targetElement]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    logger.info('TutorialTooltip', 'tutorial_dismissed', 'User dismissed tutorial', { tutorialId });
    onDismiss();
  };

  const handleDontShowAgain = () => {
    logger.info('TutorialTooltip', 'tutorial_disabled', 'User disabled tutorial', { tutorialId });
    onDontShowAgain();
  };

  return (
    <>
      <style>
        {`
          @keyframes tutorialFadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .tutorial-tooltip {
            animation: tutorialFadeIn 0.3s ease-out;
          }
        `}
      </style>
      <div 
        className="tutorial-tooltip"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          backgroundColor: '#1E3A8A',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          maxWidth: '320px',
          fontSize: '12px',
          lineHeight: '1.4'
        }}
      >
        {/* Arrow pointing to target */}
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '20px',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid #1E3A8A'
        }} />

        {/* Content */}
        <div style={{ marginBottom: '12px' }}>
          {content}
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          justifyContent: 'flex-end',
          borderTop: '1px solid #3B82F6',
          paddingTop: '12px',
          marginTop: '12px'
        }}>
          {/* Note: fontSize is hardcoded because CSS variables don't work with color-scheme: light */}
          <button
            onClick={handleDontShowAgain}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Don't show again
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  );
};

export default TutorialTooltip;