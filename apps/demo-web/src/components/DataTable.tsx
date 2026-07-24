import type { ReactNode } from 'react';

export interface TableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly sortKey?: string;
  readonly numeric?: boolean;
  readonly render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly TableColumn<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (item: T) => string;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
  readonly onSort?: (key: string) => void;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  sortBy,
  sortOrder,
  onSort,
}: DataTableProps<T>): ReactNode {
  return (
    <div className="table-frame">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.sortKey === sortBy;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? 'numeric' : undefined}
                  aria-sort={
                    active ? (sortOrder === 'desc' ? 'descending' : 'ascending') : undefined
                  }
                >
                  {column.sortKey && onSort ? (
                    <button className="sort-button" onClick={() => onSort(column.sortKey!)}>
                      {column.label}
                      <span aria-hidden="true">
                        {active ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'numeric' : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
