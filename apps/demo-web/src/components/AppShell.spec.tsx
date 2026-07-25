import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { displayName: 'Administrator' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('AppShell', () => {
  it('uses readable section names instead of numeric navigation codes', () => {
    render(
      <MemoryRouter initialEntries={['/athletes']}>
        <AppShell />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Основная навигация' });

    expect(navigation).toHaveTextContent('Спортсмены');
    expect(navigation).toHaveTextContent('Лошади');
    expect(navigation).toHaveTextContent('Соревнования');
    expect(screen.queryByText('01')).not.toBeInTheDocument();
    expect(screen.queryByText('02')).not.toBeInTheDocument();
    expect(screen.queryByText('03')).not.toBeInTheDocument();
    expect(screen.getByText('Администратор FEM')).toBeInTheDocument();
    expect(screen.queryByText(/demo|демо|прототип/i)).not.toBeInTheDocument();
  });
});
