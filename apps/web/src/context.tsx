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
  storageError: string | null;
  timezone: string;
};

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [theme, setThemeState] = useState<ThemePreference>(() => localStorage.getItem('form.theme') === 'light' ? 'light' : 'dark');
  const [announce, setAnnounce] = useState('');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('Asia/Jerusalem');

  useEffect(() => {
    let cancelled = false;
    repository.initializeCatalog()
      .then(() => repository.getProfile())
      .then((profile) => {
        if (!cancelled) {
          const zone = profile?.timezone ?? 'Asia/Jerusalem';
          repository.setTimeZone(zone);
          setTimezone(zone);
          setNeedsOnboarding(profile === null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsOnboarding(false);
          setReady(true);
          const message = 'לא ניתן לטעון את האחסון המקומי. בדקו שטח אחסון פנוי, הרשאות דפדפן ומצב גלישה פרטית; אם חלק מהנתונים נטענים, יצאו גיבוי לפני ניקוי אחסון.';
          setStorageError(message);
          setAnnounce(message);
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
  const value = useMemo(() => ({ repo: repository, ready, refreshKey, refresh, needsOnboarding, setNeedsOnboarding, theme, setTheme, announce, setAnnounce, storageError, timezone }), [ready, refreshKey, refresh, needsOnboarding, theme, setTheme, announce, storageError, timezone]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}

export function useForm(): FormContextValue {
  const value = useContext(FormContext);
  if (!value) throw new Error('useForm outside provider');
  return value;
}
