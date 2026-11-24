'use strict';
const keys = {};
const P = { autoHeadway: 1.6, gaps: null, earn: 0, zoom: 1, auto: false, free: false, active: false, paused: false, bus: null, x: 0, z: 0, h: 0, v: 0, steer: 0, cam: 0, camH: 0, lesson: null, cd: {}, shake: 0, hint: '', done: false };
const vt = b => b.isCar ? b.spec : BUS_TYPES[b.type];
const pickStops = anchors => { const ids = []; for (const [ax, az] of anchors) { let b = null, bd = 1e9; for (const s of STOPS) { if (ids.includes(s.id)) continue; const d = Math.hypot(s.mid.x - ax, s.mid.z - az); if (d < bd) { bd = d; b = s; } } ids.push(b.id); } return ids; };
const LESSONS = [
  { id: 'L1', title: '1교시 · 기본 조작', desc: '가속, 정지, 문, 경적, 카메라 전환을 익혀요.', anchors: [[60, 50], [140, 100]], pass: 0, tasks: [['move', '가속해서 시속 20km 이상 달리기 (W)'], ['halt', '브레이크로 완전히 정지하기 (S)'], ['open', '정지 후 문 열기 (F)'], ['close', '문 닫기 (F)'], ['horn', '경적 울리기 (H)'], ['cam', '카메라 전환해 보기 (C)']] },
  { id: 'L2', title: '2교시 · 정류장 정차', desc: '정류장 3곳에 연석 가까이 정확히 세우고 승객을 태워요.', anchors: [[80, 40], [160, 90], [100, 160]], pass: 70 },
  { id: 'L3', title: '3교시 · 도심 안전운전', desc: '신호·속도·차선을 지키며 4개 정류장을 순회해요.', anchors: [[-120, -60], [-40, -150], [60, -120], [0, 0]], pass: 80 },
  { id: 'L4', title: '4교시 · 면허 시험', desc: '6개 정류장 종합 주행. 85점 이상이면 합격!', anchors: [[-150, 100], [-60, 40], [40, 100], [140, 140], [150, -40], [40, -60]], pass: 85 }
];

// ===== 길 안내 / 비콘 =====
let chev = null, beacon = null, parkBox = null;
function initGuides() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1.4, -1.3, 0, -0.9, 0, 0, -0.2, 0, 0, 1.4, 0, 0, -0.2, 1.3, 0, -0.9], 3)); g.computeVertexNormals();
  chev = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }), 18); chev.frustumCulled = false; chev.visible = false; scene.add(chev);
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide })); beacon.visible = false; scene.add(beacon);
  parkBox = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: .28, depthWrite: false })); parkBox.rotation.x = -Math.PI / 2; parkBox.visible = false; scene.add(parkBox);
}

// ===== 시작 / 종료 =====
function startManual(bus, lesson) {
  const a = bus.agent; P.bus = bus; bus.manual = true; a.manual = true;
  Object.assign(P, { active: true, paused: false, done: false, x: a.x, z: a.z, h: a.yaw, v: a.v, steer: 0, s: a.s, si: a.si, score: 100, comfort: 100, lesson: lesson || null, tick: 0, cd: {}, shake: 0, inNode: false, served: 0, graded: false, boarded: 0, t: 0, pens: {}, hornN: 0, camN: 0, revWait: false, lastV: a.v, grade: '', taskDone: {}, missed: 0, perfect: 0, ending: 0 });
  a.v = 0; a.hold = false; a.arrived = false; P.doorOpen = bus.doorGoal > 0.5; if (!P.doorOpen) bus.doorGoal = 0;
  P.cruise = 0; P.mode = 1; P.lights = 0; P.fuel = 0; P.earn = 0; P.free = !!bus.isCar; P.auto = false; P.zoom = 1; P.stopInfo = null; P.finishing = false;
  P.camH = P.h; P.cam = 0; G.speed = 1; G.state = 'drive'; if (!chev) initGuides();
  chev.visible = beacon.visible = parkBox.visible = !P.free;
  UI.showDrive(); sfx('start');
}
function startLesson(L) {
  startSchoolWorld();
  const ids = pickStops(L.anchors), r = makeRoute('교습', 0xffb020, ids, -1, 'L'); L.route = r;
  const model = makeBus('city', 0xffb020, '교습 중'); scene.add(model.group); const a = new Agent('bus', model);
  const b = { id: 0, type: 'city', routeId: -1, model, agent: a, pax: [], income: 0, phase: 'run', tick: 0, doorT: 0, doorGoal: 0, manual: false };
  G.buses.push(b); a.path = r.path; a.stopsOn = true; a.s = (r.path.stops[0].s - a.doorZ - 75 + r.path.L) % r.path.L; a.si = a.nearestStop(); a.pose(0);
  startManual(b, L);
}
function placeCar(a, at) {
  let bn = 0, bd = 1e18; NP.forEach((n, i) => { const d = (n.x - at.x) ** 2 + (n.z - at.z) ** 2; if (d < bd) { bd = d; bn = i; } });
  const i0 = clamp(NP[bn].i - 1, 0, GN - 3), j0 = clamp(NP[bn].j - 1, 0, GN - 3), path = buildPath(rectLoop(i0, j0, i0 + 2, j0 + 2, false), {});
  a.path = path; a.stopsOn = false; a.s = projectPath(path, at.x, at.z).s; a.cruise = 13; a.pose(0);
}
function startCar(c, at) {
  const spec = carDerived(c), model = makeCarModel(spec, c.color); scene.add(model.group);
  const a = new Agent('car', model); placeCar(a, at || { x: 0, z: 0 });
  const b = { id: 'car', isCar: true, carRef: c, type: '__car', spec: carType(spec), model, agent: a, pax: [], income: 0, phase: 'run', doorGoal: 0, doorT: 0, manual: false, cond: 100, km: 0, age: 0 };
  startManual(b, null);
}
function teleportCar(x, z) {
  const a = P.bus.agent; if (P.auto) setAuto(false); placeCar(a, { x, z }); P.x = a.x; P.z = a.z; P.h = a.yaw; P.v = 0; P.steer = 0; P.camH = P.h; P.cruise = 0; a.v = 0; toast('📍 위치 이동 완료', 'good');
}
const lightsOn = () => P.lights === 1 || (P.lights === 0 && nightK > 0.4);
const lightPow = () => (lightsOn() ? ((P.bus.spec && P.bus.spec.feat && P.bus.spec.feat.has('led')) ? 2.4 : 1.6) : 0);
const MODE_N = ['ECO', 'NORMAL', 'SPORT'];
let saveWT = 0;
function driveCost(dist, dt) {   // 연료/전기 요금: 내 지갑에서 차감
  const b = P.bus; if (!b.isCar || dist <= 0) return; const T = b.spec, cost = T.perKm * dist / 1000 * [0.85, 1, 1.25][P.mode];
  SCHOOL.wallet = Math.max(0, SCHOOL.wallet - cost); P.fuel += cost; if (b.carRef) b.carRef.km += dist; if ((saveWT += dt) > 10) { saveWT = 0; saveSchool(); }
}
function setAuto(on) {
  const b = P.bus, a = b.agent;
  if (on) {
    if (P.lesson) { toast('운전교실에서는 자율주행을 쓸 수 없어요', 'bad'); return; }
    if (b.isCar && !b.spec.feat.has('adas')) { toast("🚫 이 차에는 '스마트센스 · 고속도로주행보조' 옵션이 없어요. 매장에서 옵션으로 추가할 수 있어요", 'bad'); return; }
    if (b.isCar) {
      let bn = 0, bd = 1e18; NP.forEach((n, i) => { const d = (n.x - P.x) ** 2 + (n.z - P.z) ** 2; if (d < bd) { bd = d; bn = i; } });
      const i0 = clamp(NP[bn].i - 1, 0, GN - 3), j0 = clamp(NP[bn].j - 1, 0, GN - 3);
      a.path = buildPath(rectLoop(i0, j0, i0 + 2, j0 + 2, Math.random() < 0.5), {}); a.stopsOn = false; a.cruise = Math.min(14, b.spec.vmax * 0.5);
      const pr = projectPath(a.path, P.x, P.z); a.s = pr.s; a.v = Math.max(0, P.v); a.manual = false; a.hold = false; a.pose(0);
    } else {
      const pr = projectPath(a.path, P.x, P.z, P.s, 80); a.s = pr.s; a.v = Math.max(0, P.v); a.hold = false; a.arrived = false; b.phase = 'run'; b.manual = false; a.manual = false; b.doorGoal = 0; P.doorOpen = false; P.graded = false; a.si = a.nearestStop(); a.pose(0);
    }
    a.headway = P.autoHeadway; P.auto = true; toast('🤖 자율주행 시작 · 아무 조작이나 하면 수동 전환 · [ ] 로 차간 시간 조절', 'gold'); sfx('good');
  } else {
    a.headway = 1.2; P.auto = false; P.x = a.x; P.z = a.z; P.h = a.yaw; P.v = a.v; P.steer = 0; a.manual = true;
    if (!b.isCar) { P.s = a.s; P.si = a.si; b.manual = true; P.doorOpen = b.doorGoal > 0.5; b.phase = 'run'; a.hold = false; a.arrived = false; P.graded = false; }
    toast('수동 운전으로 전환', 'good');
  }
}
function autoStep(dt) {
  const b = P.bus, a = b.agent;
  if (b.isCar) { a.step(dt, G.gt); driveCost(a.v * dt, dt); }
  P.x = a.x; P.z = a.z; P.h = a.yaw; P.v = a.v; P.s = a.s; P.steer = a.steer * 2;
  if (!b.isCar) {
    P.si = a.si; P.doorOpen = b.doorGoal > 0.5; const st = a.path.stops[a.si], S = STOPS[st.id];
    P.stopInfo = { name: S.name, dist: wrapS(st.s - a.doorZ - a.s, a.path.L), waiting: S.waiting, inZone: false, zoneNow: false, gap: 9, lon: 9 }; guides(a, a.path);
  }
  computeGaps(dt); dashUpdate();
  const m = b.model; if (m.steerWheel) m.steerWheel.rotation.z = P.steer * 2.2; m.spot.intensity = lightPow();
  computeHint(); engineAudio(Math.abs(P.v), 0.3);
}
function stopManual(silent) {
  if (!P.active) return; const b = P.bus, a = b.agent;
  b.manual = false; a.manual = false; P.active = false; b.model.setCockpit(false); b.model.spot.intensity = 0; chev.visible = beacon.visible = parkBox.visible = false;
  P.auto = false;
  if (b.isCar) a.dispose();
  else if (G.school) { a.dispose(); G.buses.splice(G.buses.indexOf(b), 1); }
  else {
    const r = routeById(b.routeId); if (r) { const pr = projectPath(a.path, P.x, P.z); a.s = pr.s; a.v = 0; a.si = a.nearestStop(); a.hold = false; a.arrived = false; b.phase = 'run'; b.doorGoal = 0; a.pose(0); }
  }
  camera.near = 0.5; camera.updateProjectionMatrix();
  G.state = G.school ? 'school' : 'company';
  if (!silent) { if (G.school) UI.showTitle(); else UI.showMgmt(); }
}

// ===== 감점 =====
function pen(key, amt, text, cdT) {
  if (P.cd[key] > 0) return; P.cd[key] = cdT || 2; P.score = Math.max(0, P.score - amt); P.pens[key] = (P.pens[key] || 0) + 1; toast('-' + amt + ' ' + text, 'bad'); sfx('bad');
}
function rate(key, perSec, text, dt) { P.score = Math.max(0, P.score - perSec * dt); if (!(P.cd[key] > 0)) { P.cd[key] = 4; P.pens[key] = (P.pens[key] || 0) + 1; toast(text, 'bad'); } }

// ===== 키 =====
function playerKey(code) {
  if (!P.active || P.paused) return;
  if (code === 'KeyF') {
    if (P.bus.isCar || P.auto) return;
    if (!P.doorOpen) { if (Math.abs(P.v) > 1) { toast('정차 후 문을 여세요', 'bad'); return; } P.doorOpen = true; P.bus.doorGoal = 1; sfx('door'); }
    else { P.doorOpen = false; P.bus.doorGoal = 0; sfx('door'); }
  }
  if (code === 'KeyT') setAuto(!P.auto);
  if (code === 'KeyL') { P.lights = (P.lights + 1) % 3; toast('💡 헤드라이트 ' + ['자동', '켜짐', '꺼짐'][P.lights]); }
  if (P.bus.isCar && !P.auto) {
    if (code === 'KeyK') { const T = P.bus.spec; if (!T.feat.has('cruise')) toast('🚫 크루즈 컨트롤 옵션이 없어요', 'bad'); else if (P.cruise) { P.cruise = 0; toast('크루즈 해제'); } else if (P.v > 8) { P.cruise = P.v; toast('🚀 크루즈 ' + Math.round(P.v * 3.6) + 'km/h 고정 · 브레이크로 해제', 'gold'); } else toast('시속 30km 이상에서 설정할 수 있어요', 'bad'); }
    if (code === 'KeyV') { const T = P.bus.spec; P.mode = (P.mode + 1) % 3; if (P.mode === 2 && !T.feat.has('sport')) P.mode = 0; toast('🏎 주행 모드: ' + MODE_N[P.mode] + (P.mode === 2 ? ' (가속·코너링 강화, 연료 소모↑)' : P.mode === 0 ? ' (연비 우선)' : ''), 'gold'); }
  }
  if (code === 'BracketRight' || code === 'BracketLeft') { P.autoHeadway = clamp(Math.round((P.autoHeadway + (code === 'BracketRight' ? 0.2 : -0.2)) * 10) / 10, 0.8, 3.0); P.bus.agent.headway = P.autoHeadway; toast('🤖 자율주행 차간 시간 ' + P.autoHeadway.toFixed(1) + '초', 'gold'); }
  if (code === 'KeyH') { P.hornN++; sfx('horn'); }
  if (code === 'KeyC') { P.cam = (P.cam + 1) % ((P.bus.spec && P.bus.spec.feat && P.bus.spec.feat.has('surround')) ? 5 : 4); P.camN++; P.bus.model.setCockpit(P.cam === 2); camera.near = P.cam === 2 ? 0.3 : 0.5; camera.updateProjectionMatrix(); }
  if (code === 'KeyR' && !P.auto) { const pr = projectPath(P.bus.agent.path, P.x, P.z, P.s, 60); const t = pathAt(P.bus.agent.path, pr.s); P.x = t.x; P.z = t.z; P.h = Math.atan2(t.tx, t.tz); P.v = 0; if (P.free) toast('도로 위로 복귀'); else pen('reset', 5, '노선 복귀', 1); }
}

// ===== 충돌 =====
function pushCircle(px, pz, r, out) {
  for (const b of world.blocks) {
    const nx = clamp(px, b.minx, b.maxx), nz = clamp(pz, b.minz, b.maxz); let dx = px - nx, dz = pz - nz; const d = Math.hypot(dx, dz);
    if (d < r) {
      if (d < 1e-4) { const m = Math.min(px - b.minx, b.maxx - px, pz - b.minz, b.maxz - pz); if (m === px - b.minx) { out.x -= m + r; } else if (m === b.maxx - px) { out.x += m + r; } else if (m === pz - b.minz) { out.z -= m + r; } else out.z += m + r; }
      else { out.x += dx / d * (r - d); out.z += dz / d * (r - d); }
    }
  }
}

// ===== 매 프레임 =====
const _t = {};
function updatePlayer(dt) {
  for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] -= dt;
  if (P.paused) return;
  const b = P.bus, a = b.agent, T = vt(b), free = !!b.isCar, L = T.len, wb = (free ? 0.6 : 0.55) * L, path = a.path;
  P.t += dt;
  if (P.auto) { if (keys.KeyW || keys.ArrowUp || keys.KeyS || keys.ArrowDown || keys.KeyA || keys.ArrowLeft || keys.KeyD || keys.ArrowRight || keys.Space) setAuto(false); else { autoStep(dt); return; } }
  // --- 조작
  const brk = keys.KeyS || keys.ArrowDown, hb = keys.Space; if (free && P.cruise && (brk || hb)) { P.cruise = 0; toast('크루즈 해제'); }
  const thr = keys.KeyW || keys.ArrowUp || (free && P.cruise > 0 && P.v < P.cruise - 0.4), ending = P.ending > 0;
  const load = 1 - 0.12 * b.pax.length / T.cap; let acc = 0;
  if (!brk) P.revWait = false;
  if (thr && !ending) acc = P.v < -0.2 ? 7 : (b.cond < 25 ? 0.75 : 1) * (T.accel || 3.0) * (free ? [0.8, 1, 1.25][P.mode] : 1) * load * clamp(1 - P.v / T.vmax, 0, 1) + 0.15;
  else if (brk) { if (P.v > 0.05 && !P.revWait) { acc = -(T.brake || 7.5); if (P.v + acc * dt <= 0) { P.v = 0; acc = 0; P.revWait = true; } } else if (P.revWait) acc = 0; else acc = P.v > -4.5 ? -2.4 : 0; }
  acc -= (free ? 0.012 : 0.05) * P.v + (free ? 0.00012 : 0.0009) * P.v * Math.abs(P.v) + Math.sign(P.v) * 0.22;
  if (hb) acc -= Math.sign(P.v) * 9;
  const v0 = P.v; P.v += acc * dt; if ((hb || (!thr && !brk)) && v0 * P.v < 0) P.v = 0; if (!thr && !brk && Math.abs(P.v) < 0.04) P.v = 0;
  const tgt = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
  P.steer += (tgt - P.steer) * Math.min(1, dt * (tgt === 0 ? 5 : 3.2));
  const dmax = lerp(0.62, free ? 0.09 : 0.2, clamp(Math.abs(P.v) / (T.steerSpeed || 16), 0, 1)), delta = P.steer * dmax, ym = (free ? 11 * (P.mode === 2 ? 1.2 : 1) : 6) / Math.max(Math.abs(P.v), 1), yaw = clamp(P.v / wb * Math.tan(delta), -ym, ym);
  P.h += yaw * dt; const fx = Math.sin(P.h), fz = Math.cos(P.h);
  P.x += fx * P.v * dt; P.z += fz * P.v * dt;
  // --- 충돌
  const out = { x: 0, z: 0 }, rad = T.w / 2 + 0.15;
  for (const o of [-0.3, 0, 0.3]) pushCircle(P.x + fx * L * o, P.z + fz * L * o, rad, out);
  for (const o of agents) {
    if (o === a || o.manual) continue;
    if (Math.abs(o.x - P.x) > 14 || Math.abs(o.z - P.z) > 14) continue;
    for (const po of [-0.3, 0.3, 0]) for (const oo of [-0.25, 0.25]) {
      const ax = P.x + fx * L * po, az = P.z + fz * L * po, bx = o.x + o.fx * o.len * oo, bz = o.z + o.fz * o.len * oo, dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz) || 1e-3, r2 = rad + (o.kind === 'car' ? 1.0 : 1.35);
      if (d < r2) { out.x += dx / d * (r2 - d) * 0.5; out.z += dz / d * (r2 - d) * 0.5; P.carHit = true; }
    }
  }
  const pm = Math.hypot(out.x, out.z);
  if (pm > 0.001) {
    P.x += clamp(out.x, -1, 1); P.z += clamp(out.z, -1, 1);
    if (Math.abs(P.v) > 1.5) { if (free) { if (!(P.cd.crash > 0)) { P.cd.crash = 1.2; toast('💥 충돌!', 'bad'); } } else pen(P.carHit ? 'hitcar' : 'crash', 5 + Math.round(Math.abs(P.v) * 0.6), P.carHit ? '차량과 충돌' : '구조물 충돌', 1.2); P.shake = Math.min(1, Math.abs(P.v) / 10); sfx('crash'); }
    P.v *= 0.55; if (!G.school && !free) b.cond = Math.max(0, b.cond - 2);
  }
  P.carHit = false;
  const alat = P.v * yaw, along = (P.v - v0) / dt;
  if (free) { driveCost(Math.abs(P.v) * dt, dt); P.stopInfo = null; }
  if (!free) {
  // --- 경로 진행
  if (!G.school && !free) { addRun(b, Math.abs(P.v) * dt); if (b.cond < 25 && !(P.cd.cond > 0)) { P.cd.cond = 20; toast('🔧 정비 불량! 출력이 떨어졌어요', 'bad'); } }
  const pr = projectPath(path, P.x, P.z, P.s, 40); P.s = pr.s; a.s = pr.s; P.offRoute = pr.d > 14;
  // --- 승차감
  if (b.pax.length) { if (Math.abs(alat) > 2.8) P.comfort = Math.max(0, P.comfort - (Math.abs(alat) - 2.8) * 9 * dt); if (along < -5.5) P.comfort = Math.max(0, P.comfort - 22 * dt); }
  if (along < -6.9 && P.v > 3 && b.pax.length) pen('harsh', 1, '급제동', 3);
  // --- 규정
  const kmh = Math.abs(P.v) * 3.6;
  if (kmh > 52) rate('speed', 1.6, '⚠ 과속 (제한 50km/h)', dt);
  if (P.doorOpen && Math.abs(P.v) > 1.5) rate('doormove', 3, '⚠ 문 열고 주행!', dt);
  const ni = clamp(Math.round(P.x / SP + HC), 0, GN - 1), nj = clamp(Math.round(P.z / SP + HC), 0, GN - 1), nd = NP[nid(ni, nj)];
  const inside = Math.abs(P.x - nd.x) < 9.2 && Math.abs(P.z - nd.z) < 9.2;
  if (inside && !P.inNode) { const ax = Math.abs(fx) > Math.abs(fz) ? 0 : 1; if (lightState(ax, G.gt) === 2 && P.v > 2.5) pen('red', 10, '신호 위반', 3); }
  P.inNode = inside;
  if (!inside && P.v > 3) {
    if (Math.abs(fx) > 0.93 && Math.abs(P.x - nd.x) > 11) { const z0 = nd.z, lt = (P.z - z0) * Math.sign(fx); if (Math.abs(P.z - z0) < 8 && lt < -0.2) rate('center', 2, '⚠ 중앙선 침범', dt); }
    else if (Math.abs(fz) > 0.93 && Math.abs(P.z - nd.z) > 11) { const x0 = nd.x, lt = (P.x - x0) * -Math.sign(fz); if (Math.abs(P.x - x0) < 8 && lt < -0.2) rate('center', 2, '⚠ 중앙선 침범', dt); }
  }
  // --- 정류장
  const st = path.stops[P.si], stopObj = STOPS[st.id], doorX = P.x + fx * a.doorZ, doorZ = P.z + fz * a.doorZ;
  const rx = doorX - stopObj.mid.x, rz = doorZ - stopObj.mid.z, lon = rx * stopObj.dir.x + rz * stopObj.dir.z, lat = rx * stopObj.right.x + rz * stopObj.right.z;
  const gap = ROAD / 2 - (lat + T.w / 2), ang = Math.abs(wrapPi(P.h - Math.atan2(stopObj.dir.x, stopObj.dir.z)));
  const inZone = Math.abs(lon) <= 9 && gap < 4.5 && gap > -1 && ang < 0.6;
  P.stopInfo = { name: stopObj.name, dist: wrapS(st.s - a.doorZ - P.s, path.L), lon, gap, inZone, waiting: stopObj.waiting };
  if (P.doorOpen && inZone && Math.abs(P.v) < 1) {
    if (!P.graded) {
      P.graded = true; const al = Math.abs(lon);
      if (al <= 2.2 && gap <= 1.2) { P.grade = '완벽'; P.perfect++; P.score = Math.min(100, P.score + 3); if (!G.school) { G.goodStops++; G.rep = Math.min(100, G.rep + 0.3); } toast('✨ 완벽한 정차! +3', 'good'); sfx('good'); }
      else if (al <= 4.5 && gap <= 2.0) { P.grade = '좋음'; toast('좋은 정차', 'good'); }
      else { P.grade = '보통'; P.score = Math.max(0, P.score - 3); toast('-3 정차 위치가 어긋났어요 (연석 ' + gap.toFixed(1) + 'm · 표지판 ' + Math.abs(lon).toFixed(1) + 'm)', 'bad'); }
    }
    if (!serveTick(b, dt, stopObj, P.si) && b.lastAction === 'board') P.boarded++;
  }
  // 정류장 완료 / 놓침
  if (P.graded && !P.doorOpen && (!inZone || Math.abs(P.v) > 2)) {
    P.graded = false; P.served++; P.si = (P.si + 1) % path.stops.length; a.si = P.si;
    if (!G.school && b.pax.length >= 0) { const tip = Math.round(P.boarded * 120 * (P.comfort / 100) * (P.score / 100)); if (tip > 0) { G.money += tip * (SCHOOL.license ? 1.25 : 1); G.day.rev += tip; G.stats.revenue += tip; toast('💰 팁 ' + fmtMoney(tip), 'gold'); } }
    P.boarded = 0; sfx('chime'); P.stopsDone = (P.stopsDone || 0) + 1;
    if (P.lesson && P.lesson.route && P.served >= path.stops.length && P.lesson.id !== 'L1') finishLesson();
  } else if (!P.graded && st.s - a.doorZ - P.s < -18 && wrapS(st.s - a.doorZ - P.s, path.L) < -18) {
    P.missed++; pen('miss', 8, '정류장 통과 (' + stopObj.name + ')', 0.5); P.si = (P.si + 1) % path.stops.length; a.si = P.si; if (!G.school) G.rep = Math.max(0, G.rep - 0.5);
  }
  if (P.stopInfo) P.stopInfo.zoneNow = inZone;
  // --- 레슨 과제
  if (P.lesson && P.lesson.id === 'L1') lessonTasks();
  if (P.ending > 0) { P.ending -= dt; }
  }
  // --- 비주얼 반영
  a.x = P.x; a.z = P.z; a.yaw = P.h; a.fx = fx; a.fz = fz; a.v = P.v; a.steer = delta; a.braking = brk || hb; a.render(dt);
  computeGaps(dt); dashUpdate();
  const m = b.model; if (m.steerWheel) m.steerWheel.rotation.z = P.steer * 2.2; m.group.rotation.z = clamp(-alat * 0.006, -0.05, 0.05); m.group.rotation.x = clamp(-along * 0.004, -0.04, 0.04);
  m.spot.intensity = lightPow();
  if (!free) guides(a, path);
  computeHint();
  engineAudio(Math.abs(P.v), thr ? 1 : 0);
}
function lessonTasks() {
  const d = P.taskDone, kmh = Math.abs(P.v) * 3.6;
  if (!d.move && kmh >= 20) d.move = 1; if (d.move && !d.halt && Math.abs(P.v) < 0.1) d.halt = 1;
  if (d.halt && !d.open && P.doorOpen) d.open = 1; if (d.open && !d.close && !P.doorOpen) d.close = 1;
  if (!d.horn && P.hornN > 0) d.horn = 1; if (!d.cam && P.camN > 0) d.cam = 1;
  if (P.lesson.tasks.every(t => d[t[0]]) && !P.finishing) { P.finishing = true; setTimeout(finishLesson, 900); }
}
function finishLesson() {
  if (!P.active || P.done) return; P.done = true; const L = P.lesson, sc = Math.round(P.score), pass = L.id === 'L1' || sc >= L.pass;
  const stars = L.id === 'L1' ? 3 : sc >= 95 ? 3 : sc >= L.pass + 5 ? 2 : pass ? 1 : 0;
  if (pass && !SCHOOL.done[L.id]) { const rw = L.id === 'L4' ? 1000000 : 200000; SCHOOL.wallet += rw; toast('👛 합격 보상 ' + fmtMoney(rw) + ' 지급!', 'gold'); }
  if (pass) { SCHOOL.done[L.id] = 1; SCHOOL.best[L.id] = Math.max(SCHOOL.best[L.id] || 0, sc); if (L.id === 'L4') SCHOOL.license = 1; saveSchool(); }
  UI.showLessonResult(L, sc, pass, stars);
}

// ===== 길안내 · 힌트 · 카메라 =====
function guides(a, path) {
  const route = P.lesson ? P.lesson.route : routeById(P.bus.routeId); const col = route ? route.color : 0x4ade80;
  for (let i = 0; i < 18; i++) { pathAt(path, P.s + 6 + i * 7, _t); _dummy.position.set(_t.x, 0.13, _t.z); _dummy.rotation.set(0, Math.atan2(_t.tx, _t.tz), 0); _dummy.scale.set(0.9, 1, 0.9); _dummy.updateMatrix(); chev.setMatrixAt(i, _dummy.matrix); }
  chev.instanceMatrix.needsUpdate = true;
  const st = path.stops[P.si], S = STOPS[st.id], T = vt(P.bus);
  beacon.position.set(S.curb.x, 20, S.curb.z); beacon.material.color.setHex(col);
  const lc = 8 - 0.4 - T.w / 2; parkBox.scale.set(T.w + 0.3, T.len, 1);
  const cx = S.mid.x + S.right.x * lc - S.dir.x * (a.doorZ), cz = S.mid.z + S.right.z * lc - S.dir.z * (a.doorZ);
  parkBox.position.set(cx, 0.11, cz); parkBox.rotation.z = -Math.atan2(S.dir.x, S.dir.z);
  parkBox.material.color.setHex(P.stopInfo && P.stopInfo.inZone && P.stopInfo.gap <= 1.2 && Math.abs(P.stopInfo.lon) <= 2.2 ? 0x4ade80 : 0xffffff);
}
function computeHint() {
  const si = P.stopInfo, b = P.bus; let h = '';
  if (P.auto) { P.hint = '🤖 자율주행 중' + (si ? ' · 다음 정류장: ' + si.name + ' ' + Math.max(0, Math.round(si.dist)) + 'm' : '') + ' · 조작하면 수동 전환'; return; }
  if (P.free) { P.hint = '🚗 자유 주행 · T 자율주행 · C 카메라 · H 경적 · Esc 메뉴'; return; }
  const redAhead = (() => { const ni = clamp(Math.round(P.x / SP + HC), 0, GN - 1), nj = clamp(Math.round(P.z / SP + HC), 0, GN - 1); const n = NP[nid(ni, nj)]; const dx = n.x - P.x, dz = n.z - P.z, ah = dx * Math.sin(P.h) + dz * Math.cos(P.h); if (ah > 5 && ah < 45 && Math.abs(dx * Math.cos(P.h) - dz * Math.sin(P.h)) < 8) { const ax = Math.abs(Math.sin(P.h)) > Math.abs(Math.cos(P.h)) ? 0 : 1; return lightState(ax, G.gt); } return 0; })();
  if (P.lesson && P.lesson.id === 'L1') { const t = P.lesson.tasks.find(t => !P.taskDone[t[0]]); h = t ? '🎓 ' + t[1] : '✅ 모든 과제 완료!'; }
  else if (P.doorOpen && Math.abs(P.v) > 1.5) h = '⚠ 문이 열려 있어요! F로 닫으세요';
  else if (si && si.zoneNow && Math.abs(P.v) < 1) h = P.doorOpen ? (b.tick > 0 || si.waiting >= 1 || b.pax.includes(STOPS[b.agent.path.stops[P.si].id].id) ? '🚏 승하차 중… 끝나면 F로 문을 닫고 출발' : '승하차 완료 · F로 문을 닫고 출발하세요') : '정차 완료 · F로 문을 열어 승객을 태우세요';
  else if (si && si.dist < 70 && si.dist > -10) h = si.dist < 30 ? '🅿 초록 주차선에 맞춰 연석 가까이 천천히 정차하세요' : '정류장 접근 · 속도를 줄이고 오른쪽 차선으로 붙으세요';
  else if (redAhead === 2) h = '🔴 신호 대기 · 정지선에서 멈추세요';
  else if (P.offRoute) h = '노선을 벗어났어요 · R 키로 노선 복귀';
  else if (si) h = '다음 정류장: ' + si.name + ' · ' + Math.max(0, Math.round(si.dist)) + 'm';
  P.hint = h;
}
function driveCamera(dt) {
  const b = P.bus, T = vt(b), L = T.len; P.camH += wrapPi(P.h - P.camH) * Math.min(1, dt * (P.cam === 1 ? 6 : 3.2));
  const sh = P.shake; P.shake = Math.max(0, P.shake - dt * 2.5); const jx = (Math.random() - .5) * sh * .6, jy = (Math.random() - .5) * sh * .4;
  const cs = Math.sin(P.camH), cc = Math.cos(P.camH);
  camera.up.set(0, 1, 0);
  if (P.cam === 4) { camera.position.set(P.x + jx, 26 * P.zoom, P.z + 0.001); camera.up.set(Math.sin(P.h), 0, Math.cos(P.h)); camera.lookAt(P.x, 0, P.z); }
  else if (P.cam === 2) {
    const m = b.model.group; m.updateMatrixWorld(); const cp = b.model.cockpit; _t.v = _t.v || new THREE.Vector3(); _t.v.set(cp.x, cp.y, cp.z); m.localToWorld(_t.v);
    camera.position.set(_t.v.x + jx, _t.v.y + jy, _t.v.z); const look = P.h + P.steer * 0.12; camera.lookAt(_t.v.x + Math.sin(look) * 30, 1.9 - Math.abs(P.v) * 0.01, _t.v.z + Math.cos(look) * 30);
  } else {
    const d = [L / 2 + 10, L / 2 + 6.5, 0, 28][P.cam] * P.zoom, h = [5.4, 3.3, 0, 13][P.cam] * (0.6 + 0.4 * P.zoom);
    camera.position.set(P.x - cs * d + jx, h + jy, P.z - cc * d); camera.lookAt(P.x + cs * 5, (P.cam === 3 ? 0.5 : 1.6), P.z + cc * 5);
  }
  const fov = 62 + clamp(Math.abs(P.v) / 20, 0, 1) * 10; if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
}
const rearCam = new THREE.PerspectiveCamera(70, 300 / 92, 0.8, 450);
function rearView() {
  const b = P.bus, L = b.model.len, fx = Math.sin(P.h), fz = Math.cos(P.h);
  rearCam.position.set(P.x - fx * (L / 2 + 0.2), vt(b).h + 0.3, P.z - fz * (L / 2 + 0.2)); rearCam.lookAt(P.x - fx * 40, 1.5, P.z - fz * 40); return rearCam;
}

// ===== 앞차 · 뒷차 간격 (거리 · 시간) =====
let gapT = 0;
function computeGaps(dt) {
  if ((gapT -= dt) > 0) return; gapT = 0.12;
  const b = P.bus, a = b.agent, T = vt(b), fx = Math.sin(P.h), fz = Math.cos(P.h); let fr = null, rr = null;
  for (const o of agents) {
    if (o === a) continue; const dx = o.x - P.x, dz = o.z - P.z, ah = dx * fx + dz * fz; if (Math.abs(ah) > 160) continue;
    const lat = dx * fz - dz * fx; if (Math.abs(lat) > 2.9 || o.fx * fx + o.fz * fz < 0.5) continue;
    const gap = Math.abs(ah) - (T.len + o.len) / 2;
    if (ah > 0 && (!fr || gap < fr.d)) fr = { d: Math.max(0, gap), v: o.v, kind: o.kind };
    if (ah < 0 && (!rr || gap < rr.d)) rr = { d: Math.max(0, gap), v: o.v, kind: o.kind };
  }
  if (fr) fr.t = P.v > 0.8 ? fr.d / P.v : null; if (rr) rr.t = rr.v > 0.8 ? rr.d / rr.v : null;
  P.gaps = { front: fr, rear: rr, route: !b.isCar && !P.lesson ? routeGaps(b) : null };
}
const fmtMS = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let dashT = 0;
function dashUpdate() {
  const b = P.bus; if (P.cam !== 2 || !b.model.drawDash || (dashT++ % 4)) return;
  const g = P.gaps && P.gaps.front, si = P.stopInfo;
  b.model.drawDash({ kmh: Math.round(Math.abs(P.v) * 3.6), gear: P.v < -0.2 ? 'R' : Math.abs(P.v) < 0.2 ? 'N' : 'D', door: P.doorOpen, next: si ? si.name : '', auto: P.auto, gap: g ? (g.t ? '앞차 ' + g.t.toFixed(1) + 's' : '앞차 ' + Math.round(g.d) + 'm') : '' });
}
