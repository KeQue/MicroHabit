import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const productionHost = 'nzpnfrutomyuvrprkrwi.supabase.co';
const codes = new Map([
  ['invalid_credentials', 'invalid-credentials'],
  ['email_not_confirmed', 'email-unconfirmed'],
  ['user_banned', 'account-unavailable'],
  ['email_provider_disabled', 'provider-disabled'],
  ['over_request_rate_limit', 'rate-limited'],
  ['over_email_send_rate_limit', 'rate-limited'],
  ['request_timeout', 'backend-timeout'],
]);

// One request, no retries or stored session. Response content remains in memory.
export async function checkAuth(env, request = fetch) {
  if (env.E2E_BACKEND_ENV !== 'production' || env.E2E_BACKEND_HOST !== productionHost || env.E2E_ALLOW_PRODUCTION_AUTH !== 'yes') return { status: 'FAIL', category: 'configuration' };
  if (!env.E2E_SUPABASE_ANON_KEY || !env.E2E_LOGIN_EMAIL || !env.E2E_LOGIN_PASSWORD) return { status: 'FAIL', category: 'missing-secret' };
  try {
    const response = await request(`https://${productionHost}/auth/v1/token?grant_type=password`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { apikey: env.E2E_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.E2E_LOGIN_EMAIL.trim(), password: env.E2E_LOGIN_PASSWORD }),
    });
    if (response.status === 429) return { status: 'FAIL', category: 'rate-limited' };
    if (response.status >= 500) return { status: 'FAIL', category: 'backend-unavailable' };
    if (response.status === 401 || response.status === 403) return { status: 'FAIL', category: 'access-or-key' };
    // Bound private response data and never print it, even on parse failure.
    let text = '';
    for await (const chunk of response.body || []) {
      text += Buffer.from(chunk).toString('utf8');
      if (text.length > 131072) return { status: 'FAIL', category: 'unexpected-response' };
    }
    let data;
    try { data = JSON.parse(text); } catch { return { status: 'FAIL', category: 'unexpected-response' }; }
    if (response.ok && typeof data.access_token === 'string' && data.access_token.length > 0 && typeof data.token_type === 'string' && data.token_type.toLowerCase() === 'bearer') return { status: 'PASS', category: 'authenticated' };
    return { status: 'FAIL', category: codes.get(data?.code) || 'other-auth-error' };
  } catch { return { status: 'FAIL', category: 'connection-or-timeout' }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkAuth(process.env);
  console.log(`Auth preflight: ${result.status} (${result.category})`);
  if (result.status !== 'PASS') process.exitCode = 1;
}
