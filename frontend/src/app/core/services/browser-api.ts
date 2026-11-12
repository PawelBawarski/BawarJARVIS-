/** Browser transport: same-origin /api only. Auth is attached by the LOCAL dev proxy, never by Angular. */
export class BrowserApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'BrowserApiError';
  }
}

export async function browserApi<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!path.startsWith('/api/') || path.startsWith('//')) {
    throw new Error('INVALID_API_ROUTE');
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      ...(body !== undefined ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      } : {}),
    });
  } catch {
    throw new BrowserApiError(0, 'BACKEND_UNAVAILABLE');
  }
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === 'object') {
        const rawCode = 'code' in payload ? payload.code :
          'error' in payload ? payload.error : undefined;
        if (typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{2,80}$/.test(rawCode)) {
          code = rawCode;
        }
      }
    } catch { /* preserve HTTP status */ }
    throw new BrowserApiError(response.status, code);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}
