import React from 'react';
import { ErrorProvider } from '../context/ErrorContext.jsx';
import { PhotoProvider } from '../context/PhotoContext.jsx';
import { UIProvider } from '../context/UIContext.jsx';
import { DialogProvider } from '../context/DialogContext.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const AppProviders = ({ children }) => {
  return (
    <ErrorProvider>
      <ErrorBoundary>
        <DialogProvider>
          <UIProvider>
            <PhotoProvider>
              {children}
            </PhotoProvider>
          </UIProvider>
        </DialogProvider>
      </ErrorBoundary>
    </ErrorProvider>
  );
};

export default AppProviders;