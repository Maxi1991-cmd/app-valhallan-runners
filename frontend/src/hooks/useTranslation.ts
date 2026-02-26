import { useState, useCallback, useEffect } from 'react';
import i18n from '../i18n';

// Global listeners for language changes
const listeners: Set<() => void> = new Set();

export const notifyLanguageChange = () => {
  listeners.forEach(listener => listener());
};

export const useTranslation = () => {
  const [, forceUpdate] = useState(0);

  // Subscribe to language changes
  useEffect(() => {
    const update = () => forceUpdate(n => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const t = useCallback((key: string, options?: Record<string, any>) => {
    return i18n.t(key, options);
  }, []);

  const changeLanguage = useCallback((locale: string) => {
    i18n.locale = locale;
    notifyLanguageChange();
  }, []);

  return { t, i18n, changeLanguage };
};

export default useTranslation;
