/**
 * 성좌 크로니클 — Cloudflare Workers 판 서버 (카드 없이 무료)
 * 하는 일: 1) 로그인 토큰(Firebase ID 토큰) 확인  2) 서비스 계정으로 Realtime Database 읽기/쓰기
 * 실제 게임 규칙은 ../functions/handlers.js, logic.js 를 그대로 씁니다.
 */
import { makeHandlers } from '../functions/handlers.js';

const b64u = {
  enc: bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
  encText: s => b64u.enc(new TextEncoder().encode(s)),
  decJson: s => JSON.parse(new TextDecoder().decode(b64u.dec(s))),
};

/* ---------- 로그인 토큰 확인 ---------- */
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache = { at: 0, keys: null };
async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw Object.assign(new Error('로그인 확인 서버에 연결하지 못했어요.'), { code: 'unavailable' });
  jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return jwksCache.keys;
}
export async function verifyIdToken(token, projectId, nowSec = Math.floor(Date.now() / 1000)) {
  const bad = () => Object.assign(new Error('로그인이 필요해요.'), { code: 'unauthenticated' });
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw bad();
  let header, claims;
  try { header = b64u.decJson(parts[0]); claims = b64u.decJson(parts[1]); } catch { throw bad(); }
  if (header.alg !== 'RS256' || !header.kid) throw bad();
  const jwk = (await getJwks()).find(k => k.kid === header.kid);
  if (!jwk) throw bad();
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw bad();
  if (claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId) throw bad();
  if (!(claims.exp > nowSec) || !(claims.iat <= nowSec + 60) || !claims.sub) throw bad();
  return claims.sub;
}

/* ---------- 서비스 계정으로 DB 접근 ---------- */
let tokenCache = { at: 0, value: null };
async function accessToken(env) {
  if (tokenCache.value && Date.now() - tokenCache.at < 50 * 60e3) return tokenCache.value;
  const sa = JSON.parse(env.SA_JSON);
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u.encText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u.encText(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + b64u.enc(sig),
  });
  if (!r.ok) throw Object.assign(new Error('서버 설정(서비스 계정 키)을 확인해 주세요.'), { code: 'internal' });
  tokenCache = { at: Date.now(), value: (await r.json()).access_token };
  return tokenCache.value;
}

export function makeRestAdapter(env) {
  const base = String(env.DATABASE_URL).replace(/\/$/, '');
  const url = p => base + '/anime/' + p.split('/').filter(Boolean).map(encodeURIComponent).join('/') + '.json';
  const call = async (method, p, body, extra = {}) => {
    const r = await fetch(url(p), { method, headers: Object.assign({ authorization: 'Bearer ' + (await accessToken(env)), 'content-type': 'application/json' }, extra.headers || {}), body: body === undefined ? undefined : JSON.stringify(body) });
    return r;
  };
  const must = async (r) => { if (!r.ok && r.status !== 412) throw Object.assign(new Error('데이터베이스 오류 ' + r.status), { code: 'internal' }); return r; };
  return {
    TS: { '.sv': 'timestamp' },
    get: async p => { const r = await must(await call('GET', p)); return r.json(); },
    set: async (p, v) => { await must(await call('PUT', p, v)); },
    remove: async p => { await must(await call('DELETE', p)); },
    update: async (p, o) => { await must(await call('PATCH', p, o)); },
    push: async (p, v) => { await must(await call('POST', p, v)); },
    // ETag 를 이용한 안전한 읽고-쓰기. 중간에 누가 바꾸면 다시 시도해요.
    tx: async (p, fn) => {
      for (let i = 0; i < 6; i++) {
        const g = await must(await call('GET', p, undefined, { headers: { 'X-Firebase-ETag': 'true' } }));
        const etag = g.headers.get('etag'), cur = await g.json();
        const next = fn(cur);
        if (next === undefined) return { committed: false };
        const w = await call(next === null ? 'DELETE' : 'PUT', p, next === null ? undefined : next, { headers: { 'if-match': etag } });
        if (w.status === 412) continue;
        await must(w);
        return { committed: true };
      }
      throw Object.assign(new Error('잠시 후 다시 시도해 주세요.'), { code: 'aborted' });
    },
  };
}

/* ---------- 요청 처리 ---------- */
const HTTP = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'not-found': 404, 'deadline-exceeded': 408, 'already-exists': 409, aborted: 409, 'failed-precondition': 412, 'resource-exhausted': 429, unavailable: 503 };
const NAMES = new Set(['ping', 'buyChar', 'buyEquip', 'convert', 'gacha', 'sellRare', 'claimEvent', 'startBattle', 'claimStage', 'tradeConfirm', 'deleteAccount']);
const rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };

function corsHeaders(req, env) {
  const origin = req.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return { ok, headers: Object.assign({ vary: 'origin' }, ok ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-max-age': '86400' } : {}) };
}
const json = (status, obj, headers) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers) });

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
    if (u.pathname === '/health') return json(200, { ok: true }, cors.headers);
    const m = u.pathname.match(/^\/api\/(\w+)$/);
    if (!m || req.method !== 'POST' || !NAMES.has(m[1])) return json(404, { error: { code: 'not-found', message: '없는 주소예요.' } }, cors.headers);
    if (!cors.ok) return json(403, { error: { code: 'permission-denied', message: '허용되지 않은 사이트예요.' } }, cors.headers);
    try {
      const auth = req.headers.get('authorization') || '';
      const uid = await verifyIdToken(auth.replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID);
      let data = {};
      try { data = (await req.json()) || {}; } catch { /* 본문이 없어도 됨 */ }
      const H = makeHandlers(makeRestAdapter(env), { rand });
      const out = await H[m[1]]({ uid, data });
      return json(200, { data: out }, cors.headers);
    } catch (e) {
      const code = HTTP[e && e.code] ? e.code : 'internal';
      const message = HTTP[e && e.code] ? e.message : '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.';
      return json(HTTP[code] || 500, { error: { code, message } }, cors.headers);
    }
  },
};
