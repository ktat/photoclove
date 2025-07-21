import React, { createContext, useContext, useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';

const ErrorContext = createContext();

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// Error severity mapping for UI display
const SEVERITY_CONFIG = {
  Info: { color: '#0ea5e9', bgColor: '#e0f2fe', timeout: 5000 },
  Warning: { color: '#eab308', bgColor: '#fefce8', timeout: 8000 },
  Error: { color: '#ef4444', bgColor: '#fef2f2', timeout: 12000 },
  Critical: { color: '#dc2626', bgColor: '#fef2f2', timeout: 0 } // No auto-dismiss for critical
};

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);

  const addError = useCallback((error, operation = null, userAction = null) => {
    const id = Date.now() + Math.random();
    
    // Handle PhotoClove structured errors from Rust
    let errorData;
    if (typeof error === 'object' && error.error && error.correlation_id) {
      // This is a PhotoClove ErrorWithContext
      const rustError = error.error;
      errorData = {
        id,
        message: rustError.user_message || 'An error occurred',
        suggestion: rustError.suggestion || '',
        severity: rustError.severity || 'Error',
        category: rustError.category || 'System',
        recoverable: rustError.is_recoverable || false,
        correlationId: error.correlation_id,
        timestamp: error.timestamp || new Date().toISOString(),
        operation: operation,
        userAction: userAction || error.user_action,
        rawError: error
      };
    } else if (typeof error === 'string') {
      // String error message
      errorData = {
        id,
        message: error,
        suggestion: '',
        severity: 'Error',
        category: 'System',
        recoverable: false,
        correlationId: null,
        timestamp: new Date().toISOString(),
        operation: operation,
        userAction: userAction,
        rawError: error
      };
    } else {
      // JavaScript Error object or other
      errorData = {
        id,
        message: error?.message || error?.toString() || 'Unknown error occurred',
        suggestion: '',
        severity: 'Error',
        category: 'System',
        recoverable: false,
        correlationId: null,
        timestamp: new Date().toISOString(),
        operation: operation,
        userAction: userAction,
        stack: error?.stack,
        rawError: error
      };
    }
    
    setErrors(prev => [...prev, errorData]);
    
    // Log the error
    logger.error('ErrorContext', 'error_added', `Error in ${operation || 'unknown operation'}`, {
      message: errorData.message,
      severity: errorData.severity,
      category: errorData.category,
      correlationId: errorData.correlationId,
      userAction: errorData.userAction
    });
    
    // Auto-remove error based on severity (except Critical)
    const config = SEVERITY_CONFIG[errorData.severity] || SEVERITY_CONFIG.Error;
    if (config.timeout > 0) {
      setTimeout(() => {
        removeError(id);
      }, config.timeout);
    }
    
    return id;
  }, []);

  const removeError = useCallback((id) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const retryOperation = useCallback((errorId, retryFn) => {
    const error = errors.find(e => e.id === errorId);
    if (error && error.recoverable && retryFn) {
      logger.info('ErrorContext', 'retry_operation', 'User retrying failed operation', {
        operation: error.operation,
        correlationId: error.correlationId
      });
      
      removeError(errorId);
      retryFn();
    }
  }, [errors, removeError]);

  // Enhanced Tauri error handler that can handle PhotoClove errors
  const handleTauriError = useCallback((error, operation = 'Operation') => {
    console.error(`${operation} failed:`, error);
    
    // Try to parse as PhotoClove error first
    let parsedError = error;
    if (typeof error === 'string') {
      try {
        parsedError = JSON.parse(error);
      } catch {
        // Not JSON, treat as plain string
      }
    }
    
    addError(parsedError, operation);
  }, [addError]);

  const handleApiError = useCallback((error, operation = 'API call', userAction = null) => {
    // Handle different types of API errors
    if (error?.response?.status === 404) {
      addError('The requested resource was not found', operation, userAction);
    } else if (error?.response?.status === 403) {
      addError('Permission denied for this operation', operation, userAction);
    } else if (error?.response?.status >= 500) {
      addError('Server error occurred. Please try again later', operation, userAction);
    } else {
      addError(error, operation, userAction);
    }
  }, [addError]);

  const value = {
    errors,
    addError,
    removeError,
    clearErrors,
    retryOperation,
    handleTauriError,
    handleApiError,
    SEVERITY_CONFIG
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

export default ErrorContext;