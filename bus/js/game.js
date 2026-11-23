'use strict';
const FARE = 1500, HPS = 1 / 25, SAVE_KEY = 'bus_company_v1', SCHOOL_KEY = 'bus_school_v1';
const LEVELS = [0, 100, 400, 1000, 2500, 6000, 15000];
const ROUTE_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0x14b8a6, 0xec4899, 0x64748b];
let G = null, cars = [];
const SCHOOL = (() => { try { return Object.assign({ done: {}, best: {}, license: 0 }, JSON.parse(localStorage.getItem(SCHOOL_KEY))); } catch (e) { return { done: {}, best: {}, license: 0 }; } })();
const saveSchool = () => { try { localStorage.setItem(SCHOOL_KEY, JSON.stringify(SCHOOL)); } catch (e) { } };

function newState(name, school) {
  return { name, school: !!school, money: 1500000, rep: 50, pax: 0, gt: 0, hour: 9, speed: 1, routes: [], buses: [], nextRoute: 1, nextBus: 1, stats: { revenue: 0, expense: 0, alighted: 0 }, rate: 0, goals: {}, goodStops: 0, saveT: 0, pedT: 0, timeT: 0, goalT: 0 };
}
const level = () => { let l = 1; LEVELS.forEach((t, i) => { if (G.pax >= t) l = i + 1; }); return l; };
const routeById = id => G.routes.find(r => r.id === id);
const busById = id => G.buses.find(b => b.id === id);

function resetWorld() {
  while (agents.length) agents[0].dispose();
  cars = [];
  const rr = mulberry(99); STOPS.forEach(s => s.waiting = Math.floor(rr() * 8));
}
function spawnCars(n) {
  for (let i = 0; i < n; i++) {
    const i0 = Math.floor(Math.random() * 4), j0 = Math.floor(Math.random() * 4), i1 = Math.min(GN - 1, i0 + 2 + Math.floor(Math.random() * 3)), j1 = Math.min(GN - 1, j0 + 2 + Math.floor(Math.random() * 3));
    const path = buildPath(rectLoop(i0, j0, i1, j1, Math.random() < 0.5), {});
    const m = makeCar(); scene.add(m.group); const a = new Agent('car', m); a.setPath(path, Math.random() * path.L); cars.push(a);
  }
}

// ===== 노선 / 버스 =====
function makeRoute(name, color, stopIds, id, num) {
  const { E, stopAt } = routeEdges(stopIds), path = buildPath(E, stopAt);
  return { id, num, name, color, stopIds: stopIds.slice(), path, income: 0, pax: 0 };
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
  for (const b of G.buses.filter(b => b.routeId === r.id)) if (b.manual) P.stopManual(true);
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
  if (!free) { if (G.money < T.price) return null; G.money -= T.price; }
  const model = makeBus(type, r.color, r.num + ' ' + r.name); scene.add(model.group);
  const a = new Agent('bus', model); a.cruise = Math.min(13, T.vmax - 5);
  const b = { id: G.nextBus++, type, routeId, model, agent: a, pax: [], income: 0, phase: 'run', tick: 0, doorT: 0, doorGoal: 0, minDwell: 0, manual: false };
  G.buses.push(b); placeBusOnRoute(b); return b;
}
function sellBus(b, noRefund) {
  if (b.manual) P.stopManual(true);
  if (!noRefund) G.money += BUS_TYPES[b.type].price * 0.5;
  b.agent.dispose(); G.buses.splice(G.buses.indexOf(b), 1);
}
function reassignBus(b, routeId) { if (b.manual) return; b.routeId = routeId; const r = routeById(routeId); b.model.group.traverse(() => { }); b.income = 0; placeBusOnRoute(b); }

// ===== 승객 =====
function pay(b, amount) {
  G.money += amount; G.stats.revenue += amount; b.income += amount; G.pax++; G.rep = Math.min(100, G.rep + 0.01);
  const r = routeById(b.routeId); if (r) { r.income += amount; r.pax++; }
}
function serveTick(b, dt, stop, si) {
  b.lastAction = null; b.tick -= dt; if (b.tick > 0) return false;
  const i = b.pax.indexOf(stop.id);
  if (i >= 0) { b.pax.splice(i, 1); b.model.setLoad(b.pax.length); G.stats.alighted++; b.tick = 0.28; b.lastAction = 'alight'; return false; }
  const T = BUS_TYPES[b.type];
  if (stop.waiting >= 1 && b.pax.length < T.cap) {
    stop.waiting -= 1; const st = b.agent.path.stops, n = st.length;
    b.pax.push(st[(si + 1 + Math.floor(Math.random() * Math.min(5, n - 1))) % n].id); pay(b, FARE); b.model.setLoad(b.pax.length); b.tick = 0.34; b.lastAction = 'board'; return false;
  }
  return true;
}
function updateBus(b, dt) {
  const a = b.agent;
  b.doorT += clamp(b.doorGoal - b.doorT, -1.6 * dt, 1.6 * dt); b.model.setDoor(b.doorT);
  if (b.manual) return;
  if (b.phase === 'run') {
    a.step(dt, G.gt);
    if (a.arrived) { b.phase = 'open'; b.doorGoal = 1; b.minDwell = 2.2; b.tick = 0.35; a.v = 0; a.braking = true; a.render(0); }
  } else if (b.phase === 'open') {
    b.minDwell -= dt;
    if (b.doorT > 0.9) { const st = STOPS[a.path.stops[a.si].id]; if (serveTick(b, dt, st, a.si) && b.minDwell <= 0) { b.phase = 'close'; b.doorGoal = 0; } }
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
  G.gt += dt; G.hour = (G.hour + dt * HPS) % 24;
  const night = clamp((Math.abs(G.hour - 3) < 3 ? 1 : 0) * 0.6 + 0.4, 0, 1);
  const dm = 0.45 + 0.55 * (1 - (G.hour > 22 || G.hour < 5 ? 0.7 : 0));
  for (const s of STOPS) s.waiting = Math.min(40, s.waiting + s.pop * (0.5 + G.rep / 100) * dm * dt);
  for (const b of G.buses) updateBus(b, dt);
  for (const c of cars) c.step(dt, G.gt);
  if (!G.school) {
    let wage = 0; for (const b of G.buses) if (!b.manual) wage += BUS_TYPES[b.type].wage * dt;
    G.money -= wage; G.stats.expense += wage;
  }
  const rev0 = G.stats.revenue; G._r0 = G._r0 === undefined ? rev0 : G._r0;
  G.rate += ((G.stats.revenue - G._r0) / Math.max(dt, 1e-3) * 60 - G.rate) * Math.min(1, dt * 0.15); G._r0 = G.stats.revenue;
  updateSignals(G.gt);
  if ((G.timeT -= dt) < 0) { G.timeT = 0.5; applyTime(G.hour); }
  if ((G.pedT -= dt) < 0) { G.pedT = 0.7; updatePeds(); G.repT = (G.repT || 0) + 0.7; if (G.repT > 30) { G.repT = 0; for (const s of STOPS) if (s.waiting > 30 && G.routes.some(r => r.stopIds.includes(s.id))) G.rep = Math.max(0, G.rep - 0.4); } }
  if (!G.school && (G.goalT -= dt) < 0) { G.goalT = 1; checkGoals(); const l = level(); if (l > lastLvl) { toast('⭐ 회사 레벨 ' + l + ' 달성!', 'gold'); if (BUS_TYPES.dd.lvl === l) toast('🚌 2층 버스를 구매할 수 있어요', 'good'); } lastLvl = l; }
  if (!G.school && (G.saveT -= dt) < 0) { G.saveT = 20; saveCompany(); }
  for (const c of world.clouds) { c.position.x += dt * 2; if (c.position.x > 700) c.position.x = -700; }
  sun.position.copy(world.sunDir || sun.position);
}

// ===== 저장 =====
function saveCompany() {
  if (!G || G.school) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      name: G.name, money: G.money, rep: G.rep, pax: G.pax, gt: G.gt, hour: G.hour, goals: G.goals, goodStops: G.goodStops, nextRoute: G.nextRoute, nextBus: G.nextBus, stats: G.stats,
      routes: G.routes.map(r => ({ id: r.id, num: r.num, name: r.name, color: r.color, stopIds: r.stopIds, income: r.income, pax: r.pax })),
      buses: G.buses.map(b => ({ id: b.id, type: b.type, routeId: b.routeId, income: b.income })), waiting: STOPS.map(s => Math.round(s.waiting))
    }));
  } catch (e) { }
}
function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function startCompany(name, saved) {
  resetWorld(); G = newState(name); lastLvl = 1;
  if (saved) {
    Object.assign(G, { name: saved.name, money: saved.money, rep: saved.rep, pax: saved.pax, gt: saved.gt || 0, hour: saved.hour || 9, goals: saved.goals || {}, goodStops: saved.goodStops || 0, nextRoute: saved.nextRoute, nextBus: saved.nextBus, stats: saved.stats || G.stats });
    (saved.waiting || []).forEach((w, i) => { if (STOPS[i]) STOPS[i].waiting = w; });
    for (const r of saved.routes) { const rr = makeRoute(r.name, r.color, r.stopIds, r.id, r.num); rr.income = r.income || 0; rr.pax = r.pax || 0; G.routes.push(rr); }
    for (const b of saved.buses) { const nb = addBus(b.type, b.routeId, true); if (nb) { nb.id = b.id; nb.income = b.income || 0; } }
    lastLvl = level();
  } else {
    const anchors = [[-90, -90], [90, -90], [90, 90], [-90, 90], [0, 0]], ids = [];
    for (const [ax, az] of anchors) { let best = null, bd = 1e9; for (const s of STOPS) { if (ids.includes(s.id)) continue; const d = Math.hypot(s.mid.x - ax, s.mid.z - az); if (d < bd) { bd = d; best = s; } } ids.push(best.id); }
    const r = addRoute('시범 순환', ROUTE_COLORS[0], ids, true); addBus('city', r.id, true);
  }
  spawnCars(16); setHQName(G.name); applyTime(G.hour);
}
function startSchoolWorld() { resetWorld(); G = newState('운전교실', true); G.hour = 10; spawnCars(14); applyTime(G.hour); setHQName('운전교실'); }
