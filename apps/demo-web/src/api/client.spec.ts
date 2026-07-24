import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, setCsrfToken, toQuery } from './client';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serializes only provided query values', () => {
    expect(toQuery({ page: 2, search: 'Ana', status: undefined, archived: '' })).toBe(
      '?page=2&search=Ana',
    );
  });

  it('adds CSRF, idempotency and credentials to an Admin POST', async () => {
    setCsrfToken('csrf-demo');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'created' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/admin/athletes', { method: 'POST', body: { displayName: 'Demo' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe('include');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-demo');
    expect(headers.get('Idempotency-Key')).toMatch(/^demo-/);
  });

  it('allows anonymous login without a CSRF token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { csrfToken: 'next' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.invalid', password: 'secret', otp: '123456' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has('X-CSRF-Token')).toBe(false);
  });

  it('sends the current resource version on PATCH', async () => {
    setCsrfToken('csrf-demo');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'updated' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/admin/horses/id', {
      method: 'PATCH',
      body: { displayName: 'Updated' },
      version: 7,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('If-Match')).toBe('7');
  });

  it('maps a stale version conflict to a safe message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 409,
          code: 'STALE_VERSION',
          message: 'internal text',
          error: 'Conflict',
          details: [],
          timestamp: new Date().toISOString(),
          path: '/api/v1/admin/athletes/id',
          requestId: 'request-demo',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/admin/athletes/id')).rejects.toMatchObject({
      code: 'STALE_VERSION',
      message: 'Запись уже изменена. Обновите данные и повторите действие.',
      requestId: 'request-demo',
    });
  });

  it.each([
    [401, 'AUTH_REQUIRED', 'Сессия завершена. Войдите снова.'],
    [403, 'FORBIDDEN', 'Недостаточно прав для этого действия.'],
    [404, 'NOT_FOUND', 'Запись не найдена.'],
    [409, 'CONFLICT', 'Изменение конфликтует с актуальными данными.'],
    [500, 'INTERNAL_ERROR', 'Сервис временно недоступен.'],
  ])('maps HTTP %i to a safe frontend message', async (status, code, message) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: status,
          code,
          message: 'sensitive backend detail',
          error: 'Backend error',
          details: [],
          timestamp: new Date().toISOString(),
          path: '/api/v1/admin/athletes',
          requestId: `request-${status}`,
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/admin/athletes')).rejects.toMatchObject({
      status,
      code,
      message,
      requestId: `request-${status}`,
    });
  });
});
