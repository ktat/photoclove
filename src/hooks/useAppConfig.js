import { useEffect, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { useUI } from '../context/UIContext.jsx';
import { useError } from '../context/ErrorContext.jsx';

export const useAppConfig = () => {
  const { useCount, setUseCount } = useUI();
  const { handleTauriError } = useError();

  const loadConfig = useCallback(() => {
    invoke("get_config", {}).then((e) => {
      const json = JSON.parse(e);
      setUseCount(json.use_count);
    }).catch((error) => {
      handleTauriError(error, "Getting configuration");
    });
  }, [setUseCount, handleTauriError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    useCount,
    loadConfig
  };
};