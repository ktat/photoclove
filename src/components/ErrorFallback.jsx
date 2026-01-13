import React, { useState } from 'react';

const ErrorFallback = ({ error, errorInfo, resetError, name, level = 'component' }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const isApplicationLevel = level === 'application';
  const errorTitle = isApplicationLevel 
    ? 'Application Error' 
    : `Component Error${name ? ` in ${name}` : ''}`;

  const getFriendlyMessage = () => {
    if (isApplicationLevel) {
      return 'The application encountered an unexpected error and needs to recover.';
    } else {
      return `A component${name ? ` (${name})` : ''} stopped working due to an unexpected error.`;
    }
  };

  const getSuggestion = () => {
    if (isApplicationLevel) {
      return 'Try refreshing the page, or restart the application if the problem persists.';
    } else {
      return 'You can try to continue using other parts of the application.';
    }
  };

  return (
    <div style={{
      padding: '24px',
      margin: isApplicationLevel ? '0' : '20px',
      border: '2px solid #ef4444',
      borderRadius: '12px',
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: isApplicationLevel ? '200px' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      {/* Error Icon and Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <span style={{ fontSize: '32px' /* Icon size - intentionally large */, marginRight: '12px' }}>
          {isApplicationLevel ? '🚨' : '⚠️'}
        </span>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'bold',
            color: '#dc2626'
          }}>
            {errorTitle}
          </h2>
          <div style={{
            fontSize: 'var(--font-size-base)',
            color: '#7f1d1d',
            marginTop: '4px'
          }}>
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Friendly Description */}
      <div style={{
        fontSize: 'var(--font-size-lg)',
        lineHeight: '1.5',
        marginBottom: '12px',
        color: '#991b1b'
      }}>
        {getFriendlyMessage()}
      </div>

      {/* Suggestion */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        marginBottom: '16px',
        borderLeft: '4px solid #ef4444'
      }}>
        <div style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'bold',
          marginBottom: '4px',
          color: '#dc2626'
        }}>
          💡 What you can do:
        </div>
        <div style={{
          fontSize: 'var(--font-size-base)',
          color: '#7f1d1d'
        }}>
          {getSuggestion()}
        </div>
      </div>

      {/* Technical Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid #ef4444',
          color: '#dc2626',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: 'var(--font-size-base)',
          marginBottom: '16px',
          alignSelf: 'flex-start'
        }}
      >
        {showDetails ? '🔼 Hide Technical Details' : '🔽 Show Technical Details'}
      </button>

      {/* Technical Details */}
      {showDetails && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'monospace'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>Error Message:</strong>
            <div style={{ 
              marginTop: '4px', 
              padding: '8px', 
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #fecaca'
            }}>
              {error?.message || error?.toString() || 'Unknown error'}
            </div>
          </div>

          {error?.stack && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Stack Trace:</strong>
              <pre style={{
                marginTop: '4px',
                padding: '8px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #fecaca',
                fontSize: 'var(--font-size-xs)',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap'
              }}>
                {error.stack}
              </pre>
            </div>
          )}

          {errorInfo?.componentStack && (
            <div>
              <strong>Component Stack:</strong>
              <pre style={{
                marginTop: '4px',
                padding: '8px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #fecaca',
                fontSize: 'var(--font-size-xs)',
                overflow: 'auto',
                maxHeight: '150px',
                whiteSpace: 'pre-wrap'
              }}>
                {errorInfo.componentStack}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <button 
          onClick={resetError}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🔄 {isApplicationLevel ? 'Reset Application' : 'Try Again'}
        </button>

        {isApplicationLevel && (
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'bold'
            }}
          >
            🔃 Reload Page
          </button>
        )}
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '16px',
          padding: '8px',
          backgroundColor: '#fcd34d',
          color: '#92400e',
          borderRadius: '4px',
          fontSize: 'var(--font-size-sm)',
          textAlign: 'center'
        }}>
          🔧 Development Mode: This error boundary will show more details in production
        </div>
      )}
    </div>
  );
};

export default ErrorFallback;