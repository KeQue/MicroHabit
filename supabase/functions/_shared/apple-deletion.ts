// No provider credentials or user tokens may be logged by these handlers.
export type Receipt = { state: 'pending' | 'revoked' | 'manual'; token_hash: string | null };
export type Context = { uses_apple: boolean; apple_subject: string | null; receipt: Receipt | null };
export type Dependencies = {
  authenticate(token: string): Promise<string | null>;
  context(id: string): Promise<Context>;
  prepare(id: string, subject: string | null, hash: string | null, state: Receipt['state']): Promise<void>;
  deleteCurrent(token: string): Promise<void>;
  refresh(token: string): Promise<{ id_token: string } | null>;
  revoke(token: string): Promise<void>;
  verify(token: string, kind: 'identity' | 'notification'): Promise<Record<string, unknown>>;
  invalidate(subject: string, cutoff: number): Promise<void>;
  now(): number;
};

class Rejected extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
const reply = (status: number, value: object) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Rejected(415, 'json_required');
  if (Number(request.headers.get('content-length')) > 16384) throw new Rejected(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Rejected(400, 'invalid_request');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); throw new Rejected(413, 'body_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Rejected(400, 'invalid_request'); }
  if (!record(value)) throw new Rejected(400, 'invalid_request');
  return value;
}
async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(n => n.toString(16).padStart(2, '0')).join('');
}
export function deletionHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    try {
      const authorization = request.headers.get('authorization');
      if (!authorization?.match(/^Bearer [^\s]+$/)) throw new Rejected(401, 'authentication_required');
      const token = authorization.slice(7), id = await deps.authenticate(token);
      if (!id) throw new Rejected(401, 'authentication_required');
      const input = await body(request);
      if (Object.keys(input).some(key => key !== 'apple_refresh_token')) throw new Rejected(400, 'invalid_request');
      const refreshToken = input.apple_refresh_token;
      if (refreshToken !== undefined && (typeof refreshToken !== 'string' || !refreshToken.length || refreshToken.length > 8192)) throw new Rejected(400, 'invalid_request');
      const context = await deps.context(id);
      let access: 'revoked' | 'manual_required' | 'not_linked' = 'not_linked';
      if (context.uses_apple) {
        let pendingPrepared = context.receipt?.state === 'pending';
        access = context.receipt?.state === 'revoked' ? 'revoked' : 'manual_required';
        if (access !== 'revoked' && typeof refreshToken === 'string' && context.apple_subject) {
          const hash = await digest(refreshToken);
          const trustedRetry = context.receipt?.state === 'pending' && context.receipt.token_hash === hash;
          let verified = trustedRetry;
          if (!verified) {
            let identity: { id_token: string } | null = null;
            try { identity = await deps.refresh(refreshToken); } catch { /* Delete data even when Apple is unavailable. */ }
            if (identity) {
              let claims: Record<string, unknown>;
              try { claims = await deps.verify(identity.id_token, 'identity'); }
              catch { throw new Rejected(409, 'apple_identity_not_verified'); }
              if (claims.sub !== context.apple_subject) throw new Rejected(409, 'apple_identity_mismatch');
              verified = true;
            }
          }
          if (verified) {
            await deps.prepare(id, context.apple_subject, hash, 'pending');
            pendingPrepared = true;
            try {
              await deps.revoke(refreshToken);
              // Persist success before app deletion, so a database retry cannot strand the user.
              await deps.prepare(id, context.apple_subject, hash, 'revoked');
              access = 'revoked';
            } catch { /* Pending proof remains available if deletion itself needs a retry. */ }
          }
        }
        if (access === 'manual_required' && !pendingPrepared) {
          await deps.prepare(id, context.apple_subject, null, 'manual');
        }
      }
      await deps.deleteCurrent(token);
      return reply(200, { deleted: true, apple_access: access });
    } catch (error) {
      return error instanceof Rejected ? reply(error.status, { error: error.code }) : reply(503, { error: 'deletion_unavailable' });
    }
  };
}

export function notificationHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    try {
      const input = await body(request);
      if (Object.keys(input).some(key => key !== 'payload') || typeof input.payload !== 'string') throw new Rejected(400, 'invalid_request');
      let claims: Record<string, unknown>;
      try { claims = await deps.verify(input.payload, 'notification'); } catch { throw new Rejected(401, 'invalid_notification'); }
      let events = claims.events;
      if (typeof events === 'string') { try { events = JSON.parse(events); } catch { throw new Rejected(400, 'invalid_event'); } }
      if (!record(events) || typeof events.type !== 'string' || typeof events.sub !== 'string' || !events.sub.length || events.sub.length > 255) throw new Rejected(400, 'invalid_event');
      const rawCutoff = events.event_time;
      if (typeof rawCutoff !== 'number' || !Number.isFinite(rawCutoff)) throw new Rejected(400, 'invalid_event');
      let cutoff: number = rawCutoff;
      if (cutoff > 1e12) cutoff = Math.floor(cutoff / 1000);
      if (cutoff < 0 || cutoff > deps.now() + 300 || typeof claims.iat !== 'number' || cutoff > claims.iat + 300) throw new Rejected(400, 'invalid_event');
      if (!['consent-revoked', 'account-deleted', 'account-delete'].includes(events.type)) return reply(200, { received: true, ignored: true });
      // Invalidate old sessions only: Apple account events do not authorize app-data deletion.
      await deps.invalidate(events.sub, Math.floor(cutoff));
      return reply(200, { received: true });
    } catch (error) {
      return error instanceof Rejected ? reply(error.status, { error: error.code }) : reply(503, { error: 'notification_unavailable' });
    }
  };
}

function decode(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('invalid_jwt');
  return Uint8Array.from(atob(segment.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export function appleVerifier(options: {
  fetch: typeof fetch; clientId: string; notificationAudiences: string[]; now(): number;
}) {
  return async (jwt: string, kind: 'identity' | 'notification'): Promise<Record<string, unknown>> => {
    if (jwt.length > 12288) throw new Error('invalid_jwt');
    const parts = jwt.split('.'); if (parts.length !== 3) throw new Error('invalid_jwt');
    const header: unknown = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims: unknown = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (!record(header) || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined || !record(claims)) throw new Error('invalid_jwt');
    const now = options.now(), audiences = kind === 'identity' ? [options.clientId] : options.notificationAudiences;
    if (claims.iss !== 'https://appleid.apple.com' || typeof claims.aud !== 'string' || !audiences.includes(claims.aud) || !claims.aud) throw new Error('invalid_jwt');
    if (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > now + 300 || claims.iat < now - 7 * 86400) throw new Error('invalid_jwt');
    if (kind === 'identity' && (typeof claims.exp !== 'number' || typeof claims.sub !== 'string' || !claims.sub.length)) throw new Error('invalid_jwt');
    if (claims.exp !== undefined && (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now || claims.exp < claims.iat)) throw new Error('invalid_jwt');
    if (kind === 'notification' && (typeof claims.jti !== 'string' || !claims.jti.length || claims.jti.length > 255)) throw new Error('invalid_jwt');
    const response = await options.fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('apple_keys_unavailable');
    const jwks = await response.json();
    if (!record(jwks) || !Array.isArray(jwks.keys)) throw new Error('invalid_keys');
    const key = jwks.keys.find((k: unknown) => record(k) && k.kid === header.kid && k.kty === 'RSA' && k.alg === 'RS256' && k.use === 'sig');
    if (!key) throw new Error('unknown_key');
    const publicKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) throw new Error('invalid_signature');
    return claims;
  };
}
