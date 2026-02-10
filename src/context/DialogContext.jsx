/**
 * Dialog Context
 *
 * Provides a Promise-based API for showing confirm/message dialogs
 * throughout the application. Replaces Tauri native dialogs with
 * custom React dialogs that match the app's theme.
 */

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import AppDialog from '../components/AppDialog.jsx';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, message, description, confirmText, cancelText, kind }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({ type: 'confirm', title, message, description, confirmText, cancelText, kind });
    });
  }, []);

  const message = useCallback(({ title, message, description, kind }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({ type: 'message', title, message, description, kind });
    });
  }, []);

  const handleClose = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialogState(null);
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, message }}>
      {children}
      {dialogState && <AppDialog {...dialogState} onClose={handleClose} />}
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);

export default DialogContext;
