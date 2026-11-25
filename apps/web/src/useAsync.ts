import { useEffect, useState } from 'react';
import { useForm } from './context';

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null } {
  const { refreshKey } = useForm();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    load().then((data) => {
      if (!cancelled) setState({ data, loading: false, error: null });
    }).catch((error: unknown) => {
      if (!cancelled) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'שגיאה לא ידועה' });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);
  return state;
}
