'use strict';
const CAM = { theta: 0.8, elev: 0.75, dist: 330, target: new THREE.Vector3(0, 0, 0), dragging: false, idle: 0 };
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

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
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; playerKey(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { keys[k] = false; });
});
const cv = renderer.domElement; let lx = 0, ly = 0;
cv.addEventListener('pointerdown', e => { if (P.active) return; CAM.dragging = true; lx = e.clientX; ly = e.clientY; CAM.idle = 0; });
addEventListener('pointerup', () => { CAM.dragging = false; });
addEventListener('pointermove', e => { if (!CAM.dragging) return; CAM.theta -= (e.clientX - lx) * 0.006; CAM.elev = clamp(CAM.elev + (e.clientY - ly) * 0.005, 0.15, 1.45); lx = e.clientX; ly = e.clientY; CAM.idle = 0; });
cv.addEventListener('wheel', e => { if (P.active) return; CAM.dist = clamp(CAM.dist * Math.exp(e.deltaY * 0.001), 22, 650); e.preventDefault(); }, { passive: false });

// ----- 카메라 (경영 · 타이틀)
const _f = new THREE.Vector3();
function orbit(dt) {
  const fl = UI.follow && G.buses.includes(UI.follow) ? UI.follow : null;
  if (G.state === 'title') { CAM.theta += dt * 0.07; CAM.dist = 260; CAM.elev = 0.5; CAM.target.set(0, 0, 0); }
  else if (fl) { CAM.target.lerp(_f.set(fl.agent.x, 1, fl.agent.z), Math.min(1, dt * 5)); }
  else { CAM.target.lerp(_f.set(0, 0, 0), Math.min(1, dt * 3)); CAM.idle += dt; if (CAM.idle > 8) CAM.theta += dt * 0.03; }
  const c = Math.cos(CAM.elev) * CAM.dist, s = Math.sin(CAM.elev) * CAM.dist;
  camera.position.set(CAM.target.x + Math.sin(CAM.theta) * c, CAM.target.y + s, CAM.target.z + Math.cos(CAM.theta) * c); camera.lookAt(CAM.target);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}

// ----- 루프
let prev = performance.now(), fpsT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  const active = P.active;
  if (!(active && P.paused)) updateWorld(active ? dt : dt * (G.state === 'company' ? G.speed : 1));
  if (active) { updatePlayer(dt); driveCamera(dt); if ((fpsT -= dt) < 0) { fpsT = 0.1; UI.updateHUD(); } } else orbit(dt);
  const fx = active ? P.x : CAM.target.x, fz = active ? P.z : CAM.target.z;
  if (world.sunDir) { sun.position.set(fx + world.sunDir.x, world.sunDir.y, fz + world.sunDir.z); sun.target.position.set(fx, 0, fz); sun.target.updateMatrixWorld(); }
  renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
  if (active && !$('rear').classList.contains('hide')) {
    const r = $('rear').getBoundingClientRect(), cam = rearView(); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
    const co = P.cam === 2; if (co) P.bus.model.setCockpit(false);
    renderer.setScissorTest(true); renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height);
    renderer.render(scene, cam); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); if (co) P.bus.model.setCockpit(true);
  }
  requestAnimationFrame(frame);
}

// ----- 시작
resize(); buildCity(); buildStops(); initGuides(); UI.init();
startSchoolWorld(); UI.showTitle();
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => { if (G && !G.school) saveCompany(); });
