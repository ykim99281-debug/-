'use strict';
// ===== 렌더러 · 씬 =====
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false;
$('gl').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 320, 1800);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 9000);
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x55663f, 0.64); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 0.8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 600 });
scene.add(sun, sun.target);

const world = { blocks: [] };
function disposeTree(root) {   // GPU 자원 해제 (공유 자원은 건드리지 않음)
  root.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.isInstancedMesh && o.dispose) o.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (m.userData.shared) continue; if ((o.isSprite || m.userData.ownsMap) && m.map) m.map.dispose(); m.dispose(); }
  });
}
const _dummy = new THREE.Object3D(), _col = new THREE.Color();
const mk = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
function canvasTex(w, h, fn, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), c); const t = new THREE.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; } return t; }
function labelSprite(text, o) {
  o = o || {}; const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = o.bg || 'rgba(12,20,40,.88)'; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 500, 84, 22) : x.rect(6, 6, 500, 84); x.fill();
  x.fillStyle = o.fg || '#fff'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 52);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(o.w || 8, (o.w || 8) * 96 / 512, 1); return s;
}

// ===== 건물 병합 지오메트리 =====
function winTex() {
  const S = 64, N = 4;
  const map = canvasTex(S * N, S * N, x => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, S * N, S * N);
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      x.fillStyle = '#3b4f68'; x.fillRect(gx * S + 10, gy * S + 12, S - 20, S - 24);
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(gx * S + 10, gy * S + 12, S - 20, 8);
    }
  });
  const rr = mulberry(7);
  const em = canvasTex(S * N, S * N, x => {
    x.fillStyle = '#000'; x.fillRect(0, 0, S * N, S * N);
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) if (rr() < 0.5) { x.fillStyle = rr() < .8 ? '#ffd98a' : '#bfe3ff'; x.fillRect(gx * S + 10, gy * S + 12, S - 20, S - 24); }
  });
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, em };
}
class Merge {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  quad(a, b, c, d, nx, ny, nz, uvs, col) {
    const base = this.p.length / 3;
    for (const v of [a, b, c, d]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.u.push(...uvs); this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  box(cx, cz, w, d, h, col, roof, y0) {
    y0 = y0 === undefined ? 0.3 : y0; const y1 = y0 + h, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const uw = w / 16, ud = d / 16, uh = h / 14.4, C = new THREE.Color(col), R = new THREE.Color(roof === undefined ? 0x555a63 : roof);
    const side = (ax, az, bx, bz, nx, nz, uu) => this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], nx, 0, nz, [0, 0, uu, 0, uu, uh, 0, uh], C);
    side(x0, z1, x1, z1, 0, 1, uw); side(x1, z0, x0, z0, 0, -1, uw); side(x1, z1, x1, z0, 1, 0, ud); side(x0, z0, x0, z1, -1, 0, ud);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0, [.01, .01, .01, .01, .01, .01, .01, .01], R);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
}
const BUILD_COL = [0xd9d3c7, 0xc9d3df, 0xe6dccb, 0xbfc9c4, 0xd8c3b5, 0xcdd5e0, 0xe0e0e6, 0xb7c4d6];
const ROOF_COL = [0x4a4f58, 0x5a4a44, 0x3e4a55, 0x6b5a4f];
const HOUSE_COL = [0xf0d9b5, 0xe8c8c0, 0xcfe0c8, 0xf4ecd0, 0xd7d0e8, 0xeadcc0];
const HOUSE_ROOF = [0xa83c32, 0x7a4a3a, 0x4a5a6e, 0x6b6f2e];

const CHUNK = 240; world.chunks = [];
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
const chunkKey = (x, z) => Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
function regChunk(obj, key) { const [a, b] = key.split(',').map(Number); world.chunks.push({ obj, x: (a + 0.5) * CHUNK, z: (b + 0.5) * CHUNK, r: CHUNK * 0.72 + 50 }); }
function cullChunks(R, useFrustum) {
  const cx = camera.position.x, cz = camera.position.z; camera.updateMatrixWorld(); _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const c of world.chunks) {
    const d = Math.hypot(cx - c.x, cz - c.z); if (d > R + c.r) { c.obj.visible = false; continue; }
    if (!useFrustum || d < 200 + c.r) { c.obj.visible = true; continue; }   // 가까운 구역은 항상 (그림자 때문)
    _sp.center.set(c.x, 20, c.z); _sp.radius = c.r + 40; c.obj.visible = _fr.intersectsSphere(_sp);
  }
}
function inst(geo, mat, list, shadow) {   // 구역별로 나눠 만들어 먼 구역은 그리지 않음
  const by = new Map(); for (const o of list) { const k = chunkKey(o.x, o.z); if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
  const out = []; for (const [k, l] of by) { const m = instChunk(geo, mat, l, shadow); regChunk(m, k); out.push(m); } return out;
}
function instChunk(geo, mat, list, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((o, i) => {
    _dummy.position.set(o.x, o.y || 0, o.z); _dummy.rotation.set(0, o.ry || 0, 0); _dummy.scale.set(o.sx === undefined ? 1 : o.sx, o.sy === undefined ? 1 : o.sy, o.sz === undefined ? 1 : o.sz);
    _dummy.updateMatrix(); m.setMatrixAt(i, _dummy.matrix); if (o.col !== undefined) m.setColorAt(i, _col.set(o.col));
  });
  m.count = list.length; m.castShadow = !!shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m;
}

let lampMat, sigMats = [], windowMat, nightK = 0;
const lampList = [], treeList = [];

function buildCity() {
  // 지면
  const gt = canvasTex(256, 256, x => { x.fillStyle = '#4a8f46'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 3500; i++) { x.fillStyle = `hsl(${95 + Math.random() * 30},${35 + Math.random() * 20}%,${28 + Math.random() * 14}%)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3); } }, 460);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshLambertMaterial({ map: gt }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.6; grass.receiveShadow = true; scene.add(grass);
  const at = canvasTex(128, 128, x => { x.fillStyle = '#34373f'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 1400; i++) { const v = 40 + Math.random() * 30; x.fillStyle = `rgb(${v},${v + 2},${v + 8})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }, 70);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2, EXT * 2), new THREE.MeshLambertMaterial({ map: at }));
  world.roadMat = road.material; road.rotation.x = -Math.PI / 2; road.position.y = 0.0; road.receiveShadow = true; scene.add(road);

  // 블록(보도 슬랩) + 건물
  const wt = winTex();
  windowMat = new THREE.MeshLambertMaterial({ map: wt.map, emissiveMap: wt.em, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, side: THREE.DoubleSide });
  const cityM = new Map(), city = { box(x, z, ...a) { const k = chunkKey(x, z); let m = cityM.get(k); if (!m) { m = new Merge(); cityM.set(k, m); } m.box(x, z, ...a); } }, slabs = [], R = srnd, BW = SP - ROAD;
  const CB0 = (GN - 2) / 2, bk = (x, z) => clamp(Math.round(x * FS / SP + CB0), 0, GN - 2) + ',' + clamp(Math.round(z * FS / SP + CB0), 0, GN - 2);
  const K = { wc: bk(-360, 280), bb: bk(120, -120), c1: bk(200, -280), c2: bk(200, -40), st: bk(-360, -120), s1: bk(-280, 200), s2: bk(-200, 200), s3: bk(-200, 280) }, riverBj = Math.round(120 * FS / SP + CB0); world.riverRow = riverBj;
  const parks = {}; for (const [x, z] of [[200, -200], [-360, -360], [40, -360], [-360, 40], [280, 40], [40, 280], [-280, -120]]) parks[bk(x, z)] = 1;
  const specialKeys = new Set(Object.values(K));
  for (let bj = 0; bj < GN - 1; bj++) for (let bi = 0; bi < GN - 1; bi++) {
    const CB = (GN - 2) / 2, cx = (bi - CB) * SP, cz = (bj - CB) * SP, dc = Math.max(Math.abs(bi - CB), Math.abs(bj - CB)), key = bi + ',' + bj;
    const park = parks[key] || (!specialKeys.has(key) && bj !== riverBj && R() < 0.05 && Math.max(Math.abs(bi - CB), Math.abs(bj - CB)) > 3), depot = key === (GN - 2) + ',' + (GN - 2);
    slabs.push({ x: cx, y: 0.15, z: cz, sx: BW, sz: BW, col: park ? 0x5aa45a : depot ? 0x6b6f78 : 0x9fa2a9 });
    world.blocks.push({ minx: cx - BW / 2, maxx: cx + BW / 2, minz: cz - BW / 2, maxz: cz + BW / 2 });
    const sp = key === K.wc ? 'wc' : key === K.bb ? 'bb' : (key === K.c1 || key === K.c2) ? 'campus' : key === K.st ? 'station' : (key === K.s1 || key === K.s2 || key === K.s3) ? 'sangmu' : '';
    if (bj === riverBj) {   // 광주천
      slabs[slabs.length - 1].col = 0x2f7fc2; slabs[slabs.length - 1].y = 0.05;
      if (bi % 2 === 0) for (let t = 0; t < 3; t++) treeList.push({ x: cx + (R() - .5) * 50, z: cz + (R() > .5 ? 1 : -1) * 26, s: .7 + R() * .4 });
    } else if (sp === 'wc' || sp === 'bb') {
      const rr = sp === 'wc' ? 26 : 19, st = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr - 3, sp === 'wc' ? 13 : 10, 32, 1, true), mk(sp === 'wc' ? 0xd7dae0 : 0xc2c8d2, { side: THREE.DoubleSide })); st.position.set(cx, 6.5, cz); st.castShadow = true; scene.add(st);
      const roof = new THREE.Mesh(new THREE.TorusGeometry(rr - 1, 1.4, 6, 32), mk(0x8d93a0)); roof.rotation.x = Math.PI / 2; roof.position.set(cx, sp === 'wc' ? 13 : 10, cz); scene.add(roof);
      const pitch = new THREE.Mesh(new THREE.CylinderGeometry(rr - 6, rr - 6, 0.2, 28), mk(0x3f9a45)); pitch.position.set(cx, 0.4, cz); scene.add(pitch);
    } else if (sp === 'campus') {
      slabs[slabs.length - 1].col = 0x6fb36f;
      for (const [ox, oz, w, d, h] of [[-16, -16, 18, 12, 14], [14, -18, 14, 14, 18], [-18, 14, 12, 16, 12], [16, 16, 18, 12, 16]]) city.box(cx + ox, cz + oz, w, d, h, 0xd8c9b0, 0x7a4a3a);
      for (let t = 0; t < 14; t++) treeList.push({ x: cx + (R() - .5) * 52, z: cz + (R() - .5) * 52, s: 1 + R() * .6 });
    } else if (sp === 'station') {
      city.box(cx, cz, 50, 14, 9, 0xcfd5dd, 0x5b6676); city.box(cx, cz + 22, 54, 5, 2.5, 0x9aa1ad, 0x6b7280); slabs[slabs.length - 1].col = 0x8d9097;
    } else if (sp === 'sangmu') {
      for (const [ox, oz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) city.box(cx + ox, cz + oz, 16 + R() * 5, 16 + R() * 5, 40 + R() * 45, BUILD_COL[Math.floor(R() * BUILD_COL.length)], ROOF_COL[Math.floor(R() * 4)]);
    } else if (park) {
      for (let t = 0; t < 22; t++) treeList.push({ x: cx + (R() - .5) * 52, z: cz + (R() - .5) * 52, s: 1 + R() * .9 });
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.1, 28), new THREE.MeshLambertMaterial({ color: 0x3f8fd0 })); pond.position.set(cx + 6, 0.33, cz - 4); scene.add(pond);
    } else if (depot) {
      city.box(cx - 6, cz - 18, 46, 18, 8, 0xc9ccd4, 0x777d88);
      const sg = labelSprite('버스 차고지', { w: 16, bg: 'rgba(255,176,32,.95)', fg: '#1a1200' }); sg.position.set(cx - 6, 11, cz - 8); scene.add(sg);
      const bm = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0x14b8a6];
      bm.forEach((c, i) => { const g = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3, 12), mk(c)); g.position.set(cx - 22 + i * 6.5, 1.8, cz + 8); g.castShadow = true; scene.add(g); });
    } else if (dc < 2 * FS) {   // 도심: 고층
      for (const [ox, oz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
        const w = 15 + R() * 6, d = 15 + R() * 6, h = 38 + R() * 62;
        city.box(cx + ox, cz + oz, w, d, h, BUILD_COL[Math.floor(R() * BUILD_COL.length)], ROOF_COL[Math.floor(R() * 4)]);
        if (bi === Math.floor(CB) && bj === Math.floor(CB) && ox < 0 && oz < 0) world.hq = { x: cx + ox, z: cz + oz, h: h + 0.3 };
      }
    } else if (dc < 3.6 * FS) {   // 중간
      for (const [ox, oz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
        const w = 17 + R() * 5, d = 17 + R() * 5, h = 14 + R() * 18;
        city.box(cx + ox, cz + oz, w, d, h, BUILD_COL[Math.floor(R() * BUILD_COL.length)], ROOF_COL[Math.floor(R() * 4)]);
      }
    } else {   // 주택가
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const w = 11 + R() * 3, d = 11 + R() * 3, h = 5 + R() * 5;
        city.box(cx + (a - 1) * 17, cz + (b - 1) * 17, w, d, h, HOUSE_COL[Math.floor(R() * HOUSE_COL.length)], HOUSE_ROOF[Math.floor(R() * 4)]);
        if (R() < 0.5) treeList.push({ x: cx + (a - 1) * 17 + 8, z: cz + (b - 1) * 17 + 8, s: .8 + R() * .5 });
      }
    }
    // 가로수 · 가로등 (블록 둘레)
    for (let side = 0; side < 4; side++) for (let t = -24; t <= 24; t += 12) {
      const ax = side < 2 ? 1 : 0, sgn = side % 2 ? 1 : -1, off = 30;
      const px = ax ? cx + t : cx + sgn * off, pz = ax ? cz + sgn * off : cz + t;
      if (Math.abs(t) === 24 && false) continue;
      if (t % 24 === 0) lampList.push({ x: px, z: pz, dx: ax ? 0 : sgn, dz: ax ? sgn : 0 });
      else if (!park) treeList.push({ x: px, z: pz, s: .8 + R() * .3, street: 1 });
    }
  }
  for (const [k, m] of cityM) { const me = m.mesh(windowMat); scene.add(me); regChunk(me, k); }
  // 외곽 보도
  const ow = 10, ol = EXT * 2 + 20;
  for (const [x, z, sx, sz] of [[-EXT - ow / 2, 0, ow, ol], [EXT + ow / 2, 0, ow, ol], [0, -EXT - ow / 2, ol, ow], [0, EXT + ow / 2, ol, ow]]) slabs.push({ x, y: 0.15, z, sx, sz, col: 0x9fa2a9 });
  world.blocks.push({ minx: -EXT - 500, maxx: -EXT, minz: -900, maxz: 900 }, { minx: EXT, maxx: EXT + 500, minz: -900, maxz: 900 }, { minx: -900, maxx: 900, minz: -EXT - 500, maxz: -EXT }, { minx: -900, maxx: 900, minz: EXT, maxz: EXT + 500 });
  inst(new THREE.BoxGeometry(1, 0.3, 1), mk(0xffffff), slabs);

  // 도로 표식
  const yel = [], whi = [];
  const edgeLine = (a, b) => {
    const A = NP[a], B = NP[b], hz = A.z === B.z, len = SP - 2 * RC, mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    const P = (o, w, arr) => arr.push(hz ? { x: mx, y: 0.06, z: mz + o, sx: len, sy: 1, sz: w } : { x: mx + o, y: 0.06, z: mz, sx: w, sy: 1, sz: len });
    P(-0.18, .12, yel); P(0.18, .12, yel); P(-7.5, .15, whi); P(7.5, .15, whi);
    for (let t = -22; t <= 22; t += 11) { const q = hz ? { x: mx + t, y: 0.06, z: mz + OFF * 0, sx: 3, sy: 1, sz: .0 } : 0; }
  };
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const n = nid(i, j); if (i < GN - 1) edgeLine(n, n + 1); if (j < GN - 1) edgeLine(n, n + GN); }
  for (const n of NP) for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
    const nx = n.i + d.x, nz = n.j + d.z; if (nx < 0 || nz < 0 || nx >= GN || nz >= GN) continue;
    const ax = d.x !== 0;
    for (let t = -6.8; t <= 6.9; t += 1.35) whi.push({ x: n.x + d.x * 11 + (ax ? 0 : t), y: 0.06, z: n.z + d.z * 11 + (ax ? t : 0), sx: ax ? 3 : .65, sy: 1, sz: ax ? .65 : 3 });
    const r = rightOf({ x: -d.x, z: -d.z });   // 이 팔로 들어오는 차량의 오른쪽 차선
    whi.push({ x: n.x + d.x * 13.6 + r.x * 4.1, y: 0.06, z: n.z + d.z * 13.6 + r.z * 4.1, sx: ax ? .5 : 7.6, sy: 1, sz: ax ? 7.6 : .5 });
  }
  const ml = new THREE.BoxGeometry(1, 0.02, 1);
  inst(ml, new THREE.MeshLambertMaterial({ color: 0xf5c518 }), yel); inst(ml, new THREE.MeshLambertMaterial({ color: 0xeeeeee }), whi);

  // 가로등
  lampMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
  inst(new THREE.CylinderGeometry(0.12, 0.16, 8, 6), mk(0x4a4f58), lampList.map(l => ({ x: l.x, y: 4.15, z: l.z })), true);
  inst(new THREE.BoxGeometry(0.5, 0.2, 1.4), lampMat, lampList.map(l => ({ x: l.x + l.dx * 1.2, y: 8.1, z: l.z + l.dz * 1.2, ry: l.dx ? Math.PI / 2 : 0 })));

  // 신호등 (모서리 4개 × 노드)
  const poles = [], sigData = [[], []];
  for (const n of NP) for (const [sx, sz, axis, fx, fz] of [[-1, 1, 0, -1, 0], [1, -1, 0, 1, 0], [-1, -1, 1, 0, -1], [1, 1, 1, 0, 1]]) {
    const px = n.x + sx * 9.3, pz = n.z + sz * 9.3;
    poles.push({ x: px, y: 3, z: pz }); sigData[axis].push({ x: px + fx * 0.3, z: pz + fz * 0.3 });
  }
  inst(new THREE.CylinderGeometry(0.1, 0.13, 6, 6), mk(0x3b4048), poles, true);
  inst(new THREE.BoxGeometry(0.5, 1.5, 0.5), mk(0x15171c), poles.map(p => ({ x: p.x, y: 5.6, z: p.z })));
  const lg = new THREE.SphereGeometry(0.17, 6, 4);
  for (let ax = 0; ax < 2; ax++) { sigMats[ax] = []; for (let c = 0; c < 3; c++) { const m = new THREE.MeshBasicMaterial({ color: 0x222222 }); sigMats[ax][c] = m; inst(lg, m, sigData[ax].map(p => ({ x: p.x + (ax === 0 ? 0 : 0), y: 6.05 - c * 0.45, z: p.z }))); } }

  // 나무
  const far = []; for (let i = 0; i < 260; i++) { const a = rand(0, 6.28), r = EXT + 25 + Math.random() * 330; far.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1 + Math.random() * 1.2 }); }
  const all = treeList.concat(far);
  inst(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 5), mk(0x6b4423), all.map(t => ({ x: t.x, y: 0.3 + 1.1 * t.s, z: t.z, sx: t.s, sy: t.s, sz: t.s })), true);
  inst(new THREE.ConeGeometry(2.2, 6, 6), mk(0xffffff), all.map((t, i) => ({ x: t.x, y: 0.3 + 5 * t.s, z: t.z, sx: t.s, sy: t.s, sz: t.s, col: new THREE.Color().setHSL(0.27 + (i % 7) * .015, 0.5, 0.26 + (i % 5) * .02).getHex() })), true);

  // 먼 산 · 구름
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, r = EXT + 430 + (i % 3) * 50, h = 90 + (i * 37 % 90); const m = new THREE.Mesh(new THREE.ConeGeometry(110 + (i % 4) * 25, h, 6), mk(0x6d7b92, { flatShading: true })); m.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r); scene.add(m); }
  world.clouds = [];
  for (let i = 0; i < 14; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false })); s.position.set(k * 14, Math.random() * 4, Math.random() * 8); s.scale.y = .55; g.add(s); } g.position.set(rand(-EXT - 300, EXT + 300), rand(110, 170), rand(-EXT - 300, EXT + 300)); scene.add(g); world.clouds.push(g); }
  // 광주 구역 이름표 · 무등산
  for (const [n, x, z] of DISTRICTS) { const s = labelSprite(n, { w: 34, bg: 'rgba(20,70,140,.82)' }); s.position.set(x, 70, z); scene.add(s); }
  for (const [x, z, h, r] of [[EXT + 260, 40, 270, 190], [EXT + 340, -90, 220, 150], [EXT + 320, 170, 200, 140]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mk(0x58765f, { flatShading: true })); m.position.set(x, h / 2 - 5, z); scene.add(m); }
  { const s = labelSprite('⛰ 무등산', { w: 44, bg: 'rgba(30,90,60,.85)' }); s.position.set(EXT + 260, 300, 40); scene.add(s); }
  // 본사 간판
  if (world.hq) { world.hqSign = labelSprite('', { w: 30, bg: 'rgba(255,176,32,.95)', fg: '#1a1200' }); world.hqSign.position.set(world.hq.x, world.hq.h + 7, world.hq.z); scene.add(world.hqSign); }
}
function setHQName(name) {
  if (!world.hqSign) return; const old = world.hqSign, p = old.position.clone();
  scene.remove(old); disposeTree(old); world.hqSign = labelSprite('🚌 ' + name, { w: 30, bg: 'rgba(255,176,32,.95)', fg: '#1a1200' }); world.hqSign.position.copy(p); scene.add(world.hqSign);
}

// ===== 정류장 3D =====
const PED_PER = 12, stopViews = [];
let pedBody, pedHead;
function buildStops() {
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd0ee, transparent: true, opacity: .4 }), steel = mk(0x3b4048), blue = mk(0x2563eb); glass.userData.noShadow = true;
  const lists = new Map(), cyl = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6);
  for (const s of STOPS) {
    const yaw = Math.atan2(s.dir.x, s.dir.z), sy = Math.sin(yaw), cy = Math.cos(yaw), ck = chunkKey(s.curb.x, s.curb.z); if (!lists.has(ck)) lists.set(ck, []); const list = lists.get(ck);
    const W = (lx, ly, lz) => [s.curb.x + lx * cy + lz * sy, 0.3 + ly, s.curb.z - lx * sy + lz * cy];   // 로컬 → 월드
    const B = (mat, lx, ly, lz, w, h, d) => { const [x, y, z] = W(lx, ly, lz); pbox(list, mat, x, y, z, w, h, d, 0, yaw, 0); };
    B(glass, -1.4, 1.25, 0, 0.12, 2.5, 4); B(steel, -0.5, 2.55, 0, 2.2, 0.15, 4.4); for (const z of [-2, 2]) B(steel, -1.4, 1.25, z, 0.12, 2.5, 0.12);
    B(blue, -1.0, 0.6, 0, 0.8, 0.12, 2.6); { const [x, y, z] = W(0.3, 1.8, 3.2); part(list, cyl, steel, x, y, z); } B(blue, 0.3, 3.4, 3.2, 0.12, 0.9, 0.9);
    const sp = labelSprite(s.name, { w: 7 }); sp.position.set(s.curb.x, 5.5, s.curb.z); scene.add(sp); stopViews.push({ sp, x: s.curb.x, z: s.curb.z });
  }
  for (const [k, list] of lists) { const gr = new THREE.Group(); mergeParts(gr, list, null); scene.add(gr); regChunk(gr, k); }
  pedBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 6), mk(0xffffff), STOPS.length * PED_PER);
  pedHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.19, 6, 4), mk(0xf2c9a0), STOPS.length * PED_PER);
  pedBody.castShadow = true; scene.add(pedBody, pedHead);
  STOPS.forEach((s, i) => { for (let k = 0; k < PED_PER; k++) pedBody.setColorAt(i * PED_PER + k, _col.setHSL(((i * 7 + k * 13) % 36) / 36, .5, .5)); });
  updatePeds();
}
function updatePeds() {
  const cp = camera.position; for (const v of stopViews) v.sp.visible = Math.hypot(v.x - cp.x, v.z - cp.z) < 420;
  let n = 0;
  STOPS.forEach((s, i) => {
    if (Math.hypot(s.curb.x - cp.x, s.curb.z - cp.z) > 500) return;   // 멀리 있는 정류장의 보행자는 그리지 않음
    const vis = Math.min(PED_PER, Math.ceil(s.waiting / 2.5));
    for (let k = 0; k < vis; k++) {
      const a = (k % 6 - 2.5) * 0.85, b = 0.2 + Math.floor(k / 6) * 0.9 + ((k * 37) % 5) * 0.1;
      const x = s.curb.x + s.dir.x * a - s.right.x * b, z = s.curb.z + s.dir.z * a - s.right.z * b;
      _dummy.position.set(x, 0.85, z); _dummy.scale.set(1, 1, 1); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix(); pedBody.setMatrixAt(n, _dummy.matrix);
      _dummy.position.set(x, 1.5, z); _dummy.updateMatrix(); pedHead.setMatrixAt(n, _dummy.matrix); n++;
    }
  });
  pedBody.count = pedHead.count = n; pedBody.instanceMatrix.needsUpdate = pedHead.instanceMatrix.needsUpdate = true; pedBody.instanceColor.needsUpdate = true;
}

// ===== 신호등 · 낮밤 =====
const SIGC = [[0x22ff66, 0x1a3a22], [0xffd23a, 0x3a3416], [0xff3b3b, 0x3a1818]];
function updateSignals(gt) {
  for (let ax = 0; ax < 2; ax++) { const st = lightState(ax, gt); for (let c = 0; c < 3; c++) sigMats[ax][c].color.setHex(SIGC[c][c === st ? 0 : 1]); }
}
const SKYK = [[0, 0x070c1e], [5, 0x0b1530], [6.3, 0xf29a6b], [7.6, 0x8fd0ff], [17, 0x8fd0ff], [18.3, 0xf0865a], [19.6, 0x0b1530], [24, 0x070c1e]];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function applyTime(h) {
  let i = 0; while (i < SKYK.length - 2 && h > SKYK[i + 1][0]) i++;
  const a = SKYK[i], b = SKYK[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  _c1.setHex(a[1]).lerp(_c2.setHex(b[1]), t); scene.background.copy(_c1); scene.fog.color.copy(_c1);
  const day = clamp((h - 5.8) / 1.8, 0, 1) * clamp((19.6 - h) / 1.8, 0, 1); nightK = 1 - day;
  hemi.intensity = 0.22 + 0.42 * day; sun.intensity = 0.08 + 0.72 * day;
  const el = Math.sin(clamp((h - 6) / 12, 0, 1) * Math.PI);
  world.sunDir = new THREE.Vector3(Math.cos((h - 6) / 12 * Math.PI) * 90, 30 + el * 120, 50);
  sun.color.setHex(day > 0.6 ? 0xfff0d6 : 0xffa060);
  lampMat.color.setHex(nightK > 0.35 ? 0xffe9a8 : 0x777777);
  windowMat.emissiveIntensity = nightK > 0.3 ? nightK : 0; updateBusLights(nightK);
  world.base = { bg: _c1.clone(), hemi: hemi.intensity, sun: sun.intensity }; applyWeatherLook();
}

// ===== 날씨 =====
const WX_T = {
  clear: { n: '맑음', i: '☀', rain: 0, fog: 0, dark: 0, spd: 1, grip: 1, dem: 1 }, cloudy: { n: '흐림', i: '☁', rain: 0, fog: .06, dark: .18, spd: 1, grip: 1, dem: 1.05 },
  rain: { n: '비', i: '🌧', rain: .55, fog: .22, dark: .32, spd: .9, grip: .8, dem: 1.3 }, storm: { n: '폭우', i: '⛈', rain: 1, fog: .38, dark: .55, spd: .78, grip: .62, dem: 1.5 }, fog: { n: '안개', i: '🌫', rain: 0, fog: .85, dark: .22, spd: .8, grip: .95, dem: 1 }
};
const WX = { type: 'clear', rainK: 0, fogK: 0, dark: 0, spd: 1, grip: 1, dem: 1, flash: 0, thunderT: 8, lock: false };
let rainMesh = null; const RAIN_N = 1600;
function initWeather() {
  const pos = new Float32Array(RAIN_N * 6); for (let i = 0; i < RAIN_N; i++) { const x = rand(-45, 45), y = rand(0, 40), z = rand(-45, 45); pos.set([x, y, z, x + 0.18, y - 1.4, z + 0.06], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0, fog: false, depthWrite: false })); rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
}
function setWeather(t) { if (WX_T[t]) WX.type = t; }
function applyWeatherLook() {
  const b = world.base; if (!b) return; const gray = _c2.setHex(0x8b929c).multiplyScalar(0.3 + 0.7 * (1 - nightK));
  scene.background.copy(b.bg).lerp(gray, clamp(WX.dark * 1.2 + WX.fogK * 0.5, 0, 0.85)); scene.fog.color.copy(scene.background);
  hemi.intensity = b.hemi * (1 - 0.28 * WX.dark) + WX.flash * 1.4; sun.intensity = b.sun * (1 - 0.85 * WX.dark);
}
function updateWeather(dt) {
  const T = WX_T[WX.type], e = Math.min(1, dt * 0.35);
  WX.rainK += (T.rain - WX.rainK) * e; WX.fogK += (T.fog - WX.fogK) * e; WX.dark += (T.dark - WX.dark) * e; WX.spd += (T.spd - WX.spd) * e; WX.grip += (T.grip - WX.grip) * e; WX.dem += (T.dem - WX.dem) * e;
  if (WX.type === 'storm') { WX.thunderT -= dt; if (WX.thunderT < 0) { WX.thunderT = rand(7, 16); WX.flash = 1; setTimeout(() => sfx('thunder'), rand(400, 1600)); } }
  WX.flash = Math.max(0, WX.flash - dt * 3); if (world.roadMat) world.roadMat.color.setScalar(1 - 0.4 * WX.rainK);
  if (rainMesh) {
    const vis = WX.rainK > 0.03 && camera.position.y < 80; rainMesh.visible = vis;
    if (vis) {
      rainMesh.material.opacity = 0.16 + 0.34 * WX.rainK; rainMesh.position.set(camera.position.x, 0, camera.position.z);
      const a = rainMesh.geometry.attributes.position.array, fall = (30 + 22 * WX.rainK) * dt, n = Math.floor(RAIN_N * (0.35 + 0.65 * WX.rainK));
      for (let i = 0; i < RAIN_N; i++) { const o = i * 6; if (i >= n) { a[o + 1] = a[o + 4] = -50; continue; } a[o + 1] -= fall; a[o + 4] -= fall; a[o] -= 0.12 * fall * 0.3; a[o + 3] -= 0.12 * fall * 0.3; if (a[o + 1] < 0) { const x = rand(-45, 45), z = rand(-45, 45), y = 40 + rand(0, 4); a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x + 0.18; a[o + 4] = y - 1.4; a[o + 5] = z + 0.06; } }
      rainMesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  if (typeof rainAudio === 'function') rainAudio(WX.rainK);
  applyWeatherLook();
}
