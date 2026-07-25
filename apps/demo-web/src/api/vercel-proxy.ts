const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'cookie',
  'idempotency-key',
  'if-match',
  'if-none-match',
  'user-agent',
  'x-action-reason',
  'x-confirm-action',
  'x-csrf-token',
  'x-request-id',
] as const;
const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-language',
  'content-type',
  'etag',
  'idempotency-replayed',
  'retry-after',
  'x-request-id',
] as const;

function jsonError(status: number, code: string, message: string): Response {
  return Response.json(
    {
      statusCode: status,
      error: status === 404 ? 'Not Found' : 'Service Unavailable',
      message,
      code,
      details: [],
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

function validatedBackendOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

function upstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

function downstreamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  const cookieHeaders = upstream.headers as Headers & {
    getSetCookie?: () => readonly string[];
  };
  const cookies =
    typeof cookieHeaders.getSetCookie === 'function' ? cookieHeaders.getSetCookie() : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) headers.append('set-cookie', cookie);
  } else {
    const cookie = upstream.headers.get('set-cookie');
    if (cookie !== null) headers.append('set-cookie', cookie);
  }
  return headers;
}

export async function proxyApiRequest(
  request: Request,
  backendOriginValue: string | undefined,
): Promise<Response> {
  const backendOrigin = validatedBackendOrigin(backendOriginValue);
  if (!backendOrigin) {
    return jsonError(503, 'BACKEND_PROXY_NOT_CONFIGURED', 'The API gateway is not configured.');
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== '/api/v1' && !requestUrl.pathname.startsWith('/api/v1/')) {
    return jsonError(404, 'PROXY_ROUTE_NOT_FOUND', 'The requested API route does not exist.');
  }
  if (!ALLOWED_METHODS.has(request.method)) {
    return jsonError(404, 'PROXY_ROUTE_NOT_FOUND', 'The requested API route does not exist.');
  }

  const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, backendOrigin);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders(request),
      redirect: 'manual',
      cache: 'no-store',
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
    });
  } catch {
    return jsonError(503, 'BACKEND_UNAVAILABLE', 'The API is temporarily unavailable.');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamHeaders(upstream),
  });
}
