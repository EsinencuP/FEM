import { useCallback, useEffect, useState } from 'react';

interface ApiState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly reload: () => void;
}

export function useApi<T>(loader: () => Promise<T>, dependencies: readonly unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback((): void => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void loader()
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return (): void => controller.abort();
    // The caller provides the stable query dependencies that define this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);

  return { data, loading, error, reload };
}
