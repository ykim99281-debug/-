'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic');
const rare = L.GD.chars.filter(c => c.rare).map(c => c.name);
const cheap = L.GD.chars.find(c => !c.rare && c.price > 0);
const fail = (fn, code) => assert.throws(fn, e => e.code === code, '기대한 오류 코드 ' + code);

test('캐릭터 구매: 코인 차감·보유 추가, 중복/희귀/부족은 거절', () => {
  const r = L.buyChar({ coins: cheap.price + 5 }, cheap.name);
  assert.equal(r.save.coins, 5); assert.ok(r.save.owned.includes(cheap.name));
  fail(() => L.buyChar({ coins: 0 }, cheap.name), 'failed-precondition');
  fail(() => L.buyChar(r.save, cheap.name), 'already-exists');
  fail(() => L.buyChar({ coins: 1e9 }, rare[0]), 'failed-precondition');
  fail(() => L.buyChar({ coins: 1e9 }, '없는 캐릭터'), 'invalid-argument');
});

test('장비 구매는 다이아로만, 중복 거절', () => {
  const e = L.GD.equips[0];
  const r = L.buyEquip({ dia: e.price }, e.name);
  assert.equal(r.save.dia, 0); assert.ok(r.save.equips.includes(e.name));
  fail(() => L.buyEquip({ dia: 0 }, e.name), 'failed-precondition');
  fail(() => L.buyEquip(r.save, e.name), 'already-exists');
});

test('환전: 코인↔다이아 비율과 범위, 돈은 새로 생기지 않는다', () => {
  let r = L.convert({ coins: 5000 }, 'coinToDia', 3);
  assert.equal(r.save.coins, 2000); assert.equal(r.save.dia, 3);
  r = L.convert({ dia: 2 }, 'diaToCoin', 2);
  assert.equal(r.save.coins, 1600); assert.equal(r.save.dia, 0);
  fail(() => L.convert({ coins: 999 }, 'coinToDia', 1), 'failed-precondition');
  fail(() => L.convert({ coins: 1e9 }, 'coinToDia', 101), 'invalid-argument');
  fail(() => L.convert({ coins: 1e9 }, 'coinToDia', -5), 'invalid-argument');
  // 왕복해도 이득이 없어야 함
  const start = { coins: 10000 };
  const there = L.convert(start, 'coinToDia', 10).save, back = L.convert(there, 'diaToCoin', 10).save;
  assert.ok(back.coins <= start.coins);
});

test('뽑기: 서버 난수로 결정, 성공/실패/중복 처리', () => {
  const seq = v => { let i = 0; return () => v[i++ % v.length]; };
  let r = L.gacha({ dia: 30 }, seq([0.1, 0]));
  assert.equal(r.save.dia, 0); assert.equal(r.result.won, true); assert.ok(r.save.rare.includes(r.result.name));
  r = L.gacha({ dia: 30 }, seq([0.9]));
  assert.equal(r.result.won, false); assert.equal(r.save.dia, 0);
  const dup = L.gacha({ dia: 30, rare: [rare[0]] }, seq([0.1, 0]));
  assert.equal(dup.result.duplicate, true); assert.equal(dup.save.rare.length, 1);
  fail(() => L.gacha({ dia: 29 }, seq([0])), 'failed-precondition');
});

test('희귀 판매', () => {
  const r = L.sellRare({ rare: [rare[0]], dia: 1 }, rare[0]);
  assert.equal(r.save.dia, 51); assert.equal(r.save.rare.length, 0);
  fail(() => L.sellRare({ rare: [] }, rare[0]), 'failed-precondition');
});

test('전투: 시작 조건, 너무 빠른 완료·중복 수령·만료 거절, 정상 지급', () => {
  const save = { best: 3 };
  fail(() => L.startBattle(save, { mode: 'normal', stage: 4 }, 0), 'failed-precondition');
  fail(() => L.startBattle(save, { mode: 'dungeon', level: 10 }, 0), 'failed-precondition');
  const b = L.startBattle(save, { mode: 'normal', stage: 3 }, 1000);
  fail(() => L.claimStage(save, b, 1000 + 500, '2026-11-21'), 'failed-precondition');   // 0.5초 만에 클리어
  const ok = L.claimStage(save, b, 1000 + 20000, '2026-11-21');
  assert.equal(ok.result.coins, 40 + 3 * 22); assert.equal(ok.save.best, 4);
  assert.equal(ok.battle.claimed, true);
  fail(() => L.claimStage(ok.save, ok.battle, 1000 + 40000, '2026-11-21'), 'failed-precondition'); // 두 번째 수령
  fail(() => L.claimStage(save, b, 1000 + 31 * 60000, '2026-11-21'), 'deadline-exceeded');
  fail(() => L.claimStage(save, null, 1, 'x'), 'failed-precondition');
});

test('전투: 하루 보상 한도', () => {
  const save = { best: 100, stageDay: { d: 'D', coins: L.CONST.DAILY_STAGE_COINS - 10, dia: 0 } };
  const b = L.startBattle(save, { mode: 'normal', stage: 100 }, 0);
  fail(() => L.claimStage(save, b, 10 * 60000, 'D'), 'resource-exhausted');
  const next = L.claimStage(save, b, 10 * 60000, 'NEXT-DAY'); // 날짜가 바뀌면 다시 0부터
  assert.ok(next.save.coins > 0);
});

test('전투: 던전은 level 로 보상/best 계산, best 가 한 번에 건너뛰지 않음', () => {
  const save = { best: 5 };
  const b = L.startBattle(save, { mode: 'dungeon', level: 5 }, 0);
  const r = L.claimStage(save, b, 5 * 60000, 'D');
  assert.equal(r.save.best, 6);
  assert.ok(r.result.coins >= 40 + 5 * 22 + 5 * 10);
});

test('최소 전투 시간은 적 체력에 비례해 늘어난다', () => {
  assert.ok(L.minBattleSeconds('normal', 100) > L.minBattleSeconds('normal', 1));
  assert.ok(L.minBattleSeconds('normal', 1) >= L.CONST.MIN_BATTLE_SEC);
});

test('거래: 교환 후 총량 보존, 부족/중복은 아무것도 바꾸지 않음', () => {
  const a = { coins: 500, owned: ['하루 세이렌', cheap.name] }, b = { coins: 100, rare: [rare[0]] };
  const r = L.swapTrade(a, { type: 'coins', amount: 300 }, b, { type: 'char', item: rare[0] });
  assert.equal(r.a.coins, 200); assert.ok(r.a.rare.includes(rare[0]));
  assert.equal(r.b.coins, 400); assert.ok(!r.b.rare.includes(rare[0]));
  assert.equal(r.a.coins + r.b.coins, 600);
  fail(() => L.swapTrade(a, { type: 'coins', amount: 9999 }, b, { type: 'char', item: rare[0] }), 'failed-precondition');
  fail(() => L.swapTrade(a, { type: 'char', item: '없는 캐릭터' }, b, { type: 'coins', amount: 1 }), 'failed-precondition');
  fail(() => L.swapTrade(a, { type: 'coins', amount: -5 }, b, { type: 'coins', amount: 1 }), 'failed-precondition');
  // 이미 가진 캐릭터를 받으면 사라지는 사고를 막음
  fail(() => L.swapTrade(a, { type: 'char', item: cheap.name }, { owned: ['하루 세이렌', cheap.name] }, { type: 'coins', amount: 0 }), 'failed-precondition');
  assert.equal(a.coins, 500); // 원본은 그대로
});

test('normalize: 이상한 값은 안전하게 보정', () => {
  const s = L.normalize({ coins: -5, dia: 'abc', owned: { 0: 'x' }, best: 0 });
  assert.equal(s.coins, 0); assert.equal(s.dia, 0); assert.ok(s.owned.includes('하루 세이렌')); assert.equal(s.best, 1);
});
