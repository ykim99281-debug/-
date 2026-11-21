'use strict';
/**
 * 성좌 크로니클 — 서버 함수
 * 돈이 오가는 모든 동작은 여기서만 처리합니다. (클라이언트는 요청만 보내요)
 * 경제 규칙 자체는 logic.js 에 있고, 이 파일은 로그인 확인·점검/밴 확인·DB 저장을 맡아요.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const L = require('./logic');

const REGION = 'asia-northeast3'; // 서울. 클라이언트(rpg.html)의 FUNCTIONS_REGION 과 같아야 해요.
setGlobalOptions({ region: REGION, maxInstances: 20 });

admin.initializeApp({
  databaseURL: process.env.DATABASE_URL || 'https://project-786867319314566748-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();
const ref = p => db.ref('anime/' + p);

const SERVER_VERSION = 1;
const PASS = new Set(['invalid-argument', 'failed-precondition', 'already-exists', 'deadline-exceeded', 'resource-exhausted', 'permission-denied', 'not-found']);
const toHttps = e => (e instanceof HttpsError ? e : PASS.has(e && e.code) ? new HttpsError(e.code, e.message) : new HttpsError('internal', '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.'));
const today = now => new Date(now + 9 * 3600e3).toISOString().slice(0, 10); // 한국 시간 기준 날짜
const rand = () => crypto.randomInt(0, 1e9) / 1e9;

/** 로그인한 사람의 닉네임을 찾고, 밴·점검·구버전을 확인합니다. */
async function who(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  const nick = (await ref('uids/' + request.auth.uid).get()).val();
  if (!nick) throw new HttpsError('failed-precondition', '닉네임이 등록되지 않은 계정이에요.');
  const [ban, cfg, role] = await Promise.all([
    ref('bans/' + nick).get(), ref('config').get(), ref('staff/' + nick).get(),
  ]);
  const now = Date.now(), b = ban.val(), c = cfg.val() || {}, r = role.val();
  if (b === true || (typeof b === 'number' && b > now)) throw new HttpsError('permission-denied', '이용이 정지된 계정이에요.');
  if (c.maint && c.maint.on && !['owner', 'mod', 'noble', 'knight'].includes(r)) throw new HttpsError('unavailable', '서버 점검 중이에요.');
  const ver = Number((request.data || {}).v) || 0;
  if (c.minVersion && ver < c.minVersion) throw new HttpsError('failed-precondition', '새 버전이 필요해요. 새로고침해 주세요.');
  return { nick, uid: request.auth.uid, role: r || '' };
}

/** 세이브를 안전하게 바꿉니다. 동시에 여러 요청이 와도 한 번에 하나씩만 반영돼요. */
async function mutateSave(nick, fn) {
  let cap = {};
  const tx = await ref('saves/' + nick).transaction(cur => {
    try {
      const out = fn(cur);
      cap = { out };
      return Object.assign({}, out.save, { updatedAt: Date.now() });
    } catch (e) { cap = { err: e }; return undefined; } // undefined = 취소
  }, undefined, false);
  if (cap.err) throw toHttps(cap.err);
  if (!tx.committed) throw new HttpsError('aborted', '잠시 후 다시 시도해 주세요.');
  return cap.out;
}
const ledger = (nick, type, detail) => ref('ledger/' + nick).push(Object.assign({ t: admin.database.ServerValue.TIMESTAMP, type }, detail || {})).catch(() => {});
const wrap = handler => onCall(async request => { try { return await handler(request); } catch (e) { throw toHttps(e); } });

exports.ping = wrap(async request => { await who(request); return { ok: true, serverVersion: SERVER_VERSION }; });

exports.buyChar = wrap(async request => {
  const { nick } = await who(request);
  const out = await mutateSave(nick, s => L.buyChar(s, String(request.data.name)));
  ledger(nick, 'buyChar', { name: request.data.name, ...out.result.spent });
  return out.result;
});

exports.buyEquip = wrap(async request => {
  const { nick } = await who(request);
  const out = await mutateSave(nick, s => L.buyEquip(s, String(request.data.name)));
  ledger(nick, 'buyEquip', { name: request.data.name, ...out.result.spent });
  return out.result;
});

exports.convert = wrap(async request => {
  const { nick } = await who(request);
  const out = await mutateSave(nick, s => L.convert(s, request.data.dir, request.data.count));
  ledger(nick, 'convert', { dir: request.data.dir, ...out.result });
  return out.result;
});

exports.gacha = wrap(async request => {
  const { nick } = await who(request);
  const out = await mutateSave(nick, s => L.gacha(s, rand));
  ledger(nick, 'gacha', { won: out.result.won, name: out.result.name || null });
  return out.result;
});

exports.sellRare = wrap(async request => {
  const { nick } = await who(request);
  const out = await mutateSave(nick, s => L.sellRare(s, String(request.data.name)));
  ledger(nick, 'sellRare', { name: request.data.name });
  return out.result;
});

const RANK_OK = {
  all: () => true,
  noble: r => ['owner', 'mod', 'noble'].includes(r),
  knight: r => ['owner', 'mod', 'noble', 'knight'].includes(r),
  elite: r => !!r,
};
exports.claimEvent = wrap(async request => {
  const { nick, role } = await who(request);
  const id = String(request.data.id || '');
  if (!/^[\w-]{1,40}$/.test(id)) throw new HttpsError('invalid-argument', '잘못된 이벤트예요.');
  const ev = (await ref('events/' + id).get()).val();
  if (!ev) throw new HttpsError('not-found', '없는 이벤트예요.');
  if (!(ev.endsAt > Date.now())) throw new HttpsError('failed-precondition', '종료된 이벤트예요.');
  if (!(RANK_OK[ev.min] || (() => false))(role)) throw new HttpsError('permission-denied', '참여 자격이 없는 직급이에요.');
  const claim = await ref('eventClaims/' + id + '/' + nick).transaction(cur => (cur ? undefined : true), undefined, false);
  if (!claim.committed) throw new HttpsError('already-exists', '이미 받은 이벤트예요.');
  const coins = Math.min(1000000, Math.max(0, Math.floor(Number(ev.coins) || 0)));
  const dia = Math.min(200, Math.max(0, Math.floor(Number(ev.dia) || 0)));
  try {
    await mutateSave(nick, s => ({ save: L.applyReward(s, coins, dia), result: {} }));
  } catch (e) { await ref('eventClaims/' + id + '/' + nick).remove(); throw e; }
  ledger(nick, 'event', { id, coins, dia });
  return { coins, dia };
});

exports.startBattle = wrap(async request => {
  const { nick } = await who(request);
  const save = (await ref('saves/' + nick).get()).val();
  const b = L.startBattle(save, request.data, Date.now());
  await ref('battles/' + nick).set(b);
  return { ok: true };
});

exports.claimStage = wrap(async request => {
  const { nick } = await who(request);
  const now = Date.now();
  // 같은 전투를 두 번 받지 못하게 먼저 잠급니다.
  let battle = null;
  const lock = await ref('battles/' + nick).transaction(cur => {
    if (!cur || cur.claimed) return undefined;
    battle = cur; return Object.assign({}, cur, { claimed: true });
  }, undefined, false);
  if (!lock.committed || !battle) throw new HttpsError('failed-precondition', '받을 수 있는 전투 보상이 없어요.');
  try {
    const out = await mutateSave(nick, s => L.claimStage(s, battle, now, today(now)));
    ledger(nick, 'stage', out.result);
    return out.result;
  } catch (e) {
    // 시간이 너무 짧아 거절된 경우만 다시 받을 수 있게 되돌립니다. (그 외에는 그대로 잠금 유지)
    if (e && (e.code === 'failed-precondition')) await ref('battles/' + nick).update({ claimed: false });
    throw e;
  }
});

/** 거래 확정: 두 사람의 세이브를 서버가 한 번에 교환합니다. */
exports.tradeConfirm = wrap(async request => {
  const { nick } = await who(request);
  const room = String(request.data.room || '');
  if (!/^[^.#$\[\]\/]{1,60}$/.test(room)) throw new HttpsError('invalid-argument', '잘못된 거래 방이에요.');
  const base = ref('tradeRooms/' + room);
  const t = (await base.get()).val() || {};
  const names = Object.keys(t.users || {});
  if (names.length !== 2 || !names.includes(nick)) throw new HttpsError('failed-precondition', '거래 상대가 필요해요.');
  const [a, b] = names;
  const oa = (t.offers || {})[a], ob = (t.offers || {})[b];
  if (!oa || !ob || !(t.ready || {})[a] || !(t.ready || {})[b]) throw new HttpsError('failed-precondition', '두 사람이 모두 확정해야 해요.');
  if (t.done) throw new HttpsError('failed-precondition', '이미 끝난 거래예요.');
  const lock = await base.child('settleLock').transaction(cur => (cur ? undefined : Date.now()), undefined, false);
  if (!lock.committed) throw new HttpsError('aborted', '거래를 처리하는 중이에요.');
  let removedA = false;
  try {
    await mutateSave(a, s => { // 1) A가 올린 것을 먼저 빼 둔다
      if (!L.hasOffer(L.normalize(s), oa)) throw L.err('failed-precondition', a + ' 님의 물건이나 코인이 부족해요.');
      if (L.isDuplicate(s, ob)) throw L.err('failed-precondition', a + ' 님이 이미 가지고 있는 물건이에요.');
      return { save: L.removeOffer(s, oa), result: {} };
    });
    removedA = true;
    await mutateSave(b, s => { // 2) B가 올린 것을 빼고 A의 물건을 받는다
      if (!L.hasOffer(L.normalize(s), ob)) throw L.err('failed-precondition', b + ' 님의 물건이나 코인이 부족해요.');
      if (L.isDuplicate(s, oa)) throw L.err('failed-precondition', b + ' 님이 이미 가지고 있는 물건이에요.');
      return { save: L.addOffer(L.removeOffer(s, ob), oa), result: {} };
    });
    await mutateSave(a, s => ({ save: L.addOffer(s, ob), result: {} })); // 3) A가 B의 물건을 받는다
  } catch (e) {
    if (removedA) { // 실패하면 A의 물건을 돌려준다
      await mutateSave(a, s => ({ save: L.addOffer(s, oa), result: {} })).catch(() => {});
    }
    await base.update({ settleLock: null, ready: null, log: '거래 실패: ' + (e.message || '알 수 없는 오류') });
    throw e;
  }
  await base.update({ offers: null, ready: null, done: true, settleLock: null, log: '거래 완료! ' + a + ' ↔ ' + b });
  ledger(a, 'trade', { with: b, gave: oa, got: ob });
  ledger(b, 'trade', { with: a, gave: ob, got: oa });
  return { ok: true };
});
