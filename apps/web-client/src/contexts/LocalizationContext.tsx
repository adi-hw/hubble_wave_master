import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { localizationService, LocalizationBundle } from '../services/localization.service';
import { useUserPreferences } from './UserPreferencesContext';
import { formatLabel } from '../lib/labels';

type LocalizationContextValue = {
  locale: string;
  bundle: LocalizationBundle | null;
  loading: boolean;
  error: string | null;
  translate: (
    namespace: string,
    key: string,
    fallback?: string,
    values?: Record<string, string | number>,
  ) => string;
};

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

const LOCAL_STORAGE_PREFIX = 'hw-localization-bundle:';

const readCachedBundle = (locale: string): LocalizationBundle | null => {
  if (!locale) return null;
  const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${locale}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalizationBundle;
  } catch {
    return null;
  }
};

const writeCachedBundle = (locale: string, bundle: LocalizationBundle) => {
  if (!locale) return;
  localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${locale}`, JSON.stringify(bundle));
};

const resolveLocaleCandidates = (preferred?: string): string[] => {
  const normalized = (preferred || 'en').trim();
  const candidates = [normalized];
  if (normalized.includes('-')) {
    candidates.push(normalized.split('-')[0]);
  }
  if (!candidates.includes('en')) {
    candidates.push('en');
  }
  return candidates.filter(Boolean);
};

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences } = useUserPreferences();
  const [locale, setLocale] = useState<string>('en');
  const [bundle, setBundle] = useState<LocalizationBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = useCallback(async (preferred?: string) => {
    const candidates = resolveLocaleCandidates(preferred);
    setLoading(true);
    setError(null);

    for (const candidate of candidates) {
      const cached = readCachedBundle(candidate);
      if (cached) {
        setLocale(candidate);
        setBundle(cached);
        setLoading(false);
        return;
      }

      try {
        const fetched = await localizationService.getBundle(candidate);
        writeCachedBundle(candidate, fetched);
        setLocale(candidate);
        setBundle(fetched);
        setLoading(false);
        return;
      } catch (err) {
        setError((err as Error).message || `Failed to load localization bundle for ${candidate}`);
      }
    }

    setLocale(candidates[0] || 'en');
    setBundle(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const preferred = preferences?.language;
    void loadBundle(preferred);
  }, [preferences?.language, loadBundle]);

  useEffect(() => {
    if (!bundle?.locale) return;
    document.documentElement.lang = bundle.locale.code || 'en';
    if (bundle.locale.direction === 'rtl') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }, [bundle]);

  const translate = useCallback(
    (
      namespace: string,
      key: string,
      fallback?: string,
      values?: Record<string, string | number>,
    ) => {
      const template = bundle?.entries?.[namespace]?.[key] || fallback || `${namespace}.${key}`;
      if (values && Object.keys(values).length > 0) {
        return formatLabel(template, values);
      }
      return template;
    },
    [bundle],
  );

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      bundle,
      loading,
      error,
      translate,
    }),
    [locale, bundle, loading, error, translate],
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
