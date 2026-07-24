import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type TableColumn } from './DataTable';

interface Row {
  readonly id: string;
  readonly name: string;
}

describe('DataTable', () => {
  it('renders semantic sorting state and forwards the allowlisted key', () => {
    const onSort = vi.fn();
    const columns: readonly TableColumn<Row>[] = [
      { key: 'name', label: 'Имя', sortKey: 'name', render: (row) => row.name },
    ];
    render(
      <DataTable
        caption="Тестовый список"
        columns={columns}
        rows={[{ id: 'one', name: 'Алекс' }]}
        rowKey={(row) => row.id}
        sortBy="name"
        sortOrder="desc"
        onSort={onSort}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /имя/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    fireEvent.click(screen.getByRole('button', { name: /имя/i }));
    expect(onSort).toHaveBeenCalledWith('name');
  });
});
