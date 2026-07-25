import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { LoginPage } from './LoginPage';

const loginMock = vi.hoisted(() => vi.fn());

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    logout: vi.fn(),
  }),
}));

function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('keeps the required email, password and TOTP contract and can reveal the password', () => {
    renderLogin();

    expect(
      screen.getByRole('heading', { name: 'База данных конного спорта Молдовы.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Платформа для управления базой данных FEM.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Войти в реестр' })).toBeInTheDocument();
    expect(screen.queryByText(/demo|демо|прототип/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    const password = screen.getByLabelText('Пароль');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/Код 2FA/)).toHaveAttribute('pattern', '[0-9]{6}');

    fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Скрыть пароль' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('submits the real authentication payload and renders a safe API error', async () => {
    loginMock.mockRejectedValue(
      new ApiError(401, { code: 'AUTHENTICATION_FAILED', requestId: 'request-demo-1' }),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo.admin@fem.local' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'demo-password' },
    });
    fireEvent.change(screen.getByLabelText(/Код 2FA/), { target: { value: '123456' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Продолжить' }).closest('form')!);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: 'demo.admin@fem.local',
        password: 'demo-password',
        otp: '123456',
      });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Проверьте email, пароль и код 2FA.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('request-demo-1');
  });
});
