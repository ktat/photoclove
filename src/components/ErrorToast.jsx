import React, { useState, useEffect } from 'react';
import { useError } from '../context/ErrorContext.jsx';

const ErrorToast = ({ error, onDismiss, autoHide = true }) => {
  const { SEVERITY_CONFIG } = useError();
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  const severityConfig = SEVERITY_CONFIG[error.severity] || SEVERITY_CONFIG.Error;

  useEffect(() => {
    if (!autoHide || severityConfig.timeout === 0) return;

    const startTime = Date.now();
    const duration = severityConfig.timeout;

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (duration - elapsed) / duration * 100);
      setProgress(remaining);
      
      if (remaining === 0) {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
        clearInterval(progressInterval);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [autoHide, severityConfig.timeout, onDismiss]);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'Info': return 'ℹ️';
      case 'Warning': return '⚠️';
      case 'Error': return '❌';
      case 'Critical': return '🚨';
      default: return '❌';
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      backgroundColor: severityConfig.bgColor,
      border: `1px solid ${severityConfig.color}40`,
      borderLeft: `4px solid ${severityConfig.color}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      margin: '8px 0',
      color: severityConfig.color === '#eab308' ? '#92400e' : severityConfig.color,
      fontSize: 'var(--font-size-base)',
      position: 'relative',
      overflow: 'hidden',
      minWidth: '300px',
      maxWidth: '400px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      animation: 'slideInToast 0.3s ease-out',
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'opacity 0.3s ease, transform 0.3s ease'
    }}>
      {/* Progress bar for auto-hide */}
      {autoHide && severityConfig.timeout > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          backgroundColor: severityConfig.color,
          width: `${progress}%`,
          transition: 'width 0.05s linear',
          opacity: 0.7
        }} />
      )}

      {/* Close button */}
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'none',
          border: 'none',
          fontSize: 'var(--font-size-lg)',
          cursor: 'pointer',
          color: 'inherit',
          padding: 'var(--space-1)',
          opacity: 0.7,
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Dismiss"
      >
        ×
      </button>

      <div style={{ marginRight: '24px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          <span style={{ marginRight: '8px', fontSize: 'var(--font-size-lg)' }}>
            {getSeverityIcon(error.severity)}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>
            {error.category} {error.severity}
          </span>
        </div>

        {/* Message */}
        <div style={{
          lineHeight: '1.3',
          marginBottom: error.suggestion ? '6px' : '0'
        }}>
          {error.message}
        </div>

        {/* Compact suggestion */}
        {error.suggestion && (
          <div style={{
            fontSize: 'var(--font-size-sm)',
            opacity: 0.9,
            fontStyle: 'italic'
          }}>
            💡 {error.suggestion}
          </div>
        )}

        {/* Operation context if important */}
        {error.operation && error.severity !== 'Info' && (
          <div style={{
            fontSize: 'var(--font-size-xs)',
            opacity: 0.7,
            marginTop: '4px'
          }}>
            During: {error.operation}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInToast {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ErrorToast;