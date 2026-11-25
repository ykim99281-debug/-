'use strict';
const FARE = 1500, HPS = 1 / 25, SAVE_KEY = 'bus_company_v1', SCHOOL_KEY = 'bus_school_v1';
const LEVELS = [0, 100, 400, 1000, 2500, 6000, 15000];
const ROUTE_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0x14b8a6, 0xec4899, 0x64748b];
let G = null, cars = [];
const SCHOOL = (() => { try { return Object.assign({ done: {}, best: {}, license: 0, wallet: 0, cars: [], nextCar: 1 }, JSON.parse(localStorage.getItem(SCHOOL_KEY))); } catch (e) { return { done: {}, best: {}, license: 0, wallet: 0, cars: [], nextCar: 1 }; } })();
(function sanitizeSchool() {
  if (!isFinite(SCHOOL.wallet) || SCHOOL.wallet < 0) SCHOOL.wallet = 0; if (!Array.isArray(SCHOOL.cars)) SCHOOL.cars = [];
  SCHOOL.cars = SCHOOL.cars.filter(c => c && typeof CAR_SPECS !== 'undefined' && CAR_SPECS[c.model] && isFinite(c.km)); SCHOOL.nextCar = Math.max(SCHOOL.nextCar || 1, 1 + Math.max(0, ...SCHOOL.cars.map(c => c.id || 0)));
  if (!SCHOOL.done || typeof SCHOOL.done !== 'object') SCHOOL.done = {}; if (!SCHOOL.best || typeof SCHOOL.best !== 'object') SCHOOL.best = {};
})();
const saveSchool = () => { try { localStorage.setItem(SCHOOL_KEY, JSON.stringify(SCHOOL)); } catch (e) { } };

function newState(name, school) {
  return { name, school: !!school, money: 1500000, rep: 50, pax: 0, gt: 0, hour: 9, speed: 1, routes: [], buses: [], nextRoute: 1, nextBus: 1, stats: { revenue: 0, expense: 0, alighted: 0 }, rate: 0, fare: 1500, up: { garage: 0, workshop: 0, fuel: 0, info: 0, welfare: 0 }, loan: 0, dayNo: 1, day: { rev: 0, fuel: 0, wage: 0, maint: 0 }, reports: [], goals: {}, goodStops: 0, events: [], evNext: 120, anT: 0, headwayTarget: 40, myPay: 0, saveT: 0, pedT: 0, timeT: 0, goalT: 0 };
}
const level = () => { let l = 1; LEVELS.forEach((t, i) => { if (G.pax >= t) l = i + 1; }); return l; };
const routeById = id => G.routes.find(r => r.id === id);
const busById = id => G.buses.find(b => b.id === id);

function resetWorld() {
  if (G && G.events) for (const e of G.events) { scene.remove(e.sprite); disposeTree(e.sprite); }
  while (agents.length) agents[0].dispose();
  cars = [];
  const rr = mulberry(99); STOPS.forEach(s => { s.waiting = Math.floor(rr() * 8); s.evMul = 1; });
}
const AMB_MIX = [['car', 56], ['taxi', 9], ['van', 8], ['truck', 7], ['moto', 9], ['police', 2], ['ambulance', 1.5]], AMB_V = { car: [11, 14], taxi: [12, 15], van: [10, 12.5], truck: [8.5, 11], moto: [13, 17], police: [15, 18], ambulance: [16, 19], rivalbus: [10.5, 12.5] };
function pickAmbient() { let r = Math.random() * AMB_MIX.reduce((a, b) => a + b[1], 0); for (const [k, w] of AMB_MIX) { if ((r -= w) < 0) return k; } return 'car'; }
function spawnCars(n) {
  const nb = n >= 20 ? Math.max(3, Math.round(n * 0.06)) : 0;
  for (let i = 0; i < n; i++) {
    const kind = i < nb ? 'rivalbus' : pickAmbient();
    const i0 = Math.floor(Math.random() * (GN - 3)), j0 = Math.floor(Math.random() * (GN - 3)), i1 = Math.min(GN - 1, i0 + 2 + Math.floor(Math.random() * 5)), j1 = Math.min(GN - 1, j0 + 2 + Math.floor(Math.random() * 5));
    const path = buildPath(rectLoop(i0, j0, i1, j1, Math.random() < 0.5), {});
    const m = makeAmbient(kind); scene.add(m.group); const a = new Agent(kind === 'rivalbus' ? 'bus' : 'car', m); const [v0, v1] = AMB_V[kind]; a.cruise = rand(v0, v1); a.setPath(path, Math.random() * path.L); cars.push(a);
  }
}

// ===== 노선 / 버스 =====
function makeRoute(name, color, stopIds, id, num) {
  const { E, stopAt } = routeEdges(stopIds), path = buildPath(E, stopAt);
  return { id, num, name, color, stopIds: stopIds.slice(), path, income: 0, pax: 0, born: G ? G.gt : 0 };
}
function routeCost(n) { return 50000 + 10000 * n; }
function addRoute(name, color, stopIds, free) {
  const cost = routeCost(stopIds.length); if (!free && G.money < cost) return null;
  if (!free) G.money -= cost;
  const r = makeRoute(name, color, stopIds, G.nextRoute++, 100 + G.nextRoute - 1); G.routes.push(r); return r;
}
function updateRoute(r, name, color, stopIds) {
  Object.assign(r, makeRoute(name, color, stopIds, r.id, r.num));
  for (const b of G.buses) if (b.routeId === r.id) placeBusOnRoute(b);
}
function deleteRoute(r) {
  if (P.active && G.buses.some(b => b.routeId === r.id && b.manual)) stopManual(false);
  for (const b of G.buses.filter(b => b.routeId === r.id)) sellBus(b, true);
  G.routes.splice(G.routes.indexOf(r), 1);
}
function placeBusOnRoute(b) {
  const r = routeById(b.routeId), a = b.agent; a.path = r.path; a.stopsOn = true; a.hold = false; a.arrived = false; b.phase = 'run'; b.doorGoal = 0; b.doorT = 0; b.pax.length = 0; b.model.setLoad(0);
  let best = 0, bd = -1; const others = G.buses.filter(o => o !== b && o.routeId === b.routeId && o.agent.path === r.path);
  const cands = r.path.stops.map(s => s.s - a.doorZ - 28);
  for (const c of cands) { let d = 1e9; for (const o of others) d = Math.min(d, Math.abs(wrapS(o.agent.s - c, r.path.L))); if (d > bd) { bd = d; best = c; } }
  a.v = 0; a.s = (best + r.path.L) % r.path.L; a.si = a.nearestStop(); a.pose(0);
}
function addBus(type, routeId, free) {
  const T = BUS_TYPES[type], r = routeById(routeId); if (!r) return null;
  if (!free) { if (G.buses.length >= garageCap()) { toast('🅿 차고지가 가득 찼어요. 회사 탭에서 차고지를 확장하세요', 'bad'); return null; } if (G.money < T.price) return null; G.money -= T.price; }
  const model = makeBus(type, r.color, r.num + ' ' + r.name); scene.add(model.group);
  const a = new Agent('bus', model); a.cruise = Math.min(13, T.vmax - 5);
  const b = { id: G.nextBus++, type, routeId, model, agent: a, pax: [], income: 0, phase: 'run', tick: 0, doorT: 0, doorGoal: 0, minDwell: 0, manual: false, cond: 100, km: 0, age: 0, timer: 0, vAvg: 7, holdT: 0, driver: { name: DRIVERS[(G.nextBus * 7) % DRIVERS.length], today: 0, total: 0 } };
  G.buses.push(b); placeBusOnRoute(b); return b;
}
function sellBus(b, noRefund) {
  if (b.manual && P.active) stopManual(false);
  if (!noRefund) G.money += busValue(b);
  b.agent.dispose(); G.buses.splice(G.buses.indexOf(b), 1);
}
function reassignBus(b, routeId) { if (b.manual) return; b.routeId = routeId; const r = routeById(routeId); b.model.group.traverse(() => { }); b.income = 0; placeBusOnRoute(b); }

// ===== 승객 =====
function pay(b, amount) {
  G.day.rev += amount; G.money += amount; { const rr0 = routeById(b.routeId); if (rr0) rr0.inc60 = (rr0.inc60 || 0) + amount; } G.stats.revenue += amount; b.income += amount; G.pax++; G.rep = Math.min(100, G.rep + 0.01);
  const r = routeById(b.routeId); if (r) { r.income += amount; r.pax++; }
}
function serveTick(b, dt, stop, si) {
  b.lastAction = null; b.tick -= dt; if (b.tick > 0) return false;
  const i = b.pax.indexOf(stop.id);
  if (i >= 0) { b.pax.splice(i, 1); b.model.setLoad(b.pax.length); G.stats.alighted++; b.tick = 0.28; b.lastAction = 'alight'; return false; }
  const T = BUS_TYPES[b.type];
  if (stop.waiting >= 1 && b.pax.length < T.cap) {
    stop.waiting -= 1; const st = b.agent.path.stops, n = st.length;
    b.pax.push(st[(si + 1 + Math.floor(Math.random() * Math.min(5, n - 1))) % n].id); pay(b, G.fare); b.model.setLoad(b.pax.length); b.tick = 0.34; b.lastAction = 'board'; return false;
  }
  return true;
}
function updateBus(b, dt) {
  const a = b.agent;
  b.doorT += clamp(b.doorGoal - b.doorT, -1.6 * dt, 1.6 * dt); b.model.setDoor(b.doorT); b.vAvg += (Math.abs(a.v) - b.vAvg) * Math.min(1, dt / 40);
  if (b.manual) return;
  if (b.phase === 'broken') { b.timer -= dt; a.v = 0; if (b.timer <= 0) { const fee = BUS_TYPES[b.type].price * 0.04; G.money -= fee; G.day.maint += fee; G.stats.expense += fee; b.cond = 60; b.phase = 'run'; toast('🔧 버스 #' + b.id + ' 수리 완료 (' + fmtMoney(fee) + ')', 'good'); } return; }
  if (b.phase === 'run') {
    const s0 = a.s; a.step(dt, G.gt); if (!G.school) { addRun(b, Math.max(0, a.s - s0)); if (b.cond < 25 && Math.random() < 0.02 * (1 - 0.25 * G.up.welfare) * dt) { b.phase = 'broken'; b.timer = 25; a.v = 0; a.braking = true; a.render(0); G.rep = Math.max(0, G.rep - 1); toast('🔧 버스 #' + b.id + ' 고장! 승객이 불편해해요 (정비소 · 정비 필요)', 'bad'); return; } }
    if (a.arrived) { b.phase = 'open'; b.doorGoal = 1; b.minDwell = 2.2; b.tick = 0.35; a.v = 0; a.braking = true; a.render(0); }
  } else if (b.phase === 'open') {
    b.minDwell -= dt;
    if (b.doorT > 0.9) {
      const st = STOPS[a.path.stops[a.si].id];
      if (serveTick(b, dt, st, a.si) && b.minDwell <= 0) {
        const rg = routeGaps(b);
        if (!G.school && rg && rg.ahead && G.headwayTarget > 0 && rg.ahead.t < G.headwayTarget && b.holdT < 30) { b.holdT += dt; b.hold2 = true; }
        else { b.phase = 'close'; b.doorGoal = 0; b.holdT = 0; b.hold2 = false; }
      }
    }
  } else if (b.phase === 'close') {
    if (b.doorT < 0.05) { b.phase = 'run'; a.hold = false; a.arrived = false; a.si = (a.si + 1) % a.path.stops.length; }
  }
}

// ===== 목표 =====
const GOALS = [
  { id: 'r2', t: '노선 2개 운영하기', ok: () => G.routes.length >= 2, rw: 150000 },
  { id: 'b3', t: '버스 3대 보유', ok: () => G.buses.length >= 3, rw: 150000 },
  { id: 'p500', t: '누적 승객 500명', ok: () => G.pax >= 500, rw: 250000 },
  { id: 's10', t: '정류장 10곳 연결', ok: () => new Set(G.routes.flatMap(r => r.stopIds)).size >= 10, rw: 200000 },
  { id: 'up3', t: '회사 업그레이드 3단계 달성', ok: () => Object.values(G.up).reduce((a, b) => a + b, 0) >= 3, rw: 200000 },
  { id: 'dd', t: '2층 버스 보유', ok: () => G.buses.some(b => b.type === 'dd'), rw: 300000 },
  { id: 'good', t: '직접 운전으로 정류장 5곳 완벽 정차', ok: () => G.goodStops >= 5, rw: 300000 },
  { id: 'rep80', t: '평판 80 달성', ok: () => G.rep >= 80, rw: 400000 },
  { id: 'cash', t: '보유 자금 ₩5,000,000', ok: () => G.money >= 5000000, rw: 500000 }
];
function checkGoals() {
  for (const g of GOALS) if (!G.goals[g.id] && g.ok()) { G.goals[g.id] = 1; G.money += g.rw; toast('🏆 목표 달성: ' + g.t + ' +' + fmtMoney(g.rw), 'gold'); }
}

// ===== 월드 갱신 =====
let lastLvl = 1;
function updateWorld(dt) {
  const prevH = G.hour; G.gt += dt; if (!G.freezeHour) G.hour = (G.hour + dt * HPS) % 24;
  const night = clamp((Math.abs(G.hour - 3) < 3 ? 1 : 0) * 0.6 + 0.4, 0, 1);
  const fm = Math.pow(1500 / G.fare, 0.8) * (1 + 0.08 * G.up.info);
  const dm = 0.45 + 0.55 * (1 - (G.hour > 22 || G.hour < 5 ? 0.7 : 0));
  for (const s of STOPS) s.waiting = Math.min(40, s.waiting + s.pop * (0.5 + G.rep / 100) * dm * fm * WX.dem * (s.evMul || 1) * dt);
  for (const b of G.buses) updateBus(b, dt);
  for (const c of cars) c.step(dt, G.gt);
  if (!G.school) {
    let wage = 0; for (const b of G.buses) if (!b.manual && !(P.active && P.auto && P.bus === b)) { const w = BUS_TYPES[b.type].wage * dt; wage += w; b.driver.today += w; b.driver.total += w; }
    G.money -= wage; G.stats.expense += wage; G.day.wage += wage;
    if (P.active && P.bus && !P.bus.isCar && P.bus.manual && !P.paused) {   // 내 급여 (대표 겸 기사) 실시간 지급
      const w = BUS_TYPES[P.bus.type].wage * dt, net = w * (1 - 0.033); G.money -= w; G.day.wage += w; G.stats.expense += w; SCHOOL.wallet += net; G.myPay += net; P.earn = (P.earn || 0) + net;
      if ((G.paySave = (G.paySave || 0) + dt) > 10) { G.paySave = 0; saveSchool(); }
    }
  }
  const rev0 = G.stats.revenue; G._r0 = G._r0 === undefined ? rev0 : G._r0;
  G.rate += ((G.stats.revenue - G._r0) / Math.max(dt, 1e-3) * 60 - G.rate) * Math.min(1, dt * 0.15); G._r0 = G.stats.revenue;
  if (!G.school && G.hour < prevH) { settle(); carDay(); }
  updateSignals(G.gt);
  if ((G.timeT -= dt) < 0) { G.timeT = 0.5; applyTime(G.hour); }
  if ((G.pedT -= dt) < 0) { G.pedT = 0.7; updatePeds(); G.repT = (G.repT || 0) + 0.7; if (G.repT > 30) { G.repT = 0; for (const s of STOPS) if (s.waiting > 30 && G.routes.some(r => r.stopIds.includes(s.id))) G.rep = Math.max(0, G.rep - 0.4); } }
  if (!G.school && (G.goalT -= dt) < 0) { G.goalT = 1; checkGoals(); const l = level(); if (l > lastLvl) { toast('⭐ 회사 레벨 ' + l + ' 달성!', 'gold'); for (const k in BUS_TYPES) if (BUS_TYPES[k].lvl === l) toast('🚌 ' + BUS_TYPES[k].name + ' 구매 가능!', 'good'); } lastLvl = l; }
  if (!G.school && (G.saveT -= dt) < 0) { G.saveT = 20; saveCompany(); }
  if (!WX.lock && ((G.wxT = (G.wxT || 240) - dt) < 0)) { G.wxT = rand(240, 480); const r = Math.random(), t = r < .5 ? 'clear' : r < .72 ? 'cloudy' : r < .9 ? 'rain' : r < .96 ? 'fog' : 'storm'; if (t !== WX.type) { setWeather(t); toast(WX_T[t].i + ' 날씨가 바뀌었어요: ' + WX_T[t].n + (WX_T[t].dem > 1.2 ? ' · 승객이 늘어요' : ''), 'gold'); } }
  if (!G.school && G.money < 0 && ((G.warnT = (G.warnT || 0) - dt) < 0)) { G.warnT = 60; toast('⚠ 회사 자금이 바닥났어요! 버스를 매각하거나 대출·인출 취소로 메우세요', 'bad'); }
  if (!G.school) {
    if ((G.anT -= dt) < 0) { G.anT = 2; for (const r of G.routes) { r.rate = (r.rate || 0) + ((r.inc60 || 0) * 30 - (r.rate || 0)) * 0.2; r.inc60 = 0; } }
    if (G.gt > G.evNext) { if (G.events.length < 2) spawnEvent(); G.evNext = G.gt + rand(280, 480); }
    for (let i = G.events.length - 1; i >= 0; i--) if (G.gt > G.events[i].until) endEvent(G.events[i]);
  }
  for (const c of world.clouds) { c.position.x += dt * 2; if (c.position.x > EXT + 400) c.position.x = -EXT - 400; }
  sun.position.copy(world.sunDir || sun.position);
}

// ===== 저장 =====
function makeSave() {
  return {
    ver: 4, gn: GN, ts: Date.now(), name: G.name, myPay: G.myPay, headwayTarget: G.headwayTarget, fare: G.fare, up: G.up, loan: G.loan, dayNo: G.dayNo, day: G.day, reports: G.reports, money: G.money, rep: G.rep, pax: G.pax, gt: G.gt, hour: G.hour, goals: G.goals, goodStops: G.goodStops, nextRoute: G.nextRoute, nextBus: G.nextBus, stats: G.stats,
    routes: G.routes.map(r => ({ id: r.id, num: r.num, name: r.name, color: r.color, stopIds: r.stopIds, income: r.income, pax: r.pax, rate: r.rate || 0, rateN: G.buses.filter(b => b.routeId === r.id).length, len: Math.round(r.path.L) })),
    buses: G.buses.map(b => ({ id: b.id, type: b.type, routeId: b.routeId, income: b.income, cond: b.cond, km: b.km, age: b.age, driver: b.driver })), waiting: STOPS.map(s => Math.round(s.waiting))
  };
}
function saveCompany() { if (!G || G.school) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave())); } catch (e) { } }
function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function sanitizeSave(s0) {   // 저장 데이터 검증 · 지도 변경 시 이전
  if (!s0 || typeof s0 !== 'object') return null;
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d; let s = Object.assign({}, s0), migrated = null;
  if (s.gn !== GN) {
    const refund = (s.buses || []).reduce((a, b) => a + (BUS_TYPES[b && b.type] ? BUS_TYPES[b.type].price * 0.9 : 0), 0) + (s.routes || []).reduce((a, r) => a + (r && r.stopIds ? routeCost(r.stopIds.length) * 0.5 : 0), 0);
    s = Object.assign(s, { routes: [], buses: [], waiting: [], money: num(s.money, 0) + refund }); migrated = { refund: Math.round(refund) };
  }
  s.routes = (s.routes || []).filter(r => r && Array.isArray(r.stopIds) && r.stopIds.length >= 2 && r.stopIds.every(i => STOPS[i]));
  const rid = new Set(s.routes.map(r => r.id)); s.buses = (s.buses || []).filter(b => b && BUS_TYPES[b.type] && rid.has(b.routeId));
  s.money = num(s.money, 1500000); s.rep = clamp(num(s.rep, 50), 0, 100); s.pax = num(s.pax, 0); s.gt = num(s.gt, 0); s.hour = clamp(num(s.hour, 9), 0, 23.999); s.loan = num(s.loan, 0); s.fare = clamp(num(s.fare, 1500), 1000, 2500);
  s.nextRoute = Math.max(num(s.nextRoute, 1), 1 + Math.max(0, ...s.routes.map(r => r.id))); s.nextBus = Math.max(num(s.nextBus, 1), 1 + Math.max(0, ...s.buses.map(b => b.id || 0)));
  return { save: s, migrated };
}
function starterRoute() {
  const anchors = [[-90, -90], [90, -90], [90, 90], [-90, 90], [0, 0]], ids = [];
  for (const [ax, az] of anchors) { let best = null, bd = 1e9; for (const s of STOPS) { if (ids.includes(s.id)) continue; const d = Math.hypot(s.mid.x - ax, s.mid.z - az); if (d < bd) { bd = d; best = s; } } ids.push(best.id); }
  const r = addRoute('시범 순환', ROUTE_COLORS[0], ids, true); addBus('city', r.id, true); return r;
}
function startCompany(name, saved0) {
  resetWorld(); G = newState(name); lastLvl = 1; const sv = saved0 ? sanitizeSave(saved0) : null, saved = sv && sv.save; let offRep = null;
  if (saved && saved.ts && !sv.migrated && saved.routes.length) { const el = (Date.now() - saved.ts) / 1000; if (el > 90) offRep = offlineSim(saved, el, 0.6); }
  if (saved) {
    Object.assign(G, { name: saved.name || name, money: saved.money, rep: saved.rep, pax: saved.pax, gt: saved.gt, hour: saved.hour, goals: saved.goals || {}, goodStops: saved.goodStops || 0, nextRoute: saved.nextRoute, nextBus: saved.nextBus, stats: Object.assign(G.stats, saved.stats || {}) });
    G.myPay = saved.myPay || 0; G.headwayTarget = saved.headwayTarget === undefined ? 40 : saved.headwayTarget; G.fare = saved.fare; G.up = Object.assign(G.up, saved.up || {}); G.loan = saved.loan; G.dayNo = saved.dayNo || 1; G.day = saved.day || G.day; G.reports = saved.reports || [];
    (saved.waiting || []).forEach((w, i) => { if (STOPS[i] && isFinite(w)) STOPS[i].waiting = w; });
    for (const r of saved.routes) { const rr = makeRoute(r.name || '노선', r.color, r.stopIds, r.id, r.num); rr.income = r.income || 0; rr.pax = r.pax || 0; G.routes.push(rr); }
    for (const b of saved.buses) { const nb = addBus(b.type, b.routeId, true); if (nb) { nb.id = b.id || nb.id; nb.income = b.income || 0; nb.cond = isFinite(b.cond) ? b.cond : 100; nb.km = b.km || 0; nb.age = b.age || 0; if (b.driver && b.driver.name) nb.driver = b.driver; } }
    lastLvl = level(); G.migrated = sv.migrated; G.offlineReport = offRep;
    if (!G.routes.length) { starterRoute(); }
  } else { starterRoute(); G.speed = 10; }
  WX.lock = false; setWeather('clear'); G.wxT = 240; spawnCars(80); setHQName(G.name); applyTime(G.hour);
}
function startSchoolWorld() { resetWorld(); G = newState('운전교실', true); WX.lock = true; setWeather('clear'); G.hour = 10; spawnCars(60); applyTime(G.hour); setHQName('운전교실'); }

// ===== 현실적 경영: 업그레이드 · 정비 · 대출 · 결산 =====
const UPGRADES = {
  garage: { name: '🅿 차고지 확장', desc: '보유 가능 버스 +3대 (일 임대료 +₩8,000)', max: 5, cost: l => Math.round(300000 * Math.pow(1.7, l) / 1000) * 1000 },
  workshop: { name: '🔧 정비소', desc: '정비 비용 -20%/레벨 · 야간 자동 정비 · 고장 감소', max: 3, cost: l => Math.round(350000 * Math.pow(1.9, l) / 1000) * 1000 },
  fuel: { name: '⛽ 연료 효율 개선', desc: '연료비 -8%/레벨 (에코 드라이브 교육)', max: 3, cost: l => Math.round(250000 * Math.pow(1.8, l) / 1000) * 1000 },
  info: { name: '📱 승객 정보 시스템', desc: '정류장 도착 안내 · 승객 수요 +8%/레벨', max: 3, cost: l => Math.round(400000 * Math.pow(1.8, l) / 1000) * 1000 },
  welfare: { name: '🧑‍✈️ 기사 교육·복지', desc: '버스 고장 확률 -25%/레벨', max: 2, cost: l => Math.round(450000 * Math.pow(2, l) / 1000) * 1000 }
};
const garageCap = () => 3 + 3 * G.up.garage;
function buyUpgrade(k) {
  const U = UPGRADES[k], l = G.up[k]; if (l >= U.max) return false; const c = U.cost(l);
  if (G.money < c) { toast('자금이 부족해요', 'bad'); return false; }
  G.money -= c; G.up[k]++; G.stats.expense += c; toast(U.name + ' Lv.' + G.up[k] + ' 완료!', 'gold'); sfx('chime'); return true;
}
const serviceCost = b => Math.round((100 - b.cond) * BUS_TYPES[b.type].price * 0.0008 * (1 - 0.2 * G.up.workshop));
function serviceBus(b) { const c = serviceCost(b); if (G.money < c) { toast('정비비가 부족해요', 'bad'); return false; } G.money -= c; G.day.maint += c; G.stats.expense += c; b.cond = 100; if (b.phase === 'broken') b.timer = 0; toast('🔧 정비 완료 ' + fmtMoney(c), 'good'); return true; }
const busValue = b => Math.round(BUS_TYPES[b.type].price * (0.3 + 0.5 * b.cond / 100) * Math.max(0.5, 1 - 0.03 * b.age));
function addRun(b, dist) {
  if (dist <= 0) return; const f = BUS_TYPES[b.type].fuel * (1 - 0.08 * G.up.fuel) * dist;
  G.money -= f; G.day.fuel += f; G.stats.expense += f; b.km += dist; b.cond = Math.max(0, b.cond - dist * 0.0025);
}
const loanLimit = () => 1000000 * level();
function borrow(n) { if (G.loan + n > loanLimit()) { toast('대출 한도 초과 (한도 ' + fmtMoney(loanLimit()) + ')', 'bad'); return; } G.loan += n; G.money += n; toast('🏦 대출 ' + fmtMoney(n) + ' 실행 (일 이자 2%)', 'gold'); }
function repay(n) { n = Math.min(n, G.loan, Math.max(0, G.money)); if (n <= 0) { toast('상환할 수 없어요', 'bad'); return; } G.loan -= n; G.money -= n; toast('대출 ' + fmtMoney(n) + ' 상환', 'good'); }
function settleOn(S) {   // 하루 결산 (실시간 G · 저장 데이터 · 오프라인 모두 공용)
  const d = S.day, rent = 15000 + 8000 * S.up.garage, ins = 3000 * S.buses.length, interest = Math.round(S.loan * 0.02);
  let maint = d.maint;
  if (S.up.workshop > 0) for (const b of S.buses) if (!b.manual && b.phase !== 'broken' && b.cond < 60) { const c = Math.round((100 - b.cond) * BUS_TYPES[b.type].price * 0.0008 * (1 - 0.2 * S.up.workshop)); if (S.money > c) { S.money -= c; maint += c; S.stats.expense += c; b.cond = 90; } }
  const cost = d.fuel + d.wage + maint + rent + ins + interest, profit = d.rev - cost, tax = profit > 0 ? Math.round(profit * 0.1) : 0;
  S.money -= rent + ins + interest + tax; S.stats.expense += rent + ins + interest + tax;
  const rep = { day: S.dayNo, rev: d.rev, fuel: d.fuel, wage: d.wage, maint, rent, ins, interest, tax, net: profit - tax };
  S.reports.unshift(rep); S.reports.length = Math.min(S.reports.length, 7); S.dayNo++; S.day = { rev: 0, fuel: 0, wage: 0, maint: 0 };
  for (const b of S.buses) { b.age = (b.age || 0) + 1; if (b.driver) b.driver.today = 0; }
  return rep;
}
function settle() { const rep = settleOn(G); toast(`📒 ${rep.day}일차 결산: 순이익 ${fmtMoney(rep.net)}`, rep.net >= 0 ? 'gold' : 'bad'); }

// ===== 개인 지갑 · 내 차 =====
const DIV_TAX = 0.154;
function withdraw(amt) {
  amt = Math.min(amt, Math.floor(Math.max(0, G.money))); if (G.school || amt <= 0) { toast('인출할 회사 자금이 없어요', 'bad'); return false; }
  const net = Math.round(amt * (1 - DIV_TAX)); G.money -= amt; G.stats.dividend = (G.stats.dividend || 0) + amt; SCHOOL.wallet += net; saveSchool();
  toast(`👛 ${fmtMoney(amt)} 인출 → 세후 ${fmtMoney(net)} 입금 (배당소득세 15.4%)`, 'gold'); sfx('chime'); return true;
}
function deposit(amt) { amt = Math.min(amt, SCHOOL.wallet); if (G.school || amt <= 0) { toast('입금할 수 없어요', 'bad'); return false; } SCHOOL.wallet -= amt; G.money += amt; saveSchool(); toast('🏢 회사에 ' + fmtMoney(amt) + ' 투자(입금)', 'good'); return true; }
const carValue = c => Math.round((c.price || CAR_SPECS[c.model].price) * Math.max(0.4, 0.85 - c.km / 1000 * 0.002 - (c.age || 0) * 0.004));
function buyCarCfg(key, cfg, pay) {
  const q = carQuote(key, cfg, pay), s = CAR_SPECS[key];
  if (SCHOOL.wallet < q.upfront) { toast('내 지갑 잔액이 부족해요 (필요 선납금 ' + fmtMoney(q.upfront) + ')', 'bad'); return false; }
  SCHOOL.wallet -= q.upfront;
  SCHOOL.cars.push({ id: SCHOOL.nextCar++, model: key, color: s.colors[cfg.color], cfg: { trim: cfg.trim, eng: cfg.eng, opts: cfg.opts.slice(), color: cfg.color }, km: 0, age: 0, price: q.price, loan: pay.method === 'loan' ? { pmt: q.pmt, left: pay.months, apr: q.apr, bal: q.financed, overdue: 0 } : null });
  saveSchool(); toast('🚗 ' + s.brand + ' ' + s.name + ' ' + TRIM_SETS[s.brand][cfg.trim].n + ' 출고!', 'gold'); sfx('chime'); return true;
}
function buyCar(key, color) { const s = CAR_SPECS[key], ci = Math.max(0, s.colors.indexOf(color)); return buyCarCfg(key, Object.assign(defaultCfg(key), { color: ci }), { method: 'cash' }); }
function carDay() {   // 경영 모드 하루(자정)마다 할부금 자동 납부
  for (const c of SCHOOL.cars.slice()) {
    c.age = (c.age || 0) + 1; const l = c.loan; if (!l) continue;
    if (SCHOOL.wallet >= l.pmt) {
      SCHOOL.wallet -= l.pmt; const it = l.bal * l.apr / 12; l.bal = Math.max(0, l.bal - (l.pmt - it)); l.left--; l.overdue = 0;
      if (l.left <= 0 || l.bal < 1000) { c.loan = null; toast('🎉 ' + CAR_SPECS[c.model].name + ' 할부 완납!', 'gold'); } else toast('💳 ' + CAR_SPECS[c.model].name + ' 할부금 ' + fmtMoney(l.pmt) + ' 납부 (잔여 ' + l.left + '회)', 'good');
    } else {
      l.overdue++; l.bal += Math.round(l.pmt * 0.03); toast('⚠ ' + CAR_SPECS[c.model].name + ' 할부금 미납! 연체료 가산 (' + l.overdue + '/3회)', 'bad');
      if (l.overdue >= 3) { SCHOOL.cars.splice(SCHOOL.cars.indexOf(c), 1); toast('🚨 ' + CAR_SPECS[c.model].name + ' 압류되었어요', 'bad'); }
    }
  }
  saveSchool();
}
function sellCar(c) {
  const net = carValue(c) - (c.loan ? Math.round(c.loan.bal) : 0);
  if (SCHOOL.wallet + net < 0) { toast('할부 잔액이 커서 매각할 수 없어요 (지갑 ' + fmtMoney(-net) + ' 필요)', 'bad'); return false; }
  SCHOOL.wallet += net; SCHOOL.cars.splice(SCHOOL.cars.indexOf(c), 1); saveSchool(); toast('중고차 매각 완료 · 정산 ' + fmtMoney(net), 'good'); return true;
}

// ===== 기사 · 배차 간격 =====
const DRIVERS = ['김민수', '이서준', '박지훈', '최영호', '정대현', '강민재', '조성민', '윤재원', '장현우', '임태양', '한지호', '오세훈', '서동혁', '신우진', '권도윤', '황준서', '안정우', '송민석', '류건우', '홍승현', '전상철', '고영진', '문병철', '양기범', '배철수', '백승호', '노현수', '남궁민', '심재훈', '하준혁'];
function routeGaps(b) {   // 같은 노선의 앞차 · 뒷차 (거리 m, 시간 s)
  const a = b.agent, p = a.path; if (!p || !G.buses) return null; const L = p.L; let ah = null, bh = null;
  for (const o of G.buses) {
    if (o === b || o.routeId !== b.routeId || o.agent.path !== p) continue;
    const dA = ((o.agent.s - a.s) % L + L) % L, dB = L - dA;
    if (!ah || dA < ah.d) ah = { bus: o, d: dA }; if (!bh || dB < bh.d) bh = { bus: o, d: dB };
  }
  if (ah) ah.t = ah.d / Math.max(4, b.vAvg || 7); if (bh) bh.t = bh.d / Math.max(4, bh.bus.vAvg || 7);
  return { ahead: ah, behind: bh };
}

// ===== 도시 이벤트 (수요 폭증) =====
const EV_DEFS = [
  { i: '🎆', n: '불꽃축제', pl: ['5·18민주광장', '금남로4가역', '광주천변'], m: 3 }, { i: '⚾', n: '프로야구 홈경기', pl: ['기아챔피언스필드'], m: 3.5 }, { i: '⚽', n: '축구 경기', pl: ['광주월드컵경기장'], m: 3.5 },
  { i: '🎓', n: '개강 첫날', pl: ['전남대학교', '조선대학교'], m: 2.6 }, { i: '🎨', n: '광주비엔날레 개막', pl: ['광주비엔날레', '국립아시아문화전당'], m: 3 }, { i: '🛍', n: '전통시장 특가', pl: ['양동시장', '송정5일시장'], m: 2.5 }, { i: '⛰', n: '등산객 급증', pl: ['무등산국립공원', '증심사'], m: 3 }
];
function spawnEvent() {
  const def = EV_DEFS[Math.floor(Math.random() * EV_DEFS.length)], name = def.pl[Math.floor(Math.random() * def.pl.length)], pl = PLACES.find(p => p[0] === name) || PLACES[0];
  const ev = { def, name, x: pl[1], z: pl[2], until: G.gt + rand(150, 240), stops: [] };
  for (const s of STOPS) if (Math.hypot(s.mid.x - ev.x, s.mid.z - ev.z) < 220) { s.evMul = def.m; ev.stops.push(s.id); }
  ev.sprite = labelSprite(def.i + ' ' + def.n, { w: 22, bg: 'rgba(251,146,60,.92)', fg: '#1a0e00' }); ev.sprite.position.set(ev.x, 55, ev.z); scene.add(ev.sprite);
  G.events.push(ev); toast(def.i + ' ' + name + ' ' + def.n + '! 일대 승객이 ×' + def.m + ' (' + Math.round((ev.until - G.gt) / 60 * 10) / 10 + '분)', 'gold');
}
function endEvent(ev) { for (const id of ev.stops) STOPS[id].evMul = 1; if (ev.sprite) { scene.remove(ev.sprite); disposeTree(ev.sprite); } G.events.splice(G.events.indexOf(ev), 1); toast(ev.def.i + ' ' + ev.def.n + ' 종료', 'good'); }
const eventMarkers = () => (G && G.events ? G.events.map(e => ({ x: e.x, z: e.z, c: '#fb923c', big: 1 })) : []);

// ===== 오프라인 운영 · 자유주행 중 회사 운영 =====
const DAY_S = 600, OFF_CAP = 6 * 3600;
function routeRateEst(r, S, work, all) {   // 노선 수입 ₩/시뮬초
  if (!work.length) return 0;
  if (r.rate > 0 && r.rateN > 0) return (r.rate / 60) * Math.min(1.25, work.length / r.rateN);
  let dem = 0; for (const id of r.stopIds) { const s = STOPS[id]; if (s) dem += s.pop; }
  dem *= (0.5 + S.rep / 100) * Math.pow(1500 / S.fare, 0.8) * 0.8;
  const loopT = (r.len || 1500) / 9 + r.stopIds.length * 9, avgCap = work.reduce((a, b) => a + BUS_TYPES[b.type].cap, 0) / work.length, capS = work.length * r.stopIds.length * avgCap * 0.3 / loopT;
  return Math.min(dem, capS) * 0.7 * S.fare;
}
function offlineSim(S, realSec, eff, minSec) {
  const simSec = Math.min(realSec, OFF_CAP) * eff; if (simSec < (minSec === undefined ? 60 : minSec)) return null;
  const rep = { realSec: Math.round(realSec), simSec: Math.round(simSec), days: 0, rev: 0, net: 0, pax: 0, breakdowns: 0 }, money0 = S.money, fuelLvl = S.up.fuel || 0, ws = S.up.workshop || 0, wf = S.up.welfare || 0;
  window.__quiet = true;
  try {
    let left = simSec;
    while (left > 0.5) {
      const dt = Math.min(left, DAY_S - ((S.day._t || 0) % DAY_S)), step = Math.max(dt, 0.5); left -= step;
      let rev = 0, fuel = 0, wage = 0, maint = 0;
      for (const r of S.routes) {
        const all = S.buses.filter(b => b.routeId === r.id), work = all.filter(b => b.cond >= 25), rr = routeRateEst(r, S, work, all) * step; rev += rr; r.income = (r.income || 0) + rr; r.pax = (r.pax || 0) + Math.round(rr / S.fare); rep.pax += rr / S.fare; S.pax += rr / S.fare;
        for (const b of work) b.income = (b.income || 0) + rr / work.length;
      }
      for (const b of S.buses) {
        const T = BUS_TYPES[b.type], ok = b.cond >= 25; wage += T.wage * step; if (ok) { const m = 13 * 0.6 * step; fuel += T.fuel * m * (1 - 0.08 * fuelLvl); b.km = (b.km || 0) + m; b.cond = Math.max(0, b.cond - m * 0.0025); }
        if (b.cond < 25 && ws === 0 && Math.random() < 0.6) { const fee = T.price * 0.04; maint += fee; b.cond = 60; rep.breakdowns++; S.rep = Math.max(0, S.rep - 1 * (1 - 0.25 * wf)); }
      }
      S.money += rev - fuel - wage - maint; S.stats.revenue += rev; S.stats.expense += fuel + wage + maint; rep.rev += rev;
      S.day.rev += rev; S.day.fuel += fuel; S.day.wage += wage; S.day.maint += maint; S.day._t = (S.day._t || 0) + step;
      if (S.day._t >= DAY_S - 0.01) { delete S.day._t; settleOn(S); rep.days++; try { carDay(); } catch (e) { } }
    }
    S.hour = (S.hour + simSec * HPS) % 24; S.gt += simSec; S.rep = Math.min(100, S.rep + rep.pax * 0.01);
  } finally { window.__quiet = false; }
  rep.net = Math.round(S.money - money0); rep.rev = Math.round(rep.rev); rep.pax = Math.round(rep.pax); return rep;
}
function liveCatchUp(realSec, eff) {   // 탭을 숨겼다 돌아왔을 때 (회사 모드)
  if (!G || G.school || !G.routes.length) return null; const S = JSON.parse(JSON.stringify(makeSave())); S.day = Object.assign({ rev: 0, fuel: 0, wage: 0, maint: 0 }, S.day); const rep = offlineSim(S, realSec, eff); if (!rep) return null;
  Object.assign(G, { money: S.money, pax: S.pax, rep: S.rep, hour: S.hour, gt: S.gt, loan: S.loan, reports: S.reports, dayNo: S.dayNo, day: S.day, stats: S.stats });
  for (const sb of S.buses) { const b = busById(sb.id); if (b) { b.cond = sb.cond; b.km = sb.km; b.age = sb.age; b.income = sb.income; if (b.driver && sb.driver) b.driver.today = sb.driver.today || 0; } }
  for (const sr of S.routes) { const r = routeById(sr.id); if (r) { r.income = sr.income; r.pax = sr.pax; } }
  return rep;
}
let BG = null;   // 타이틀에서 시작한 자유주행·교습 중 저장된 회사의 운영
function bgStart() {
  BG = null; const s0 = loadSaved(); if (!s0) return; const sv = sanitizeSave(s0); if (!sv || sv.migrated || !sv.save.routes.length) return;
  const c2 = JSON.parse(JSON.stringify(sv.save)); c2.day = Object.assign({ rev: 0, fuel: 0, wage: 0, maint: 0 }, c2.day); window.__quiet = true; let rep = null; try { rep = offlineSim(c2, DAY_S / 0.8, 0.8, 1); } finally { window.__quiet = false; }
  BG = { t: 0, flushT: 0, live: 0, rate: rep ? rep.net / (DAY_S / 0.8) : 0, name: sv.save.name, sum: { rev: 0, net: 0, pax: 0, days: 0, breakdowns: 0 } };
}
function bgUpdate(dt) { if (!BG) return; BG.t += dt; BG.flushT += dt; BG.live += BG.rate * dt; if (BG.flushT >= 30) bgFlush(false); }
function bgFlush(final) {
  if (!BG) return null; let out = null; const s0 = BG.t > 1 ? loadSaved() : null;
  if (s0) { const sv = sanitizeSave(s0); if (sv && !sv.migrated) { const S = sv.save; S.day = Object.assign({ rev: 0, fuel: 0, wage: 0, maint: 0 }, S.day); const rep = offlineSim(S, BG.t, 0.8, 1); if (rep) { S.ts = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } for (const k of ['rev', 'net', 'pax', 'days', 'breakdowns']) BG.sum[k] += rep[k]; } } }
  BG.t = 0; BG.flushT = 0; if (final) { out = BG.sum; out.name = BG.name; BG = null; } return out;
}
