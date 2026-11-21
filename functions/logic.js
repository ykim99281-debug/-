'use strict';
/**
 * 게임 경제 규칙 (서버가 진실을 쥐는 부분).
 * 이 파일은 Firebase 에 의존하지 않는 순수 함수만 담고 있어서 로컬에서 시험할 수 있어요.
 * 입력 세이브는 건드리지 않고, 새 세이브 객체를 돌려줍니다.
 */
const GD = require('./gamedata.json');

const CHAR = Object.fromEntries(GD.chars.map(c => [c.name, c]));
const EQUIP = Object.fromEntries(GD.equips.map(e => [e.name, e]));
const KATANA = new Set(GD.katanas);

const START_CHAR = '하루 세이렌';
const START_KATANA = '낡은 공명 장비';

const CONST = {
  COIN_PER_DIA: 1000,      // 1000코인 -> 1다이아
  COIN_PER_DIA_BACK: 800,  // 1다이아 -> 800코인
  CONVERT_MAX: 100,        // 한 번에 바꿀 수 있는 개수
  GACHA_COST: 30,
  GACHA_RATE: 0.25,
  RARE_SELL_DIA: 50,
  MAX_COINS: 10000000000000,
  MAX_DIA: 100000000,
  // 전투 검증
  MAX_DPS: 6000,           // 연타 매크로까지 감안한 보수적 최대 초당 피해
  MIN_BATTLE_SEC: 3,
  BATTLE_EXPIRE_MS: 30 * 60 * 1000,
  DAILY_STAGE_COINS: 3000000,
  DAILY_STAGE_DIA: 2000,
};

function err(code, message) {
  return Object.assign(new Error(message), { code });
}
const arr = x => (Array.isArray(x) ? x.slice() : x && typeof x === 'object' ? Object.values(x) : []);
const int = (x, d = 0) => (Number.isFinite(Number(x)) ? Math.floor(Number(x)) : d);

/** 저장된 데이터를 항상 같은 모양으로 맞춥니다. */
function normalize(raw) {
  const s = Object.assign({}, raw || {});
  s.coins = Math.max(0, int(s.coins));
  s.dia = Math.max(0, int(s.dia));
  s.owned = [...new Set(arr(s.owned))];
  if (!s.owned.includes(START_CHAR)) s.owned.push(START_CHAR);
  s.rare = [...new Set(arr(s.rare))];
  s.equips = [...new Set(arr(s.equips))];
  s.katanas = arr(s.katanas);
  if (!s.katanas.length) s.katanas = [START_KATANA];
  s.best = Math.max(1, int(s.best, 1));
  s.pvp = Math.max(0, int(s.pvp));
  return s;
}

const need = (cond, code, msg) => { if (!cond) throw err(code, msg); };
const owns = (s, name) => s.owned.includes(name) || s.rare.includes(name);

function buyChar(save, name) {
  const s = normalize(save);
  const c = CHAR[name];
  need(c, 'invalid-argument', '없는 캐릭터예요.');
  need(!c.rare, 'failed-precondition', '희귀 캐릭터는 상점에서 살 수 없어요.');
  need(!owns(s, name), 'already-exists', '이미 가지고 있어요.');
  need(s.coins >= c.price, 'failed-precondition', '코인이 부족해요.');
  s.coins -= c.price;
  s.owned.push(name);
  return { save: s, result: { spent: { coins: c.price } } };
}

function buyEquip(save, name) {
  const s = normalize(save);
  const e = EQUIP[name];
  need(e, 'invalid-argument', '없는 장비예요.');
  need(!s.equips.includes(name), 'already-exists', '이미 가지고 있어요.');
  need(s.dia >= e.price, 'failed-precondition', '다이아가 부족해요.');
  s.dia -= e.price;
  s.equips.push(name);
  return { save: s, result: { spent: { dia: e.price } } };
}

function convert(save, dir, count) {
  const s = normalize(save);
  const n = int(count, 1);
  need(n >= 1 && n <= CONST.CONVERT_MAX, 'invalid-argument', '한 번에 1~' + CONST.CONVERT_MAX + '개까지 바꿀 수 있어요.');
  if (dir === 'coinToDia') {
    const cost = n * CONST.COIN_PER_DIA;
    need(s.coins >= cost, 'failed-precondition', '코인이 부족해요.');
    s.coins -= cost; s.dia += n;
    return { save: s, result: { coins: -cost, dia: n } };
  }
  if (dir === 'diaToCoin') {
    need(s.dia >= n, 'failed-precondition', '다이아가 부족해요.');
    const gain = n * CONST.COIN_PER_DIA_BACK;
    s.dia -= n; s.coins += gain;
    return { save: s, result: { coins: gain, dia: -n } };
  }
  throw err('invalid-argument', '알 수 없는 교환이에요.');
}

/** rand: 0 이상 1 미만의 난수를 돌려주는 함수 (서버에서는 암호학적 난수) */
function gacha(save, rand) {
  const s = normalize(save);
  need(s.dia >= CONST.GACHA_COST, 'failed-precondition', '다이아가 부족해요.');
  s.dia -= CONST.GACHA_COST;
  const pool = GD.chars.filter(c => c.rare);
  let won = false, name = null, duplicate = false;
  if (rand() < CONST.GACHA_RATE) {
    won = true;
    name = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))].name;
    if (s.rare.includes(name)) duplicate = true; else s.rare.push(name);
  }
  return { save: s, result: { won, name, duplicate, spent: { dia: CONST.GACHA_COST } } };
}

function sellRare(save, name) {
  const s = normalize(save);
  need(s.rare.includes(name), 'failed-precondition', '가지고 있는 희귀 캐릭터만 팔 수 있어요.');
  s.rare = s.rare.filter(x => x !== name);
  s.dia += CONST.RARE_SELL_DIA;
  return { save: s, result: { dia: CONST.RARE_SELL_DIA } };
}

function applyReward(save, coins, dia) {
  const s = normalize(save);
  s.coins = Math.min(CONST.MAX_COINS, s.coins + Math.max(0, int(coins)));
  s.dia = Math.min(CONST.MAX_DIA, s.dia + Math.max(0, int(dia)));
  return s;
}

/* ---------------- 전투 ---------------- */

function enemyHp(mode, stage, level) {
  if (mode === 'dungeon') {
    const diff = Math.max(1, level), boss = level >= 70;
    return (900 + diff * 420) * (boss ? 2.2 : 1.35);
  }
  const mult = stage % 10 === 0 ? 2.1 : stage % 5 === 0 ? 1.55 : 1;
  return (650 + stage * 260 + Math.floor(stage / 3) * 180) * mult;
}
function minBattleSeconds(mode, stage, level) {
  return Math.max(CONST.MIN_BATTLE_SEC, enemyHp(mode, stage, level) / CONST.MAX_DPS);
}
function stageReward(mode, stage, level) {
  const bonusStage = mode === 'dungeon' ? level : stage;
  let coins = 40 + (mode === 'dungeon' ? level : stage) * 22 + (bonusStage % 5 === 0 ? 150 : 0) + (bonusStage % 10 === 0 ? 300 : 0) + (mode === 'dungeon' ? level * 10 : 0);
  let dia = (bonusStage % 10 === 0 ? 10 : bonusStage % 5 === 0 ? 4 : 0) + (mode === 'dungeon' ? Math.max(1, Math.floor(level / 10)) : 0);
  return { coins, dia };
}

/** 전투를 시작했다고 서버에 기록합니다. 아직 갈 수 없는 스테이지/지역은 거절해요. */
function startBattle(save, params, now) {
  const s = normalize(save);
  const mode = params.mode === 'dungeon' ? 'dungeon' : 'normal';
  const stage = Math.max(1, int(params.stage, 1));
  const level = Math.max(1, int(params.level, 1));
  if (mode === 'normal') need(stage <= s.best, 'failed-precondition', '아직 갈 수 없는 스테이지예요.');
  else need(level <= s.best, 'failed-precondition', '아직 입장할 수 없는 지역이에요.');
  return { mode, stage, level, startedAt: now, claimed: false };
}

/** 전투 보상을 지급합니다. 너무 빨리 끝냈거나, 이미 받았거나, 오래된 전투면 거절해요. */
function claimStage(save, battle, now, today) {
  const s = normalize(save);
  need(battle && !battle.claimed, 'failed-precondition', '받을 수 있는 전투 보상이 없어요.');
  need(now - battle.startedAt <= CONST.BATTLE_EXPIRE_MS, 'deadline-exceeded', '전투 기록이 만료됐어요.');
  const minSec = minBattleSeconds(battle.mode, battle.stage, battle.level);
  need((now - battle.startedAt) / 1000 >= minSec, 'failed-precondition', '전투가 너무 빨리 끝났어요.');
  const rw = stageReward(battle.mode, battle.stage, battle.level);
  const day = s.stageDay && s.stageDay.d === today ? s.stageDay : { d: today, coins: 0, dia: 0 };
  need(day.coins + rw.coins <= CONST.DAILY_STAGE_COINS && day.dia + rw.dia <= CONST.DAILY_STAGE_DIA, 'resource-exhausted', '오늘 전투 보상 한도에 도달했어요.');
  day.coins += rw.coins; day.dia += rw.dia;
  s.stageDay = day;
  const out = applyReward(s, rw.coins, rw.dia);
  out.best = Math.max(out.best, battle.mode === 'dungeon' ? battle.level + 1 : battle.stage + 1);
  return { save: out, result: Object.assign({ best: out.best }, rw), battle: Object.assign({}, battle, { claimed: true }) };
}

/* ---------------- 거래 ---------------- */

function hasOffer(s, o) {
  if (!o) return false;
  if (o.type === 'coins') return int(o.amount) >= 1 && s.coins >= int(o.amount);
  if (o.type === 'char') return !!CHAR[o.item] && owns(s, o.item);
  if (o.type === 'katana') return KATANA.has(o.item) && s.katanas.includes(o.item);
  if (o.type === 'equip') return !!EQUIP[o.item] && s.equips.includes(o.item);
  return false;
}
function removeOffer(save, o) {
  const s = normalize(save);
  if (o.type === 'coins') s.coins -= int(o.amount);
  if (o.type === 'char') { s.owned = s.owned.filter(x => x !== o.item); s.rare = s.rare.filter(x => x !== o.item); if (!s.owned.length && !s.rare.length) s.owned = [START_CHAR]; }
  if (o.type === 'katana') { s.katanas = s.katanas.filter(x => x !== o.item); if (!s.katanas.length) s.katanas = [START_KATANA]; }
  if (o.type === 'equip') s.equips = s.equips.filter(x => x !== o.item);
  return s;
}
function addOffer(save, o) {
  const s = normalize(save);
  if (o.type === 'coins') s.coins = Math.min(CONST.MAX_COINS, s.coins + int(o.amount));
  if (o.type === 'char') { const k = CHAR[o.item].rare ? 'rare' : 'owned'; if (!s[k].includes(o.item)) s[k].push(o.item); }
  if (o.type === 'katana' && !s.katanas.includes(o.item)) s.katanas.push(o.item);
  if (o.type === 'equip' && !s.equips.includes(o.item)) s.equips.push(o.item);
  return s;
}
/** 두 사람의 세이브를 한 번에 교환합니다. 한쪽이라도 조건이 안 맞으면 아무것도 바꾸지 않아요. */
function swapTrade(saveA, offerA, saveB, offerB) {
  const a = normalize(saveA), b = normalize(saveB);
  need(hasOffer(a, offerA), 'failed-precondition', '한쪽이 올린 물건이나 코인이 부족해요.');
  need(hasOffer(b, offerB), 'failed-precondition', '한쪽이 올린 물건이나 코인이 부족해요.');
  // 이미 가진 캐릭터/장비를 받으면 사라지는 것을 막기 위해 거절
  const dupe = (s, o) => (o.type === 'char' && owns(s, o.item)) || (o.type === 'katana' && s.katanas.includes(o.item)) || (o.type === 'equip' && s.equips.includes(o.item));
  need(!dupe(a, offerB) && !dupe(b, offerA), 'failed-precondition', '이미 가지고 있는 물건은 받을 수 없어요.');
  return { a: addOffer(removeOffer(a, offerA), offerB), b: addOffer(removeOffer(b, offerB), offerA) };
}

/** 받는 쪽이 이미 가진 물건이면 true (받으면 사라지는 사고 방지용) */
function isDuplicate(s, o) {
  const n = normalize(s);
  return (o.type === 'char' && owns(n, o.item)) || (o.type === 'katana' && n.katanas.includes(o.item)) || (o.type === 'equip' && n.equips.includes(o.item));
}

module.exports = {
  CONST, GD, normalize, err, isDuplicate,
  buyChar, buyEquip, convert, gacha, sellRare, applyReward,
  enemyHp, minBattleSeconds, stageReward, startBattle, claimStage,
  hasOffer, removeOffer, addOffer, swapTrade,
};
