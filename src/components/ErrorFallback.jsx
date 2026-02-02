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
      padding: 'var(--space-6)',
      margin: isApplicationLevel ? '0' : '20px',
      border: '2px solid var(--color-danger)',
      borderRadius: 'var(--radius-xl)',
      backgroundColor: 'var(--color-danger-bg)',
      color: 'var(--color-danger-dark)',
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
        marginBottom: 'var(--space-4)'
      }}>
        <span style={{ fontSize: 'var(--font-size-2xl)', marginRight: 'var(--space-3)' }}>
          {isApplicationLevel ? '🚨' : '⚠️'}
        </span>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'bold',
            color: 'var(--color-danger-dark)'
          }}>
            {errorTitle}
          </h2>
          <div style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-danger-darker)',
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
        marginBottom: 'var(--space-3)',
        color: 'var(--color-danger-dark)'
      }}>
        {getFriendlyMessage()}
      </div>

      {/* Suggestion */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-danger-bg-strong)',
        border: '1px solid var(--color-danger-border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-4)',
        borderLeft: '4px solid var(--color-danger)'
      }}>
        <div style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'bold',
          marginBottom: 'var(--space-1)',
          color: 'var(--color-danger-dark)'
        }}>
          💡 What you can do:
        </div>
        <div style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-danger-darker)'
        }}>
          {getSuggestion()}
        </div>
      </div>

      {/* Technical Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid var(--color-danger)',
          color: 'var(--color-danger-dark)',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-base)',
          marginBottom: 'var(--space-4)',
          alignSelf: 'flex-start'
        }}
      >
        {showDetails ? '🔼 Hide Technical Details' : '🔽 Show Technical Details'}
      </button>

      {/* Technical Details */}
      {showDetails && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg-strong)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'monospace'
        }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <strong>Error Message:</strong>
            <div style={{
              marginTop: 'var(--space-1)',
              padding: 'var(--space-2)',
              backgroundColor: 'var(--color-danger-bg)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-danger-border)'
            }}>
              {error?.message || error?.toString() || 'Unknown error'}
            </div>
          </div>

          {error?.stack && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <strong>Stack Trace:</strong>
              <pre style={{
                marginTop: 'var(--space-1)',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-danger-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-danger-border)',
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
                marginTop: 'var(--space-1)',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-danger-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-danger-border)',
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
        gap: 'var(--space-3)',
        alignItems: 'center'
      }}>
        <button
          onClick={resetError}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-danger-dark)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}
        >
          🔄 {isApplicationLevel ? 'Reset Application' : 'Try Again'}
        </button>

        {isApplicationLevel && (
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-text-muted)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
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
          marginTop: 'var(--space-4)',
          padding: 'var(--space-2)',
          backgroundColor: 'var(--color-warning-bg-strong)',
          color: 'var(--color-warning-darker)',
          borderRadius: 'var(--radius-sm)',
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