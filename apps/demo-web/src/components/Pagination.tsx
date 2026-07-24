import type { ReactNode } from 'react';

import type { PaginationMeta } from '../api/contracts';
import { Button } from './Button';

export function Pagination({
  meta,
  onPage,
}: {
  readonly meta: PaginationMeta;
  readonly onPage: (page: number) => void;
}): ReactNode {
  return (
    <nav className="pagination" aria-label="Пагинация">
      <p>
        Страница <strong>{meta.page}</strong> из <strong>{Math.max(meta.totalPages, 1)}</strong>
        <span> · {meta.total} записей</span>
      </p>
      <div>
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Назад
        </Button>
        <Button
          variant="secondary"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          Далее
        </Button>
      </div>
    </nav>
  );
}
