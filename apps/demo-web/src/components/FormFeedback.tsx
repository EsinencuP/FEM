import type { ReactNode } from 'react';

import { ApiError } from '../api/client';

export function FormFeedback({
  error,
  success,
}: {
  readonly error: unknown;
  readonly success?: string;
}): ReactNode {
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <div className="form-error" role="alert">
        <strong>{error instanceof Error ? error.message : 'Не удалось сохранить запись.'}</strong>
        {apiError?.details.map((detail) => (
          <span key={`${detail.path}:${detail.message}`}>
            {detail.path}: {detail.message}
          </span>
        ))}
        {apiError?.requestId ? <span>Код обращения: {apiError.requestId}</span> : null}
      </div>
    );
  }
  return success ? (
    <div className="form-success" role="status">
      {success}
    </div>
  ) : null;
}
