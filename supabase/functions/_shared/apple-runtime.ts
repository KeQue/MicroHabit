import { appleVerifier, type Dependencies, type Context, type Receipt } from './apple-deletion.ts';

export function runtime(env: (name: string) => string | undefined, fetcher: typeof fetch = fetch): Dependencies {
  const required = (name: string) => { const value = env(name); if (!value) throw new Error('server_configuration_missing'); return value; };
  const base = required('SUPABASE_URL').replace(/\/$/, '');
  const anon = required('SUPABASE_ANON_KEY'), service = required('SUPABASE_SERVICE_ROLE_KEY');
  const call = async (path: string, token: string, key: string, value?: object) => {
    const response = await fetcher(base + path, {
      method: value ? 'POST' : 'GET',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: value ? JSON.stringify(value) : undefined, signal: AbortSignal.timeout(15000),
    });
    return response;
  };
  const rpc = async (name: string, value: object) => {
    const response = await call('/rest/v1/rpc/' + name, service, service, value);
    if (!response.ok) throw new Error('database_unavailable');
    const text = await response.text(); return text ? JSON.parse(text) : null;
  };
  const apple = async (path: string, token: string) => fetcher('https://appleid.apple.com/auth/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: required('APPLE_CLIENT_ID'), client_secret: required('APPLE_CLIENT_SECRET'),
      ...(path === 'token' ? { grant_type: 'refresh_token', refresh_token: token } : { token, token_type_hint: 'refresh_token' }) }),
    signal: AbortSignal.timeout(10000),
  });
  return {
    async authenticate(token) {
      const response = await call('/auth/v1/user', token, anon);
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error('authentication_unavailable');
      const user = await response.json();
      if (typeof user.id !== 'string') throw new Error('invalid_authentication_response');
      return user.id;
    },
    context: async id => await rpc('get_apple_deletion_context', { p_user_id: id }) as Context,
    prepare: async (id, subject, hash, state: Receipt['state']) => { await rpc('prepare_apple_deletion', {
      p_user_id: id, p_apple_subject: subject, p_token_hash: hash, p_state: state,
    }); },
    async deleteCurrent(token) {
      const response = await call('/rest/v1/rpc/delete_my_account', token, anon, {});
      if (!response.ok) throw new Error('database_deletion_failed');
    },
    async refresh(token) {
      const response = await apple('token', token);
      if (!response.ok) return null;
      const value = await response.json();
      if (typeof value.id_token !== 'string') throw new Error('apple_identity_missing');
      return { id_token: value.id_token };
    },
    async revoke(token) { if (!(await apple('revoke', token)).ok) throw new Error('apple_revocation_unavailable'); },
    verify: appleVerifier({ fetch: fetcher, clientId: env('APPLE_CLIENT_ID') ?? '',
      notificationAudiences: (env('APPLE_NOTIFICATION_AUDIENCES') ?? '').split(',').map(s => s.trim()).filter(Boolean),
      now: () => Math.floor(Date.now() / 1000) }),
    invalidate: async (subject, cutoff) => { await rpc('invalidate_apple_sessions', { p_apple_subject: subject, p_event_time: cutoff }); },
    now: () => Math.floor(Date.now() / 1000),
  };
}
