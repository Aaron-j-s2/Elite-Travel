export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, message: string, code: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        // Required by the server on every state-changing request (CSRF guard)
        'X-ETH-Request': '1',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'We couldn’t reach the server. Check your connection and try again.', 'network');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && url.startsWith('/api/admin') && !url.startsWith('/api/admin/auth/')) {
      window.dispatchEvent(new Event('eth:unauthorized'));
    }
    const fields = (data?.fields ?? data?.details ?? {}) as Record<string, string>;
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.code ?? 'error', typeof fields === 'object' ? fields : {});
  }
  return data as T;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, undefined, signal),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T>(url: string) => request<T>('DELETE', url),
};

export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
