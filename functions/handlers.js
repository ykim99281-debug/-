'use strict';
/**
 * 서버 동작 모음. Firebase Functions 와 Cloudflare Workers 가 똑같이 이 파일을 씁니다.
 * 저장소(DB)에 접근하는 방법만 "어댑터"로 갈아 끼워요.
 *
 * 어댑터가 가져야 하는 것 (경로는 'anime/' 아래 기준):
 *   TS                       : 서버 시간 표식
 *   get(path)                : 값 또는 null
 *   set(path, value) / remove(path) / update(path, obj) / push(path, value)
 *   tx(path, fn)             : fn(현재값) 이 undefined 를 돌려주면 취소. { committed } 반환
 */
const L = require('./logic');

const today = now => new Date(now + 9 * 3600e3).toISOString().slice(0, 10); // 한국 시간 기준 날짜
const RANK_OK = {
  all: () => true,
  noble: r => ['owner', 'mod', 'noble'].includes(r),
  knight: r => ['owner', 'mod', 'noble', 'knight'].includes(r),
  elite: r => !!r,
};

function makeHandlers(db, opts = {}) {
  const rand = opts.rand || Math.random;
  const nowFn = opts.now || (() => Date.now());
  const SERVER_VERSION = 2;

  /** 로그인한 사람의 닉네임을 찾고, 밴·점검·구버전을 확인합니다. */
  async function who(ctx) {
    if (!ctx.uid) throw L.err('unauthenticated', '로그인이 필요해요.');
    const nick = await db.get('uids/' + ctx.uid);
    if (!nick) throw L.err('failed-precondition', '닉네임이 등록되지 않은 계정이에요.');
    const [ban, cfg, role] = await Promise.all([db.get('bans/' + nick), db.get('config'), db.get('staff/' + nick)]);
    const now = nowFn(), c = cfg || {}, r = role || '';
    if (ban === true || (typeof ban === 'number' && ban > now)) throw L.err('permission-denied', '이용이 정지된 계정이에요.');
    if (c.maint && c.maint.on && !['owner', 'mod', 'noble', 'knight'].includes(r)) throw L.err('unavailable', '서버 점검 중이에요.');
    if (c.minVersion && (Number((ctx.data || {}).v) || 0) < c.minVersion) throw L.err('failed-precondition', '새 버전이 필요해요. 새로고침해 주세요.');
    return { nick, role: r };
  }

  /** 세이브를 안전하게 바꿉니다. 동시에 여러 요청이 와도 한 번에 하나씩만 반영돼요. */
  async function mutateSave(nick, fn) {
    let cap = {};
    const r = await db.tx('saves/' + nick, cur => {
      try {
        const out = fn(cur);
        cap = { out };
        return Object.assign({}, out.save, { updatedAt: nowFn() });
      } catch (e) { cap = { err: e }; return undefined; }
    });
    if (cap.err) throw cap.err;
    if (!r.committed) throw L.err('aborted', '잠시 후 다시 시도해 주세요.');
    return cap.out;
  }
  const ledger = (nick, type, detail) => Promise.resolve(db.push('ledger/' + nick, Object.assign({ t: db.TS, type }, detail || {}))).catch(() => {});

  const H = {};
  H.ping = async ctx => { await who(ctx); return { ok: true, serverVersion: SERVER_VERSION }; };

  H.buyChar = async ctx => {
    const { nick } = await who(ctx);
    const out = await mutateSave(nick, s => L.buyChar(s, String(ctx.data.name)));
    ledger(nick, 'buyChar', Object.assign({ name: ctx.data.name }, out.result.spent));
    return out.result;
  };
  H.buyEquip = async ctx => {
    const { nick } = await who(ctx);
    const out = await mutateSave(nick, s => L.buyEquip(s, String(ctx.data.name)));
    ledger(nick, 'buyEquip', Object.assign({ name: ctx.data.name }, out.result.spent));
    return out.result;
  };
  H.convert = async ctx => {
    const { nick } = await who(ctx);
    const out = await mutateSave(nick, s => L.convert(s, ctx.data.dir, ctx.data.count));
    ledger(nick, 'convert', Object.assign({ dir: ctx.data.dir }, out.result));
    return out.result;
  };
  H.gacha = async ctx => {
    const { nick } = await who(ctx);
    const out = await mutateSave(nick, s => L.gacha(s, rand));
    ledger(nick, 'gacha', { won: out.result.won, name: out.result.name || null });
    return out.result;
  };
  H.sellRare = async ctx => {
    const { nick } = await who(ctx);
    const out = await mutateSave(nick, s => L.sellRare(s, String(ctx.data.name)));
    ledger(nick, 'sellRare', { name: ctx.data.name });
    return out.result;
  };

  H.claimEvent = async ctx => {
    const { nick, role } = await who(ctx);
    const id = String(ctx.data.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) throw L.err('invalid-argument', '잘못된 이벤트예요.');
    const ev = await db.get('events/' + id);
    if (!ev) throw L.err('not-found', '없는 이벤트예요.');
    if (!(ev.endsAt > nowFn())) throw L.err('failed-precondition', '종료된 이벤트예요.');
    if (!(RANK_OK[ev.min] || (() => false))(role)) throw L.err('permission-denied', '참여 자격이 없는 직급이에요.');
    const claim = await db.tx('eventClaims/' + id + '/' + nick, cur => (cur ? undefined : true));
    if (!claim.committed) throw L.err('already-exists', '이미 받은 이벤트예요.');
    const coins = Math.min(1000000, Math.max(0, Math.floor(Number(ev.coins) || 0)));
    const dia = Math.min(200, Math.max(0, Math.floor(Number(ev.dia) || 0)));
    try {
      await mutateSave(nick, s => ({ save: L.applyReward(s, coins, dia), result: {} }));
    } catch (e) { await db.remove('eventClaims/' + id + '/' + nick); throw e; }
    ledger(nick, 'event', { id, coins, dia });
    return { coins, dia };
  };

  H.startBattle = async ctx => {
    const { nick } = await who(ctx);
    const save = await db.get('saves/' + nick);
    const b = L.startBattle(save, ctx.data, nowFn());
    await db.set('battles/' + nick, b);
    return { ok: true };
  };

  H.claimStage = async ctx => {
    const { nick } = await who(ctx);
    const now = nowFn();
    let battle = null; // 같은 전투를 두 번 받지 못하게 먼저 잠급니다.
    const lock = await db.tx('battles/' + nick, cur => {
      if (!cur || cur.claimed) return undefined;
      battle = cur; return Object.assign({}, cur, { claimed: true });
    });
    if (!lock.committed || !battle) throw L.err('failed-precondition', '받을 수 있는 전투 보상이 없어요.');
    try {
      const out = await mutateSave(nick, s => L.claimStage(s, battle, now, today(now)));
      ledger(nick, 'stage', out.result);
      return out.result;
    } catch (e) {
      if (e && e.code === 'failed-precondition') await db.update('battles/' + nick, { claimed: false }); // 너무 빨라서 거절된 경우만 다시 받을 수 있게
      throw e;
    }
  };

  H.tradeConfirm = async ctx => {
    const { nick } = await who(ctx);
    const room = String(ctx.data.room || '');
    if (!/^[^.#$\[\]\/]{1,60}$/.test(room)) throw L.err('invalid-argument', '잘못된 거래 방이에요.');
    const base = 'tradeRooms/' + room;
    const t = (await db.get(base)) || {};
    const names = Object.keys(t.users || {});
    if (names.length !== 2 || !names.includes(nick)) throw L.err('failed-precondition', '거래 상대가 필요해요.');
    const [a, b] = names;
    const oa = (t.offers || {})[a], ob = (t.offers || {})[b];
    if (!oa || !ob || !(t.ready || {})[a] || !(t.ready || {})[b]) throw L.err('failed-precondition', '두 사람이 모두 확정해야 해요.');
    if (t.done) throw L.err('failed-precondition', '이미 끝난 거래예요.');
    const lock = await db.tx(base + '/settleLock', cur => (cur ? undefined : nowFn()));
    if (!lock.committed) throw L.err('aborted', '거래를 처리하는 중이에요.');
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
      if (removedA) await mutateSave(a, s => ({ save: L.addOffer(s, oa), result: {} })).catch(() => {}); // 실패하면 A의 물건을 돌려준다
      await db.update(base, { settleLock: null, ready: null, log: '거래 실패: ' + (e.message || '알 수 없는 오류') });
      throw e;
    }
    await db.update(base, { offers: null, ready: null, done: true, settleLock: null, log: '거래 완료! ' + a + ' ↔ ' + b });
    ledger(a, 'trade', { with: b, gave: oa, got: ob });
    ledger(b, 'trade', { with: a, gave: ob, got: oa });
    return { ok: true };
  };

  /** 내 계정의 서버 데이터를 모두 지웁니다. (밴/채팅금지 기록은 우회 방지를 위해 남겨요) */
  H.deleteAccount = async ctx => {
    if (!ctx.uid) throw L.err('unauthenticated', '로그인이 필요해요.');
    const nick = await db.get('uids/' + ctx.uid);
    if (!nick) throw L.err('failed-precondition', '삭제할 계정이 없어요.');
    if (await db.get('staff/' + nick)) throw L.err('failed-precondition', '직급이 있는 계정은 먼저 직급을 해제해야 삭제할 수 있어요.');
    for (const p of ['saves/' + nick, 'prefs/' + nick, 'users/' + nick, 'mails/' + nick, 'invites/' + nick, 'battles/' + nick, 'ledger/' + nick]) await db.remove(p);
    await db.remove('uids/' + ctx.uid);
    await db.remove('names/' + nick);
    return { ok: true };
  };

  return H;
}

module.exports = { makeHandlers, today };
