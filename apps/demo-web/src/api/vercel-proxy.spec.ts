import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxyApiRequest } from './vercel-proxy';

describe('Vercel API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails closed when the backend origin is not configured', async () => {
    const response = await proxyApiRequest(
      new Request('https://demo.example/api/v1/health'),
      undefined,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BACKEND_PROXY_NOT_CONFIGURED',
    });
  });

  it('does not proxy paths outside the versioned API boundary', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyApiRequest(
      new Request('https://demo.example/private'),
      'https://api.example',
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an allowlisted request and preserves the secure session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'fem_admin_session=opaque; Path=/api/v1; HttpOnly; Secure; SameSite=Strict',
          'x-request-id': 'request-123',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://demo.example/api/v1/auth/login?source=demo', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'existing=value',
        origin: 'https://untrusted.example',
        'x-request-id': 'request-123',
      },
      body: JSON.stringify({ email: 'demo@example.test' }),
    });

    const response = await proxyApiRequest(request, 'https://api.example');

    expect(response.status).toBe(200);
    const [target, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(target.toString()).toBe('https://api.example/api/v1/auth/login?source=demo');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('origin')).toBeNull();
    expect(new Headers(options.headers).get('cookie')).toBe('existing=value');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
    expect(response.headers.get('x-request-id')).toBe('request-123');
  });

  it('returns a safe response when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network details')));

    const response = await proxyApiRequest(
      new Request('https://demo.example/api/v1/health'),
      'https://api.example',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BACKEND_UNAVAILABLE',
      message: 'The API is temporarily unavailable.',
    });
  });
});
