// 편의점 사장 키우기 — 로블록스 스타일 3D 타이쿤 월드 (three.js, 에셋 없이 전부 코드로 생성)
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
const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// 로블록스 느낌: 매끈한 플라스틱 재질
const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: 0 }, o));
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
    g.fillStyle = '#fff'; g.font = `900 78px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w * .42, h * .52);
    g.font = '700 30px sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(sub, w * .86, h * .52);
  });
}
// 스터드(레고 돌기) 패턴 베이스플레이트
function studTex(base, dark, light, n) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * s + s / 2, cy = y * s + s / 2;
      g.fillStyle = dark; g.beginPath(); g.arc(cx + 1.5, cy + 2.5, s * .33, 0, 7); g.fill();
      g.fillStyle = light; g.beginPath(); g.arc(cx, cy, s * .33, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(cx - s * .08, cy - s * .1, s * .15, 0, 7); g.fill();
    }
  });
}
const tileTex = (a, b, rep) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
}, rep);
function windowTex(seed) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#26324a'; g.fillRect(0, 0, w, h);
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let y = 8; y < h - 8; y += 22) for (let x = 8; x < w - 8; x += 20) { const lit = r() > .45; g.fillStyle = lit ? (r() > .5 ? '#ffe9a8' : '#bfe2ff') : '#33405c'; g.fillRect(x, y, 12, 14); }
  });
}
function nameTag(text, o = {}) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 72; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(4, 8, 312, 56, 14); g.fill();
  g.font = `800 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.color || '#fff'; g.fillText(text, 160, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(1.5, .34, 1); s.position.y = o.y || 2.2; s.renderOrder = 10; return s;
}
const faces = {};
function faceMat(kind) {
  return faces[kind] ||= new THREE.MeshBasicMaterial({
    map: canvasTex(64, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = '#111'; g.lineWidth = 5; g.lineCap = 'round';
      if (kind === 'wink') { g.fillRect(16, 20, 8, 12); g.fillRect(40, 25, 10, 4); } else if (kind === 'cool') { g.fillRect(12, 20, 16, 8); g.fillRect(36, 20, 16, 8); } else { g.fillRect(16, 20, 8, 12); g.fillRect(40, 20, 8, 12); }
      g.strokeStyle = '#111'; g.beginPath(); g.arc(32, kind === 'grin' ? 34 : 36, kind === 'grin' ? 14 : 12, .2 * Math.PI, .8 * Math.PI); g.stroke();
    }), transparent: true, toneMapped: false,
  });
}

// ---------- 로블록스 R6 스타일 캐릭터 ----------
const SKIN = ['#f5cd30', '#f5cd30', '#e0a070', '#fdd8b5', '#c4915e', '#9ae07a'];
const SHIRT = ['#0d69ac', '#c4281c', '#4b974b', '#f5cd30', '#da8541', '#7b2fbe', '#e8e8e8', '#e0508a', '#27c0c0', '#1f1f23'];
const PANTS = ['#4b974b', '#0d69ac', '#1f1f23', '#5a4c42', '#a34b4b', '#3b4a73'];
const U1 = .34;
function person(o = {}) {
  const sc = o.scale || 1, g = new THREE.Group(), U = {};
  const skin = M(o.skin || pick(SKIN), { roughness: .4 }), shirt = M(o.shirt || pick(SHIRT), { roughness: .45 }), pants = M(o.pants || pick(PANTS), { roughness: .5 });
  U.legL = new THREE.Group(); U.legR = new THREE.Group();
  [U.legL, U.legR].forEach((l, i) => { l.position.set(i ? U1 / 2 : -U1 / 2, U1 * 2, 0); add(l, BOX(U1 - .01, U1 * 2, U1), pants, 0, -U1, 0); g.add(l); });
  U.body = add(g, BOX(U1 * 2, U1 * 2, U1), shirt, 0, U1 * 3, 0);
  U.armL = new THREE.Group(); U.armR = new THREE.Group();
  [U.armL, U.armR].forEach((a, i) => { a.position.set(i ? U1 * 1.5 : -U1 * 1.5, U1 * 4, 0); add(a, BOX(U1 - .01, U1 * 2, U1), skin, 0, -U1, 0); add(a, BOX(U1 - .005, U1 * .9, U1 + .005), shirt, 0, -U1 * .45, 0); g.add(a); });
  U.head = new THREE.Group(); U.head.position.y = U1 * 4 + U1 * .5 + .01; g.add(U.head);
  add(U.head, new THREE.CylinderGeometry(U1 * .55, U1 * .55, U1, 20), skin, 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(U1 * .95, U1 * .95), faceMat(o.face || pick(['smile', 'smile', 'grin', 'wink', 'cool']))); face.position.set(0, 0, U1 * .555); U.head.add(face);
  const k = o.kind, hc = o.cap || '#c4281c';
  if (k === 'cap' || k === 'barista') { add(U.head, new THREE.CylinderGeometry(U1 * .58, U1 * .6, U1 * .35, 20), M(hc), 0, U1 * .45, 0); add(U.head, BOX(U1 * .8, U1 * .08, U1 * .55), M(hc), 0, U1 * .32, U1 * .6); }
  if (k === 'hard') { add(U.head, new THREE.SphereGeometry(U1 * .62, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), M('#ffb020'), 0, U1 * .3, 0); }
  if (k === 'manager') { add(g, BOX(.09, .5, .02), M('#c4281c'), 0, U1 * 3.2, U1 * .52); }
  if (k === 'apron') { add(g, BOX(U1 * 1.7, U1 * 1.5, .03), M(o.apron || '#4b974b'), 0, U1 * 2.7, U1 * .52); }
  if (k === 'hood') { add(U.head, new THREE.CylinderGeometry(U1 * .6, U1 * .6, U1 * .3, 20), M('#222a38'), 0, U1 * .42, 0); }
  if (k === 'crown') {
    const gold = M('#ffd23f', { metalness: .8, roughness: .25, emissive: '#7a5200', emissiveIntensity: .35 });
    add(U.head, new THREE.CylinderGeometry(U1 * .5, U1 * .56, U1 * .28, 16), gold, 0, U1 * .62, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(U.head, new THREE.ConeGeometry(U1 * .09, U1 * .3, 6), gold, Math.cos(a) * U1 * .42, U1 * .88, Math.sin(a) * U1 * .42); }
  }
  g.scale.setScalar(sc); g.userData = U; U.h = U1 * 5 * sc;
  return g;
}
function robot() {
  const g = person({ skin: '#a8b2c0', shirt: '#e8ecf4', pants: '#8b96a8', face: 'cool' });
  const U = g.userData; U.head.children[1].visible = false;
  add(U.head, BOX(U1 * .9, U1 * .3, .02), M('#001a24', { emissive: '#22d3ee', emissiveIntensity: 2.4 }), 0, .02, U1 * .56, false);
  add(U.head, new THREE.CylinderGeometry(.015, .015, .2), M('#889'), 0, U1 * .7, 0); add(U.head, new THREE.SphereGeometry(.045, 8, 8), M('#f43f5e', { emissive: '#f43f5e', emissiveIntensity: 2 }), 0, U1 * .85, 0, false);
  add(g, BOX(U1 * 1.1, U1 * .7, .02), M('#0a1020', { emissive: '#22d3ee', emissiveIntensity: 1.2 }), 0, U1 * 3.1, U1 * .52, false);
  return g;
}
function swing(p, t, speed, amp) {
  const U = p.userData; if (!U.legL) return;
  const s = Math.sin(t * speed) * amp;
  U.legL.rotation.x = s; U.legR.rotation.x = -s; U.armL.rotation.x = -s * .9; U.armR.rotation.x = s * .9;
}

// ---------- 월드 ----------
export function createWorld(canvas, view, cb) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 500);
  const skyCol = new THREE.Color('#6fc3ff'); scene.background = skyCol; scene.fog = new THREE.Fog(skyCol, 60, 170);

  const hemi = new THREE.HemisphereLight('#cfe9ff', '#7a8a6a', .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3d6', 2.3); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 30; sc.bottom = -26; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight('#8fb2ff', 0); moon.position.set(-18, 30, 22); scene.add(moon);
  const warm1 = new THREE.PointLight('#ffd9a0', 0, 12, 1.6); warm1.position.set(-1.6, 3.1, 0.2); scene.add(warm1);
  const warm2 = new THREE.PointLight('#ffe6c0', 0, 12, 1.6); warm2.position.set(2.2, 3.1, -1.0); scene.add(warm2);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .4, .6, .88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useFX = true;

  // 하늘
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff1b0' })); sunDisc.material.fog = false; scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), new THREE.MeshBasicMaterial({ color: '#dfe8ff' })); moonDisc.material.fog = false; scene.add(moonDisc);
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3 + .1, r = 200; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#fff', size: 1.8, transparent: true, opacity: 0, fog: false, depthWrite: false }); scene.add(new THREE.Points(starGeo, starMat));
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, transparent: true, opacity: .95, emissive: '#fff', emissiveIntensity: .2 });
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(BOX(rnd(5, 9), rnd(2.5, 4), rnd(4, 7)), cloudMat); s.position.set(j * 5 - 8, rnd(-.6, .6), rnd(-1.5, 1.5)); c.add(s); }
    c.position.set(rnd(-140, 140), rnd(40, 58), rnd(-120, 10)); c.userData.v = rnd(.5, 1.2); clouds.add(c);
  }

  // 땅: 거대한 잔디 + 스터드 베이스플레이트 + 시멘트 길
  const far = add(scene, new THREE.PlaneGeometry(900, 900), M('#4c8f3a', { roughness: 1 }), 0, -.6, 0, false); far.rotation.x = -Math.PI / 2; far.receiveShadow = true;
  const plateTex = studTex('#5dac46', '#3f8a31', '#6cc255', 8); plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping; plateTex.repeat.set(16, 14);
  const plate = add(scene, BOX(64, .6, 56), M('#fff', { map: plateTex, roughness: .55 }), 0, -.3, 12, false); plate.receiveShadow = true;
  const pathTex = studTex('#b8bcc4', '#9aa0aa', '#c9cdd4', 8); pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping; pathTex.repeat.set(16, 2);
  const path = add(scene, BOX(64, .08, 3.2), M('#fff', { map: pathTex, roughness: .5 }), 0, .04, 5.0, false); path.receiveShadow = true;
  for (const [x, z] of [[-27, 2], [27, 2], [-27, 14], [27, 14], [-27, 26], [27, 26], [-18, -6], [18, -6], [-23, 8], [23, 20]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    add(g, BOX(.7, 2.2, .7), M('#7b4f2a'), 0, 1.1, 0);
    add(g, BOX(2.6, 1.8, 2.6), M('#2f9d3a'), 0, 3.0, 0); add(g, BOX(1.7, 1.4, 1.7), M('#3fb44a'), 0, 4.4, 0); scene.add(g);
  }

  // ---------- 편의점 본체 ----------
  const store = new THREE.Group(); scene.add(store);
  const W = 8, D = 6;
  add(store, BOX(W, .1, D), M('#fff', { map: tileTex('#f4f1ea', '#d9d4c8', [8, 6]), roughness: .3 }), 0, .05, 0).receiveShadow = true;
  const wallM = M('#f1f4f6', { roughness: .6 });
  add(store, BOX(W + .4, 3.5, .2), wallM, 0, 1.75, -D / 2 - .1);
  add(store, BOX(.2, 3.5, D + .2), wallM, -W / 2 - .1, 1.75, 0);
  add(store, BOX(.2, 3.5, D + .2), wallM, W / 2 + .1, 1.75, 0);
  add(store, BOX(W + .4, .35, .3), M('#1f2937'), 0, 3.55, D / 2);
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfeeff', transparent: true, opacity: .2, roughness: .04, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
  const frameM = M('#222a36', { metalness: .4, roughness: .4 });
  const glass = (x0, x1) => { add(store, BOX(x1 - x0, 2.8, .04), glassM, (x0 + x1) / 2, 1.6, D / 2, false); add(store, BOX(.08, 2.8, .08), frameM, x0, 1.6, D / 2); add(store, BOX(.08, 2.8, .08), frameM, x1, 1.6, D / 2); };
  glass(-4, -2.2); glass(-.8, 4); add(store, BOX(W, .22, .1), frameM, 0, .11, D / 2);
  const doorL = add(store, BOX(.7, 2.6, .04), glassM, -1.85, 1.5, D / 2 + .03, false);
  const doorR = add(store, BOX(.7, 2.6, .04), glassM, -1.15, 1.5, D / 2 + .03, false);
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('#12924a', '편의점 24', 'OPEN 24H', '#ff5a36'), emissive: '#ffffff', emissiveIntensity: .1, roughness: .5 }); signMat.emissiveMap = signMat.map;
  add(store, BOX(W + .4, 1.05, .25), [M('#12924a'), M('#12924a'), M('#12924a'), M('#12924a'), signMat, M('#12924a')], 0, 4.05, D / 2 + .05);
  const led = new THREE.Group(); led.visible = false; store.add(led);
  const ledM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#6ff3ff', emissiveIntensity: 3 });
  add(led, BOX(W + .5, .08, .08), ledM, 0, 4.62, D / 2 + .2, false); add(led, BOX(W + .5, .08, .08), ledM, 0, 3.5, D / 2 + .2, false);
  add(led, BOX(.08, 1.2, .08), ledM, -W / 2 - .22, 4.06, D / 2 + .2, false); add(led, BOX(.08, 1.2, .08), ledM, W / 2 + .22, 4.06, D / 2 + .2, false);
  const neon = new THREE.Group(); neon.visible = false; store.add(neon);
  const neonTex = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ff3d8b'; g.font = '900 88px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3d8b'; g.shadowBlur = 18; g.fillText('24H', w / 2, h / 2); });
  add(neon, new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }), 0, 5.5, D / 2 + .1, false);
  const trophies = new THREE.Group(); store.add(trophies);
  const lightPanelM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d6', emissiveIntensity: .5 });
  for (const [x, z] of [[-2.2, -.2], [2.0, -.2], [-2.2, 2.0], [2.0, 2.0]]) add(store, BOX(1.8, .06, .5), lightPanelM, x, 3.42, z, false);

  const fridgeUnits = [], fridgeFrame = M('#c9d3dc', { metalness: .3, roughness: .35 });
  const bottleCols = ['#ff5252', '#ffd54f', '#4fc3f7', '#81c784', '#ba68c8', '#ffffff', '#ff8a65'];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.set(-3 + i * 1.2, 0, -D / 2 + .42);
    add(g, BOX(1.1, 2.3, .72), fridgeFrame, 0, 1.2, 0);
    add(g, BOX(.96, 2.05, .02), new THREE.MeshStandardMaterial({ color: '#dff6ff', emissive: '#bde9ff', emissiveIntensity: .75, roughness: .2 }), 0, 1.22, .37, false);
    for (let s = 0; s < 5; s++) for (let k = 0; k < 7; k++) add(g, BOX(.09, .2, .09), M(pick(bottleCols)), -.38 + k * .125, .36 + s * .38, .34, false);
    g.visible = i < 3; fridgeUnits.push(g); store.add(g);
  }
  const shelves = [];
  const prodGeo = BOX(.2, .22, .22);
  const prodCols = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#ffee58', '#8d6e63'].map(c => new THREE.Color(c));
  function makeShelf(len, x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
    const wood = M('#d9a066', { roughness: .55 });
    add(g, BOX(len, .12, .7), M('#6b7280'), 0, .06, 0); add(g, BOX(len, 1.7, .05), M('#4b5563'), 0, .9, 0);
    for (let l = 0; l < 4; l++) add(g, BOX(len, .05, .62), wood, 0, .35 + l * .42, .02);
    add(g, BOX(.06, 1.75, .66), M('#374151'), -len / 2, .9, 0); add(g, BOX(.06, 1.75, .66), M('#374151'), len / 2, .9, 0);
    const per = Math.floor(len / .24), im = new THREE.InstancedMesh(prodGeo, M('#fff', { roughness: .45 }), per * 8);
    im.castShadow = true; let n = 0; const d = new THREE.Object3D();
    for (const side of [1, -1]) for (let l = 0; l < 4; l++) for (let k = 0; k < per; k++) { d.position.set(-len / 2 + .22 + k * .24, .47 + l * .42, side * .17); d.scale.set(1, rnd(.8, 1.3), 1); d.updateMatrix(); im.setMatrixAt(n, d.matrix); im.setColorAt(n, pick(prodCols)); n++; }
    g.add(im); store.add(g); g.visible = false; return g;
  }
  shelves.push(makeShelf(2.8, -2.2, -1.15), makeShelf(2.6, .6, -1.15), makeShelf(1.7, -3.1, 1.0), makeShelf(2.4, 0.1, -0.1));

  const counter = new THREE.Group(); counter.position.set(2.5, 0, .75); store.add(counter);
  add(counter, BOX(3.0, 1.0, .8), M('#f8fafc', { roughness: .35 }), 0, .5, 0);
  add(counter, BOX(3.1, .08, .9), M('#1f2937', { roughness: .3 }), 0, 1.04, 0);
  add(counter, BOX(3.0, .12, .8), M('#16a34a'), 0, .06, 0);
  const regScreen = add(counter, BOX(.4, .28, .04), M('#001a0d', { emissive: '#22c55e', emissiveIntensity: 1.4 }), -.7, 1.4, 0, false); regScreen.rotation.x = -.3;
  add(counter, BOX(.5, .22, .4), M('#2b3340'), -.7, 1.19, .05);
  for (let i = 0; i < 8; i++) add(counter, BOX(.12, .08, .12), M(pick(['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff'])), .1 + i * .16, 1.12, .1, false);

  const micro = new THREE.Group(); micro.visible = false; store.add(micro);
  add(micro, BOX(1.2, .9, .6), M('#cfd5dc'), 3.0, .45, -1.1); add(micro, BOX(.5, .3, .45), M('#252b34'), 3.0, 1.05, -1.1);
  add(micro, BOX(.28, .2, .02), M('#2a1500', { emissive: '#ffa63d', emissiveIntensity: 1.6 }), 2.92, 1.05, -.87, false);
  const coffee = new THREE.Group(); coffee.visible = false; store.add(coffee);
  add(coffee, BOX(.9, .85, .6), M('#6b4226'), 3.35, .43, -2.35); add(coffee, BOX(.7, .6, .5), M('#222'), 3.35, 1.15, -2.38);
  add(coffee, BOX(.2, .2, .02), M('#000', { emissive: '#ff4d4d', emissiveIntensity: 2 }), 3.35, 1.2, -2.12, false);
  const atm = new THREE.Group(); atm.visible = false; store.add(atm);
  add(atm, BOX(1.1, 2.2, .8), M('#1d4ed8', { roughness: .4 }), -5.3, 1.1, 2.6); add(atm, BOX(.7, .5, .04), M('#001a33', { emissive: '#38bdf8', emissiveIntensity: 1.8 }), -5.3, 1.6, 3.02, false);
  add(atm, BOX(.8, .08, .3), M('#e5e7eb'), -5.3, 1.1, 3.0); add(atm, BOX(1.1, .2, .8), M('#facc15', { emissive: '#facc15', emissiveIntensity: .8 }), -5.3, 2.3, 2.6, false);
  const eat = new THREE.Group(); eat.visible = false; store.add(eat);
  for (const x of [-3.4, -2.2]) {
    add(eat, new THREE.CylinderGeometry(.45, .45, .06, 18), M('#f1f5f9'), x, .92, 2.2); add(eat, new THREE.CylinderGeometry(.05, .05, .9, 8), M('#555'), x, .47, 2.2);
    for (const dx of [-.55, .55]) { add(eat, new THREE.CylinderGeometry(.18, .18, .05, 12), M('#ef4444'), x + dx, .6, 2.2); add(eat, new THREE.CylinderGeometry(.03, .03, .55, 6), M('#555'), x + dx, .3, 2.2); }
  }
  const kiosk = new THREE.Group(); kiosk.visible = false; store.add(kiosk);
  add(kiosk, BOX(.7, 1.5, .4), M('#7c3aed'), 3.55, .75, 2.6); add(kiosk, BOX(.55, .8, .03), M('#10002b', { emissive: '#c084fc', emissiveIntensity: 1.6 }), 3.55, 1.0, 2.8, false);
  const pb = new THREE.Group(); pb.visible = false; store.add(pb);
  add(pb, new THREE.CylinderGeometry(.9, 1.0, .5, 20), M('#fbbf24', { metalness: .8, roughness: .25, emissive: '#7a5200', emissiveIntensity: .3 }), 0, .25, 2.3);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(pb, BOX(.22, .3, .22), M(pick(['#fff', '#fde68a', '#fb7185'])), Math.cos(a) * .55, .65, 2.3 + Math.sin(a) * .55); }
  add(pb, new THREE.TorusGeometry(.35, .04, 8, 24), M('#fff', { emissive: '#fde68a', emissiveIntensity: 1.5 }), 0, 1.15, 2.3, false).rotation.x = Math.PI / 2;

  // 지점
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

  // 도시
  const district = new THREE.Group(); scene.add(district);
  const winTex = [windowTex(7), windowTex(19), windowTex(31)];
  const towerMats = winTex.map(t => new THREE.MeshStandardMaterial({ color: '#fff', map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: 0, roughness: .5 }));
  const towers = []; let seed = 12345; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const TOWER_RANK = [0, 2, 6, 12, 18, 26, 34];
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? 1 : -1, col = Math.floor(i / 2);
    const w = 4 + R() * 4, d = 4 + R() * 4, h = 6 + R() * 10 + (i > 12 ? R() * 14 : 0) + (i > 24 ? 10 : 0);
    const x = side * (14 + (col % 6) * 9 + R() * 3), z = -14 - Math.floor(col / 6) * 12 - R() * 4;
    const m = towerMats[i % 3].clone(); m.map = m.emissiveMap = winTex[i % 3].clone(); m.map.needsUpdate = true; m.map.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 4))); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    const t = new THREE.Mesh(BOX(w, h, d), m); t.position.set(x, h / 2, z); t.castShadow = true; t.receiveShadow = true; t.scale.y = .01; t.userData = { h, t: 0, mat: m };
    t.visible = false; district.add(t); towers.push(t);
  }
  const hq = new THREE.Group(); hq.position.set(0, 0, -22); hq.visible = false; scene.add(hq);
  const hqMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', metalness: .6, roughness: .2, emissive: '#7dd3fc', emissiveIntensity: .08 });
  add(hq, BOX(8, 34, 8), hqMat, 0, 17, 0); add(hq, BOX(5.5, 12, 5.5), hqMat, 0, 40, 0); add(hq, BOX(.3, 8, .3), M('#e5e7eb'), 0, 50, 0);
  add(hq, new THREE.TorusGeometry(5.2, .25, 8, 40), M('#22c55e', { emissive: '#22c55e', emissiveIntensity: 2 }), 0, 33, 0, false).rotation.x = Math.PI / 2;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(3, 28, 20), new THREE.MeshStandardMaterial({ color: '#2563eb', emissive: '#1d4ed8', emissiveIntensity: .8, roughness: .35 })); globe.position.set(0, 58, 0); hq.add(globe);
  const globeRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, .08, 8, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.6, 2), toneMapped: false })); globeRing.position.copy(globe.position); hq.add(globeRing);
  globe.visible = globeRing.visible = false;
  const holo = new THREE.Group(); holo.position.set(0, 6.0, 0); holo.visible = false; scene.add(holo);
  const holoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.8, 2.2), toneMapped: false, wireframe: true })); holo.add(holoCore);
  const holoRings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1 + i * .35, .025, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(.4, 1.5, 2), toneMapped: false })); r.rotation.set(i, i * 1.3, 0); holo.add(r); return r; });
  const truck = new THREE.Group(); truck.position.set(14, 0, 8.6); truck.visible = false; scene.add(truck);
  add(truck, BOX(4.2, 2.2, 2), M('#f8fafc'), 0, 1.5, 0); add(truck, BOX(1.4, 1.6, 2), M('#f59e0b'), 2.8, 1.2, 0);
  add(truck, BOX(3.8, .3, 1.7), M('#16a34a'), 0, .55, 0);
  for (const x of [-1.3, 1.3, 3.0]) for (const z of [-1.05, 1.05]) { const w = add(truck, new THREE.CylinderGeometry(.42, .42, .3, 14), M('#111'), x, .42, z); w.rotation.x = Math.PI / 2; }

  // ---------- 충돌(플레이어) ----------
  const WALLS = [[-4.3, 4.3, -3.4, -2.9], [-4.3, -3.9, -3.4, 3.2], [3.9, 4.3, -3.4, 3.2], [-4.3, -2.2, 2.85, 3.2], [-.8, 4.3, 2.85, 3.2],
    [1.0, 4.0, .3, 1.2], [-3.7, -.7, -1.55, -.75], [-.8, 1.9, -1.55, -.75]];
  function collide(p, r) {
    for (const [x0, x1, z0, z1] of WALLS) {
      const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
        else { const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r; }
      }
    }
  }

  // ---------- 플레이어(사장님) ----------
  const player = person({ kind: 'crown', shirt: '#c4281c', pants: '#1f1f23', skin: '#f5cd30', face: 'grin' });
  player.add(nameTag('👑 나 (사장님)', { color: '#ffe066', y: player.userData.h + .45 }));
  player.position.set(0, 0, 17); scene.add(player);
  let pvy = 0, pAir = 0, pYaw = Math.PI, moveTarget = null;
  const marker = new THREE.Mesh(new THREE.TorusGeometry(.45, .07, 8, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9 })); marker.rotation.x = Math.PI / 2; marker.visible = false; scene.add(marker);
  const keys = {}; let joy = { x: 0, y: 0 };
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') jump(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function jump() { if (pAir === 0) { pvy = 6.2; pAir = 1; } }

  // ---------- 손님 ----------
  const quality = { low: false };
  const custs = [], DOOR = new THREE.Vector3(-1.5, 0, 3.4);
  const stops = [new THREE.Vector3(-2.2, 0, -.4), new THREE.Vector3(.6, 0, -.4), new THREE.Vector3(-2.2, 0, 1.0), new THREE.Vector3(-.4, 0, 1.4), new THREE.Vector3(-3.0, 0, 2.3)];
  const queue = new THREE.Vector3(2.5, 0, 1.75);
  const CN = ['손님', '단골', '꼬마', '학생', '직장인', '할머니', '배달러', '관광객'];
  let rate = 0, spawnT = 0, customerSoon = false;
  function spawnCustomer() {
    if (custs.length >= (quality.low ? 8 : 14)) return;
    const kid = Math.random() < .15, fromL = Math.random() < .5;
    const p = person({ scale: kid ? .7 : rnd(.93, 1.08), kind: Math.random() < .2 ? 'cap' : undefined, cap: pick(SHIRT) });
    if (Math.random() < .5) p.add(nameTag(pick(CN), { y: p.userData.h + .4 }));
    const sx = fromL ? -30 : 30, z = rnd(4.6, 5.5);
    p.position.set(sx, 0, z); scene.add(p);
    const path = [{ p: new THREE.Vector3(DOOR.x, 0, z) }, { p: new THREE.Vector3(DOOR.x, 0, 2.3), door: true }];
    const shops = Math.random() < .4 ? 2 : 1; const used = [];
    for (let i = 0; i < shops; i++) { let s; do s = pick(stops); while (used.includes(s)); used.push(s); path.push({ p: s.clone(), wait: rnd(.7, 1.6), look: true }); }
    path.push({ p: queue.clone().add(new THREE.Vector3(rnd(-.4, .4), 0, 0)), wait: .5, pay: true });
    path.push({ p: new THREE.Vector3(DOOR.x, 0, 2.3), door: true }); path.push({ p: new THREE.Vector3(DOOR.x, 0, z), bag: true });
    path.push({ p: new THREE.Vector3(fromL ? 30 : -30, 0, z), end: true });
    custs.push({ g: p, path, i: 0, wait: 0, speed: rnd(1.8, 2.6) * (kid ? .8 : 1), phase: Math.random() * 6, rich: Math.random() < .1 });
  }
  const pool = { coins: [] };
  const coinGeo = new THREE.CylinderGeometry(.11, .11, .04, 14), coinMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: .9, roughness: .25, emissive: '#ffb300', emissiveIntensity: .6 });
  for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(coinGeo, coinMat); m.visible = false; m.userData = { v: new THREE.Vector3(), life: 0 }; scene.add(m); pool.coins.push(m); }
  function coins(pos, n) {
    for (let i = 0; i < n; i++) { const m = pool.coins.find(c => !c.visible); if (!m) return; m.visible = true; m.position.copy(pos); m.position.y += .3; m.userData.v.set(rnd(-1.8, 1.8), rnd(3.5, 6), rnd(-1.8, 1.8)); m.userData.life = 0; }
  }
  const FW = 700, fwGeo = new THREE.BufferGeometry(), fwPos = new Float32Array(FW * 3), fwCol = new Float32Array(FW * 3), fwVel = new Float32Array(FW * 3), fwLife = new Float32Array(FW);
  fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
  const fw = new THREE.Points(fwGeo, new THREE.PointsMaterial({ size: .5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); fw.frustumCulled = false; scene.add(fw);
  for (let i = 0; i < FW; i++) fwPos[i * 3 + 1] = -999;
  let fwNext = 0;
  function burst(x, y, z) {
    const c = new THREE.Color().setHSL(Math.random(), 1, .6);
    for (let i = 0; i < 90; i++) {
      const k = fwNext++ % FW, a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), s = rnd(3, 8);
      fwPos[k * 3] = x; fwPos[k * 3 + 1] = y; fwPos[k * 3 + 2] = z; fwVel[k * 3] = Math.sin(b) * Math.cos(a) * s; fwVel[k * 3 + 1] = Math.cos(b) * s; fwVel[k * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
      fwCol[k * 3] = c.r * 2; fwCol[k * 3 + 1] = c.g * 2; fwCol[k * 3 + 2] = c.b * 2; fwLife[k] = rnd(1.1, 1.9);
    }
  }

  // ---------- 직원 ----------
  const STAFF_DEF = {
    part: { make: () => person({ kind: 'apron', apron: '#4b974b', shirt: '#e8e8e8' }), spots: [[-2.2, -.4], [-3.0, .0]] },
    cashier: { make: () => person({ kind: 'cap', cap: '#4b974b', shirt: '#4b974b' }), spots: [[3.4, .0], [1.6, .0]] },
    night: { make: () => person({ kind: 'hood', shirt: '#2b3446', pants: '#111827' }), spots: [[-3.4, -1.9], [-1.0, -1.9]] },
    manager: { make: () => person({ kind: 'manager', shirt: '#f1f5f9', pants: '#111827' }), spots: [[.3, 2.4], [-3.3, 3.2]] },
    barista: { make: () => person({ kind: 'barista', cap: '#6b4226', shirt: '#6b4226', apron: '#3a2414' }), spots: [[3.35, -1.8], [2.2, -2.0]] },
    logi: { make: () => person({ kind: 'hard', shirt: '#1f2937' }), spots: [[11.8, 7.3], [12.4, 7.6]], vest: true },
    ai: { make: () => robot(), spots: [[-.6, 2.5], [1.0, 2.3]] },
    ceo: { make: () => null, spots: [] },
  };
  const staffGroup = new THREE.Group(); scene.add(staffGroup); const staffObj = {};
  function setStaff(id, n, names) {
    const d = STAFF_DEF[id]; if (!d || !d.spots.length) return;
    const want = n <= 0 ? 0 : n < 6 ? 1 : 2, arr = staffObj[id] ||= [];
    while (arr.length < want) {
      const p = d.make(), sp = d.spots[arr.length]; p.position.set(sp[0], 0, sp[1]);
      if (d.vest) add(p, BOX(U1 * 2.05, U1 * 1.7, U1 + .03), M('#ff7a00', { emissive: '#ff5500', emissiveIntensity: .3 }), 0, U1 * 3, 0);
      const nm = names && names[arr.length]; if (nm) p.add(nameTag(nm, { y: p.userData.h + .4 }));
      p.userData.pop = 0; p.userData.ph = Math.random() * 6; p.scale.setScalar(.01); staffGroup.add(p); arr.push(p);
    }
    while (arr.length > want) staffGroup.remove(arr.pop());
  }

  // ---------- 구매 패드 (타이쿤) ----------
  const tw = [];
  const padsG = new THREE.Group(); scene.add(padsG);
  const PADS = {}; const ROWZ = { staff: 8.4, goods: 12.0, up: 15.6 };
  function padPos(kind, idx, count) { const sp = 3.4, x0 = -(count - 1) * sp / 2; return [x0 + idx * sp, ROWZ[kind]]; }
  function drawPad(pad, d) {
    const g = pad.ctx, w = 256, st = d.state;
    const col = st === 'ok' ? ['#2fd45a', '#17a63f'] : st === 'no' ? ['#e2483b', '#a82a22'] : st === 'reg' ? ['#3aa0ff', '#1c6fd1'] : ['#8b94a3', '#5d6573'];
    const gr = g.createLinearGradient(0, 0, 0, w); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, w - 16);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.font = '88px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(d.icon, w / 2, 70);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.font = `900 30px ${FONT}`; g.fillText(d.name, w / 2, 135);
    g.font = `700 22px ${FONT}`; g.fillText(d.sub || '', w / 2, 168);
    g.font = `900 40px ${FONT}`; g.fillStyle = st === 'ok' ? '#fff9c4' : '#fff'; g.fillText(d.cost || '', w / 2, 214); g.shadowBlur = 0;
    pad.tex.needsUpdate = true;
  }
  function ensurePad(d) {
    let pad = PADS[d.id];
    if (!pad) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const grp = new THREE.Group(); add(grp, BOX(2.6, .22, 2.6), M('#2a2f3a', { roughness: .6 }), 0, .11, 0);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); top.rotation.x = -Math.PI / 2; top.position.y = .225; grp.add(top);
      padsG.add(grp);
      pad = PADS[d.id] = { id: d.id, grp, top, tex, ctx: c.getContext('2d'), cd: 0, flash: 0, sig: '' };
      grp.visible = false;
    }
    return pad;
  }
  function setPads(list) {
    const counts = { staff: 0, goods: 0, up: 0 }; list.forEach(d => { if (!d.fixed) counts[d.kind]++; });
    const seen = new Set(), idx = { staff: 0, goods: 0, up: 0 };
    list.forEach(d => {
      seen.add(d.id); const pad = ensurePad(d); pad.data = d;
      const [x, z] = d.fixed || padPos(d.kind, idx[d.kind]++, counts[d.kind]); pad.grp.position.x = x; pad.grp.position.z = z;
      const sig = [d.state, d.name, d.sub, d.cost, d.icon].join('|'); if (sig !== pad.sig) { pad.sig = sig; drawPad(pad, d); }
      if (!pad.grp.visible) { pad.grp.visible = true; pad.grp.scale.setScalar(.01); tw.push({ o: pad.grp, t: 0, d: .5 }); }
    });
    for (const id in PADS) if (!seen.has(id)) PADS[id].grp.visible = false;
  }

  const show = (o, v) => { if (o.visible === v) return; o.visible = v; if (v) { o.scale.setScalar(.01); tw.push({ o, t: 0, d: .6 }); } };
  let curKey = '', curRank = 0;
  function sync(S, ri, names) {
    const staff = S.staff || {}, goodsSum = Object.values(S.goods || {}).reduce((a, b) => a + b, 0), ups = S.ups || {};
    const key = JSON.stringify([staff, goodsSum, ups, S.fran, ri]);
    if (key === curKey) return; curKey = key; curRank = ri;
    for (const id in STAFF_DEF) setStaff(id, staff[id] || 0, names && names[id]);
    const st = goodsSum < 3 ? 1 : goodsSum < 8 ? 2 : goodsSum < 16 ? 3 : 4;
    shelves.forEach((s, i) => show(s, i < st));
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
  let az = 0, el = .52, zoom = 1, dragging = false, moved = 0, lastX = 0, lastY = 0, shake = 0;
  const pts = new Map(); let pinch0 = 0, zoom0 = 1;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); lastX = e.clientX; lastY = e.clientY; moved = 0; dragging = true; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; } });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) zoom = clamp(zoom0 * pinch0 / d, .55, 2.2); moved = 99; return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    az -= dx * .006; el = clamp(el + dy * .004, .12, 1.3);
  });
  const up = e => {
    const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (!pts.size) dragging = false;
    if (had && moved < 8 && e.type === 'pointerup') {
      const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(gplane, hit)) { moveTarget = hit.clone(); marker.position.set(hit.x, .1, hit.z); marker.visible = true; }
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (1 + e.deltaY * .001), .55, 2.2); }, { passive: false });

  function resize() {
    const w = view.clientWidth || 360, h = view.clientHeight || 300;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.fov = w / h < .9 ? 62 : 52; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view); resize();
  function lowQuality() { if (quality.low) return; quality.low = true; renderer.setPixelRatio(1); sun.castShadow = false; useFX = false; resize(); }
  if (/Mobi|Android/i.test(navigator.userAgent)) sun.shadow.mapSize.set(1024, 1024);

  // ---------- 메인 루프 ----------
  let T = 0, tod = .35, last = performance.now(), fAcc = 0, fN = 0, doorOpen = 0, pulse = 0, regCd = 0;
  const skyDay = new THREE.Color('#6fc3ff'), skyDusk = new THREE.Color('#ff9a62'), skyNight = new THREE.Color('#0a1230'), tmp = new THREE.Color(), sunDir = new THREE.Vector3();
  const regPos = new THREE.Vector3(1.8, 1.1, 1.6), REG = new THREE.Vector3(2.5, 0, 1.9);
  const camTarget = new THREE.Vector3(0, 1.5, 15), camGoal = new THREE.Vector3(), mv = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
  const regPad = { id: 'reg', fixed: [REG.x, REG.z], kind: 'up', state: 'reg', icon: '🧾', name: '계산대', sub: '올라서서 응대', cost: '밟으면 응대!' };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .1); last = now; T += dt;
    if (!quality.low && T > 3) { fAcc += dt; fN++; if (fN >= 90) { if (fAcc / fN > .04) lowQuality(); fAcc = 0; fN = 0; if (T > 20) fN = -9999; } }

    // 시간대
    tod = (tod + dt / 200) % 1;
    const ang = tod * Math.PI * 2 - Math.PI / 2, elev = Math.sin(ang), night = smooth(.12, -.25, elev), dusk = clamp(1 - Math.abs(elev) * 3.5, 0, 1) * (1 - night * .6);
    sunDir.set(Math.cos(ang) * .8, Math.max(elev, -.2), .5 - Math.cos(ang) * .2).normalize();
    sun.position.copy(sunDir).multiplyScalar(70); sun.target.position.set(0, 0, 8);
    sun.intensity = 2.4 * smooth(-.05, .35, elev); sun.color.set('#fff3d6').lerp(skyDusk, dusk * .7);
    hemi.intensity = lerp(.8, 1.0, 1 - night); moon.intensity = night * 1.8;
    hemi.color.set('#cfe9ff').lerp(new THREE.Color('#6a80d0'), night);
    tmp.copy(skyDay).lerp(skyDusk, dusk).lerp(skyNight, night); skyCol.copy(tmp); scene.fog.color.copy(tmp);
    renderer.toneMappingExposure = lerp(1.1, 1.3, night);
    sunDisc.position.copy(sunDir).multiplyScalar(160); sunDisc.visible = elev > -.05; sunDisc.material.color.set('#fff1b0').lerp(skyDusk, dusk);
    moonDisc.position.set(-sunDir.x * 160, Math.max(-sunDir.y * 160, 12), Math.min(-sunDir.z * 160, -90)); moonDisc.visible = night > .1;
    starMat.opacity = night * .95; cloudMat.opacity = lerp(.95, .3, night); cloudMat.color.set('#fff').lerp(skyDusk, dusk * .6).lerp(new THREE.Color('#4a5578'), night);
    clouds.children.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 150) c.position.x = -150; });
    warm1.intensity = lerp(.8, 22, night); warm2.intensity = lerp(.8, 22, night); lightPanelM.emissiveIntensity = lerp(.5, 2.4, clamp(night * 1.4 + .12, 0, 1));
    signMat.emissiveIntensity = lerp(.1, 1.1, night); branches.forEach(b => b.userData.sm.emissiveIntensity = lerp(.1, 1.0, night));
    towers.forEach(t => t.userData.mat.emissiveIntensity = night * .95); hqMat.emissiveIntensity = .08 + night * .8;
    globe.rotation.y += dt * .5; globeRing.rotation.x = Math.PI / 2 + Math.sin(T) * .2; globeRing.rotation.y += dt * .6;

    // 플레이어 이동 (카메라 기준)
    const ix = joy.x + ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const iy = joy.y + ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
    const il = Math.hypot(ix, iy);
    fwd.set(-Math.sin(az), 0, -Math.cos(az)); rgt.set(Math.cos(az), 0, -Math.sin(az));
    mv.set(0, 0, 0);
    if (il > .08) { moveTarget = null; marker.visible = false; mv.addScaledVector(fwd, iy).addScaledVector(rgt, ix); if (il > 1) mv.divideScalar(il); }
    else if (moveTarget) { const dx = moveTarget.x - player.position.x, dz = moveTarget.z - player.position.z, d = Math.hypot(dx, dz); if (d < .25) { moveTarget = null; marker.visible = false; } else mv.set(dx / d, 0, dz / d); }
    const speed = 7.2, mvLen = mv.length();
    if (mvLen > .02) { player.position.addScaledVector(mv, speed * dt); const ty = Math.atan2(mv.x, mv.z); let d = ty - pYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; pYaw += d * Math.min(1, dt * 14); player.rotation.y = pYaw; }
    player.position.x = clamp(player.position.x, -28, 28); player.position.z = clamp(player.position.z, -7, 27.5);
    collide(player.position, .36);
    if (pAir) { pvy -= 20 * dt; player.position.y += pvy * dt; if (player.position.y <= 0) { player.position.y = 0; pvy = 0; pAir = 0; } }
    const PU = player.userData;
    if (mvLen > .02 && !pAir) swing(player, T, 13, .8 * Math.min(1, mvLen)); else if (pAir) swing(player, T, 4, .5); else { PU.legL.rotation.x *= .8; PU.legR.rotation.x *= .8; PU.armL.rotation.x = Math.sin(T * 2) * .05; PU.armR.rotation.x = -Math.sin(T * 2) * .05; }
    marker.scale.setScalar(1 + Math.sin(T * 8) * .15);

    // 패드 / 계산대 밟기
    regCd -= dt;
    if (Math.hypot(player.position.x - REG.x, player.position.z - REG.z) < 1.0 && player.position.y < .6 && regCd <= 0) { regCd = .32; if (cb.onTap) cb.onTap(); coins(regPos, 2); pulse = .3; shake = .25; customerSoon = true; }
    for (const id in PADS) {
      const pad = PADS[id]; if (!pad.grp.visible || !pad.data) continue;
      pad.cd -= dt; pad.flash = Math.max(0, pad.flash - dt);
      const near = Math.abs(player.position.x - pad.grp.position.x) < 1.25 && Math.abs(player.position.z - pad.grp.position.z) < 1.25 && player.position.y < .5;
      pad.grp.position.y = near ? -.05 : 0;
      pad.top.material.color.setScalar(1 + pad.flash * 1.5);
      if (id !== 'reg' && near && pad.cd <= 0 && pad.data.state !== 'done') { pad.cd = pad.data.state === 'ok' ? .42 : 1.5; const ok = cb.onPad && cb.onPad(id); if (ok) { pad.flash = .35; coins(pad.grp.position, 5); shake = .3; } }
    }

    // 손님 생성
    spawnT -= dt;
    if (customerSoon) { customerSoon = false; if (spawnT < 1.2) { spawnCustomer(); spawnT = 1.2; } }
    else if (spawnT <= 0 && rate > 0) { spawnCustomer(); spawnT = clamp(7 / Math.pow(rate, .32), .35, 6) * rnd(.7, 1.3); }
    let doorNear = Math.hypot(player.position.x - DOOR.x, player.position.z - DOOR.z) < 2.2;
    for (let i = custs.length - 1; i >= 0; i--) {
      const c = custs[i], wp = c.path[c.i];
      if (c.wait > 0) { c.wait -= dt; swing(c.g, T + c.phase, 2, .02); c.g.userData.head.rotation.y = Math.sin(T * 2 + c.phase) * .5; if (c.wait <= 0) { if (wp.pay) { coins(regPos, c.rich ? 7 : 3); pulse = .35; if (cb.onPay) cb.onPay(); } c.i++; if (c.i >= c.path.length) { scene.remove(c.g); custs.splice(i, 1); } } continue; }
      const dx = wp.p.x - c.g.position.x, dz = wp.p.z - c.g.position.z, dist = Math.hypot(dx, dz), step = c.speed * dt;
      if (wp.door && Math.hypot(c.g.position.x - DOOR.x, c.g.position.z - DOOR.z) < 3) doorNear = true;
      if (dist <= step) {
        c.g.position.set(wp.p.x, 0, wp.p.z);
        if (wp.wait) { c.wait = wp.wait; c.g.rotation.y = Math.PI; c.g.userData.head.rotation.y = 0; continue; }
        if (wp.bag) add(c.g, BOX(.2, .26, .1), M('#f8fafc'), U1 * 1.7, .6, .08);
        c.i++; if (c.i >= c.path.length) { scene.remove(c.g); custs.splice(i, 1); }
      } else {
        c.g.position.x += dx / dist * step; c.g.position.z += dz / dist * step;
        const ty = Math.atan2(dx, dz); let d = ty - c.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; c.g.rotation.y += d * Math.min(1, dt * 10);
        swing(c.g, T + c.phase, 9, .7);
      }
    }
    doorOpen = lerp(doorOpen, doorNear ? .62 : 0, Math.min(1, dt * 6)); doorL.position.x = -1.85 - doorOpen; doorR.position.x = -1.15 + doorOpen;

    for (const id in staffObj) staffObj[id].forEach(p => {
      const U = p.userData; U.pop = Math.min(1, U.pop + dt * 1.6); p.scale.setScalar(Math.max(easeOutBack(U.pop), .01));
      const ph = U.ph + T;
      if (id === 'ai') { p.position.y = Math.sin(ph * 1.5) * .04; p.rotation.y = Math.sin(ph * .5) * .6; U.armR.rotation.x = Math.sin(ph * 2) * .4; }
      else { p.rotation.y = id === 'logi' ? -.9 + Math.sin(ph) * .2 : Math.sin(ph * .6) * .25; const busy = Math.sin(ph * 3) * .5 - .5; U.armR.rotation.x = id === 'barista' || id === 'cashier' ? -.9 + busy * .3 : Math.sin(ph * 2) * .25; U.armL.rotation.x = Math.sin(ph * 2 + 1) * .15; U.head.rotation.y = Math.sin(ph * .8) * .4; }
    });
    holo.position.y = 6.2 + Math.sin(T * 1.2) * .25; holo.rotation.y += dt * .7; holoCore.rotation.x += dt; holoRings.forEach((r, i) => { r.rotation.x += dt * (.6 + i * .3); r.rotation.z += dt * (.4 + i * .2); });
    trophies.children.forEach(m => { m.rotation.y += dt * 1.4; m.position.y = 4.95 + Math.sin(T * 2 + m.userData.ph) * .07; });

    for (let i = tw.length - 1; i >= 0; i--) { const q = tw[i]; q.t += dt; const k = clamp(q.t / q.d, 0, 1); q.o.scale.setScalar(Math.max(.01, easeOutBack(k))); if (k >= 1) { q.o.scale.setScalar(1); tw.splice(i, 1); } }
    branches.forEach(b => { if (b.visible) { b.userData.t = Math.min(1, b.userData.t + dt * 1.1); b.scale.y = Math.max(.01, easeOutBack(b.userData.t)); } });
    towers.forEach(t => { if (t.visible) { t.userData.t = Math.min(1, t.userData.t + dt * .6); const k = easeOutBack(t.userData.t); t.scale.y = Math.max(.01, k); t.position.y = t.userData.h * k / 2; } });

    pool.coins.forEach(m => { if (!m.visible) return; const u = m.userData; u.life += dt; u.v.y -= 12 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += dt * 9; m.rotation.z += dt * 5; if (m.position.y < .1 || u.life > 1.3) m.visible = false; });
    for (let i = 0; i < FW; i++) if (fwLife[i] > 0) { fwLife[i] -= dt; fwVel[i * 3 + 1] -= 4 * dt; fwPos[i * 3] += fwVel[i * 3] * dt; fwPos[i * 3 + 1] += fwVel[i * 3 + 1] * dt; fwPos[i * 3 + 2] += fwVel[i * 3 + 2] * dt; if (fwLife[i] <= 0) fwPos[i * 3 + 1] = -999; }
    fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true;

    // 3인칭 카메라 (플레이어 추적)
    camGoal.set(player.position.x, 1.5 + player.position.y * .5, player.position.z - 2.2); camTarget.lerp(camGoal, Math.min(1, dt * 6));
    const baseDist = [11, 12.5, 14, 16, 18, 20, 22][Math.min(curRank, 6)] * zoom;
    shake = Math.max(0, shake - dt * 3);
    const cx = camTarget.x + Math.sin(az) * Math.cos(el) * baseDist, cy = camTarget.y + Math.sin(el) * baseDist, cz = camTarget.z + Math.cos(az) * Math.cos(el) * baseDist;
    camera.position.set(cx + (Math.random() - .5) * shake * .1, Math.max(.8, cy) + (Math.random() - .5) * shake * .1, cz);
    camera.lookAt(camTarget);
    pulse = Math.max(0, pulse - dt); regScreen.material.emissiveIntensity = 1.4 + pulse * 6;

    if (useFX) composer.render(); else renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  setPads([regPad]);

  return {
    sync, setPads(list) { setPads([regPad, ...list]); },
    setRate(r) { rate = r; },
    setJoy(x, y) { joy = { x, y }; },
    jump,
    celebrate() { let n = 0; const id = setInterval(() => { const p = player.position; burst(p.x + rnd(-8, 8), rnd(8, 15), p.z - rnd(4, 14)); if (++n > 6) clearInterval(id); }, 260); },
    teleport(x, z) { player.position.set(x, 0, z); moveTarget = null; camTarget.set(x, 1.5, z - 2.2); },
    setNight(v) { tod = v ? .0 : .38; },
  };
}
