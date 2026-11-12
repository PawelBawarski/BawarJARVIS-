/** Browser transport: same-origin /api only; credentials are supplied by the local dev proxy. */
export class BrowserApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'BrowserApiError';
  }
}

/** Only safe reads can be retried. A failed write may already have reached the backend. */
export interface BrowserApiOptions {
  readonly signal?: AbortSignal;
  /** Override for individual GET calls; deliberately ignored by mutating requests. */
  readonly retries?: number;
  /** Useful in deterministic unit tests; production defaults to bounded backoff. */
  readonly retryDelayMs?: number;
}

const TRANSIENT_STATUSES = new Set([408, 502, 503, 504]);
const MAX_GET_RETRIES = 2;

function cancelled(): BrowserApiError {
  return new BrowserApiError(0, 'REQUEST_CANCELLED');
}

function waitForRetry(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(cancelled());
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(cancelled());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retryable(error: BrowserApiError): boolean {
  // A 503 may mean that the model is deliberately unavailable, not that the proxy is down.
  return error.message !== 'LLM_NOT_READY' &&
    (error.status === 0 && error.message === 'BACKEND_UNAVAILABLE' || TRANSIENT_STATUSES.has(error.status));
}

/** Stable translation keys; never show raw proxy/HTTP errors to end users. */
export function browserApiErrorKey(error: unknown): string | null {
  if (!(error instanceof BrowserApiError)) return null;
  if (error.message === 'LLM_NOT_READY') return 'chat.llmUnavailable';
  if (error.message === 'REQUEST_CANCELLED') return 'api.error.cancelled';
  if (error.message === 'INVALID_API_RESPONSE') return 'api.error.invalidResponse';
  if (error.message === 'MODEL_BUSY') return 'api.error.busy';
  if (error.status === 0) return 'api.error.unavailable';
  if (error.status === 401 || error.status === 403) return 'api.error.authorization';
  if (error.status === 429) return 'api.error.rateLimited';
  if (error.status === 408 || error.status === 504) return 'api.error.timeout';
  if (error.status === 502 || error.status === 503) return 'api.error.temporary';
  return 'api.error.general';
}

export async function browserApi<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: BrowserApiOptions = {},
): Promise<T> {
  if (!path.startsWith('/api/') || path.startsWith('//')) {
    throw new Error('INVALID_API_ROUTE');
  }
  // Even if a caller requests retries for a mutation, NEVER replay it automatically.
  const retries = method === 'GET'
    ? Math.min(MAX_GET_RETRIES, Math.max(0, Math.trunc(options.retries ?? MAX_GET_RETRIES)))
    : 0;

  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw cancelled();
    let error: BrowserApiError;
    try {
      const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        ...(options.signal ? { signal: options.signal } : {}),
        ...(body !== undefined ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        } : {}),
      });
      if (response.ok) {
        if (response.status === 204) return null as T;
        try { return await response.json() as T; }
        catch { throw new BrowserApiError(response.status, 'INVALID_API_RESPONSE'); }
      }
      let code = `HTTP_${response.status}`;
      try {
        const payload: unknown = await response.json();
        if (payload && typeof payload === 'object') {
          const raw = 'code' in payload ? payload.code :
            'error' in payload ? payload.error : undefined;
          if (typeof raw === 'string' && /^[A-Z][A-Z0-9_]{2,80}$/.test(raw)) code = raw;
        }
      } catch { /* preserve HTTP status when the error payload is not JSON */ }
      error = new BrowserApiError(response.status, code);
    } catch (caught) {
      if (options.signal?.aborted) throw cancelled();
      error = caught instanceof BrowserApiError
        ? caught : new BrowserApiError(0, 'BACKEND_UNAVAILABLE');
    }

    if (attempt >= retries || !retryable(error)) throw error;
    const delay = options.retryDelayMs === undefined
      ? 200 * 2 ** attempt
      : Math.max(0, options.retryDelayMs);
    await waitForRetry(delay, options.signal);
  }
}
