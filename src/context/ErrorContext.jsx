import React, { createContext, useContext, useState, useCallback } from 'react';

const ErrorContext = createContext();

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);

  const addError = useCallback((error, type = 'error') => {
    const id = Date.now() + Math.random();
    const newError = {
      id,
      message: error.message || error.toString(),
      type,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
    
    setErrors(prev => [...prev, newError]);
    
    // Auto-remove error after 10 seconds
    setTimeout(() => {
      removeError(id);
    }, 10000);
    
    return id;
  }, []);

  const removeError = useCallback((id) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const handleTauriError = useCallback((error, operation = 'Tauri operation') => {
    console.error(`${operation} failed:`, error);
    
    let errorMessage = `${operation} failed`;
    if (typeof error === 'string') {
      errorMessage += `: ${error}`;
    } else if (error && error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    addError(new Error(errorMessage), 'tauri');
  }, [addError]);

  const value = {
    errors,
    addError,
    removeError,
    clearErrors,
    handleTauriError
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

export default ErrorContext;