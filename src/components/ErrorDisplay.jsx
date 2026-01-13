import React from 'react';
import { useError } from '../context/ErrorContext.jsx';

const ErrorDisplay = () => {
  const { errors, removeError, retryOperation, SEVERITY_CONFIG } = useError();

  if (errors.length === 0) return null;

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'Info': return 'ℹ️';
      case 'Warning': return '⚠️';
      case 'Error': return '❌';
      case 'Critical': return '🚨';
      default: return '❌';
    }
  };

  const getSeverityStyle = (severity) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Error;
    return {
      backgroundColor: config.bgColor,
      borderColor: config.color,
      color: config.color === '#eab308' ? '#92400e' : config.color, // Darker text for yellow warning
    };
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      maxWidth: '450px'
    }}>
      {errors.map(error => {
        const severityStyle = getSeverityStyle(error.severity);
        return (
          <div 
            key={error.id}
            style={{
              padding: '16px',
              margin: '8px 0',
              backgroundColor: severityStyle.backgroundColor,
              border: `2px solid ${severityStyle.borderColor}`,
              borderRadius: '8px',
              color: severityStyle.color,
              position: 'relative',
              fontSize: 'var(--font-size-base)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => removeError(error.id)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                fontSize: 'var(--font-size-xl)',
                cursor: 'pointer',
                color: 'inherit',
                padding: '4px',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Dismiss"
            >
              ×
            </button>

            <div style={{ marginRight: '32px' }}>
              {/* Header with severity icon and category */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'bold'
              }}>
                <span style={{ marginRight: '8px' }}>
                  {getSeverityIcon(error.severity)}
                </span>
                <span>
                  {error.category || 'System'} {error.severity}
                </span>
              </div>

              {/* Operation context */}
              {error.operation && (
                <div style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  opacity: 0.8, 
                  marginBottom: '6px',
                  fontStyle: 'italic'
                }}>
                  During: {error.operation}
                </div>
              )}

              {/* Main error message */}
              <div style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                {error.message}
              </div>

              {/* Suggestion if available */}
              {error.suggestion && (
                <div style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  opacity: 0.9, 
                  marginBottom: '8px',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  borderLeft: '3px solid currentColor'
                }}>
                  💡 {error.suggestion}
                </div>
              )}

              {/* Action buttons and metadata */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {/* Retry button for recoverable errors */}
                {error.recoverable && (
                  <button
                    onClick={() => retryOperation(error.id)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: severityStyle.borderColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'bold'
                    }}
                    title="Retry the failed operation"
                  >
                    🔄 Retry
                  </button>
                )}

                {/* Timestamp and correlation ID */}
                <div style={{ 
                  fontSize: 'var(--font-size-xs)', 
                  opacity: 0.7,
                  textAlign: 'right',
                  flex: 1
                }}>
                  <div>{new Date(error.timestamp).toLocaleTimeString()}</div>
                  {error.correlationId && (
                    <div title="Correlation ID for debugging">
                      ID: {error.correlationId.slice(-8)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes slideIn {
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

export default ErrorDisplay;