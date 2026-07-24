import type { ReactNode } from 'react';

import { Button } from './Button';

interface FilterBarProps {
  readonly children: ReactNode;
  readonly onReset: () => void;
}

export function FilterBar({ children, onReset }: FilterBarProps): ReactNode {
  return (
    <section className="filter-bar" aria-label="Фильтры списка">
      <div className="filter-bar__fields">{children}</div>
      <Button variant="quiet" onClick={onReset}>
        Сбросить
      </Button>
    </section>
  );
}

export function FilterControl({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <label className="filter-control">
      <span>{label}</span>
      {children}
    </label>
  );
}
