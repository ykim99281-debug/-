// 편의점 사장 키우기 — 3D 월드 (three.js, 에셋 없이 전부 코드로 생성)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .75, metalness: 0 }, o));
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m); return m;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---------- 텍스처 ----------
function signTexture(bg, text, sub, accent) {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#fff'; g.font = '900 78px "Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w * .42, h * .52);
    g.font = '700 30px sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(sub, w * .86, h * .52);
  });
}
const asphaltTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7b828d'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 105 + Math.random() * 45 | 0; g.fillStyle = `rgb(${v},${v + 3},${v + 8})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, [40, 6]);
const roadTex = () => canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#59606b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { const v = 78 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v + 3},${v + 8})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#e9d36a'; for (let x = 0; x < w; x += 128) g.fillRect(x + 10, h / 2 - 3, 70, 6);
}, [24, 1]);
const tileTex = (a, b, rep) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
  g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.strokeRect(0, 0, w, h);
}, rep);
function windowTex(seed) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#1c2433'; g.fillRect(0, 0, w, h);
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let y = 8; y < h - 8; y += 22) for (let x = 8; x < w - 8; x += 20) {
      const lit = r() > .45; g.fillStyle = lit ? (r() > .5 ? '#ffe9a8' : '#bfe2ff') : '#2a3347'; g.fillRect(x, y, 12, 14);
    }
  });
}

// ---------- 사람 ----------
const SKIN = ['#f1c7a1', '#e0ac82', '#c68a5f', '#8d5b3b', '#f5d6bd'];
const HAIR = ['#1b1b1f', '#3b2a1e', '#6b4a2b', '#a8782e', '#d8d8dc', '#7a2d2d'];
const SHIRT = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#34495e', '#ff6b9d', '#2ecc71'];
const PANTS = ['#2c3e50', '#34495e', '#5d4e37', '#1f2937', '#445a7a'];
function person(o = {}) {
  const sc = o.scale || 1, g = new THREE.Group(), U = {};
  const skin = M(o.skin || pick(SKIN)), shirt = M(o.shirt || pick(SHIRT), { roughness: .6 }), pants = M(o.pants || pick(PANTS));
  U.legL = new THREE.Group(); U.legR = new THREE.Group();
  [U.legL, U.legR].forEach((l, i) => { l.position.set(i ? .1 : -.1, .56, 0); add(l, BOX(.15, .56, .17), pants, 0, -.28, 0); add(l, BOX(.17, .1, .26), M('#222'), 0, -.55, .03); g.add(l); });
  const body = add(g, new THREE.CapsuleGeometry(.2, .36, 4, 12), shirt, 0, .96, 0);
  U.body = body;
  U.armL = new THREE.Group(); U.armR = new THREE.Group();
  [U.armL, U.armR].forEach((a, i) => { a.position.set(i ? .27 : -.27, 1.2, 0); add(a, new THREE.CapsuleGeometry(.065, .3, 3, 8), shirt, 0, -.2, 0); add(a, new THREE.SphereGeometry(.065, 8, 8), skin, 0, -.42, 0); g.add(a); });
  U.head = new THREE.Group(); U.head.position.y = 1.5; g.add(U.head);
  add(U.head, new THREE.SphereGeometry(.18, 16, 14), skin, 0, 0, 0);
  const hair = M(o.hair || pick(HAIR), { roughness: .9 });
  add(U.head, new THREE.SphereGeometry(.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * .5), hair, 0, .02, -.01);
  const eye = M('#111');
  add(U.head, new THREE.SphereGeometry(.022, 6, 6), eye, -.065, .01, .165, false); add(U.head, new THREE.SphereGeometry(.022, 6, 6), eye, .065, .01, .165, false);
  const k = o.kind;
  if (k === 'cap' || k === 'barista') { add(U.head, new THREE.CylinderGeometry(.19, .2, .1, 14), M(o.cap || '#16a34a'), 0, .13, 0); add(U.head, BOX(.2, .03, .16), M(o.cap || '#16a34a'), 0, .09, .2); }
  if (k === 'hard') { add(U.head, new THREE.SphereGeometry(.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5), M('#ffb020'), 0, .06, 0); }
  if (k === 'manager') { add(g, BOX(.07, .3, .02), M('#c0392b'), 0, 1.0, .2); }
  if (k === 'apron') { add(g, BOX(.34, .42, .03), M(o.apron || '#6b4226'), 0, .88, .19); }
  if (k === 'vest') { add(g, BOX(.43, .36, .02), M('#ff7a00', { emissive: '#ff5500', emissiveIntensity: .25 }), 0, 1.0, .19); }
  if (k === 'hood') { add(U.head, new THREE.SphereGeometry(.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * .62), M('#222a38'), 0, .0, -.02); }
  g.scale.setScalar(sc); g.userData = U;
  return g;
}
function robot() {
  const g = new THREE.Group(), U = {}, white = M('#f4f6fb', { roughness: .25, metalness: .4 });
  U.legL = new THREE.Group(); U.legR = new THREE.Group();
  [U.legL, U.legR].forEach((l, i) => { l.position.set(i ? .14 : -.14, .5, 0); add(l, BOX(.14, .5, .16), M('#9aa4b5', { metalness: .6, roughness: .3 }), 0, -.25, 0); g.add(l); });
  U.body = add(g, BOX(.6, .62, .4), white, 0, .88, 0);
  add(g, BOX(.34, .24, .02), M('#0a1020', { emissive: '#22d3ee', emissiveIntensity: 1.4 }), 0, .9, .21, false);
  U.armL = new THREE.Group(); U.armR = new THREE.Group();
  [U.armL, U.armR].forEach((a, i) => { a.position.set(i ? .4 : -.4, 1.1, 0); add(a, BOX(.12, .5, .12), white, 0, -.25, 0); g.add(a); });
  U.head = new THREE.Group(); U.head.position.y = 1.42; g.add(U.head);
  add(U.head, BOX(.42, .32, .34), white, 0, 0, 0);
  add(U.head, BOX(.3, .1, .02), M('#001a24', { emissive: '#22d3ee', emissiveIntensity: 2.2 }), 0, .02, .18, false);
  add(U.head, new THREE.CylinderGeometry(.015, .015, .16), M('#889'), 0, .24, 0); add(U.head, new THREE.SphereGeometry(.04, 8, 8), M('#f43f5e', { emissive: '#f43f5e', emissiveIntensity: 2 }), 0, .33, 0, false);
  g.userData = U; return g;
}
function swing(p, t, speed, amp) {
  const U = p.userData; if (!U.legL) return;
  const s = Math.sin(t * speed) * amp;
  U.legL.rotation.x = s; U.legR.rotation.x = -s; U.armL.rotation.x = -s * .8; U.armR.rotation.x = s * .8;
  U.body.position.y = (U.body.userData.y0 ||= U.body.position.y) + Math.abs(Math.cos(t * speed)) * .03 * (amp > .1 ? 1 : 0);
}

// ---------- 월드 ----------
export function createWorld(canvas, view, cb) {
  const dpr0 = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
  const skyCol = new THREE.Color('#8fd0ff'); scene.background = skyCol; scene.fog = new THREE.Fog(skyCol, 45, 130);

  // 조명
  const hemi = new THREE.HemisphereLight('#bfe3ff', '#59606b', .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3d6', 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight('#8fb2ff', 0); moon.position.set(-18, 30, 22); scene.add(moon);
  const warm1 = new THREE.PointLight('#ffd9a0', 0, 12, 1.6); warm1.position.set(-1.6, 3.1, 0.2); scene.add(warm1);
  const warm2 = new THREE.PointLight('#ffe6c0', 0, 12, 1.6); warm2.position.set(2.2, 3.1, -1.0); scene.add(warm2);

  // 후처리
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .65, .82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useFX = true;

  // 하늘: 별/해/달/구름
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff1b0' })); sunDisc.material.fog = false; scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), new THREE.MeshBasicMaterial({ color: '#dfe8ff' })); moonDisc.material.fog = false; scene.add(moonDisc);
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3 + .1, r = 160; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 20); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#fff', size: 1.6, transparent: true, opacity: 0, fog: false, depthWrite: false }); scene.add(new THREE.Points(starGeo, starMat));
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, transparent: true, opacity: .92, emissive: '#fff', emissiveIntensity: .15 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 5; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(3, 6), 10, 8), cloudMat); s.position.set(j * 4 - 8 + rnd(-1, 1), rnd(-1, 1), rnd(-2, 2)); s.scale.y = .55; c.add(s); }
    c.position.set(rnd(-110, 110), rnd(34, 50), rnd(-90, -20)); c.userData.v = rnd(.4, 1.1); clouds.add(c);
  }

  // 땅: 인도 / 도로
  const ground = add(scene, new THREE.PlaneGeometry(400, 300), M('#ffffff', { map: asphaltTex(), roughness: .95 }), 0, -.02, -60, false); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const road = add(scene, new THREE.PlaneGeometry(400, 9), M('#fff', { map: roadTex(), roughness: .9 }), 0, 0, 10.5, false); road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
  const walk = add(scene, BOX(400, .14, 3.4), M('#fff', { map: tileTex('#cfd3d8', '#c1c6cc', [160, 1.4]), roughness: .85 }), 0, .07, 4.7); walk.receiveShadow = true;
  add(scene, BOX(400, .2, .25), M('#9ca3af'), 0, .1, 6.45);

  // 가로등
  const lampHeads = [];
  for (let x = -36; x <= 36; x += 12) {
    if (Math.abs(x + 3) < 9) continue;
    const g = new THREE.Group(); g.position.set(x + 3, 0, 6.0);
    add(g, new THREE.CylinderGeometry(.07, .1, 4.4, 8), M('#4b5563', { metalness: .5 }), 0, 2.2, 0);
    add(g, BOX(1.1, .08, .08), M('#4b5563'), -.5, 4.4, 0);
    const head = add(g, BOX(.5, .1, .24), M('#fff7d6', { emissive: '#ffd27a', emissiveIntensity: 0 }), -1.0, 4.36, 0, false); lampHeads.push(head);
    scene.add(g);
  }
  // 가로수
  for (let x = -34; x <= 34; x += 12) {
    if (Math.abs(x - 3) < 9) continue;
    const g = new THREE.Group(); g.position.set(x - 3, 0, 5.4);
    add(g, new THREE.CylinderGeometry(.1, .14, 1.4, 8), M('#6b4a2b'), 0, .7, 0);
    add(g, new THREE.IcosahedronGeometry(.9, 1), M('#3f9d4a', { roughness: .9, flatShading: true }), 0, 2.0, 0);
    add(g, new THREE.IcosahedronGeometry(.6, 1), M('#4cb356', { roughness: .9, flatShading: true }), .3, 2.6, .1);
    scene.add(g);
  }

  // ---------- 편의점 본체 ----------
  const store = new THREE.Group(); scene.add(store);
  const W = 8, D = 6;
  const floor = add(store, BOX(W, .1, D), M('#fff', { map: tileTex('#f4f1ea', '#d9d4c8', [8, 6]), roughness: .35, metalness: .05 }), 0, .05, 0); floor.receiveShadow = true;
  const wallM = M('#eef1f3', { roughness: .85 });
  add(store, BOX(W + .4, 3.5, .2), wallM, 0, 1.75, -D / 2 - .1);
  add(store, BOX(.2, 3.5, D + .2), wallM, -W / 2 - .1, 1.75, 0);
  add(store, BOX(.2, 3.5, D + .2), wallM, W / 2 + .1, 1.75, 0);
  add(store, BOX(W + .4, .35, .3), M('#1f2937'), 0, 3.55, D / 2); // 전면 상단 프레임
  // 전면 유리 + 문
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfeeff', transparent: true, opacity: .18, roughness: .04, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
  const frameM = M('#222a36', { metalness: .5, roughness: .4 });
  const glass = (x0, x1) => { const w = x1 - x0; const m = add(store, BOX(w, 2.8, .04), glassM, (x0 + x1) / 2, 1.6, D / 2, false); add(store, BOX(.07, 2.8, .07), frameM, x0, 1.6, D / 2); add(store, BOX(.07, 2.8, .07), frameM, x1, 1.6, D / 2); };
  glass(-4, -2.2); glass(-.8, 4); add(store, BOX(.1, .2, .1), frameM, 0, .1, D / 2);
  add(store, BOX(W, .22, .1), frameM, 0, .11, D / 2);
  const doorL = add(store, BOX(.7, 2.6, .04), glassM, -1.85, 1.5, D / 2 + .03, false);
  const doorR = add(store, BOX(.7, 2.6, .04), glassM, -1.15, 1.5, D / 2 + .03, false);
  // 간판
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('#12924a', '편의점 24', 'OPEN 24H', '#ff5a36'), emissiveMap: null, emissive: '#ffffff', emissiveIntensity: .1, roughness: .5 });
  signMat.emissiveMap = signMat.map;
  const sign = add(store, BOX(W + .4, 1.05, .25), [M('#12924a'), M('#12924a'), M('#12924a'), M('#12924a'), signMat, M('#12924a')], 0, 4.05, D / 2 + .05);
  // LED 테두리(업그레이드)
  const led = new THREE.Group(); led.visible = false; store.add(led);
  const ledM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#6ff3ff', emissiveIntensity: 3 });
  add(led, BOX(W + .5, .06, .06), ledM, 0, 4.62, D / 2 + .2, false); add(led, BOX(W + .5, .06, .06), ledM, 0, 3.5, D / 2 + .2, false);
  add(led, BOX(.06, 1.2, .06), ledM, -W / 2 - .22, 4.06, D / 2 + .2, false); add(led, BOX(.06, 1.2, .06), ledM, W / 2 + .22, 4.06, D / 2 + .2, false);
  // 24H 네온(업그레이드)
  const neon = new THREE.Group(); neon.visible = false; store.add(neon);
  const neonTex = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ff3d8b'; g.font = '900 88px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3d8b'; g.shadowBlur = 18; g.fillText('24H', w / 2, h / 2); });
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false });
  add(neon, new THREE.PlaneGeometry(2.6, 1.3), neonMat, 0, 5.5, D / 2 + .1, false);
  // 지붕 트로피(프랜차이즈)
  const trophies = new THREE.Group(); store.add(trophies);

  // 천장 라이트 패널
  const lightPanelM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d6', emissiveIntensity: .5 });
  for (const [x, z] of [[-2.2, -.2], [2.0, -.2], [-2.2, 2.0], [2.0, 2.0]]) add(store, BOX(1.8, .06, .5), lightPanelM, x, 3.42, z, false);

  // 냉장고(뒷벽)
  const fridgeUnits = [];
  const fridgeFrame = M('#c9d3dc', { metalness: .4, roughness: .35 });
  const bottleCols = ['#ff5252', '#ffd54f', '#4fc3f7', '#81c784', '#ba68c8', '#ffffff', '#ff8a65'];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.set(-3 + i * 1.2, 0, -D / 2 + .42);
    add(g, BOX(1.1, 2.3, .72), fridgeFrame, 0, 1.2, 0);
    add(g, BOX(.96, 2.05, .02), new THREE.MeshStandardMaterial({ color: '#dff6ff', emissive: '#bde9ff', emissiveIntensity: .75, roughness: .2 }), 0, 1.22, .37, false);
    for (let s = 0; s < 5; s++) for (let k = 0; k < 7; k++) add(g, new THREE.CylinderGeometry(.045, .045, .2, 8), M(pick(bottleCols), { emissive: '#222', roughness: .4 }), -.38 + k * .125, .36 + s * .38, .34, false);
    g.visible = i < 3; fridgeUnits.push(g); store.add(g);
  }
  // 선반
  const shelves = [];
  const prodGeo = BOX(.2, .22, .22);
  const prodCols = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#ffee58', '#8d6e63'].map(c => new THREE.Color(c));
  function makeShelf(len, x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
    const wood = M('#b98b5a', { roughness: .6 });
    add(g, BOX(len, .12, .7), M('#6b7280'), 0, .06, 0);
    add(g, BOX(len, 1.7, .05), M('#4b5563'), 0, .9, 0);
    for (let l = 0; l < 4; l++) add(g, BOX(len, .05, .62), wood, 0, .35 + l * .42, .02);
    add(g, BOX(.06, 1.75, .66), M('#374151'), -len / 2, .9, 0); add(g, BOX(.06, 1.75, .66), M('#374151'), len / 2, .9, 0);
    const per = Math.floor(len / .24), count = per * 4 * 2, im = new THREE.InstancedMesh(prodGeo, M('#fff', { roughness: .5 }), count);
    im.castShadow = true; let n = 0; const d = new THREE.Object3D();
    for (let side of [1, -1]) for (let l = 0; l < 4; l++) for (let k = 0; k < per; k++) {
      d.position.set(-len / 2 + .22 + k * .24, .47 + l * .42, side * .17); d.rotation.y = 0; d.scale.set(1, rnd(.8, 1.4), 1); d.updateMatrix(); im.setMatrixAt(n, d.matrix); im.setColorAt(n, pick(prodCols)); n++;
    }
    g.add(im); store.add(g); g.visible = false; g.userData.t = 0; return g;
  }
  shelves.push(makeShelf(2.8, -2.2, -1.15), makeShelf(2.6, .6, -1.15), makeShelf(1.7, -3.0, .9, Math.PI / 2 * 0), makeShelf(2.4, -2.4, .0 + 0.0, 0));
  shelves[3].position.set(-1.1, 0, .2); shelves[3].position.x = 0.1; shelves[3].position.z = -0.1; shelves[3].visible = false;
  shelves[2].position.set(-3.1, 0, 1.0); shelves[2].rotation.y = 0;

  // 카운터
  const counter = new THREE.Group(); counter.position.set(2.5, 0, .75); store.add(counter);
  add(counter, BOX(3.0, 1.0, .8), M('#f8fafc', { roughness: .4 }), 0, .5, 0);
  add(counter, BOX(3.1, .08, .9), M('#1f2937', { roughness: .3, metalness: .2 }), 0, 1.04, 0);
  add(counter, BOX(3.0, .12, .8), M('#16a34a'), 0, .06, 0);
  const regScreen = add(counter, BOX(.4, .28, .04), M('#001a0d', { emissive: '#22c55e', emissiveIntensity: 1.4 }), -.7, 1.4, .0, false); regScreen.rotation.x = -.3;
  add(counter, BOX(.5, .22, .4), M('#2b3340'), -.7, 1.19, .05);
  add(counter, BOX(.28, .12, .25), M('#e5e7eb'), .9, 1.12, 0);
  // 사탕 진열
  for (let i = 0; i < 8; i++) add(counter, BOX(.12, .08, .12), M(pick(['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff'])), .1 + i * .16, 1.12, .1, false);

  // 전자레인지(업그레이드)
  const micro = new THREE.Group(); micro.visible = false; store.add(micro);
  add(micro, BOX(1.2, .9, .6), M('#cfd5dc'), 3.0, .45, -1.1);
  add(micro, BOX(.5, .3, .45), M('#252b34'), 3.0, 1.05, -1.1);
  add(micro, BOX(.28, .2, .02), M('#2a1500', { emissive: '#ffa63d', emissiveIntensity: 1.6 }), 2.92, 1.05, -.87, false);
  // 커피 머신 (바리스타)
  const coffee = new THREE.Group(); coffee.visible = false; store.add(coffee);
  add(coffee, BOX(.9, .85, .6), M('#6b4226'), 3.35, .43, -2.35);
  add(coffee, BOX(.7, .6, .5), M('#222'), 3.35, 1.15, -2.38);
  add(coffee, BOX(.2, .2, .02), M('#000', { emissive: '#ff4d4d', emissiveIntensity: 2 }), 3.35, 1.2, -2.12, false);
  // ATM (업그레이드, 매장 밖 좌측)
  const atm = new THREE.Group(); atm.visible = false; store.add(atm);
  add(atm, BOX(1.1, 2.2, .8), M('#1d4ed8', { metalness: .3, roughness: .4 }), -5.3, 1.1, 2.6);
  add(atm, BOX(.7, .5, .04), M('#001a33', { emissive: '#38bdf8', emissiveIntensity: 1.8 }), -5.3, 1.6, 3.02, false);
  add(atm, BOX(.8, .08, .3), M('#e5e7eb'), -5.3, 1.1, 3.0);
  add(atm, BOX(1.1, .2, .8), M('#facc15', { emissive: '#facc15', emissiveIntensity: .8 }), -5.3, 2.3, 2.6, false);
  // 취식 공간 (업그레이드)
  const eat = new THREE.Group(); eat.visible = false; store.add(eat);
  for (const x of [-3.4, -2.2]) {
    add(eat, new THREE.CylinderGeometry(.45, .45, .06, 18), M('#f1f5f9'), x, .92, 2.2); add(eat, new THREE.CylinderGeometry(.05, .05, .9, 8), M('#555'), x, .47, 2.2);
    for (const dx of [-.55, .55]) { add(eat, new THREE.CylinderGeometry(.18, .18, .05, 12), M('#ef4444'), x + dx, .6, 2.2); add(eat, new THREE.CylinderGeometry(.03, .03, .55, 6), M('#555'), x + dx, .3, 2.2); }
  }
  // 멤버십 앱 키오스크
  const kiosk = new THREE.Group(); kiosk.visible = false; store.add(kiosk);
  add(kiosk, BOX(.7, 1.5, .4), M('#7c3aed'), 3.55, .75, 2.6);
  add(kiosk, BOX(.55, .8, .03), M('#10002b', { emissive: '#c084fc', emissiveIntensity: 1.6 }), 3.55, 1.0, 2.8, false);
  // 자체 브랜드 진열대 (황금)
  const pb = new THREE.Group(); pb.visible = false; store.add(pb);
  add(pb, new THREE.CylinderGeometry(.9, 1.0, .5, 20), M('#fbbf24', { metalness: .8, roughness: .25, emissive: '#7a5200', emissiveIntensity: .3 }), 0, .25, 2.3);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(pb, BOX(.22, .3, .22), M(pick(['#fff', '#fde68a', '#fb7185'])), Math.cos(a) * .55, .65, 2.3 + Math.sin(a) * .55); }
  add(pb, new THREE.TorusGeometry(.35, .04, 8, 24), M('#fff', { emissive: '#fde68a', emissiveIntensity: 1.5 }), 0, 1.15, 2.3, false).rotation.x = Math.PI / 2;

  // 지점(옆 건물 파사드)
  const branches = [];
  const bSigns = [['#2563eb', '24시 편의점'], ['#9333ea', '편의점 플러스'], ['#ea580c', '편의점 프라임'], ['#0d9488', '편의점 글로벌']];
  [10.6, -10.6, 21.2, -21.2].forEach((x, i) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0); g.userData.t = 0;
    add(g, BOX(W, .1, D), M('#e9e6df'), 0, .05, 0);
    add(g, BOX(W, 3.5, .2), M('#dfe3e8'), 0, 1.75, -D / 2); add(g, BOX(.2, 3.5, D), M('#dfe3e8'), -W / 2, 1.75, 0); add(g, BOX(.2, 3.5, D), M('#dfe3e8'), W / 2, 1.75, 0);
    add(g, BOX(W, 2.8, .04), new THREE.MeshStandardMaterial({ color: '#ffe9b8', emissive: '#ffcf70', emissiveIntensity: .55, transparent: true, opacity: .55, roughness: .1 }), 0, 1.6, D / 2, false);
    const sm = new THREE.MeshStandardMaterial({ map: signTexture(bSigns[i][0], bSigns[i][1], '24H', '#fff'), roughness: .5, emissive: '#fff', emissiveIntensity: .1 }); sm.emissiveMap = sm.map;
    add(g, BOX(W + .2, 1.0, .25), [M('#333'), M('#333'), M('#333'), M('#333'), sm, M('#333')], 0, 4.05, D / 2 + .05);
    for (let s = 0; s < 3; s++) add(g, BOX(2.2, 1.7, .5), M('#8b95a3'), -2.4 + s * 2.4, .9, -1.6);
    g.visible = false; g.scale.y = .01; g.userData.sm = sm; scene.add(g); branches.push(g);
  });

  // 도시 스카이라인
  const district = new THREE.Group(); scene.add(district);
  const winTex = [windowTex(7), windowTex(19), windowTex(31)];
  const towerMats = winTex.map(t => { const m = new THREE.MeshStandardMaterial({ color: '#fff', map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: .0, roughness: .55, metalness: .1 }); return m; });
  const towers = []; let seed = 12345; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const TOWER_RANK = [0, 2, 6, 12, 18, 26, 34];
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? 1 : -1, col = Math.floor(i / 2);
    const w = 4 + R() * 4, d = 4 + R() * 4, h = 6 + R() * 10 + (i > 12 ? R() * 14 : 0) + (i > 24 ? 10 : 0);
    const x = side * (14 + (col % 6) * 9 + R() * 3), z = -14 - Math.floor(col / 6) * 12 - R() * 4;
    const m = towerMats[i % 3].clone(); m.map = m.emissiveMap = winTex[i % 3].clone(); m.map.needsUpdate = true; m.map.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 4))); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    const t = new THREE.Mesh(BOX(w, h, d), m); t.position.set(x, h / 2, z); t.castShadow = true; t.receiveShadow = true; t.scale.y = .01; t.userData = { h, t: 0, n: i, mat: m };
    t.visible = false; district.add(t); towers.push(t);
  }
  // 본사 빌딩 + 지구본 (최상위 등급)
  const hq = new THREE.Group(); hq.position.set(0, 0, -22); hq.visible = false; scene.add(hq);
  const hqMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', metalness: .85, roughness: .12, emissive: '#7dd3fc', emissiveIntensity: .08 });
  add(hq, BOX(8, 34, 8), hqMat, 0, 17, 0); add(hq, BOX(5.5, 12, 5.5), hqMat, 0, 40, 0); add(hq, BOX(.3, 8, .3), M('#e5e7eb'), 0, 50, 0);
  add(hq, new THREE.TorusGeometry(5.2, .25, 8, 40), M('#22c55e', { emissive: '#22c55e', emissiveIntensity: 2 }), 0, 33, 0, false).rotation.x = Math.PI / 2;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(3, 28, 20), new THREE.MeshStandardMaterial({ color: '#2563eb', emissive: '#1d4ed8', emissiveIntensity: .8, roughness: .35, wireframe: false })); globe.position.set(0, 58, 0); hq.add(globe);
  const globeRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, .08, 8, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.6, 2), toneMapped: false })); globeRing.position.copy(globe.position); hq.add(globeRing);
  globe.visible = globeRing.visible = false;

  // AI 홀로그램 / 물류 트럭
  const holo = new THREE.Group(); holo.position.set(0, 6.0, 0); holo.visible = false; scene.add(holo);
  const holoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.8, 2.2), toneMapped: false, wireframe: true })); holo.add(holoCore);
  const holoRings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1 + i * .35, .025, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(.4, 1.5, 2), toneMapped: false })); r.rotation.set(i, i * 1.3, 0); holo.add(r); return r; });
  const truck = new THREE.Group(); truck.position.set(11, 0, 8.6); truck.visible = false; scene.add(truck);
  add(truck, BOX(4.2, 2.2, 2), M('#f8fafc'), 0, 1.5, 0); add(truck, BOX(1.4, 1.6, 2), M('#f59e0b'), 2.8, 1.2, 0);
  add(truck, BOX(.04, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: '#bfe9ff', emissive: '#7dd3fc', emissiveIntensity: .3 }), 3.52, 1.55, 0, false);
  add(truck, BOX(3.8, .3, 1.7), M('#16a34a'), 0, .55, 0);
  for (const x of [-1.3, 1.3, 3.0]) for (const z of [-1.05, 1.05]) { const w = add(truck, new THREE.CylinderGeometry(.42, .42, .3, 14), M('#111'), x, .42, z); w.rotation.x = Math.PI / 2; }

  // 자동차
  const cars = [];
  const carCols = ['#ef4444', '#3b82f6', '#f59e0b', '#e5e7eb', '#111827', '#22c55e'];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(), col = carCols[i % carCols.length];
    add(g, BOX(3.4, .8, 1.6), M(col, { metalness: .5, roughness: .3 }), 0, .6, 0);
    add(g, BOX(1.8, .6, 1.4), new THREE.MeshStandardMaterial({ color: '#9bd8ff', metalness: .6, roughness: .15 }), -.2, 1.2, 0);
    for (const x of [-1.1, 1.1]) for (const z of [-.8, .8]) { const w = add(g, new THREE.CylinderGeometry(.33, .33, .25, 12), M('#111'), x, .33, z); w.rotation.x = Math.PI / 2; }
    const hl = add(g, BOX(.06, .18, .3), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6c8', emissiveIntensity: 0 }), 1.72, .65, .5, false); const hl2 = add(g, BOX(.06, .18, .3), hl.material, 1.72, .65, -.5, false);
    const dir = i % 2 ? 1 : -1; g.position.set(rnd(-40, 40), 0, 9.2 + (dir > 0 ? 1.7 : 0)); g.rotation.y = dir > 0 ? 0 : Math.PI;
    g.userData = { v: dir * rnd(4, 7), hl: hl.material }; scene.add(g); cars.push(g);
  }

  // ---------- 손님 ----------
  const custs = [], DOOR = new THREE.Vector3(-1.5, 0, 3.4);
  const stops = [new THREE.Vector3(-2.2, 0, -.4), new THREE.Vector3(.6, 0, -.4), new THREE.Vector3(-2.2, 0, 1.0), new THREE.Vector3(-.4, 0, 1.4), new THREE.Vector3(-3.0, 0, 2.3)];
  const queue = new THREE.Vector3(2.5, 0, 1.75);
  let rate = 0, spawnT = 0;
  function spawnCustomer(forceFast) {
    if (custs.length >= (quality.low ? 8 : 14)) return;
    const kid = Math.random() < .15, fromL = Math.random() < .5;
    const p = person({ scale: kid ? .72 : rnd(.93, 1.08), kind: Math.random() < .2 ? 'cap' : undefined, cap: pick(SHIRT) });
    const sx = fromL ? -22 : 22, z = rnd(4.4, 5.4);
    p.position.set(sx, 0, z); scene.add(p);
    const path = [{ p: new THREE.Vector3(DOOR.x, 0, z) }, { p: new THREE.Vector3(DOOR.x, 0, 2.3), door: true }];
    const shops = Math.random() < .4 ? 2 : 1; const used = [];
    for (let i = 0; i < shops; i++) { let s; do s = pick(stops); while (used.includes(s)); used.push(s); path.push({ p: s.clone(), wait: rnd(.7, 1.6), look: true }); }
    path.push({ p: queue.clone().add(new THREE.Vector3(rnd(-.4, .4), 0, 0)), wait: .5, pay: true });
    path.push({ p: new THREE.Vector3(DOOR.x, 0, 2.3), door: true }); path.push({ p: new THREE.Vector3(DOOR.x, 0, z), bag: true });
    path.push({ p: new THREE.Vector3(fromL ? 22 : -22, 0, z), end: true });
    custs.push({ g: p, path, i: 0, wait: 0, speed: rnd(1.8, 2.6) * (kid ? .8 : 1), phase: Math.random() * 6, rich: Math.random() < .1 });
  }
  const pool = { coins: [], free: [] };
  const coinGeo = new THREE.CylinderGeometry(.09, .09, .03, 12), coinMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: .9, roughness: .25, emissive: '#ffb300', emissiveIntensity: .5 });
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(coinGeo, coinMat); m.visible = false; m.userData = { v: new THREE.Vector3(), life: 0 }; scene.add(m); pool.coins.push(m); }
  function coins(pos, n) {
    for (let i = 0; i < n; i++) {
      const m = pool.coins.find(c => !c.visible); if (!m) return;
      m.visible = true; m.position.copy(pos); m.position.y += .1; m.userData.v.set(rnd(-1.6, 1.6), rnd(3, 5.5), rnd(-.5, 2)); m.userData.life = 0; m.scale.setScalar(1);
    }
  }
  // 불꽃놀이
  const FW = 700, fwGeo = new THREE.BufferGeometry(), fwPos = new Float32Array(FW * 3), fwCol = new Float32Array(FW * 3), fwVel = new Float32Array(FW * 3), fwLife = new Float32Array(FW);
  fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
  const fw = new THREE.Points(fwGeo, new THREE.PointsMaterial({ size: .45, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true })); fw.frustumCulled = false; scene.add(fw);
  for (let i = 0; i < FW; i++) fwPos[i * 3 + 1] = -999;
  let fwNext = 0;
  function burst(x, y, z) {
    const c = new THREE.Color().setHSL(Math.random(), 1, .6);
    for (let i = 0; i < 90; i++) {
      const k = fwNext++ % FW, a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), s = rnd(3, 8);
      fwPos[k * 3] = x; fwPos[k * 3 + 1] = y; fwPos[k * 3 + 2] = z;
      fwVel[k * 3] = Math.sin(b) * Math.cos(a) * s; fwVel[k * 3 + 1] = Math.cos(b) * s; fwVel[k * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
      fwCol[k * 3] = c.r * 2; fwCol[k * 3 + 1] = c.g * 2; fwCol[k * 3 + 2] = c.b * 2; fwLife[k] = rnd(1.1, 1.9);
    }
  }

  // ---------- 직원 ----------
  const STAFF_DEF = {
    part: { make: () => person({ kind: 'apron', apron: '#16a34a', shirt: '#f8fafc' }), spots: [[-2.2, -.4], [-3.0, .0]] },
    cashier: { make: () => person({ kind: 'cap', cap: '#16a34a', shirt: '#16a34a' }), spots: [[3.4, .0], [1.6, .0]] },
    night: { make: () => person({ kind: 'hood', shirt: '#222a38', pants: '#111827' }), spots: [[-3.4, -1.9], [-1.0, -1.9]] },
    manager: { make: () => person({ kind: 'manager', shirt: '#f1f5f9', pants: '#111827' }), spots: [[.3, 2.4], [-3.3, 3.2]] },
    barista: { make: () => person({ kind: 'barista', cap: '#6b4226', shirt: '#6b4226', apron: '#3a2414' }), spots: [[3.35, -1.8], [2.2, -2.0]] },
    logi: { make: () => person({ kind: 'hard', shirt: '#1f2937' }), spots: [[9.3, 7.3], [9.9, 7.6]], vest: true },
    ai: { make: () => robot(), spots: [[-.6, 2.5], [1.0, 2.3]] },
    ceo: { make: () => null, spots: [] },
  };
  const staffGroup = new THREE.Group(); scene.add(staffGroup);
  const staffObj = {};
  function setStaff(id, n) {
    const d = STAFF_DEF[id]; if (!d || !d.spots.length) return;
    const want = n <= 0 ? 0 : n < 6 ? 1 : 2, arr = staffObj[id] ||= [];
    while (arr.length < want) {
      const p = d.make(); const sp = d.spots[arr.length]; p.position.set(sp[0], 0, sp[1]);
      if (d.vest) add(p, BOX(.43, .36, .02), M('#ff7a00', { emissive: '#ff5500', emissiveIntensity: .3 }), 0, 1.0, .19);
      p.userData.pop = 0; p.userData.ph = Math.random() * 6; p.scale.multiplyScalar(.01); p.userData.base = p.scale.x * 100 || 1; staffGroup.add(p); arr.push(p);
    }
    while (arr.length > want) staffGroup.remove(arr.pop());
  }

  // ---------- 상태 동기화 ----------
  const tw = []; // {obj,t,dur,fn}
  const show = (o, v, kind) => { if (o.visible === v) return; o.visible = v; if (v) { o.scale.setScalar(.01); tw.push({ o, t: 0, d: .6 }); } };
  let curKey = '', curRank = 0, shelfTarget = 0;
  function sync(S, ri) {
    const staff = S.staff || {}, goodsSum = Object.values(S.goods || {}).reduce((a, b) => a + b, 0), ups = S.ups || {};
    const key = JSON.stringify([staff, goodsSum, ups, S.fran, ri]);
    if (key === curKey) return; curKey = key;
    curRank = ri;
    for (const id in STAFF_DEF) setStaff(id, staff[id] || 0);
    shelfTarget = goodsSum < 3 ? 1 : goodsSum < 8 ? 2 : goodsSum < 16 ? 3 : 4;
    shelves.forEach((s, i) => { const v = i < shelfTarget; if (s.visible !== v) { s.visible = v; if (v) { s.scale.setScalar(.01); tw.push({ o: s, t: 0, d: .5 }); } } });
    const fr = 3 + (ups.fridge ? 3 : 0); fridgeUnits.forEach((f, i) => show(f, i < fr));
    show(led, !!ups.sign); show(micro, !!ups.micro); show(atm, !!ups.atm); show(neon, !!ups.h24); show(eat, !!ups.eat); show(kiosk, !!ups.app); show(pb, !!ups.brand);
    show(coffee, (staff.barista || 0) > 0); show(truck, (staff.logi || 0) > 0); show(holo, (staff.ceo || 0) > 0);
    const bn = [2, 3, 4, 5]; branches.forEach((b, i) => { const v = ri >= bn[i]; if (b.visible !== v) { b.visible = v; b.userData.t = 0; } });
    const tc = TOWER_RANK[Math.min(ri, TOWER_RANK.length - 1)]; towers.forEach((t, i) => { const v = i < tc; if (t.visible !== v) { t.visible = v; t.userData.t = 0; } });
    const hv = ri >= 4; if (hq.visible !== hv) { hq.visible = hv; hq.scale.setScalar(.01); tw.push({ o: hq, t: 0, d: 1.4 }); }
    globe.visible = globeRing.visible = ri >= 6;
    trophies.clear();
    for (let i = 0; i < Math.min(S.fran, 8); i++) { const m = add(trophies, new THREE.OctahedronGeometry(.28), M('#fbbf24', { metalness: .9, roughness: .2, emissive: '#b45309', emissiveIntensity: .8 }), -3.4 + i * .95, 4.95, D / 2 - .2); m.userData.ph = i; }
  }

  // ---------- 카메라 ----------
  let az = .3, el = .42, zoom = 1, dragging = false, moved = 0, lastX = 0, lastY = 0, idle = 0, shake = 0;
  const pts = new Map(); let pinch0 = 0, zoom0 = 1;
  const target = new THREE.Vector3(0, 1.6, 0.8);
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); lastX = e.clientX; lastY = e.clientY; moved = 0; dragging = true; idle = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; } });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); idle = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) zoom = clamp(zoom0 * pinch0 / d, .6, 1.7); moved = 99; return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    az = clamp(az - dx * .006, -1.2, 1.2); el = clamp(el + dy * .004, .12, 1.15);
  });
  const up = e => { const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (!pts.size) dragging = false; if (had && moved < 8 && e.type === 'pointerup' && cb.onTap) cb.onTap(e.clientX, e.clientY); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (1 + e.deltaY * .001), .6, 1.7); idle = 0; }, { passive: false });

  // ---------- 크기/품질 ----------
  const quality = { low: false };
  function resize() {
    const w = view.clientWidth || 360, h = view.clientHeight || 300;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.fov = w / h < .9 ? 52 : 42; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view); resize();
  function lowQuality() {
    if (quality.low) return; quality.low = true;
    renderer.setPixelRatio(1); sun.castShadow = false; sun.shadow.map && sun.shadow.map.dispose(); useFX = false; resize();
  }
  if (/Mobi|Android/i.test(navigator.userAgent)) { sun.shadow.mapSize.set(1024, 1024); }

  // ---------- 메인 루프 ----------
  let T = 0, tod = .42, last = performance.now(), fAcc = 0, fN = 0, payQ = 0, doorOpen = 0, pulse = 0;
  const skyDay = new THREE.Color('#86cdff'), skyDusk = new THREE.Color('#ff9a62'), skyNight = new THREE.Color('#050a1d'), tmp = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const regPos = new THREE.Vector3(2.5 - .7, 1.1, .75);
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, .1); last = now; T += dt;
    if (!quality.low && T > 3) { fAcc += dt; fN++; if (fN >= 90) { if (fAcc / fN > .04) lowQuality(); fAcc = 0; fN = 0; if (T > 20) fN = -9999; } }

    // 시간대
    tod = (tod + dt / 180) % 1;
    const ang = tod * Math.PI * 2 - Math.PI / 2, elev = Math.sin(ang), night = smooth(.15, -.2, elev), dusk = clamp(1 - Math.abs(elev) * 3.5, 0, 1) * (1 - night * .6);
    sunDir.set(Math.cos(ang) * .8, Math.max(elev, -.2), .5 - Math.cos(ang) * .2).normalize();
    sun.position.copy(sunDir).multiplyScalar(60); sun.target.position.set(0, 0, 0);
    sun.intensity = 2.4 * smooth(-.05, .35, elev); sun.color.set('#fff3d6').lerp(skyDusk, dusk * .7);
    hemi.intensity = lerp(.55, .95, 1 - night); moon.intensity = night * 1.5;
    hemi.color.set('#bfe3ff').lerp(new THREE.Color('#5b72c4'), night);
    tmp.copy(skyDay).lerp(skyDusk, dusk).lerp(skyNight, night); skyCol.copy(tmp); scene.fog.color.copy(tmp); scene.fog.far = lerp(140, 90, night);
    renderer.toneMappingExposure = lerp(1.05, 1.25, night);
    sunDisc.position.copy(sunDir).multiplyScalar(130); sunDisc.visible = elev > -.05; sunDisc.material.color.set('#fff1b0').lerp(skyDusk, dusk);
    moonDisc.position.set(-sunDir.x, Math.max(-sunDir.y, -.1) + .02, -sunDir.z).multiplyScalar(130); moonDisc.position.y = Math.max(moonDisc.position.y, 6); moonDisc.visible = night > .1; moonDisc.position.z = Math.min(moonDisc.position.z, -60);
    starMat.opacity = night * .95; cloudMat.opacity = lerp(.92, .25, night); cloudMat.color.set('#fff').lerp(skyDusk, dusk * .6).lerp(new THREE.Color('#4a5578'), night);
    clouds.children.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 130) c.position.x = -130; });
    const lights = clamp(night * 1.4 + .12, 0, 1);
    warm1.intensity = lerp(.8, 22, night); warm2.intensity = lerp(.8, 22, night); lightPanelM.emissiveIntensity = lerp(.5, 2.4, lights);
    signMat.emissiveIntensity = lerp(.1, 1.15, night); branches.forEach(b => b.userData.sm.emissiveIntensity = lerp(.1, 1.0, night));
    lampHeads.forEach(h => h.material.emissiveIntensity = lerp(0, 4.5, night));
    towerMats.forEach(m => m.emissiveIntensity = night * .9); towers.forEach(t => t.userData.mat.emissiveIntensity = night * .95);
    hqMat.emissiveIntensity = .08 + night * .8; globe.rotation.y += dt * .5; globeRing.rotation.x = Math.PI / 2 + Math.sin(T) * .2; globeRing.rotation.y += dt * .6;

    // 자동차
    cars.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; if (c.position.x < -60) c.position.x = 60; c.userData.hl.emissiveIntensity = night * 3.5; });

    // 자동 손님
    spawnT -= dt; if (spawnT <= 0 && rate > 0) { spawnCustomer(); spawnT = clamp(7 / Math.pow(rate, .32), .35, 6) * rnd(.7, 1.3); }
    // 손님 이동
    let doorNear = false;
    for (let i = custs.length - 1; i >= 0; i--) {
      const c = custs[i], wp = c.path[c.i];
      if (c.wait > 0) { c.wait -= dt; swing(c.g, T + c.phase, 2, 0.02); c.g.userData.head.rotation.y = Math.sin(T * 2 + c.phase) * .5; if (c.wait <= 0) { if (wp.pay && cb.onPay) { cb.onPay(); coins(regPos, c.rich ? 7 : 3); pulse = .35; } c.i++; if (c.i >= c.path.length) { scene.remove(c.g); custs.splice(i, 1); } } continue; }
      const dx = wp.p.x - c.g.position.x, dz = wp.p.z - c.g.position.z, dist = Math.hypot(dx, dz), step = c.speed * dt;
      if (wp.door && Math.hypot(c.g.position.x - DOOR.x, c.g.position.z - DOOR.z) < 3) doorNear = true;
      if (dist <= step) {
        c.g.position.set(wp.p.x, 0, wp.p.z);
        if (wp.wait) { c.wait = wp.wait; c.g.rotation.y = wp.pay ? 0 : Math.PI * (.5 + Math.random() * 0); c.g.userData.head.rotation.y = 0; if (wp.pay) c.g.rotation.y = Math.PI; if (wp.look) c.g.rotation.y = Math.PI; continue; }
        if (wp.bag) { const bag = add(c.g, BOX(.18, .22, .1), M('#f8fafc'), .27, .6, .08); }
        c.i++; if (c.i >= c.path.length) { scene.remove(c.g); custs.splice(i, 1); }
      } else {
        c.g.position.x += dx / dist * step; c.g.position.z += dz / dist * step;
        const ty = Math.atan2(dx, dz); let d = ty - c.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; c.g.rotation.y += d * Math.min(1, dt * 10);
        swing(c.g, T + c.phase, 9, .65);
      }
    }
    doorOpen = lerp(doorOpen, doorNear ? .62 : 0, Math.min(1, dt * 6)); doorL.position.x = -1.85 - doorOpen; doorR.position.x = -1.15 + doorOpen;

    // 직원 연출
    for (const id in staffObj) staffObj[id].forEach(p => {
      const U = p.userData; U.pop = Math.min(1, U.pop + dt * 1.6); const s = (U.base || 1) * easeOutBack(U.pop); p.scale.setScalar(Math.max(s, .01));
      const ph = U.ph + T;
      if (id === 'ai') { p.position.y = Math.sin(ph * 1.5) * .03; p.rotation.y = Math.sin(ph * .5) * .6; U.armR.rotation.x = Math.sin(ph * 2) * .4; }
      else {
        p.rotation.y = id === 'logi' ? -.9 + Math.sin(ph) * .2 : Math.sin(ph * .6) * .25 + (id === 'cashier' ? 0 : 0);
        const busy = Math.sin(ph * 3) * .5 - .5; if (U.armR) { U.armR.rotation.x = id === 'barista' || id === 'cashier' ? -.9 + busy * .3 : Math.sin(ph * 2) * .25; U.armL.rotation.x = Math.sin(ph * 2 + 1) * .15; }
        if (U.head) U.head.rotation.y = Math.sin(ph * .8) * .4;
      }
    });
    holo.position.y = 6.2 + Math.sin(T * 1.2) * .25; holo.rotation.y += dt * .7; holoCore.rotation.x += dt; holoRings.forEach((r, i) => { r.rotation.x += dt * (.6 + i * .3); r.rotation.z += dt * (.4 + i * .2); });
    trophies.children.forEach(m => { m.rotation.y += dt * 1.4; m.position.y = 4.95 + Math.sin(T * 2 + m.userData.ph) * .07; });

    // 트윈(등장 애니메이션)
    for (let i = tw.length - 1; i >= 0; i--) { const q = tw[i]; q.t += dt; const k = clamp(q.t / q.d, 0, 1); q.o.scale.setScalar(Math.max(.01, easeOutBack(k))); if (k >= 1) { q.o.scale.setScalar(1); tw.splice(i, 1); } }
    branches.forEach(b => { if (b.visible) { b.userData.t = Math.min(1, b.userData.t + dt * 1.1); b.scale.y = Math.max(.01, easeOutBack(b.userData.t)); } });
    towers.forEach(t => { if (t.visible) { t.userData.t = Math.min(1, t.userData.t + dt * .6); const k = easeOutBack(t.userData.t); t.scale.y = Math.max(.01, k); t.position.y = t.userData.h * k / 2; } });

    // 코인/불꽃놀이
    pool.coins.forEach(m => { if (!m.visible) return; const u = m.userData; u.life += dt; u.v.y -= 11 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += dt * 9; m.rotation.z += dt * 5; if (m.position.y < .1 || u.life > 1.2) { m.visible = false; } });
    for (let i = 0; i < FW; i++) if (fwLife[i] > 0) { fwLife[i] -= dt; fwVel[i * 3 + 1] -= 4 * dt; fwPos[i * 3] += fwVel[i * 3] * dt; fwPos[i * 3 + 1] += fwVel[i * 3 + 1] * dt; fwPos[i * 3 + 2] += fwVel[i * 3 + 2] * dt; if (fwLife[i] <= 0) fwPos[i * 3 + 1] = -999; }
    fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true;

    // 카메라
    idle += dt; if (!dragging && idle > 6) { az += Math.sin(T * .25) * .0009; }
    const baseDist = [19, 21, 25, 30, 34, 38, 42][Math.min(curRank, 6)] * zoom;
    const cx = target.x + Math.sin(az) * Math.cos(el) * baseDist, cy = target.y + Math.sin(el) * baseDist, cz = target.z + Math.cos(az) * Math.cos(el) * baseDist;
    shake = Math.max(0, shake - dt * 3);
    camera.position.set(cx + (Math.random() - .5) * shake * .15, cy + (Math.random() - .5) * shake * .15, cz);
    camera.lookAt(target.x, target.y + curRank * .35, target.z);
    // 펄스(계산대 연출)
    pulse = Math.max(0, pulse - dt); regScreen.material.emissiveIntensity = 1.4 + pulse * 6;

    if (useFX) composer.render(); else renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    sync,
    setRate(r) { rate = r; },
    tap() { const c = Math.random() < .5; spawnCustomer(true); coins(regPos, 2); pulse = .3; shake = .35; },
    celebrate() { let n = 0; const id = setInterval(() => { burst(rnd(-9, 9), rnd(8, 15), rnd(-8, 0)); if (++n > 6) clearInterval(id); }, 260); },
    setNight(v) { tod = v ? .0 : .45; },
  };
}
