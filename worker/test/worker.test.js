// 가짜 구글/실시간 데이터베이스를 붙여서 Cloudflare Worker 를 처음부터 끝까지 시험합니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

const subtle = globalThis.crypto.subtle;
const enc = s => new TextEncoder().encode(s);
const b64u = b => Buffer.from(b).toString('base64url');

// ---- 키 만들기 ----
const google = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const other = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const saKey = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', saKey.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
const jwk = { ...(await subtle.exportKey('jwk', google.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };

const PROJECT = 'test-proj';
const ENV = {
  FIREBASE_PROJECT_ID: PROJECT, DATABASE_URL: 'https://db.example', ALLOWED_ORIGINS: 'https://game.example',
  SA_JSON: JSON.stringify({ client_email: 'sa@test.iam', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n` }),
};
async function idToken(uid, over = {}, key = google.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })));
  const body = b64u(enc(JSON.stringify({ aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, iat: now - 5, exp: now + 3600, ...over })));
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', key, enc(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

// ---- 가짜 네트워크 ----
let data = {}, conflictOnce = 0, log = [];
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const split = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = ks => { let c = data; for (const k of ks) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : clone(c); };
function setAt(ks, v) { let c = data; for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; } const l = ks[ks.length - 1]; if (v === null || v === undefined) delete c[l]; else c[l] = res(clone(v)); }
const res = v => { if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); for (const k of Object.keys(v)) v[k] = res(v[k]); } return v; };
const etagOf = v => (v === null ? 'null_etag' : 'e' + Buffer.from(JSON.stringify(v)).toString('base64').slice(0, 40));
globalThis.fetch = async (input, init = {}) => {
  const url = String(input), method = (init.method || 'GET').toUpperCase();
  log.push(method + ' ' + url.replace(/^https?:\/\/[^/]+/, ''));
  if (url.includes('securetoken@system.gserviceaccount.com')) return Response.json({ keys: [jwk] });
  if (url === 'https://oauth2.googleapis.com/token') { assert.match(String(init.body), /grant_type=.*jwt-bearer.*assertion=/); return Response.json({ access_token: 'fake-token' }); }
  if (url.startsWith('https://db.example/anime/')) {
    assert.equal(init.headers.authorization, 'Bearer fake-token');
    const ks = ['anime', ...split(url.replace('https://db.example/anime/', '').replace(/\.json.*$/, ''))], body = init.body ? JSON.parse(init.body) : undefined;
    const cur = getAt(ks), h = init.headers || {};
    if (method === 'GET') return new Response(JSON.stringify(cur), { headers: { etag: etagOf(cur) } });
    if (h['if-match'] !== undefined && (conflictOnce > 0 || h['if-match'] !== etagOf(cur))) { if (conflictOnce > 0) conflictOnce--; return new Response(JSON.stringify(cur), { status: 412 }); }
    if (method === 'PUT') { setAt(ks, body); return Response.json(body); }
    if (method === 'DELETE') { setAt(ks, null); return Response.json(null); }
    if (method === 'PATCH') { for (const [k, v] of Object.entries(body)) setAt([...ks, ...split(k)], v); return Response.json(body); }
    if (method === 'POST') { const id = 'p' + Math.random().toString(36).slice(2, 8); setAt([...ks, id], body); return Response.json({ name: id }); }
  }
  throw new Error('예상치 못한 요청 ' + method + ' ' + url);
};

const seed = () => { log = []; conflictOnce = 0; data = { anime: {
  uids: { u1: 'A유저', u2: 'B유저' }, saves: { 'A유저': { coins: 5000, dia: 0, owned: ['하루 세이렌'], best: 2 }, 'B유저': { coins: 100, rare: ['레이나 블래스트'], owned: ['하루 세이렌'] } },
} }; };
const ORIGIN = 'https://game.example';
async function api(name, uid, payload, { origin = ORIGIN, token } = {}) {
  const headers = { origin, 'content-type': 'application/json' };
  const t = token !== undefined ? token : uid ? await idToken(uid) : '';
  if (t) headers.authorization = 'Bearer ' + t;
  const r = await worker.fetch(new Request('https://w.example/api/' + name, { method: 'POST', headers, body: JSON.stringify(Object.assign({ v: 999 }, payload || {})) }), ENV);
  return { status: r.status, body: await r.json(), headers: r.headers };
}
const db = (p) => getAt(['anime', ...p.split('/')]);

test('상태 확인과 CORS: 허용된 사이트만', async () => {
  seed();
  let r = await worker.fetch(new Request('https://w.example/health', { headers: { origin: ORIGIN } }), ENV);
  assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  r = await worker.fetch(new Request('https://w.example/api/convert', { method: 'OPTIONS', headers: { origin: ORIGIN } }), ENV);
  assert.equal(r.status, 204);
  r = await worker.fetch(new Request('https://w.example/api/convert', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), ENV);
  assert.equal(r.status, 403);
  assert.equal((await api('convert', 'u1', {}, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await api('모르는', 'u1')).status, 404);
});

test('로그인 토큰: 없음/위조/다른 프로젝트/만료는 모두 401', async () => {
  seed();
  assert.equal((await api('ping', null)).status, 401);
  assert.equal((await api('ping', null, {}, { token: await idToken('u1', {}, other.privateKey) })).status, 401);   // 다른 키로 서명
  assert.equal((await api('ping', null, {}, { token: await idToken('u1', { aud: 'other-proj' }) })).status, 401);
  assert.equal((await api('ping', null, {}, { token: await idToken('u1', { exp: Math.floor(Date.now() / 1000) - 10 }) })).status, 401);
  assert.equal((await api('ping', null, {}, { token: 'a.b.c' })).status, 401);
  assert.equal(log.filter(l => l.startsWith('GET /anime')).length, 0, '인증 실패 시 DB를 읽지 않아야 함');
});

test('정상 요청: 환전이 DB에 반영되고 장부가 남는다', async () => {
  seed();
  const r = await api('convert', 'u1', { dir: 'coinToDia', count: 2 });
  assert.equal(r.status, 200); assert.deepEqual(r.body.data, { coins: -2000, dia: 2 });
  assert.equal(db('saves/A유저').coins, 3000); assert.equal(db('saves/A유저').dia, 2);
  assert.ok(Object.keys(db('ledger/A유저') || {}).length >= 1);
});

test('동시에 바뀌면(412) 자동으로 다시 시도한다', async () => {
  seed(); conflictOnce = 2;
  const r = await api('convert', 'u1', { dir: 'coinToDia', count: 1 });
  assert.equal(r.status, 200); assert.equal(db('saves/A유저').coins, 4000);
});

test('오류는 알맞은 상태 코드와 한국어 메시지로 돌려준다', async () => {
  seed();
  let r = await api('buyChar', 'u1', { name: '오블리비온' });   // 코인 부족
  assert.equal(r.status, 412); assert.match(r.body.error.message, /코인이 부족/);
  r = await api('convert', 'u1', { dir: 'coinToDia', count: 999 });
  assert.equal(r.status, 400);
  r = await api('ping', 'ghost');                                      // 닉네임 없는 계정
  assert.equal(r.status, 412);
  data.anime.bans = { 'A유저': true };
  assert.equal((await api('convert', 'u1', { dir: 'coinToDia', count: 1 })).status, 403);
});

test('전투 보상과 거래가 Worker 를 통해서도 똑같이 동작한다', async () => {
  seed();
  assert.equal((await api('startBattle', 'u1', { mode: 'normal', stage: 9 })).status, 412);
  assert.equal((await api('startBattle', 'u1', { mode: 'normal', stage: 2 })).status, 200);
  assert.equal((await api('claimStage', 'u1')).status, 412);            // 너무 빨라서 거절 → 되돌려져 다시 받을 수 있음
  data.anime.battles['A유저'].startedAt -= 60000;
  const ok = await api('claimStage', 'u1');
  assert.equal(ok.status, 200); assert.equal(ok.body.data.coins, 40 + 2 * 22);
  assert.equal((await api('claimStage', 'u1')).status, 412);            // 두 번째는 거절
  data.anime.tradeRooms = { r: { users: { 'A유저': {}, 'B유저': {} }, offers: { 'A유저': { type: 'coins', amount: 300 }, 'B유저': { type: 'char', item: '레이나 블래스트' } }, ready: { 'A유저': true, 'B유저': true } } };
  const before = db('saves/A유저').coins + db('saves/B유저').coins;
  assert.equal((await api('tradeConfirm', 'u2', { room: 'r' })).status, 200);
  assert.equal(db('saves/A유저').coins + db('saves/B유저').coins, before);
  assert.ok(db('saves/A유저').rare.includes('레이나 블래스트'));
  assert.equal(db('tradeRooms/r').done, true);
});

test('계정 삭제도 Worker 를 통해 동작한다', async () => {
  seed();
  data.anime.prefs = { 'A유저': { eq: 'x' } };
  const r = await api('deleteAccount', 'u1');
  assert.equal(r.status, 200);
  assert.equal(db('saves/A유저'), null); assert.equal(db('prefs/A유저'), null); assert.equal(db('uids/u1'), null);
  assert.ok(db('saves/B유저'));
});
