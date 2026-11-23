'use strict';
const BUS_TYPES = {
  mini: { name: '마을버스', len: 8.4, w: 2.3, h: 3.0, cap: 24, price: 500000, wage: 60, vmax: 20, lvl: 1, deck: 1 },
  city: { name: '시내버스', len: 12, w: 2.55, h: 3.2, cap: 45, price: 800000, wage: 90, vmax: 22, lvl: 1, deck: 1 },
  dd: { name: '2층 버스', len: 11, w: 2.55, h: 4.5, cap: 72, price: 1500000, wage: 140, vmax: 19, lvl: 3, deck: 2 }
};
const _gc = {};
const bgeo = (w, h, d) => _gc['b' + w + h + d] || (_gc['b' + w + h + d] = new THREE.BoxGeometry(w, h, d));
const _tc = {};
function destTex(text, color) {
  const k = text + color; if (_tc[k]) return _tc[k];
  return _tc[k] = canvasTex(256, 48, (x) => { x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 48); x.fillStyle = '#ffae2b'; x.font = 'bold 30px monospace'; x.textBaseline = 'middle'; x.fillText(text, 8, 26); });
}

function makeBus(type, color, label) {
  const T = BUS_TYPES[type], L = T.len, W = T.w, H = T.h, g = new THREE.Group(), shell = [], keep = [], inner = new THREE.Group(); g.add(inner);
  const paint = mk(color), white = mk(0xf1f3f6), dark = mk(0x1a1d24), glass = new THREE.MeshLambertMaterial({ color: 0x86b4d4, transparent: true, opacity: .38, side: THREE.DoubleSide });
  const add = (geo, mat, x, y, z, list, cast) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast !== false; g.add(m); (list || shell).push(m); return m; };
  const topY = H - 0.3;
  add(bgeo(W, 1.05, L), paint, 0, 0.975, 0);                                            // 하부 차체
  if (T.deck === 2) add(bgeo(W + 0.02, 0.22, L), paint, 0, 2.55, 0);                    // 2층 띠
  add(bgeo(W - 0.04, topY - 1.5, L - 0.2), glass, 0, (topY + 1.5) / 2, 0);              // 유리창 띠
  for (let z = -L / 2 + 0.3; z <= L / 2 - 0.2; z += L / 6) add(bgeo(W + 0.01, topY - 1.5, 0.1), dark, 0, (topY + 1.5) / 2, z);
  add(bgeo(W, 0.3, L), white, 0, H - 0.15, 0);                                           // 지붕
  add(bgeo(W - 0.8, 0.28, 2.2), white, 0, H + 0.1, -L * 0.15);                            // 에어컨
  add(bgeo(W + 0.1, 0.3, 0.3), dark, 0, 0.62, L / 2 + 0.1); add(bgeo(W + 0.1, 0.3, 0.3), dark, 0, 0.62, -L / 2 - 0.1);   // 범퍼
  const ws = add(bgeo(W - 0.2, topY - 1.45, 0.06), glass, 0, (topY + 1.45) / 2, L / 2 + 0.02); ws.rotation.x = -0.08;
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshBasicMaterial({ map: destTex(label, color) })); dest.position.set(0, topY - 0.25, L / 2 + 0.07); g.add(dest); shell.push(dest);
  const head = new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), tail = new THREE.MeshBasicMaterial({ color: 0x661111 });
  for (const s of [-1, 1]) { add(bgeo(0.5, 0.22, 0.08), head, s * (W / 2 - 0.4), 0.82, L / 2 + 0.05); add(bgeo(0.4, 0.22, 0.08), tail, s * (W / 2 - 0.35), 0.9, -L / 2 - 0.05); }
  add(bgeo(1.2, 0.4, 0.05), dark, 0, 0.9, L / 2 + 0.03);
  // 바퀴
  const wheels = [], front = [], wg = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 18); wg.rotateZ(Math.PI / 2);
  const rg = new THREE.CylinderGeometry(0.26, 0.26, 0.34, 8); rg.rotateZ(Math.PI / 2);
  const tire = mk(0x16171b), rim = mk(0xc8ccd2);
  for (const [z, f] of [[0.30 * L, 1], [-0.25 * L, 0]]) for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * (W / 2 - 0.1), 0.5, z);
    const w = new THREE.Mesh(wg, tire); w.castShadow = true; w.add(new THREE.Mesh(rg, rim)); piv.add(w); g.add(piv); wheels.push(w); if (f) front.push(piv); shell.push(piv);
  }
  // 문 (오른쪽=-x)
  const leaves = [], doorZ = [L / 2 - 1.4].concat(L > 10 ? [-L * 0.12] : []);
  for (const dz of doorZ) {
    add(bgeo(0.04, 2.0, 1.3), dark, -W / 2 - 0.005, 1.45, dz);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(-W / 2 - 0.05, 1.45, dz + s * 0.65);
      const leaf = new THREE.Mesh(bgeo(0.06, 2.0, 0.65), glass); leaf.position.z = -s * 0.325; piv.add(leaf);
      const fr = new THREE.Mesh(bgeo(0.07, 0.12, 0.65), dark); fr.position.set(0, 0.94, -s * 0.325); piv.add(fr);
      g.add(piv); leaves.push([piv, s]); shell.push(piv);
    }
  }
  // 사이드 미러
  for (const s of [-1, 1]) { add(bgeo(0.06, 0.5, 0.28), dark, s * (W / 2 + 0.38), 2.0, L / 2 - 0.5, keep, false); add(bgeo(0.4, 0.05, 0.05), dark, s * (W / 2 + 0.17), 2.15, L / 2 - 0.5, keep, false); }
  // 실내
  const im = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); inner.add(m); return m; };
  const floor = mk(0x3a3d46), seatM = mk(0x2c4a7a);
  im(bgeo(W - 0.1, 0.06, L - 0.3), floor, 0, 0.56, 0);
  if (T.deck === 2) im(bgeo(W - 0.1, 0.06, L - 0.3), floor, 0, 2.6, 0);
  im(bgeo(W - 0.3, 0.55, 0.75), mk(0x20242c), 0, 1.25, L / 2 - 0.55);                 // 대시보드
  im(bgeo(W - 0.3, 0.12, 0.2), mk(0x15171c), 0, 1.55, L / 2 - 0.25);
  im(bgeo(0.5, 0.15, 0.4), mk(0x15171c), 0.55, 1.58, L / 2 - 0.6);                      // 계기판
  im(bgeo(0.55, 0.7, 0.5), mk(0x1c1f26), 0.55, 0.95, L / 2 - 2.1);                      // 운전석
  const wheelPiv = new THREE.Group(); wheelPiv.position.set(0.55, 1.62, L / 2 - 1.0); wheelPiv.rotation.x = -1.1; inner.add(wheelPiv);
  const sw = new THREE.Group(); wheelPiv.add(sw);
  sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 20), mk(0x101114))); const sp = new THREE.Mesh(bgeo(0.4, 0.04, 0.03), mk(0x101114)); sw.add(sp);
  const keepIn = [];
  for (const s of [-1, 1]) { const p = new THREE.Mesh(bgeo(0.1, topY - 1.4, 0.12), dark); p.position.set(s * (W / 2 - 0.1), (topY + 1.4) / 2, L / 2 - 0.1); inner.add(p); }
  im(bgeo(W, 0.14, 0.14), dark, 0, topY - 0.05, L / 2 - 0.1);
  // 좌석
  const slots = [], seatPos = [];
  const decks = T.deck === 2 ? [0.56, 2.6] : [0.56];
  for (const fy of decks) for (let z = -L / 2 + 0.9; z <= L / 2 - 3.2; z += 1.0) for (const x of [-0.95, -0.5, 0.5, 0.95]) {
    if (fy === 0.56 && z > -L * 0.12 - 1.2 && z < -L * 0.12 + 1.2 && x < 0) continue;   // 중간문 앞 비움
    seatPos.push({ x, y: fy + 0.25, z, py: fy + 0.82 });
  }
  const seats = new THREE.InstancedMesh(bgeo(0.42, 0.5, 0.45), seatM, seatPos.length);
  seatPos.forEach((s, i) => { _dummy.position.set(s.x, s.y, s.z); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1); _dummy.updateMatrix(); seats.setMatrixAt(i, _dummy.matrix); slots.push([s.x, s.py, s.z]); });
  inner.add(seats);
  for (const fy of decks) for (let z = -L / 2 + 1.2; z <= L / 2 - 3.4; z += 0.9) for (const x of [-0.15, 0.15]) slots.push([x, fy + 0.62 + 0.1, z]);   // 서있는 승객
  let sh = 12345; for (let i = slots.length - 1; i > 0; i--) { sh = (sh * 1103515245 + 12345) & 0x7fffffff; const j = sh % (i + 1); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.23, 0.8, 8), mk(0xffffff), T.cap + 4), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), mk(0xf2c9a0), T.cap + 4);
  for (let i = 0; i < T.cap + 4; i++) {
    const s = slots[i % slots.length]; _dummy.position.set(s[0], s[1], s[2]); _dummy.scale.set(1, 1, 1); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix(); body.setMatrixAt(i, _dummy.matrix);
    _dummy.position.y += 0.55; _dummy.updateMatrix(); heads.setMatrixAt(i, _dummy.matrix); body.setColorAt(i, _col.setHSL((i * 0.137) % 1, .5, .5));
  }
  body.count = heads.count = 0; inner.add(body, heads);
  // 전조등 (밤, 플레이어용)
  const spot = new THREE.SpotLight(0xfff2cc, 0, 70, 0.5, 0.5, 1); spot.position.set(0, 1, L / 2); spot.target.position.set(0, 0, L / 2 + 20); g.add(spot, spot.target);
  g.traverse(o => { if (o.isMesh && !o.castShadow) o.receiveShadow = false; });
  const B = {
    group: g, shell, keep, inner, wheels, front, steerWheel: sw, type, spot, tail, len: L, w: W, doorZ: doorZ[0], fa: 0.30 * L, ra: -0.25 * L,
    cockpit: { x: 0.55, y: 2.05, z: L / 2 - 1.55 },
    setDoor(t) { for (const [p, s] of leaves) p.rotation.y = s * t * 1.5; },
    setLoad(n) { body.count = heads.count = Math.min(n, T.cap + 4); },
    setBrake(on) { tail.color.setHex(on ? 0xff2a2a : 0x661111); },
    setCockpit(on) { for (const m of shell) m.visible = !on; }
  };
  return B;
}

function makeCar() {
  const g = new THREE.Group(), cols = [0xe8e8ee, 0x1f2937, 0xb91c1c, 0x1d4ed8, 0x9ca3af, 0xfacc15, 0x0f766e, 0xf97316];
  const kind = Math.floor(Math.random() * 3), L = [4.4, 4.7, 5.2][kind], W = 1.85, c = mk(cols[Math.floor(Math.random() * cols.length)]);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(bgeo(W, 0.6, L), c, 0, 0.65, 0); add(bgeo(W - 0.15, 0.5, L * (kind === 2 ? 0.7 : 0.5)), mk(0x2a3442), 0, 1.15, kind === 2 ? -0.3 : -0.2);
  add(bgeo(W - 0.2, 0.08, L * (kind === 2 ? .7 : .45)), c, 0, 1.43, kind === 2 ? -0.3 : -0.2);
  const tail = new THREE.MeshBasicMaterial({ color: 0x771111 });
  for (const s of [-1, 1]) { add(bgeo(0.4, 0.15, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), s * 0.6, 0.7, L / 2 + 0.02); add(bgeo(0.4, 0.15, 0.06), tail, s * 0.6, 0.72, -L / 2 - 0.02); }
  const wheels = [], front = [], wg = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12); wg.rotateZ(Math.PI / 2);
  for (const [z, f] of [[L * 0.32, 1], [-L * 0.3, 0]]) for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * (W / 2 - 0.08), 0.34, z); const w = new THREE.Mesh(wg, mk(0x15161a)); p.add(w); g.add(p); wheels.push(w); if (f) front.push(p); }
  return { group: g, wheels, front, len: L, fa: 0.32 * L, ra: -0.3 * L, tail, setBrake(on) { tail.color.setHex(on ? 0xff2a2a : 0x771111); }, setDoor() { }, setLoad() { } };
}

// ===== 차량 에이전트 (버스/승용차 공통) =====
const agents = [];
const _fa = {}, _ra = {};
class Agent {
  constructor(kind, model) {
    this.kind = kind; this.m = model; this.len = model.len; this.path = null; this.s = 0; this.v = 0; this.cruise = kind === 'car' ? rand(11, 14) : 13;
    this.x = 0; this.z = 0; this.fx = 0; this.fz = 1; this.yaw = 0; this.manual = false; this.stopsOn = false; this.si = 0; this.arrived = false; this.hold = false; this.braking = false; this.steer = 0;
    this.doorZ = model.doorZ || 0; agents.push(this);
  }
  setPath(p, s) { this.path = p; this.s = s; this.pose(0); }
  nearestStop() {   // 앞으로 만날 첫 정류장
    const p = this.path; if (!p.stops.length) return 0; let b = 0, bd = 1e9;
    p.stops.forEach((st, i) => { const d = ((st.s - this.doorZ - this.s) % p.L + p.L) % p.L; if (d < bd) { bd = d; b = i; } }); return b;
  }
  step(dt, gt) {
    const p = this.path, L = p.L; let vt = this.cruise;
    for (const c of p.corners) {
      const d = ((c.s0 - this.len / 2 - this.s) % L + L) % L;
      if (c.turn) {
        const ins = ((this.s - c.s0) % L + L) % L; if (ins < c.s1 - c.s0 + this.len * 0.5) vt = Math.min(vt, 6); else if (d < 70) vt = Math.min(vt, Math.sqrt(36 + 5 * d));
      }
      if (d < this.v * this.v / 6 + 30) {   // 신호
        const st = lightState(c.axis, gt);
        if (st === 2 || (st === 1 && d > this.v * this.v / 8 + 1.5)) vt = Math.min(vt, Math.sqrt(6 * Math.max(0, d - 1.2)));
      }
    }
    if (this.stopsOn && p.stops.length) {
      const st = p.stops[this.si], d = wrapS(st.s - this.doorZ - this.s, L);
      if (d > -3) { vt = Math.min(vt, Math.sqrt(6 * Math.max(0, d - 0.3))); if (d < 0.8 && this.v < 0.4 && !this.arrived) { this.arrived = true; this.hold = true; } }
    }
    for (const o of agents) {   // 앞차 간격
      if (o === this || !o.path && !o.manual) continue;
      const dx = o.x - this.x, dz = o.z - this.z, ah = dx * this.fx + dz * this.fz;
      if (ah <= 0 || ah > 30 + this.v) continue;
      const lat = dx * this.fz - dz * this.fx; if (Math.abs(lat) > 2.6 || o.fx * this.fx + o.fz * this.fz < 0.6) continue;
      const gap = ah - (this.len + o.len) / 2;
      vt = Math.min(vt, gap < 2.5 ? 0 : Math.min(this.cruise, Math.max(0, o.v) + Math.sqrt(Math.max(0, gap - 2.5)) * 1.3));
    }
    this.braking = vt < this.v - 0.3;
    if (this.hold) vt = 0;
    this.v = vt > this.v ? Math.min(vt, this.v + 2.4 * dt) : Math.max(vt, this.v - 5 * dt);
    this.s += this.v * dt; this.pose(dt);
  }
  pose(dt) {
    const p = this.path, f = pathAt(p, this.s + this.m.fa, _fa), r = pathAt(p, this.s + this.m.ra, _ra);
    const yaw = Math.atan2(f.x - r.x, f.z - r.z), k = -this.m.ra / (this.m.fa - this.m.ra);
    this.x = r.x + (f.x - r.x) * k; this.z = r.z + (f.z - r.z) * k; this.yaw = yaw; this.fx = Math.sin(yaw); this.fz = Math.cos(yaw);
    this.steer = clamp(wrapPi(Math.atan2(f.tx, f.tz) - yaw) * 1.6, -0.5, 0.5); this.render(dt);
  }
  render(dt) {
    const g = this.m.group; g.position.set(this.x, 0, this.z); g.rotation.y = this.yaw;
    const w = this.v * dt / 0.45; for (const wh of this.m.wheels) wh.rotation.x += w; for (const f of this.m.front) f.rotation.y = this.steer;
    this.m.setBrake(this.braking);
  }
  dispose() { const i = agents.indexOf(this); if (i >= 0) agents.splice(i, 1); scene.remove(this.m.group); }
}
