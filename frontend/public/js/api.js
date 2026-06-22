// Fetch wrapper for the JSON API. On 401 it resets to the login screen.
import { state } from './state.js';
import { renderLogin } from './views/login.js';

const API = '/api';

export async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { state.user = null; renderLogin(); throw new Error('unauth'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}
