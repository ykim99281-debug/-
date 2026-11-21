'use strict';
/**
 * 성좌 크로니클 — Firebase Functions 판 (Blaze 요금제 필요)
 * 실제 동작은 handlers.js 에 있어요. 이 파일은 Firebase 와 연결하는 얇은 껍데기입니다.
 * 카드 없이 쓰려면 worker/ (Cloudflare Workers) 를 쓰세요.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { makeHandlers } = require('./handlers');

const REGION = 'asia-northeast3'; // 서울. 클라이언트(rpg.html)의 FUNCTIONS_REGION 과 같아야 해요.
setGlobalOptions({ region: REGION, maxInstances: 20 });

admin.initializeApp({
  databaseURL: process.env.DATABASE_URL || 'https://project-786867319314566748-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();
const ref = p => db.ref('anime/' + p);

const adapter = {
  TS: admin.database.ServerValue.TIMESTAMP,
  get: async p => (await ref(p).get()).val(),
  set: (p, v) => ref(p).set(v),
  remove: p => ref(p).remove(),
  update: (p, o) => ref(p).update(o),
  push: (p, v) => ref(p).push(v),
  tx: async (p, fn) => { const r = await ref(p).transaction(fn, undefined, false); return { committed: r.committed }; },
};
const H = makeHandlers(adapter, { rand: () => crypto.randomInt(0, 1e9) / 1e9 });

const PASS = new Set(['unauthenticated', 'invalid-argument', 'failed-precondition', 'already-exists', 'deadline-exceeded', 'resource-exhausted', 'permission-denied', 'not-found', 'aborted', 'unavailable']);
const toHttps = e => (e instanceof HttpsError ? e : PASS.has(e && e.code) ? new HttpsError(e.code, e.message) : new HttpsError('internal', '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.'));

for (const name of ['ping', 'buyChar', 'buyEquip', 'convert', 'gacha', 'sellRare', 'claimEvent', 'startBattle', 'claimStage', 'tradeConfirm', 'deleteAccount']) {
  exports[name] = onCall(async request => {
    try { return await H[name]({ uid: request.auth && request.auth.uid, data: request.data || {} }); }
    catch (e) { throw toHttps(e); }
  });
}
