'use strict';
// 가짜 실시간 데이터베이스를 붙여서 서버 함수(index.js)의 흐름을 시험합니다.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.GCLOUD_PROJECT = 'test-project';
const admin = require('firebase-admin');

let data = {};
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const split = p => p.split('/').filter(Boolean);
function getAt(path) { let c = data; for (const k of split(path)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : clone(c); }
function setAt(path, v) {
  const ks = split(path); let c = data;
  for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; }
  const last = ks[ks.length - 1];
  if (v === null || v === undefined) delete c[last]; else c[last] = resolve(clone(v));
}
function resolve(v) { if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); for (const k of Object.keys(v)) v[k] = resolve(v[k]); } return v; }
class Ref {
  constructor(p) { this.p = p; }
  child(c) { return new Ref(this.p + '/' + c); }
  async get() { const v = getAt(this.p); return { val: () => v, exists: () => v !== null }; }
  async set(v) { setAt(this.p, v); }
  async remove() { setAt(this.p, null); }
  async update(o) { for (const [k, v] of Object.entries(o)) setAt(this.p + '/' + k, v); }
  async push(v) { const id = 'k' + Math.random().toString(36).slice(2, 9); setAt(this.p + '/' + id, v); return { key: id }; }
  async transaction(fn) { const cur = getAt(this.p); const nv = fn(cur); if (nv === undefined) return { committed: false }; setAt(this.p, nv); return { committed: true }; }
}
const mockDb = { ref: p => new Ref(p) };
const dbFn = () => mockDb; dbFn.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
Object.defineProperty(admin, 'database', { get: () => dbFn, configurable: true });
Object.defineProperty(admin, 'initializeApp', { value: () => {}, configurable: true, writable: true });
const F = require('../index.js');

const call = (fn, uid, payload) => F[fn].run({ auth: uid ? { uid } : undefined, data: Object.assign({ v: 999 }, payload || {}) });
const seed = () => {
  data = { anime: {
    uids: { u1: 'A유저', u2: 'B유저', u3: '밴유저', u4: '기사님' },
    names: { 'A유저': 'u1', 'B유저': 'u2', '밴유저': 'u3', '기사님': 'u4' },
    saves: { 'A유저': { coins: 5000, dia: 40, owned: ['하루 세이렌'], best: 3 }, 'B유저': { coins: 100, dia: 0, owned: ['하루 세이렌'], rare: ['레이나 블래스트'] },
             '밴유저': { coins: 99999 }, '기사님': { coins: 10 } },
    bans: { '밴유저': true }, staff: { '기사님': 'knight' },
  } };
};
const rejects = async (p, code) => assert.rejects(p, e => (code ? e.code === code : true));
const save = n => data.anime.saves[n];

test('로그인 없으면 거절, 닉네임 없는 계정 거절', async () => {
  seed();
  await rejects(call('convert', null, { dir: 'coinToDia', count: 1 }), 'unauthenticated');
  await rejects(call('convert', 'ghost', { dir: 'coinToDia', count: 1 }), 'failed-precondition');
});

test('밴된 계정은 어떤 요청도 못 한다', async () => {
  seed();
  await rejects(call('convert', 'u3', { dir: 'coinToDia', count: 1 }), 'permission-denied');
  data.anime.bans['A유저'] = Date.now() + 60000;            // 기간 밴
  await rejects(call('convert', 'u1', { dir: 'coinToDia', count: 1 }), 'permission-denied');
  data.anime.bans['A유저'] = Date.now() - 1000;             // 만료된 밴은 통과
  await call('convert', 'u1', { dir: 'coinToDia', count: 1 });
});

test('점검 중에는 기사 미만 차단, 기사 이상 통과', async () => {
  seed(); data.anime.config = { maint: { on: true } };
  await rejects(call('convert', 'u1', { dir: 'coinToDia', count: 1 }), 'unavailable');
  await call('convert', 'u4', { dir: 'coinToDia', count: 0 }).catch(e => assert.equal(e.code, 'invalid-argument')); // 통과해서 로직까지 도달
});

test('구버전 클라이언트 차단', async () => {
  seed(); data.anime.config = { minVersion: 200 };
  await rejects(call('convert', 'u1', { v: 100, dir: 'coinToDia', count: 1 }), 'failed-precondition');
  await call('convert', 'u1', { v: 200, dir: 'coinToDia', count: 1 });
});

test('구매·환전·뽑기가 세이브에 반영되고 장부가 남는다', async () => {
  seed();
  await call('buyChar', 'u1', { name: '라이언 볼트' });
  assert.equal(save('A유저').coins, 5000 - 350); assert.ok(save('A유저').owned.includes('라이언 볼트'));
  await call('convert', 'u1', { dir: 'coinToDia', count: 2 });
  assert.equal(save('A유저').dia, 42); assert.equal(save('A유저').coins, 5000 - 350 - 2000);
  const g = await call('gacha', 'u1');
  assert.equal(save('A유저').dia, 12); assert.equal(typeof g.won, 'boolean');
  await rejects(call('buyChar', 'u1', { name: '라이언 볼트' }), 'already-exists');
  assert.ok(Object.keys(data.anime.ledger['A유저']).length >= 3);
  assert.ok(save('A유저').updatedAt > 0);
});

test('전투: 시작→너무 빨리 받기 거절→(시간 경과)→정상 수령→중복 수령 거절', async () => {
  seed();
  await rejects(call('startBattle', 'u1', { mode: 'normal', stage: 9 }), 'failed-precondition'); // 못 가는 스테이지
  await call('startBattle', 'u1', { mode: 'normal', stage: 3 });
  await rejects(call('claimStage', 'u1'), 'failed-precondition');       // 방금 시작해서 너무 빠름
  data.anime.battles['A유저'].startedAt -= 60000;                       // 1분 지난 것으로 조작
  const r = await call('claimStage', 'u1');
  assert.equal(r.coins, 40 + 3 * 22); assert.equal(save('A유저').best, 4);
  await rejects(call('claimStage', 'u1'), 'failed-precondition');       // 같은 전투 두 번째
});

test('이벤트: 직급 조건, 중복 수령 거절', async () => {
  seed();
  data.anime.events = { e1: { title: 't', min: 'knight', coins: 500, dia: 2, endsAt: Date.now() + 99999 }, e2: { title: 'all', min: 'all', coins: 10, dia: 0, endsAt: Date.now() + 99999 }, old: { min: 'all', coins: 1, endsAt: Date.now() - 1 } };
  await rejects(call('claimEvent', 'u1', { id: 'e1' }), 'permission-denied');    // 직급 없음
  await call('claimEvent', 'u4', { id: 'e1' });                                    // 기사
  assert.equal(save('기사님').coins, 510); assert.equal(save('기사님').dia, 2);
  await rejects(call('claimEvent', 'u4', { id: 'e1' }), 'already-exists');
  await call('claimEvent', 'u1', { id: 'e2' });
  await rejects(call('claimEvent', 'u1', { id: 'old' }), 'failed-precondition');
  await rejects(call('claimEvent', 'u1', { id: '../x' }), 'invalid-argument');
});

test('거래: 두 사람이 확정하면 서버가 교환, 총량 보존', async () => {
  seed();
  data.anime.tradeRooms = { r1: { users: { 'A유저': {}, 'B유저': {} }, offers: { 'A유저': { type: 'coins', amount: 300 }, 'B유저': { type: 'char', item: '레이나 블래스트' } }, ready: { 'A유저': true } } };
  await rejects(call('tradeConfirm', 'u1', { room: 'r1' }), 'failed-precondition');   // 상대가 아직 확정 안 함
  data.anime.tradeRooms.r1.ready['B유저'] = true;
  const before = save('A유저').coins + save('B유저').coins;
  await call('tradeConfirm', 'u2', { room: 'r1' });
  assert.equal(save('A유저').coins, 4700); assert.equal(save('B유저').coins, 400);
  assert.equal(save('A유저').coins + save('B유저').coins, before);
  assert.ok(save('A유저').rare.includes('레이나 블래스트')); assert.ok(!save('B유저').rare.includes('레이나 블래스트'));
  assert.equal(data.anime.tradeRooms.r1.done, true);
  await rejects(call('tradeConfirm', 'u1', { room: 'r1' }), 'failed-precondition');   // 이미 끝난 거래
});

test('거래 실패 시 아무것도 사라지지 않는다 (상대가 물건이 없는 경우)', async () => {
  seed();
  data.anime.tradeRooms = { r2: { users: { 'A유저': {}, 'B유저': {} }, offers: { 'A유저': { type: 'coins', amount: 300 }, 'B유저': { type: 'coins', amount: 9999 } }, ready: { 'A유저': true, 'B유저': true } } };
  await rejects(call('tradeConfirm', 'u1', { room: 'r2' }), 'failed-precondition');
  assert.equal(save('A유저').coins, 5000); assert.equal(save('B유저').coins, 100);   // 원래대로
  assert.equal(data.anime.tradeRooms.r2.settleLock, undefined);
  await rejects(call('tradeConfirm', 'u4', { room: 'r2' }), 'failed-precondition');   // 거래 당사자가 아닌 사람
});
