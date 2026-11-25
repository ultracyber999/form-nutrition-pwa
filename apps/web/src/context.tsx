import { FormDatabase, FormRepository } from '@form/data';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const repository = new FormRepository(new FormDatabase('form-local'));

type ThemePreference = 'dark' | 'light';

type FormContextValue = {
  repo: FormRepository;
  ready: boolean;
  refreshKey: number;
  refresh: () => void;
  needsOnboarding: boolean;
  setNeedsOnboarding: (value: boolean) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  announce: string;
  setAnnounce: (message: string) => void;
};

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [theme, setThemeState] = useState<ThemePreference>(() => localStorage.getItem('form.theme') === 'light' ? 'light' : 'dark');
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    let cancelled = false;
    repository.initializeCatalog()
      .then(() => repository.getProfile())
      .then((profile) => {
        if (!cancelled) {
          setNeedsOnboarding(profile === null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsOnboarding(false);
          setReady(true);
          setAnnounce('לא ניתן לטעון את האחסון המקומי');
        }
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('form.theme', theme);
  }, [theme]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);
  const value = useMemo(() => ({ repo: repository, ready, refreshKey, refresh, needsOnboarding, setNeedsOnboarding, theme, setTheme, announce, setAnnounce }), [ready, refreshKey, refresh, needsOnboarding, theme, setTheme, announce]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}

export function useForm(): FormContextValue {
  const value = useContext(FormContext);
  if (!value) throw new Error('useForm outside provider');
  return value;
}
