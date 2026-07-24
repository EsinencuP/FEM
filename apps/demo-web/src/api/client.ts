import type { ApiErrorBody } from './contracts';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (configuredBaseUrl ?? 'http://127.0.0.1:3000/api/v1').replace(
  /\/$/,
  '',
);

const CSRF_KEY = 'fem.demo.csrf';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: readonly { readonly path: string; readonly message: string }[];

  constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(userMessage(status, body?.code));
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'REQUEST_FAILED';
    this.requestId = body?.requestId;
    this.details = body?.details ?? [];
  }
}

function userMessage(status: number, code?: string): string {
  if (code === 'STALE_VERSION') return 'Запись уже изменена. Обновите данные и повторите действие.';
  if (code === 'VALIDATION_ERROR') return 'Проверьте заполнение обязательных полей.';
  if (code === 'RECOVERY_SESSION_RESTRICTED') {
    return 'Сессия восстановления ограничена. Завершите настройку второго фактора.';
  }
  if (status === 400) return 'Запрос содержит некорректные данные.';
  if (status === 401) return 'Сессия завершена. Войдите снова.';
  if (status === 403) return 'Недостаточно прав для этого действия.';
  if (status === 404) return 'Запись не найдена.';
  if (status === 409) return 'Изменение конфликтует с актуальными данными.';
  if (status === 429) return 'Слишком много запросов. Повторите через минуту.';
  if (status >= 500) return 'Сервис временно недоступен.';
  return 'Не удалось выполнить запрос.';
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

export function getCsrfToken(): string | null {
  return sessionStorage.getItem(CSRF_KEY);
}

export function setCsrfToken(value: string | null): void {
  if (value) sessionStorage.setItem(CSRF_KEY, value);
  else sessionStorage.removeItem(CSRF_KEY);
}

export function createIdempotencyKey(): string {
  return `demo-${crypto.randomUUID()}`;
}

export function toQuery(parameters: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly version?: number;
  readonly idempotencyKey?: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers({
    Accept: 'application/json',
    'X-Request-Id': crypto.randomUUID(),
  });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && path !== '/auth/login') {
    const csrf = getCsrfToken();
    if (!csrf) throw new ApiError(401, { code: 'CSRF_TOKEN_MISSING' });
    headers.set('X-CSRF-Token', csrf);
  }
  if (method === 'POST' && path.startsWith('/admin/')) {
    headers.set('Idempotency-Key', options.idempotencyKey ?? createIdempotencyKey());
  }
  if (method === 'PATCH') {
    if (options.version === undefined) throw new ApiError(409, { code: 'VERSION_REQUIRED' });
    headers.set('If-Match', String(options.version));
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError(503, { code: 'NETWORK_ERROR' });
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('fem:unauthorized'));
    throw new ApiError(response.status, isApiErrorBody(payload) ? payload : undefined);
  }
  return payload as T;
}
