'use strict';
const CAM = { theta: 0.8, elev: 0.75, dist: 1400, target: new THREE.Vector3(0, 0, 0), dragging: false, idle: 0 };
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {   // 탭을 숨기면 주행 일시정지 · 소리 끄기
  if (document.hidden) { if (P.active && !P.paused && $('modal').classList.contains('hide')) UI.pauseModal(); if (actx && actx.state === 'running') actx.suspend(); }
  else if (actx && actx.state === 'suspended') actx.resume();
});

// ----- 입력
const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '');
addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (!$('editor').classList.contains('hide')) { $('editor').classList.add('hide'); return; }
    if (!$('modal').classList.contains('hide')) { if (P.active && P.paused && !P.done) { UI.closeModal(); P.paused = false; } else if (!P.active) UI.closeModal(); return; }
    if (P.active) UI.pauseModal(); return;
  }
  if (typing(e)) return;
  if (P.active && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true; if (!e.repeat) playerKey(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// ----- 터치 조작: 버튼 · 페달 · 둥근 운전대
document.querySelectorAll('#touch [data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); keys[k] = true; playerKey(k); });
  for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => { keys[k] = false; });
});
$('tbPause').addEventListener('pointerdown', e => { e.preventDefault(); if (P.active && !P.paused) UI.pauseModal(); });
const WMAX = 2.6, wheelEl = $('wheel'), wheelSvg = $('wheelSvg'); let wAng = 0, wDrag = null, wRaf = 0;
function setWheel(a) { wAng = a; wheelSvg.style.transform = 'rotate(' + (a * 180 / Math.PI) + 'deg)'; P.wheelIn = -a / WMAX; }
wheelEl.addEventListener('pointerdown', e => {
  e.preventDefault(); wheelEl.setPointerCapture(e.pointerId); const r = wheelEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  wDrag = { cx, cy, last: Math.atan2(e.clientY - cy, e.clientX - cx) }; P.wheelOn = true; cancelAnimationFrame(wRaf);
});
wheelEl.addEventListener('pointermove', e => { if (!wDrag) return; const a = Math.atan2(e.clientY - wDrag.cy, e.clientX - wDrag.cx); const d = wrapPi(a - wDrag.last); wDrag.last = a; setWheel(clamp(wAng + d, -WMAX, WMAX)); });
const wheelUp = () => { if (!wDrag) return; wDrag = null; const back = () => { setWheel(wAng * 0.86); if (Math.abs(wAng) > 0.02) wRaf = requestAnimationFrame(back); else { setWheel(0); P.wheelOn = false; } }; back(); };
wheelEl.addEventListener('pointerup', wheelUp); wheelEl.addEventListener('pointercancel', wheelUp);
addEventListener('pointerdown', () => { if (!actx) initAudio(); else if (actx.state === 'suspended') actx.resume(); });   // 모바일: 첫 터치에 소리 활성화
$('sideToggle').addEventListener('click', () => { const s = $('side'), hid = s.style.display === 'none'; s.style.display = hid ? '' : 'none'; $('sideToggle').textContent = hid ? '📋 패널 접기' : '📋 패널 열기'; });
{ let pref = null; try { pref = localStorage.getItem('busTouch'); } catch (e) { } const auto = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || navigator.maxTouchPoints > 0; UI.setTouch(pref === null ? auto : pref === '1', true); }
const cv = renderer.domElement, ptrs = new Map(); let lastPinch = 0;
const modalOpen = () => !$('editor').classList.contains('hide') || !$('modal').classList.contains('hide');
function panScreen(px, py) {
  const s = CAM.dist * 0.0016, st = Math.sin(CAM.theta), ct = Math.cos(CAM.theta);
  CAM.target.x = clamp(CAM.target.x - ct * px * s - st * py * s, -EXT - 200, EXT + 200); CAM.target.z = clamp(CAM.target.z + st * px * s - ct * py * s, -EXT - 200, EXT + 200); UI.follow = null;
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { if (P.active) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); CAM.idle = 0; lastPinch = 0; });
const endPtr = e => { ptrs.delete(e.pointerId); lastPinch = 0; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p || P.active) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; CAM.idle = 0;
  if (ptrs.size === 2) {   // 두 손가락: 확대/축소 + 이동
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (lastPinch) CAM.dist = clamp(CAM.dist * lastPinch / d, 8, 3200); lastPinch = d; panScreen(dx * 0.5, dy * 0.5); return;
  }
  if (p.b === 2 || p.b === 1 || p.sh) panScreen(dx, dy);
  else { CAM.theta -= dx * 0.006; CAM.elev = clamp(CAM.elev + dy * 0.005, 0.08, 1.5); }
});
cv.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(e.deltaY * 0.0012); if (P.active) P.zoom = clamp(P.zoom * f, 0.45, 3.5); else CAM.dist = clamp(CAM.dist * f, 8, 3200); }, { passive: false });
cv.addEventListener('dblclick', () => { if (!P.active) { CAM.target.set(0, 0, 0); CAM.dist = 1400; CAM.elev = 0.75; UI.follow = null; } });

// ----- 카메라 (경영 · 타이틀)
const _f = new THREE.Vector3();
function orbit(dt) {
  camera.up.set(0, 1, 0);
  const fl = UI.follow && G.buses.includes(UI.follow) ? UI.follow : null;
  if (G.state === 'title') { CAM.theta += dt * 0.07; CAM.dist = 1400; CAM.elev = 0.5; CAM.target.set(0, 0, 0); }
  else {
    if (fl) CAM.target.lerp(_f.set(fl.agent.x, 1, fl.agent.z), Math.min(1, dt * 5));
    if (!modalOpen() && !typing({ target: document.activeElement })) {
      const sp = CAM.dist * 0.9 * dt, st = Math.sin(CAM.theta), ct = Math.cos(CAM.theta); let mx = 0, mz = 0;
      if (keys.KeyW || keys.ArrowUp) { mx -= st; mz -= ct; } if (keys.KeyS || keys.ArrowDown) { mx += st; mz += ct; } if (keys.KeyA || keys.ArrowLeft) { mx -= ct; mz += st; } if (keys.KeyD || keys.ArrowRight) { mx += ct; mz -= st; }
      if (mx || mz) { CAM.target.x = clamp(CAM.target.x + mx * sp, -EXT - 200, EXT + 200); CAM.target.z = clamp(CAM.target.z + mz * sp, -EXT - 200, EXT + 200); UI.follow = null; CAM.idle = 0; }
      if (keys.KeyQ) CAM.theta += dt * 1.2; if (keys.KeyE) CAM.theta -= dt * 1.2;
      if (keys.Equal || keys.NumpadAdd) CAM.dist = clamp(CAM.dist * Math.exp(-dt * 1.2), 8, 3200); if (keys.Minus || keys.NumpadSubtract) CAM.dist = clamp(CAM.dist * Math.exp(dt * 1.2), 8, 3200);
    }
    if (G.state === 'company' && !fl && !ptrs.size) { CAM.idle += dt; if (CAM.idle > 12) CAM.theta += dt * 0.03; }
  }
  const c = Math.cos(CAM.elev) * CAM.dist, s = Math.sin(CAM.elev) * CAM.dist;
  camera.position.set(CAM.target.x + Math.sin(CAM.theta) * c, Math.max(2.5, CAM.target.y + s), CAM.target.z + Math.cos(CAM.theta) * c); camera.lookAt(CAM.target);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}

// ----- 루프
let prev = performance.now(), fpsT = 0, sirT = 0;
function frameBody(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  const active = P.active;
  if (!(active && P.paused)) { const sdt = active ? dt : dt * (G.state === 'company' ? G.speed : 1), n = Math.max(1, Math.ceil(sdt / 0.1)); for (let i = 0; i < n; i++) updateWorld(sdt / n); }
  if (active) { updatePlayer(dt); driveCamera(dt); if ((fpsT -= dt) < 0) { fpsT = 0.1; UI.updateHUD(); } } else orbit(dt);
  world.focus = active ? { x: P.x, z: P.z, r: 480 } : { x: CAM.target.x, z: CAM.target.z, r: Math.max(480, CAM.dist * 0.95) };
  if ((sirT = (sirT || 0) - dt) < 0) { sirT = 0.15; let bd = 1e9; for (const a of agents) if (a.emergency) { const d = Math.hypot(a.x - world.focus.x, a.z - world.focus.z); if (d < bd) bd = d; } sirenAudio(bd < 220 ? 1 - bd / 220 : 0); }
  updateWeather(dt); cullChunks(active ? 900 : Math.max(1500, CAM.dist * 2.4), true); const fm = clamp(1 - 0.88 * WX.fogK - 0.3 * WX.rainK, 0.08, 1);
  scene.fog.near = (active ? 200 : Math.max(320, CAM.dist * 0.6)) * fm * fm; scene.fog.far = (active ? 950 : Math.max(1800, CAM.dist * 2.8)) * fm;
  const fx = active ? P.x : CAM.target.x, fz = active ? P.z : CAM.target.z;
  if (world.sunDir) { sun.position.set(fx + world.sunDir.x, world.sunDir.y, fz + world.sunDir.z); sun.target.position.set(fx, 0, fz); sun.target.updateMatrixWorld(); }
  renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
  if (active && !$('rear').classList.contains('hide')) {
    const r = $('rear').getBoundingClientRect(), cam = rearView(); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
    const co = P.cam === 2; if (co) P.bus.model.setCockpit(false);
    renderer.setScissorTest(true); renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height);
    renderer.render(scene, cam); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); if (co) P.bus.model.setCockpit(true);
  }
}
let errN = 0, errT = 0;
function frame(now) {   // 한 프레임에서 오류가 나도 루프가 멈추지 않게 보호
  try { frameBody(now); errN = Math.max(0, errN - 0.02); }
  catch (e) {
    console.error(e); try { renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); } catch (_) { }
    errN++; if (now - errT > 6000) { errT = now; toast('⚠ 오류가 발생했어요 — 계속 진행합니다', 'bad'); }
    if (errN > 40) { errN = 0; try { if (P.active) stopManual(false); } catch (_) { } }
  }
  requestAnimationFrame(frame);
}

// ----- 시작
resize(); buildCity(); buildStops(); initGuides(); initWeather(); UI.init();
startSchoolWorld(); UI.showTitle();
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => { if (G && !G.school) saveCompany(); });
