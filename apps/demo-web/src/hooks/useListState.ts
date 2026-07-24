import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface ListState {
  readonly page: number;
  readonly limit: number;
  readonly search: string;
  readonly sortBy: string;
  readonly sortOrder: 'asc' | 'desc';
  readonly get: (key: string) => string;
  readonly set: (updates: Record<string, string | number | undefined>) => void;
  readonly reset: () => void;
}

export function useListState(defaultSort: string): ListState {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const rawLimit = Number(params.get('limit')) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const search = params.get('search') ?? '';
  const sortBy = params.get('sortBy') ?? defaultSort;
  const sortOrder = params.get('sortOrder') === 'desc' ? 'desc' : 'asc';

  const set = useCallback(
    (updates: Record<string, string | number | undefined>): void => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in updates)) next.set('page', '1');
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const reset = useCallback((): void => setParams({}, { replace: false }), [setParams]);
  const get = useCallback((key: string): string => params.get(key) ?? '', [params]);
  return { page, limit, search, sortBy, sortOrder, get, set, reset };
}
