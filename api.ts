const BASE = '/api';
const KEY = 'gvpathshala.tokens';

export interface Tokens { accessToken: string; refreshToken: string }

export const tokenStore = {
  get(): Tokens | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  },
  set(t: Tokens) { localStorage.setItem(KEY, JSON.stringify(t)); },
  clear() { localStorage.removeItem(KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

interface Options { method?: string; body?: unknown; form?: FormData }

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const tokens = tokenStore.get();
  const run = (access?: string) =>
    fetch(BASE + path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers: { ...(opts.form ? {} : { 'Content-Type': 'application/json' }), ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });

  let res = await run(tokens?.accessToken);
  // Access tokens last 15 minutes. On 401, try the refresh token once, then retry the request.
  if (res.status === 401 && tokens?.refreshToken && !path.startsWith('/auth/')) {
    const r = await fetch(BASE + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) });
    if (r.ok) {
      const fresh = (await r.json()) as Tokens;
      tokenStore.set(fresh);
      res = await run(fresh.accessToken);
    } else {
      tokenStore.clear();
      window.dispatchEvent(new Event('gvpathshala:signed-out'));
    }
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Something went wrong. Try again.', data?.details);
  return data as T;
}
