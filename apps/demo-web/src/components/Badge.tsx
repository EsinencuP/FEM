import type { ReactNode } from 'react';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Активно',
  DRAFT: 'Черновик',
  INACTIVE: 'Неактивно',
  ARCHIVED: 'Архив',
  PUBLISHED: 'Опубликовано',
  WITHDRAWN: 'Снято',
};

export function Badge({ value }: { readonly value: string | null | undefined }): ReactNode {
  const normalized = value ?? 'UNKNOWN';
  return (
    <span className={`badge badge--${normalized.toLowerCase()}`}>
      {statusLabels[normalized] ?? normalized}
    </span>
  );
}
