import type { ReactNode } from 'react';

import { ApiError } from '../api/client';
import { Button } from './Button';

export function LoadingState({
  label = 'Загружаем данные…',
}: {
  readonly label?: string;
}): ReactNode {
  return (
    <div className="state-panel" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  filtered = false,
  onReset,
}: {
  readonly filtered?: boolean;
  readonly onReset?: () => void;
}): ReactNode {
  return (
    <div className="state-panel">
      <p className="state-panel__eyebrow">{filtered ? 'Ничего не найдено' : 'Пока пусто'}</p>
      <h2>{filtered ? 'Измените параметры поиска' : 'Записей ещё нет'}</h2>
      <p>
        {filtered
          ? 'Сбросьте часть фильтров или попробуйте другой запрос.'
          : 'Создайте первую демонстрационную запись.'}
      </p>
      {filtered && onReset ? <Button onClick={onReset}>Сбросить фильтры</Button> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}): ReactNode {
  const message = error instanceof Error ? error.message : 'Не удалось загрузить данные.';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="state-panel state-panel--error" role="alert">
      <p className="state-panel__eyebrow">Ошибка</p>
      <h2>{message}</h2>
      {requestId ? <p className="request-id">Код обращения: {requestId}</p> : null}
      {onRetry ? <Button onClick={onRetry}>Повторить</Button> : null}
    </div>
  );
}
