'use strict';
// ===== 상수 · 유틸 =====
const GN = 7, SP = 80, ROAD = 16, OFF = 3.9, RC = 14, HC = (GN - 1) / 2, EXT = HC * SP + ROAD / 2;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const fmtMoney = n => (n < 0 ? '-' : '') + '₩' + Math.abs(Math.round(n)).toLocaleString('ko-KR');
const fmtTime = t => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const srnd = mulberry(20240611);   // 도시 생성용 (항상 같은 도시)

// ===== 도로 격자 =====
const NP = [];
for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) NP.push({ x: (i - HC) * SP, z: (j - HC) * SP, i, j });
const nid = (i, j) => j * GN + i;
function neighbors(id) { const n = NP[id], r = []; if (n.i > 0) r.push(id - 1); if (n.i < GN - 1) r.push(id + 1); if (n.j > 0) r.push(id - GN); if (n.j < GN - 1) r.push(id + GN); return r; }
const dirOf = (u, v) => ({ x: Math.sign(NP[v].x - NP[u].x), z: Math.sign(NP[v].z - NP[u].z) });
const rightOf = d => ({ x: -d.z, z: d.x });   // 진행방향의 오른쪽

// ===== 정류장 (고정 생성) =====
const STOP_NAMES = ['시청앞', '중앙역', '대학로', '시장입구', '공원앞', '병원앞', '도서관', '터미널', '은행사거리', '체육관', '박물관', '호수공원', '신도시', '아파트단지', '학교앞', '소방서', '우체국', '백화점', '영화관', '강변', '구청', '약수터', '꽃시장', '과학관', '번화가', '동물원', '놀이공원', '야구장', '항구', '공항입구', '신촌', '문화회관', '버스터미널', '법원', '수영장', '전통시장'];
const STOPS = [];
(function () {
  let ni = 0; const nameOf = {};
  const add = (u, v) => {
    const key = Math.min(u, v) + '-' + Math.max(u, v);
    if (!(key in nameOf)) nameOf[key] = STOP_NAMES[ni++ % STOP_NAMES.length];
    const d = dirOf(u, v), r = rightOf(d), mx = (NP[u].x + NP[v].x) / 2, mz = (NP[u].z + NP[v].z) / 2;
    const dc = Math.hypot(mx, mz), rev = STOPS.some(s => s.key === key);
    STOPS.push({
      id: STOPS.length, key, name: nameOf[key] + (rev ? ' 건너편' : ''), u, v, dir: d, right: r, mid: { x: mx, z: mz },
      lane: { x: mx + r.x * OFF, z: mz + r.z * OFF }, curb: { x: mx + r.x * (ROAD / 2 + 1.6), z: mz + r.z * (ROAD / 2 + 1.6) },
      pop: 0.06 + 0.16 * Math.exp(-dc / 170) + srnd() * 0.04, waiting: Math.floor(srnd() * 6)
    });
    return Math.hypot(mx, mz) < 135;
  };
  const edges = [];
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN - 1; i++) if ((i + 2 * j) % 4 === 1) edges.push([nid(i, j), nid(i + 1, j), (i + j) % 2]);
  for (let i = 0; i < GN; i++) for (let j = 0; j < GN - 1; j++) if ((2 * i + j) % 4 === 2) edges.push([nid(i, j), nid(i, j + 1), (i + j) % 2]);
  for (const [a, b, f] of edges) { const central = add(f ? a : b, f ? b : a); if (central) add(f ? b : a, f ? a : b); }
})();

// ===== 경로 탐색 (U턴 금지 BFS) : b에서 c까지 노드 목록 =====
function connect(a, b, c, d) {
  if (b === c && a !== d) return [b];
  const key = (n, p) => n * 64 + p, q = [[b, a]], par = new Map([[key(b, a), null]]);
  for (let qi = 0; qi < q.length; qi++) {
    const [n, p] = q[qi];
    for (const w of neighbors(n)) {
      if (w === p) continue; const k = key(w, n); if (par.has(k)) continue;
      par.set(k, [n, p]);
      if (w === c && n !== d) { const out = []; let st = [w, n]; while (st) { out.push(st[0]); st = par.get(key(st[0], st[1])); } return out.reverse(); }
      q.push([w, n]);
    }
  }
  return [b];
}
function routeEdges(stopIds) {
  const E = [], stopAt = {};
  for (let i = 0; i < stopIds.length; i++) {
    const s = STOPS[stopIds[i]], t = STOPS[stopIds[(i + 1) % stopIds.length]];
    stopAt[E.length] = s.id; E.push([s.u, s.v]);
    const nodes = connect(s.u, s.v, t.u, t.v);
    for (let k = 0; k < nodes.length - 1; k++) E.push([nodes[k], nodes[k + 1]]);
  }
  return { E, stopAt };
}
function rectLoop(i0, j0, i1, j1, ccw) {
  const nodes = [];
  for (let i = i0; i < i1; i++) nodes.push(nid(i, j0));
  for (let j = j0; j < j1; j++) nodes.push(nid(i1, j));
  for (let i = i1; i > i0; i--) nodes.push(nid(i, j1));
  for (let j = j1; j > j0; j--) nodes.push(nid(i0, j));
  if (ccw) nodes.reverse();
  return nodes.map((n, k) => [n, nodes[(k + 1) % nodes.length]]);
}

// ===== 경로(차선 중심선) 생성 =====
function buildPath(E, stopAt) {
  const K = E.length, P = [], corners = [], stopIdx = [];
  const push = (x, z) => P.push({ x, z });
  const stopPts = k => {   // 정류장 구간: 연석 쪽으로 붙는 구간 삽입
    const [u, v] = E[k], d = dirOf(u, v), r = rightOf(d), mx = (NP[u].x + NP[v].x) / 2, mz = (NP[u].z + NP[v].z) / 2;
    for (let t = -18; t <= 18; t += 6) {
      const o = OFF + 2.4 * (0.5 + 0.5 * Math.cos(Math.PI * t / 18));
      if (t === 0) stopIdx.push({ id: stopAt[k], idx: P.length });
      push(mx + d.x * t + r.x * o, mz + d.z * t + r.z * o);
    }
  };
  for (let k = 0; k < K; k++) {
    const [u, v] = E[k], w = E[(k + 1) % K][1], din = dirOf(u, v), dout = dirOf(v, w), rin = rightOf(din), rout = rightOf(dout), n = NP[v];
    const sx = n.x + rin.x * OFF - din.x * RC, sz = n.z + rin.z * OFF - din.z * RC, ex = n.x + rout.x * OFF + dout.x * RC, ez = n.z + rout.z * OFF + dout.z * RC;
    const turn = Math.abs(din.x * dout.z - din.z * dout.x) > 0.5, i0 = P.length;
    if (!turn) { push(sx, sz); push(ex, ez); }
    else {
      const cx = n.x + (rin.x + rout.x) * OFF, cz = n.z + (rin.z + rout.z) * OFF;
      for (let t = 0; t <= 12; t++) { const a = t / 12, b = 1 - a; push(b * b * sx + 2 * b * a * cx + a * a * ex, b * b * sz + 2 * b * a * cz + a * a * ez); }
    }
    corners.push({ i0, i1: P.length - 1, turn, axis: din.x !== 0 ? 0 : 1, node: v, right: turn ? (din.x * dout.z - din.z * dout.x) : 0 });
    const nk = (k + 1) % K; if (stopAt[nk] !== undefined) stopPts(nk);
  }
  P.push({ x: P[0].x, z: P[0].z });
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  for (const c of corners) { c.s0 = cum[c.i0]; c.s1 = cum[c.i1]; }
  const stops = stopIdx.map(o => ({ id: o.id, s: cum[o.idx] })).sort((a, b) => a.s - b.s);
  return { pts: P, cum, L: cum[cum.length - 1], corners, stops };
}
function pathAt(p, s, out) {
  const L = p.L; s = ((s % L) + L) % L;
  let lo = 0, hi = p.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] <= s) lo = m; else hi = m; }
  const a = p.pts[lo], b = p.pts[hi], d = (p.cum[hi] - p.cum[lo]) || 1, t = (s - p.cum[lo]) / d;
  out = out || {}; out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.tx = (b.x - a.x) / d; out.tz = (b.z - a.z) / d; return out;
}
const _pp = {};
function projectPath(p, x, z, hint, win) {   // 경로 위 가장 가까운 호장
  let best = 1e18, bs = 0;
  const from = hint === undefined ? 0 : hint - win, to = hint === undefined ? p.L : hint + win, step = hint === undefined ? 3 : 1.2;
  for (let s = from; s <= to; s += step) { pathAt(p, s, _pp); const d = (x - _pp.x) ** 2 + (z - _pp.z) ** 2; if (d < best) { best = d; bs = s; } }
  return { s: ((bs % p.L) + p.L) % p.L, d: Math.sqrt(best) };
}
const wrapS = (d, L) => { d = ((d % L) + L) % L; return d > L / 2 ? d - L : d; };

// ===== 신호등 (전 교차로 동기화) =====
const LIGHT_C = 26;
function lightState(axis, gt) { const p = gt % LIGHT_C; return axis === 0 ? (p < 10 ? 0 : p < 12 ? 1 : 2) : (p < 13 ? 2 : p < 23 ? 0 : p < 25 ? 1 : 2); }   // 0초록 1노랑 2빨강
