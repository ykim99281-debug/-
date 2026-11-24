'use strict';
const BUS_TYPES = {
  mini: { name: '마을버스', len: 8.4, w: 2.3, h: 3.0, cap: 24, price: 500000, wage: 60, vmax: 20, lvl: 1, deck: 1, fuel: 2.4 },
  city: { name: '시내버스', len: 12, w: 2.55, h: 3.2, cap: 45, price: 800000, wage: 90, vmax: 22, lvl: 1, deck: 1, fuel: 3.5 },
  ev: { name: '전기버스', len: 12, w: 2.55, h: 3.2, cap: 45, price: 1400000, wage: 90, vmax: 22, lvl: 2, deck: 1, fuel: 1.2 },
  dd: { name: '2층 버스', len: 11, w: 2.55, h: 4.5, cap: 72, price: 1500000, wage: 140, vmax: 19, lvl: 3, deck: 2, fuel: 5.5 }
};
const _gc = {};
const bgeo = (w, h, d) => _gc['b' + w + h + d] || (_gc['b' + w + h + d] = Object.assign(new THREE.BoxGeometry(w, h, d), { userData: { shared: true } }));
const _tc = {};
function destTex(text, color) {
  const k = text + color; if (_tc[k]) return _tc[k];
  return _tc[k] = canvasTex(256, 48, (x) => { x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 48); x.fillStyle = '#ffae2b'; x.font = 'bold 30px monospace'; x.textBaseline = 'middle'; x.fillText(text, 8, 26); });
}

// ===== 고품질 버스 모델 =====
const BM = {};
function busMats() {
  if (BM.white) return BM;
  const ph = (c, s) => new THREE.MeshPhongMaterial({ color: c, shininess: s || 50, specular: 0x333333 });
  BM.white = ph(0xf1f3f6, 60); BM.white.side = THREE.DoubleSide; BM.dark = mk(0x17191f); BM.rubber = mk(0x0d0e11); BM.chrome = ph(0xc8ccd4, 120); BM.chrome.specular.setHex(0xffffff);
  BM.glass = new THREE.MeshPhongMaterial({ color: 0x6fa5cb, transparent: true, opacity: .4, shininess: 110, specular: 0xffffff, side: THREE.DoubleSide }); BM.glass.userData.noShadow = true;
  BM.head = new THREE.MeshBasicMaterial({ color: 0xe8e4d0 }); BM.head.userData.noShadow = true; BM.ceil = new THREE.MeshBasicMaterial({ color: 0xcfd6e0 }); BM.ceil.userData.noShadow = true;
  BM.yellow = mk(0xf2c230); BM.seat = mk(0x2c4a7a); BM.seatB = mk(0x37609a); BM.floor = mk(0x3a3d46); BM.wall = mk(0x2a2d35); BM.cab = mk(0x1c1f26); BM.paints = {};
  for (const k in BM) if (BM[k] && BM[k].isMaterial) BM[k].userData.shared = true;
  return BM;
}
const paintMat = c => { const B = busMats(); if (!B.paints[c]) { B.paints[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x555555 }); B.paints[c].userData.shared = true; } return B.paints[c]; };
function updateBusLights(k) { const B = busMats(); B.head.color.setHex(k > 0.35 ? 0xfff6d0 : 0xe8e4d0); B.ceil.color.setHex(k > 0.35 ? 0xfff2c8 : 0xcfd6e0); }
const UB = Object.assign(new THREE.BoxGeometry(1, 1, 1), { userData: { shared: true } }), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function part(list, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
  _v1.set(x, y, z); _q4.setFromEuler(_e4.set(rx || 0, ry || 0, rz || 0)); _v2.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
  list.push({ geo, mat, m: new THREE.Matrix4().compose(_v1, _q4, _v2) });
}
const pbox = (list, mat, x, y, z, w, h, d, rx, ry, rz) => part(list, UB, mat, x, y, z, rx, ry, rz, w, h, d);
function mergeParts(group, list, shell) {
  const by = new Map(); for (const p of list) { if (!by.has(p.mat)) by.set(p.mat, []); by.get(p.mat).push(p); }
  for (const [mat, arr] of by) {
    const P = [], N = []; let n = 0;
    for (const p of arr) { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.array.length; g.dispose(); }
    const pa = new Float32Array(n), na = new Float32Array(n); let o = 0; for (let i = 0; i < P.length; i++) { pa.set(P[i], o); na.set(N[i], o); o += P[i].length; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pa, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(na, 3));
    const m = new THREE.Mesh(bg, mat); m.castShadow = !mat.userData.noShadow; group.add(m); if (shell) shell.push(m);
  }
}
function roundedShape(w, y0, y1, rt, rb) {
  const s = new THREE.Shape(), h = w / 2; s.moveTo(-h + rb, y0); s.lineTo(h - rb, y0); s.quadraticCurveTo(h, y0, h, y0 + rb); s.lineTo(h, y1 - rt); s.quadraticCurveTo(h, y1, h - rt, y1);
  s.lineTo(-h + rt, y1); s.quadraticCurveTo(-h, y1, -h, y1 - rt); s.lineTo(-h, y0 + rb); s.quadraticCurveTo(-h, y0, -h + rb, y0); return s;
}
const extrude = (shape, L) => { const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -L / 2); return g; };
const hex6 = c => '#' + c.toString(16).padStart(6, '0');
function liveryTex(color, num, name, co) {
  const k = 'L' + color + num + name + co; if (_tc[k]) return _tc[k];
  const t = canvasTex(1024, 160, x => {
    x.fillStyle = hex6(color); x.fillRect(0, 0, 1024, 160); x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.moveTo(0, 20); for (let i = 0; i <= 1024; i += 16) x.lineTo(i, 24 + 12 * Math.sin(i / 80)); x.lineTo(1024, 0); x.lineTo(0, 0); x.fill();
    x.fillStyle = '#f4f6f8'; x.beginPath(); x.moveTo(0, 124); for (let i = 0; i <= 1024; i += 16) x.lineTo(i, 124 - 12 * Math.sin(i / 70 + 1)); x.lineTo(1024, 160); x.lineTo(0, 160); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 84px sans-serif'; x.textBaseline = 'middle'; x.fillText(num, 36, 70); x.font = 'bold 46px sans-serif'; x.fillText(name, 230, 54); x.font = '600 34px sans-serif'; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText(co, 990, 96);
  }); t.anisotropy = 8; return _tc[k] = t;
}
function plateTex() { return _tc.plate || (_tc.plate = canvasTex(128, 32, x => { x.fillStyle = '#f6f6f6'; x.fillRect(0, 0, 128, 32); x.strokeStyle = '#222'; x.lineWidth = 2; x.strokeRect(1, 1, 126, 30); x.fillStyle = '#111'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('광주 70사 1234', 64, 17); })); }

function makeBus(type, color, label) {
  const B = busMats(), T = BUS_TYPES[type], L = T.len, W = T.w, H = T.h, dd = T.deck === 2, g = new THREE.Group(), shell = [], keep = [], inner = new THREE.Group(); g.add(inner);
  const paint = paintMat(color), S = [], I = [], K = [], tail = new THREE.MeshBasicMaterial({ color: 0x661111 }); tail.userData.noShadow = true;
  const num = String(label).split(' ')[0], rname = String(label).split(' ').slice(1).join(' ') || '교습', co = (typeof G !== 'undefined' && G && G.name) ? G.name : '광주버스';
  const sillY = 1.58, roofY = H - 0.62, wy0 = 1.66, wy1 = roofY - 0.04;
  // --- 차체
  part(S, extrude(roundedShape(W, 0.42, sillY, 0.06, 0.14), L), paint, 0, 0, 0);
  part(S, extrude(roundedShape(W - 0.02, roofY, H, 0.55, 0), L), B.white, 0, 0, 0);
  if (dd) pbox(S, paint, 0, 2.58, 0, W + 0.02, 0.2, L - 0.1);
  pbox(S, B.dark, 0, 0.36, 0, W - 0.3, 0.3, L - 0.9);
  // --- 창문 · 기둥
  const decks = dd ? [[wy0, 2.42], [2.78, wy1]] : [[wy0, wy1]];
  for (const [a0, a1] of decks) for (const s of [-1, 1]) {
    pbox(S, B.glass, s * (W / 2 + 0.006), (a0 + a1) / 2, 0, 0.02, a1 - a0, L - 0.5);
    for (let z = -L / 2 + 0.4; z <= L / 2 - 0.3; z += 1.45) pbox(S, B.white, s * (W / 2 + 0.012), (a0 + a1) / 2, z, 0.04, a1 - a0 + 0.04, 0.1);
    pbox(S, B.dark, s * (W / 2 + 0.014), a0 - 0.02, 0, 0.03, 0.04, L - 0.5); pbox(S, B.dark, s * (W / 2 + 0.014), a1 + 0.02, 0, 0.03, 0.04, L - 0.5);
  }
  // 전면
  pbox(S, B.dark, 0, (wy0 + wy1) / 2, L / 2 + 0.004, W - 0.16, wy1 - wy0 + 0.1, 0.03);
  pbox(S, B.glass, 0, (wy0 + wy1) / 2, L / 2 + 0.03, W - 0.3, wy1 - wy0 - 0.05, 0.03, -0.1);
  pbox(S, B.white, 0, roofY + 0.06, L / 2 + 0.1, W - 0.3, 0.08, 0.3);
  pbox(S, B.dark, 0, 0.66, L / 2 + 0.12, W + 0.06, 0.32, 0.4); pbox(S, B.dark, 0, 1.02, L / 2 + 0.02, 1.3, 0.55, 0.05);
  for (let i = -2; i <= 2; i++) pbox(S, B.chrome, i * 0.22, 1.02, L / 2 + 0.05, 0.03, 0.5, 0.02);
  pbox(S, B.chrome, 0, 1.38, L / 2 + 0.05, 0.3, 0.1, 0.02);
  for (const s of [-1, 1]) { pbox(S, B.head, s * (W / 2 - 0.42), 0.92, L / 2 + 0.05, 0.6, 0.2, 0.06); pbox(S, B.head, s * (W / 2 - 0.42), 1.12, L / 2 + 0.05, 0.6, 0.04, 0.06); pbox(S, B.head, s * (W / 2 - 0.3), 0.5, L / 2 + 0.2, 0.18, 0.1, 0.05); }
  // 후면
  pbox(S, B.dark, 0, (wy0 + wy1) / 2, -L / 2 - 0.004, W - 0.5, wy1 - wy0 - 0.2, 0.03); pbox(S, B.glass, 0, (wy0 + wy1) / 2, -L / 2 - 0.03, W - 0.6, wy1 - wy0 - 0.3, 0.03);
  pbox(S, B.dark, 0, 0.66, -L / 2 - 0.12, W + 0.06, 0.32, 0.4);
  for (const s of [-1, 1]) { pbox(S, tail, s * (W / 2 - 0.2), 1.0, -L / 2 - 0.04, 0.22, 0.62, 0.06); pbox(S, B.dark, s * (W / 2 - 0.2), 1.0, -L / 2 - 0.02, 0.26, 0.66, 0.03); }
  // 지붕 장비
  pbox(S, B.white, 0, H + 0.1, -L * 0.12, W - 1.0, 0.26, 2.7); pbox(S, B.dark, 0, H + 0.24, -L * 0.12, W - 1.4, 0.04, 2.3);
  pbox(S, B.dark, 0.6, H + 0.04, L * 0.28, 0.5, 0.08, 0.7); pbox(S, B.dark, -0.6, H + 0.04, L * 0.28, 0.5, 0.08, 0.7);
  part(S, new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5), B.dark, -0.7, H + 0.4, -L / 2 + 0.7);
  // 휠 아치 · 바퀴
  const wheels = [], front = [], tg = new THREE.CylinderGeometry(0.52, 0.52, 0.3, 22); tg.rotateZ(Math.PI / 2); const rg = new THREE.CylinderGeometry(0.3, 0.3, 0.32, 14); rg.rotateZ(Math.PI / 2);
  for (const [z, f] of [[0.30 * L, 1], [-0.25 * L, 0]]) for (const s of [-1, 1]) {
    part(S, new THREE.CircleGeometry(0.66, 22), B.dark, s * (W / 2 + 0.016), 0.52, z, 0, s * Math.PI / 2, 0);
    part(S, new THREE.RingGeometry(0.66, 0.74, 22), B.rubber, s * (W / 2 + 0.02), 0.52, z, 0, s * Math.PI / 2, 0);
    const piv = new THREE.Group(); piv.position.set(s * (W / 2 - 0.12), 0.52, z); const w = new THREE.Mesh(tg, B.rubber); w.castShadow = true; const r = new THREE.Mesh(rg, B.chrome);
    w.add(r); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, nut = new THREE.Mesh(bgeo(0.04, 0.04, 0.05), B.dark); nut.position.set(s * 0.17, Math.sin(a) * 0.16, Math.cos(a) * 0.16); w.add(nut); }
    piv.add(w); g.add(piv); wheels.push(w); if (f) front.push(piv); shell.push(piv);
  }
  // 사이드 미러 (운전석 시점에서도 보임)
  for (const s of [-1, 1]) { pbox(K, B.dark, s * (W / 2 + 0.42), 2.0, L / 2 - 0.5, 0.08, 0.5, 0.3); pbox(K, B.chrome, s * (W / 2 + 0.3), 2.2, L / 2 - 0.5, 0.35, 0.04, 0.04); pbox(K, B.glass, s * (W / 2 + 0.375), 2.0, L / 2 - 0.5, 0.02, 0.44, 0.26); }
  // --- 실내
  pbox(I, B.floor, 0, 0.56, 0, W - 0.1, 0.06, L - 0.3); if (dd) pbox(I, B.floor, 0, 2.6, 0, W - 0.1, 0.06, L - 0.3);
  for (const s of [-1, 1]) { pbox(I, B.wall, s * (W / 2 - 0.06), 1.05, 0, 0.06, 1.0, L - 0.35); if (dd) pbox(I, B.wall, s * (W / 2 - 0.06), 2.95, 0, 0.06, 0.4, L - 0.35); }
  pbox(I, B.white, 0, roofY + 0.02, 0, W - 0.2, 0.05, L - 0.3);
  pbox(I, B.cab, 0, 1.25, L / 2 - 0.55, W - 0.3, 0.55, 0.75); pbox(I, B.dark, 0, 1.55, L / 2 - 0.25, W - 0.3, 0.12, 0.2);
  pbox(I, B.cab, 0.55, 0.95, L / 2 - 2.1, 0.55, 0.75, 0.5); pbox(I, B.dark, 0.55, 1.45, L / 2 - 2.3, 0.5, 0.5, 0.1);   // 운전석
  pbox(I, B.dark, 0.1, roofY - 0.1, L / 2 - 0.2, 0.3, 0.14, 0.05);                                                   // 실내 거울
  pbox(I, B.glass, -0.05, 1.7, L / 2 - 1.6, 0.04, 1.3, 1.1);                                                         // 운전석 칸막이는 문 쪽 비움
  for (const [a0] of decks) for (let z = -L / 2 + 1.3; z < L / 2 - 3; z += 2.2) for (const s of [-1, 1]) pbox(I, B.ceil, s * 0.55, (dd && a0 > 2 ? H : roofY) - 0.04, z, 0.14, 0.03, 1.2);
  for (const fy of (dd ? [0.56, 2.6] : [0.56])) { const top = fy + (dd ? 1.9 : roofY - 0.56 - 0.12); for (const s of [-1, 1]) part(I, new THREE.CylinderGeometry(0.018, 0.018, L - 3.4, 6), B.chrome, s * 0.1, top, -0.6, Math.PI / 2, 0, 0); for (let z = -L / 2 + 1.2; z < L / 2 - 3; z += 2.4) part(I, new THREE.CylinderGeometry(0.018, 0.018, top - fy, 6), B.chrome, 0.1, (top + fy) / 2, z); }
  for (const z of doorZs(L)) for (const s of [-1, 1]) part(I, new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), B.yellow, -W / 2 + 0.25, 1.5, z + s * 0.7);
  pbox(I, B.dark, -W / 2 + 0.3, 1.1, L / 2 - 1.3 - 0.8, 0.18, 0.3, 0.2);   // 요금 단말기
  // 좌석
  const slots = [], decksY = dd ? [0.56, 2.6] : [0.56];
  for (const fy of decksY) for (let z = -L / 2 + 0.9; z <= L / 2 - 3.2; z += 1.0) for (const x of [-0.95, -0.5, 0.5, 0.95]) {
    if (fy === 0.56 && z > -L * 0.12 - 1.2 && z < -L * 0.12 + 1.2 && x < 0) continue;
    pbox(I, B.seat, x, fy + 0.38, z, 0.42, 0.12, 0.44); pbox(I, B.seatB, x, fy + 0.68, z - 0.2, 0.42, 0.5, 0.08); pbox(I, B.dark, x, fy + 0.2, z, 0.06, 0.4, 0.06); slots.push([x, fy + 0.82, z]);
  }
  for (const fy of decksY) for (let z = -L / 2 + 1.2; z <= L / 2 - 3.4; z += 0.9) for (const x of [-0.15, 0.15]) slots.push([x, fy + 0.72, z]);
  let sh = 12345; for (let i = slots.length - 1; i > 0; i--) { sh = (sh * 1103515245 + 12345) & 0x7fffffff; const j = sh % (i + 1); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.23, 0.8, 8), mk(0xffffff), T.cap + 4), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), mk(0xf2c9a0), T.cap + 4);
  for (let i = 0; i < T.cap + 4; i++) { const s = slots[i % slots.length]; _dummy.position.set(s[0], s[1], s[2]); _dummy.scale.set(1, 1, 1); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix(); body.setMatrixAt(i, _dummy.matrix); _dummy.position.y += 0.55; _dummy.updateMatrix(); heads.setMatrixAt(i, _dummy.matrix); body.setColorAt(i, _col.setHSL((i * 0.137) % 1, .5, .5)); }
  body.count = heads.count = 0; inner.add(body, heads);
  // 병합
  mergeParts(g, S, shell); mergeParts(g, K, keep); mergeParts(inner, I, null);
  // --- 텍스처 평면 (도색 · LED · 번호판)
  const lv = liveryTex(color, num, rname, co);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.5, 1.0), new THREE.MeshPhongMaterial({ map: lv, shininess: 60, specular: 0x333333 })); m.position.set(s * (W / 2 + 0.024), 1.0, 0); m.rotation.y = s * Math.PI / 2; g.add(m); shell.push(m); }
  const led = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.34), new THREE.MeshBasicMaterial({ map: destTex(num + ' ' + rname, color) })); led.position.set(0, roofY + 0.34, L / 2 + 0.07); g.add(led); shell.push(led);
  const led2 = led.clone(); led2.position.set(0, roofY + 0.34, -L / 2 - 0.07); led2.rotation.y = Math.PI; g.add(led2); shell.push(led2);
  for (const [z, ry] of [[L / 2 + 0.06, 0], [-L / 2 - 0.16, Math.PI]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshBasicMaterial({ map: plateTex() })); pl.position.set(0, 0.64, z + (ry ? -0.05 : 0.1)); pl.rotation.y = ry; g.add(pl); shell.push(pl); }
  // --- 문 (움직임)
  const leaves = [], dzs = doorZs(L);
  for (const dz of dzs) {
    const slot = new THREE.Mesh(bgeo(0.04, 2.0, 1.3), B.dark); slot.position.set(-W / 2 - 0.005, 1.45, dz); g.add(slot); shell.push(slot);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(-W / 2 - 0.05, 1.45, dz + s * 0.65);
      const leaf = new THREE.Mesh(bgeo(0.06, 2.0, 0.65), B.glass); leaf.position.z = -s * 0.325; piv.add(leaf);
      const fr = new THREE.Mesh(bgeo(0.07, 0.12, 0.65), B.dark); fr.position.set(0, 0.94, -s * 0.325); piv.add(fr);
      const edge = new THREE.Mesh(bgeo(0.08, 2.0, 0.06), B.rubber); edge.position.set(0, 0, -s * 0.62); piv.add(edge);
      g.add(piv); leaves.push([piv, s]); shell.push(piv);
    }
  }
  // --- 운전석: 핸들 · 계기판 디스플레이
  const wheelPiv = new THREE.Group(); wheelPiv.position.set(0.55, 1.62, L / 2 - 1.0); wheelPiv.rotation.x = -1.1; inner.add(wheelPiv);
  const sw = new THREE.Group(); wheelPiv.add(sw); sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 22), B.rubber)); for (const a of [0, 2.09, 4.19]) { const sp = new THREE.Mesh(bgeo(0.4, 0.035, 0.03), B.rubber); sp.rotation.z = a; sw.add(sp); }
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 96; const dx = dc.getContext('2d'), dtex = new THREE.CanvasTexture(dc);
  const dmat = new THREE.MeshBasicMaterial({ map: dtex }); dmat.userData.ownsMap = true;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.195), dmat); dash.position.set(0.55, 1.58, L / 2 - 0.62); dash.rotation.set(0.7, Math.PI, 0); inner.add(dash);
  let dashKey = '';
  const drawDash = i => {
    const k = [i.kmh, i.gear, i.door, i.next, i.auto, i.gap].join('|'); if (k === dashKey) return; dashKey = k;
    dx.fillStyle = '#05080f'; dx.fillRect(0, 0, 256, 96); dx.fillStyle = i.kmh > 52 ? '#ff5a5a' : '#7dffb0'; dx.font = 'bold 52px monospace'; dx.textAlign = 'left'; dx.fillText(String(i.kmh).padStart(3, ' '), 6, 52);
    dx.font = '16px sans-serif'; dx.fillStyle = '#9fb0c8'; dx.fillText('km/h', 92, 52); dx.font = 'bold 30px sans-serif'; dx.fillStyle = '#ffb020'; dx.fillText(i.gear, 200, 40);
    dx.font = '15px sans-serif'; dx.fillStyle = i.door ? '#4ade80' : '#9fb0c8'; dx.fillText(i.door ? '● 문 열림' : '○ 문 닫힘', 150, 62); dx.fillStyle = '#cfe4ff'; dx.font = '15px sans-serif'; dx.fillText((i.auto ? '🤖 ' : '') + String(i.next || '').slice(0, 14), 6, 78); dx.fillStyle = '#ffd27a'; dx.fillText(i.gap || '', 150, 78); dtex.needsUpdate = true;
  };
  const spot = new THREE.SpotLight(0xfff2cc, 0, 70, 0.5, 0.5, 1); spot.position.set(0, 1, L / 2); spot.target.position.set(0, 0, L / 2 + 20); g.add(spot, spot.target);
  return {
    group: g, shell, keep, inner, wheels, front, steerWheel: sw, type, spot, tail, len: L, w: W, doorZ: dzs[0], fa: 0.30 * L, ra: -0.25 * L, drawDash,
    cockpit: { x: 0.55, y: 2.05, z: L / 2 - 1.55 },
    setDoor(t) { for (const [p, s] of leaves) p.rotation.y = s * t * 1.5; },
    setLoad(n) { body.count = heads.count = Math.min(n, T.cap + 4); },
    setBrake(on) { tail.color.setHex(on ? 0xff2a2a : 0x661111); },
    setCockpit(on) { for (const m of shell) m.visible = !on; }
  };
}
function doorZs(L) { return [L / 2 - 1.4].concat(L > 10 ? [-L * 0.12] : []); }

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
      if (ah <= 0 || ah > 40 + this.v * 3) continue;
      const lat = dx * this.fz - dz * this.fx; if (Math.abs(lat) > 2.6 || o.fx * this.fx + o.fz * this.fz < 0.6) continue;
      const gap = ah - (this.len + o.len) / 2;
      vt = Math.min(vt, gap < 2.5 ? 0 : Math.min(this.cruise, Math.max(0, (gap - 2.5) / (this.headway || 1.2)), Math.max(0, o.v) + Math.sqrt(Math.max(0, gap - 2.5)) * 1.3));
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
  dispose() { const i = agents.indexOf(this); if (i >= 0) agents.splice(i, 1); scene.remove(this.m.group); disposeTree(this.m.group); }
}

// ===== 실제 자동차 (신차 기준 대략가 · 대략적인 제원) =====
const CAR_SPECS = {
  morning: { brand: '기아', name: '모닝', type: 'hatch', price: 14000000, len: 3.6, w: 1.64, h: 1.5, vmax: 43, accel: 3.0, r: 0.29, colors: [0xe8e8ee, 0xf2c230, 0x2e86de, 0xc0392b, 0x2d3436], info: '경차 · 연비 좋은 첫 차' },
  avante: { brand: '현대', name: '아반떼', type: 'sedan', price: 21000000, len: 4.7, w: 1.83, h: 1.42, vmax: 52, accel: 3.6, r: 0.32, colors: [0xf4f4f6, 0x1f2937, 0x9ca3af, 0xb91c1c, 0x1d4ed8], info: '준중형 세단 · 국민 첫 세단' },
  sonata: { brand: '현대', name: '쏘나타', type: 'sedan', price: 29000000, len: 4.9, w: 1.86, h: 1.45, vmax: 57, accel: 4.0, r: 0.33, colors: [0xf4f4f6, 0x111827, 0x6b7280, 0x7f1d1d, 0x1e3a8a], info: '중형 세단' },
  k5: { brand: '기아', name: 'K5', type: 'sedan', price: 28000000, len: 4.9, w: 1.86, h: 1.45, vmax: 58, accel: 4.4, r: 0.33, colors: [0xf4f4f6, 0x111827, 0xb91c1c, 0x0f766e, 0x6b7280], info: '중형 세단 · 스포티' },
  grandeur: { brand: '현대', name: '그랜저', type: 'sedan', price: 41000000, len: 5.0, w: 1.88, h: 1.46, vmax: 61, accel: 4.4, r: 0.34, colors: [0xf4f4f6, 0x111827, 0x4b5563, 0x1e3a8a, 0x7c2d12], info: '준대형 세단' },
  carnival: { brand: '기아', name: '카니발', type: 'van', price: 38000000, len: 5.16, w: 1.99, h: 1.76, vmax: 53, accel: 3.4, r: 0.35, colors: [0xf4f4f6, 0x111827, 0x6b7280, 0x7f1d1d, 0x14532d], info: '대형 미니밴 · 11인승' },
  santafe: { brand: '현대', name: '싼타페', type: 'suv', price: 37000000, len: 4.83, w: 1.9, h: 1.72, vmax: 56, accel: 3.7, r: 0.36, colors: [0xf4f4f6, 0x111827, 0x78716c, 0x1e3a8a, 0x14532d], info: '중형 SUV' },
  g80: { brand: '제네시스', name: 'G80', type: 'sedan', price: 60000000, len: 5.0, w: 1.93, h: 1.46, vmax: 67, accel: 5.5, r: 0.35, colors: [0x0b0b0d, 0xf4f4f6, 0x374151, 0x3f1d1d, 0x1e293b], info: '프리미엄 대형 세단' },
  model3: { brand: '테슬라', name: '모델 3', type: 'sedan', price: 53000000, len: 4.72, w: 1.85, h: 1.44, vmax: 62, accel: 6.5, r: 0.33, colors: [0xf4f4f6, 0x111827, 0xb91c1c, 0x1e3a8a, 0x9ca3af], info: '전기차 · 강력한 가속', ev: 1 },
  bmw5: { brand: 'BMW', name: '5시리즈', type: 'sedan', price: 78000000, len: 5.06, w: 1.9, h: 1.48, vmax: 69, accel: 5.8, r: 0.35, colors: [0xf4f4f6, 0x0b0b0d, 0x1e3a8a, 0x6b7280, 0x7f1d1d], info: '독일 프리미엄 세단' },
  eclass: { brand: '메르세데스-벤츠', name: 'E클래스', type: 'sedan', price: 85000000, len: 4.95, w: 1.88, h: 1.47, vmax: 69, accel: 5.9, r: 0.35, colors: [0xd1d5db, 0x0b0b0d, 0xf4f4f6, 0x1e293b, 0x7f1d1d], info: '독일 프리미엄 세단' },
  p911: { brand: '포르쉐', name: '911 카레라', type: 'coupe', price: 170000000, len: 4.55, w: 1.85, h: 1.3, vmax: 81, accel: 8.5, r: 0.36, colors: [0xfacc15, 0xdc2626, 0xf4f4f6, 0x0b0b0d, 0x2563eb], info: '스포츠카 · 리어엔진' },
  huracan: { brand: '람보르기니', name: '우라칸', type: 'super', price: 350000000, len: 4.52, w: 1.93, h: 1.16, vmax: 90, accel: 10.5, r: 0.36, colors: [0x84cc16, 0xf97316, 0xfacc15, 0x0b0b0d, 0xdc2626], info: '슈퍼카 · 최고 시속 325km' }
};
const CAR_TP = { sedan: { clr: .17, bh: .55, cab: [.86, .5, .46, -.06] }, hatch: { clr: .18, bh: .58, cab: [.88, .62, .52, -.08] }, suv: { clr: .26, bh: .72, cab: [.9, .62, .52, -.08] }, van: { clr: .24, bh: .85, cab: [.94, .84, .75, -.02] }, coupe: { clr: .13, bh: .46, cab: [.84, .42, .36, -.06] }, super: { clr: .1, bh: .4, cab: [.8, .4, .3, -.05] } };
const carType = s => ({ name: s.fullName || (s.brand + ' ' + s.name), len: s.len, w: s.w, h: s.h, vmax: s.vmax, cap: 5, accel: s.accel, brake: 9, steerSpeed: 28, feat: s.feat || new Set(), perKm: s.perKm || 120, engName: s.engName || '', trimName: s.trimName || '' });

function makeCarModel(spec, color) {
  const L = spec.len, W = spec.w, tp = CAR_TP[spec.type], sc = spec.h / (tp.clr + tp.bh + tp.cab[2]), clr = tp.clr * sc, bh = tp.bh * sc, ch = tp.cab[2] * sc, cw = tp.cab[0] * W, cl = tp.cab[1] * L, cz = tp.cab[3] * L;
  const g = new THREE.Group(), shell = [], inner = new THREE.Group(); g.add(inner);
  const paint = mk(color), glass = mk(0x222d3a), dark = mk(0x131418);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); shell.push(m); return m; };
  add(bgeo(W, bh, L), paint, 0, clr + bh / 2, 0);
  add(bgeo(cw, ch, cl), glass, 0, clr + bh + ch / 2, cz);
  add(bgeo(cw - 0.06, 0.06, cl - 0.35), paint, 0, clr + bh + ch + 0.02, cz);
  if (spec.feat && spec.feat.has('sunroof')) add(bgeo(cw - 0.5, 0.02, cl * 0.45), mk(0x10161f), 0, clr + bh + ch + 0.055, cz + cl * 0.05);
  add(bgeo(W + 0.04, bh * 0.45, 0.22), dark, 0, clr + bh * 0.3, L / 2 - 0.05); add(bgeo(W + 0.04, bh * 0.45, 0.22), dark, 0, clr + bh * 0.3, -L / 2 + 0.05);
  if (spec.type === 'super' || spec.type === 'coupe') { add(bgeo(W - 0.2, 0.05, 0.4), dark, 0, clr + bh + 0.18, -L / 2 + 0.3); for (const s of [-1, 1]) add(bgeo(0.05, 0.2, 0.3), dark, s * (W / 2 - 0.3), clr + bh + 0.08, -L / 2 + 0.3); }
  const head = new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), tail = new THREE.MeshBasicMaterial({ color: 0x771111 });
  for (const s of [-1, 1]) { add(bgeo(0.4, 0.13, 0.06), head, s * (W / 2 - 0.35), clr + bh * 0.7, L / 2 + 0.01); add(bgeo(0.4, 0.12, 0.06), tail, s * (W / 2 - 0.35), clr + bh * 0.72, -L / 2 - 0.01); }
  const wheels = [], front = [], r = spec.r, wg = new THREE.CylinderGeometry(r, r, 0.26, 16); wg.rotateZ(Math.PI / 2); const tire = mk(0x141518), rim = mk(0xc9ccd2), rg = new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.28, 8); rg.rotateZ(Math.PI / 2);
  for (const [z, f] of [[L * 0.31, 1], [-L * 0.31, 0]]) for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * (W / 2 - 0.12), r, z); const w = new THREE.Mesh(wg, tire); w.castShadow = true; w.add(new THREE.Mesh(rg, rim)); p.add(w); g.add(p); wheels.push(w); if (f) front.push(p); shell.push(p); }
  // 실내 (운전석 시점용)
  const front0 = cz + cl / 2, im = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); inner.add(m); return m; };
  im(bgeo(cw - 0.1, 0.28, 0.55), mk(0x1c1f26), 0, clr + bh + 0.1, front0 - 0.35);
  const wp = new THREE.Group(); wp.position.set(0.38, clr + bh + 0.3, front0 - 0.95); wp.rotation.x = -1.15; inner.add(wp);
  const sw = new THREE.Group(); wp.add(sw); sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 18), mk(0x101114)));
  for (const s of [-1, 1]) { const p = new THREE.Mesh(bgeo(0.1, ch + 0.05, 0.1), dark); p.position.set(s * (cw / 2 - 0.05), clr + bh + ch / 2, front0 - 0.05); inner.add(p); }
  const signMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 }), sign = new THREE.Group(); sign.visible = false; sign.position.set(0, clr + bh + ch + 0.14, cz);
  sign.add(new THREE.Mesh(bgeo(0.52, 0.16, 0.2), signMat));
  const stex = _tc.taxi || (_tc.taxi = canvasTex(128, 40, x => { x.fillStyle = '#101010'; x.fillRect(0, 0, 128, 40); x.fillStyle = '#ffb020'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TAXI', 64, 22); }));
  for (const s of [1, -1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.13), new THREE.MeshBasicMaterial({ map: stex })); pl.position.z = 0.101 * s; pl.rotation.y = s > 0 ? 0 : Math.PI; sign.add(pl); }
  g.add(sign);
  const spot = new THREE.SpotLight(0xfff2cc, 0, 70, 0.5, 0.5, 1); spot.position.set(0, 0.8, L / 2); spot.target.position.set(0, 0, L / 2 + 20); g.add(spot, spot.target);
  return {
    group: g, shell, keep: [], inner, wheels, front, steerWheel: sw, spot, len: L, w: W, fa: 0.31 * L, ra: -0.31 * L, cockpit: { x: 0.38, y: clr + bh + ch * 0.62, z: front0 - 1.25 }, doorZ: 0,
    setTaxi(st) { sign.visible = st > 0; signMat.color.setHex(st === 2 ? 0xff5a5a : 0x4ade80); }, setBrake(on) { tail.color.setHex(on ? 0xff2a2a : 0x771111); }, setDoor() { }, setLoad() { }, setCockpit(on) { for (const m of shell) m.visible = !on; }
  };
}

// ===== 제조사별 트림 · 파워트레인 · 옵션 · 금융 (대략적인 현실 수치) =====
const BRANDS = {
  '현대': { apr: 0.049, fin: '현대캐피탈', note: '국내 1위 · 합리적 가격' }, '기아': { apr: 0.049, fin: '기아 파이낸셜', note: '디자인과 실용성' }, '제네시스': { apr: 0.045, fin: '제네시스 파이낸스', note: '프리미엄 · 기본 사양 충실' },
  'BMW': { apr: 0.059, fin: 'BMW 파이낸셜', note: '운전의 즐거움' }, '메르세데스-벤츠': { apr: 0.055, fin: '벤츠 파이낸셜', note: '고급 세단의 표준' }, '테슬라': { apr: 0.052, fin: '테슬라 파이낸스', note: '전기차 · 자율주행 선도' },
  '포르쉐': { apr: 0.049, fin: '포르쉐 파이낸셜', note: '스포츠카의 기준' }, '람보르기니': { apr: 0.065, fin: '람보르기니 파이낸스', note: '슈퍼카 · 한정 생산' }
};
const BRAND_BASE = { '제네시스': ['cruise', 'led', 'leather', 'adas'], 'BMW': ['cruise', 'led', 'leather'], '메르세데스-벤츠': ['cruise', 'led', 'leather'], '테슬라': ['cruise', 'adas', 'led'], '포르쉐': ['cruise', 'led', 'leather'], '람보르기니': ['cruise', 'led', 'leather', 'sport'] };
const TRIM_SETS = {
  '현대': [{ n: '스마트', d: 0, f: [] }, { n: '모던', d: .08, f: ['cruise', 'led'] }, { n: '프리미엄', d: .16, f: ['cruise', 'led', 'leather', 'surround'] }, { n: 'N라인', d: .19, acc: 1.1, f: ['cruise', 'led', 'leather', 'surround', 'sport'] }, { n: '인스퍼레이션', d: .25, f: ['cruise', 'led', 'leather', 'surround', 'adas', 'sunroof'] }],
  '기아': [{ n: '트렌디', d: 0, f: [] }, { n: '프레스티지', d: .09, f: ['cruise', 'led'] }, { n: '시그니처', d: .18, f: ['cruise', 'led', 'leather', 'surround', 'adas'] }, { n: 'GT-Line', d: .2, acc: 1.1, f: ['cruise', 'led', 'leather', 'surround', 'sport'] }],
  '제네시스': [{ n: '기본', d: 0, f: [] }, { n: '프리미엄', d: .08, f: ['surround', 'sunroof'] }, { n: '럭셔리', d: .15, f: ['surround', 'sunroof', 'hud', 'audio'] }, { n: '스포츠', d: .2, acc: 1.12, vm: 1.03, f: ['sport', 'surround', 'hud'] }],
  'BMW': [{ n: '520i', d: 0, f: [] }, { n: '530i', d: .09, acc: 1.08, f: ['adas', 'surround'] }, { n: 'M 스포츠', d: .16, acc: 1.1, f: ['sport', 'adas', 'surround', 'hud', 'sunroof', 'audio'] }],
  '메르세데스-벤츠': [{ n: 'E200', d: 0, f: [] }, { n: 'E300', d: .1, acc: 1.08, f: ['adas', 'surround'] }, { n: 'AMG 라인', d: .17, acc: 1.1, f: ['sport', 'adas', 'surround', 'hud', 'sunroof', 'audio'] }],
  '테슬라': [{ n: 'RWD', d: 0, f: [] }, { n: '롱레인지', d: .12, acc: 1.15, vm: 1.04, f: ['surround'] }, { n: '퍼포먼스', d: .28, acc: 1.45, vm: 1.1, f: ['surround', 'sport'] }],
  '포르쉐': [{ n: '카레라', d: 0, f: [] }, { n: '카레라 S', d: .16, acc: 1.12, vm: 1.05, f: ['surround'] }, { n: 'GTS', d: .27, acc: 1.2, vm: 1.08, f: ['sport', 'surround', 'sunroof'] }],
  '람보르기니': [{ n: '에보', d: 0, f: [] }, { n: 'STO', d: .25, acc: 1.12, vm: 1.05, f: ['sport'] }]
};
const ENG = { gas: { n: '가솔린', d: 0, pl: 1700, kx: 1, acc: 1, vm: 1 }, diesel: { n: '디젤', d: .06, pl: 1550, kx: 1.25, acc: 1.02, vm: 1 }, hybrid: { n: '하이브리드', d: .12, pl: 1700, kx: 1.55, acc: .96, vm: .98 }, phev: { n: '플러그인 하이브리드', d: .2, pl: 1100, kx: 2.0, acc: 1.06, vm: 1 }, ev: { n: '전기', d: 0, pl: 250, kx: 1, acc: 1, vm: 1 } };
const ENG_OK = { morning: ['gas'], avante: ['gas', 'hybrid'], sonata: ['gas', 'hybrid'], k5: ['gas', 'hybrid'], grandeur: ['gas', 'hybrid'], carnival: ['diesel', 'hybrid'], santafe: ['gas', 'hybrid', 'diesel'], g80: ['gas', 'diesel'], model3: ['ev'], bmw5: ['gas', 'diesel', 'phev'], eclass: ['gas', 'diesel'], p911: ['gas'], huracan: ['gas'] };
const KMPL = { morning: 15, avante: 13, sonata: 11.5, k5: 11.5, grandeur: 10, carnival: 8.5, santafe: 10, g80: 9, model3: 6.4, bmw5: 11, eclass: 11, p911: 7.5, huracan: 4.5 };   // model3: km/kWh
const OPTS = [
  { k: 'adas', n: '스마트센스 · 고속도로주행보조', d: 1800000, e: '자율주행(T) 사용 가능' }, { k: 'cruise', n: '크루즈 컨트롤', d: 500000, e: '속도 고정(K)' }, { k: 'surround', n: '서라운드 뷰 모니터', d: 800000, e: '버드뷰 카메라(C)' },
  { k: 'sport', n: '스포츠 모드 · 스포츠 서스펜션', d: 1500000, e: '스포츠 모드(V) · 코너링 향상' }, { k: 'led', n: '풀 LED 헤드램프', d: 700000, e: '야간 시야 향상' }, { k: 'sunroof', n: '파노라마 선루프', d: 1200000, e: '외관 · 중고가 상승' },
  { k: 'leather', n: '나파 가죽시트 · 통풍', d: 1400000, e: '중고가 상승' }, { k: 'hud', n: '헤드업 디스플레이', d: 1000000, e: '앞유리 속도 표시' }, { k: 'audio', n: '프리미엄 사운드', d: 1300000, e: '중고가 상승' }
];
const FEAT_NAME = Object.fromEntries(OPTS.map(o => [o.k, o.n]));
const r1e4 = n => Math.round(n / 1e4) * 1e4;
const optFactor = p => p < 20e6 ? 0.6 : p < 35e6 ? 0.85 : p < 70e6 ? 1.1 : p < 150e6 ? 1.7 : 3;
function defaultCfg(key) { return { trim: 0, eng: ENG_OK[key][0], opts: [], color: 0 }; }
function includedFeats(brand, trimIdx) { const t = TRIM_SETS[brand][trimIdx]; return new Set([...(BRAND_BASE[brand] || []), ...(t.f || [])]); }
function carQuote(key, cfg, pay) {
  const s = CAR_SPECS[key], tr = TRIM_SETS[s.brand][cfg.trim], en = ENG[cfg.eng], inc = includedFeats(s.brand, cfg.trim), cf = optFactor(s.price);
  const trimD = r1e4(s.price * tr.d), engD = (s.ev && cfg.eng === 'ev') ? 0 : r1e4(s.price * en.d);
  const optD = cfg.opts.filter(k => !inc.has(k)).reduce((a, k) => a + r1e4(OPTS.find(o => o.k === k).d * cf), 0), colorD = cfg.color >= 2 ? r1e4(s.price * (s.price > 150e6 ? 0.02 : 0.008)) : 0;
  const price = s.price + trimD + engD + optD + colorD;
  let tax = (s.type === 'hatch' && s.price < 20e6) ? 0 : Math.round(price * 0.07); if (cfg.eng === 'ev' || cfg.eng === 'hybrid') tax = Math.max(0, tax - (cfg.eng === 'ev' ? 1400000 : 400000));
  const reg = Math.round(price * 0.008), deliver = 300000, ins = Math.round(Math.max(700000, price * (price > 150e6 ? 0.015 : 0.009))), subsidy = (cfg.eng === 'ev' && price < 85e6) ? 6500000 : 0;
  const fees = tax + reg + deliver + ins, vehicle = price - subsidy; pay = pay || { method: 'cash' };
  let down = 0, financed = 0, pmt = 0, interest = 0;
  if (pay.method === 'loan') { down = r1e4(vehicle * pay.down); financed = vehicle - down; const r = BRANDS[s.brand].apr / 12, n = pay.months; pmt = Math.round(financed * r / (1 - Math.pow(1 + r, -n))); interest = pmt * n - financed; }
  const upfront = pay.method === 'loan' ? fees + down : fees + vehicle;
  return { price, trimD, engD, optD, colorD, tax, reg, deliver, ins, subsidy, fees, vehicle, down, financed, pmt, interest, upfront, apr: BRANDS[s.brand].apr, total: fees + vehicle + interest };
}
function carDerived(c) {
  const base = CAR_SPECS[c.model], cfg = c.cfg || { trim: Math.min(3, TRIM_SETS[base.brand].length - 1), eng: ENG_OK[c.model][0], opts: [], color: 0 };
  const tr = TRIM_SETS[base.brand][Math.min(cfg.trim, TRIM_SETS[base.brand].length - 1)], en = ENG[cfg.eng] || ENG.gas, s = Object.assign({}, base);
  s.vmax = base.vmax * (tr.vm || 1) * en.vm; s.accel = base.accel * (tr.acc || 1) * en.acc;
  s.feat = new Set([...includedFeats(base.brand, Math.min(cfg.trim, TRIM_SETS[base.brand].length - 1)), ...(cfg.opts || [])]);
  const eff = KMPL[c.model] * en.kx; s.perKm = cfg.eng === 'ev' ? en.pl / (KMPL[c.model] || 6) : en.pl / eff;   // ₩/km
  s.trimName = tr.n; s.engName = cfg.eng === 'ev' ? '전기' : en.n; s.fullName = base.brand + ' ' + base.name + ' ' + tr.n;
  return s;
}
