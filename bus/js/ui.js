'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = c => '#' + c.toString(16).padStart(6, '0');
function toast(text, kind) { const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = text; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2800); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }
function bigText(t, ms) { $('center').textContent = t; setTimeout(() => { if ($('center').textContent === t) $('center').textContent = ''; }, ms || 1200); }

// ===== 소리 =====
let actx = null, eng = null, muted = false;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = actx.createOscillator(), o2 = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(actx.destination); o1.start(); o2.start(); eng = { o1, o2, g };
  } catch (e) { actx = null; }
}
function tone(f, d, type, vol, when, slide) {
  if (!actx || muted) return; const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + (when || 0);
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .02);
}
function sfx(n) {
  if (!actx) return;
  if (n === 'horn') { tone(311, .7, 'sawtooth', .07); tone(392, .7, 'sawtooth', .07); }
  else if (n === 'door') { tone(520, .12, 'square', .04); tone(390, .16, 'square', .04, .1); }
  else if (n === 'chime') { tone(784, .25, 'sine', .08); tone(988, .35, 'sine', .08, .2); }
  else if (n === 'bad') tone(150, .25, 'sawtooth', .07, 0, 90);
  else if (n === 'good') { tone(660, .12, 'sine', .07); tone(880, .2, 'sine', .07, .1); }
  else if (n === 'crash') tone(90, .35, 'sawtooth', .12, 0, 40);
  else if (n === 'start') tone(440, .1, 'sine', .05);
}
function engineAudio(speed, thr) {
  if (!actx || !eng) return; const gs = 4.5, gear = Math.min(5, Math.floor(speed / gs)), rpm = (speed - gear * gs) / gs, f = 36 + gear * 3 + rpm * 38 + thr * 6, t = actx.currentTime;
  eng.o1.frequency.setTargetAtTime(f, t, .06); eng.o2.frequency.setTargetAtTime(f * .5, t, .06); eng.g.gain.setTargetAtTime(muted || !P.active || P.paused ? 0 : .025 + thr * .03, t, .1);
}
function announce(text) { try { if (muted || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }

// ===== 지도 그리기 (미니맵 · 편집기 공용) =====
function drawMap(ctx, size, o) {
  o = o || {}; const sc = size / (2 * EXT + 60), M = (x, z) => [(x + EXT + 30) * sc, (z + EXT + 30) * sc], k = size / 760;
  ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#1b2230'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#262e40'; for (const b of world.blocks.slice(0, 36)) { const [x, y] = M(b.minx, b.minz); ctx.fillRect(x, y, (b.maxx - b.minx) * sc, (b.maxz - b.minz) * sc); }
  ctx.strokeStyle = '#4a5468'; ctx.lineWidth = ROAD * sc * 0.55; ctx.lineCap = 'butt';
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const n = NP[nid(i, j)]; for (const m of [i < GN - 1 && NP[nid(i + 1, j)], j < GN - 1 && NP[nid(i, j + 1)]]) if (m) { const [a, b] = M(n.x, n.z), [c, d] = M(m.x, m.z); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); } }
  const poly = (path, col, w, al) => { ctx.strokeStyle = hex(col); ctx.globalAlpha = al; ctx.lineWidth = w * k; ctx.lineJoin = 'round'; ctx.beginPath(); path.pts.forEach((p, i) => { const [x, y] = M(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.globalAlpha = 1; };
  if (o.routes) for (const r of o.routes) if (r !== o.skip) poly(r.path, r.color, o.thin ? 3 : 4, o.dim || .8);
  if (o.edit && o.edit.path) poly(o.edit.path, o.edit.color, 6, 1);
  const used = new Map(); if (o.routes) for (const r of o.routes) for (const id of r.stopIds) used.set(id, r.color);
  STOPS.forEach(s => {
    const [x, y] = M(s.curb.x, s.curb.z), sel = o.edit && o.edit.stops.indexOf(s.id), isSel = sel >= 0, hover = o.hover === s.id;
    ctx.beginPath(); ctx.arc(x, y, (isSel ? 9 : hover ? 9 : o.mini ? 4.5 : 6.5) * (o.mini ? 1 : k), 0, 7);
    ctx.fillStyle = isSel ? hex(o.edit.color) : used.has(s.id) ? hex(used.get(s.id)) : '#e2e8f0'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = hover ? '#ffb020' : '#0b1020'; ctx.stroke();
    if (isSel) { ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sel + 1, x, y + 1 * k); }
    if (!o.mini && (hover || isSel)) { ctx.font = `600 ${12 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#0b1020'; ctx.strokeText(s.name, x, y - 11 * k); ctx.fillStyle = '#fff'; ctx.fillText(s.name, x, y - 11 * k); }
    if (o.crowd && s.waiting > 8) { ctx.beginPath(); ctx.arc(x, y, (6 + s.waiting / 6) * k, 0, 7); ctx.strokeStyle = 'rgba(255,176,32,.5)'; ctx.lineWidth = 2 * k; ctx.stroke(); }
  });
  if (o.target !== undefined) { const s = STOPS[o.target], [x, y] = M(s.curb.x, s.curb.z); ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 3; ctx.stroke(); }
  if (o.buses) for (const b of o.buses) { const [x, y] = M(b.agent.x, b.agent.z); ctx.beginPath(); ctx.arc(x, y, 3.5 * (o.mini ? 1 : k * 1.2), 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }
  if (o.player) { const [x, y] = M(P.x, P.z), dx = Math.sin(P.h), dz = Math.cos(P.h), r = 9; ctx.fillStyle = '#ffb020'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + dx * r, y + dz * r); ctx.lineTo(x - dx * r * .6 + dz * r * .6, y - dz * r * .6 - dx * r * .6); ctx.lineTo(x - dx * r * .6 - dz * r * .6, y - dz * r * .6 + dx * r * .6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  return { M, sc };
}

// ===== UI 객체 =====
const UI = {
  tab: 'routes', follow: null, edState: null,
  hideAll() { for (const id of ['title', 'hud', 'mgmt', 'editor', 'modal']) $(id).classList.add('hide'); $('rear').classList.add('hide'); $('touch').classList.remove('on'); },
  showTitle() {
    this.hideAll(); $('title').classList.remove('hide'); G.state = 'title'; this.follow = null;
    const s = loadSaved(); $('bCont').disabled = !s; $('contInfo').textContent = s ? `${s.name} · ${fmtMoney(s.money)}` : '저장된 회사 없음';
    const n = Object.keys(SCHOOL.done).length; $('schoolInfo').textContent = SCHOOL.license ? '🪪 면허 취득 완료!' : `수료 ${n}/4`;
  },
  showMgmt() { this.hideAll(); $('mgmt').classList.remove('hide'); G.state = 'company'; this.refreshTop(); this.renderTab(true); },
  showDrive() {
    this.hideAll(); $('hud').classList.remove('hide'); $('rear').classList.remove('hide'); $('touch').classList.add('on');
    const L = P.lesson, t = $('tasks'); if (L && L.id === 'L1') { t.classList.remove('hide'); } else t.classList.add('hide');
  },
  modal(html) { $('modalBox').innerHTML = html; $('modal').classList.remove('hide'); },
  closeModal() { $('modal').classList.add('hide'); },

  // --- 상단바
  initTop() {
    $('topbar').innerHTML = `<span class="co" id="tCo"></span><span class="stat" id="tMoney"></span><span class="stat" id="tLv"></span><span class="stat" id="tRep"></span><span class="stat" id="tRate"></span><span class="stat" id="tTime"></span><span class="sp"></span>
      <span class="spd">${[1, 2, 4].map(x => `<button data-sp="${x}">${x}×</button>`).join(' ')}</span><button class="btn sm" id="tbSave">💾 저장</button><button class="btn sm" id="tbMenu">메뉴</button>`;
    $('topbar').querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { G.speed = +b.dataset.sp; this.refreshTop(); });
    $('tbSave').onclick = () => { saveCompany(); toast('저장했어요', 'good'); }; $('tbMenu').onclick = () => { saveCompany(); this.showTitle(); };
  },
  refreshTop() {
    const l = level(), nl = LEVELS[l] !== undefined ? LEVELS[l] : null, h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60);
    $('tCo').textContent = '🚌 ' + G.name; $('tMoney').textContent = '💰 ' + fmtMoney(G.money); $('tLv').textContent = '⭐ Lv.' + l + (nl ? ` (${G.pax}/${nl})` : '');
    $('tRep').textContent = '👍 평판 ' + Math.round(G.rep); $('tRate').textContent = '📈 ' + fmtMoney(G.rate) + '/분'; $('tTime').textContent = '🕒 ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    $('topbar').querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === G.speed));
  },
  // --- 탭
  renderTab(force) {
    const body = $('tabBody'), el = document.activeElement; if (!force && el && (el.tagName === 'SELECT' || el.tagName === 'INPUT') && body.contains(el)) return;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab)); const sc = body.scrollTop;
    if (!force && UI.down) return;
    const html = this['html_' + this.tab](); if (!force && html === this.lastHtml && this.lastTab === this.tab) return;
    this.lastHtml = html; this.lastTab = this.tab; body.innerHTML = html; body.scrollTop = sc; this['bind_' + this.tab](body);
  },
  html_routes() {
    let h = `<button class="btn pri" id="newRoute" style="width:100%;margin-bottom:10px">＋ 새 노선 설계하기</button>`;
    if (!G.routes.length) h += `<p class="muted">노선이 없어요. 새 노선을 만들어 보세요!</p>`;
    for (const r of G.routes) {
      const nb = G.buses.filter(b => b.routeId === r.id).length;
      h += `<div class="card"><h4><span class="chip" style="background:${hex(r.color)}">${r.num}</span>${esc(r.name)} <small>정류장 ${r.stopIds.length}곳 · ${(r.path.L / 1000).toFixed(2)}km</small></h4>
        <small>운행 버스 ${nb}대 · 누적 승객 ${r.pax}명 · 누적 수입 ${fmtMoney(r.income)}</small>
        <div class="acts"><button class="btn sm" data-edit="${r.id}">✏ 수정</button><button class="btn sm" data-addbus="${r.id}">＋ 버스</button><button class="btn sm" data-drive="${r.id}">🎮 직접 운전</button><button class="btn sm bad" data-del="${r.id}">🗑</button></div></div>`;
    }
    return h;
  },
  bind_routes(b) {
    const nr = b.querySelector('#newRoute'); if (nr) nr.onclick = () => this.openEditor(null);
    b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => this.openEditor(routeById(+x.dataset.edit)));
    b.querySelectorAll('[data-addbus]').forEach(x => x.onclick = () => this.buyModal(+x.dataset.addbus));
    b.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { const r = routeById(+x.dataset.del); if (confirm(`'${r.name}' 노선을 삭제할까요? (소속 버스는 모두 매각됩니다)`)) { deleteRoute(r); this.renderTab(true); } });
    b.querySelectorAll('[data-drive]').forEach(x => x.onclick = () => { const bs = G.buses.filter(q => q.routeId === +x.dataset.drive); if (!bs.length) { toast('이 노선에 버스가 없어요. 먼저 버스를 추가하세요', 'bad'); return; } this.driveBus(bs[0]); });
  },
  html_fleet() {
    let h = `<button class="btn pri" id="buyBus" style="width:100%;margin-bottom:10px">＋ 버스 구매</button>`;
    if (!G.buses.length) h += `<p class="muted">보유한 버스가 없어요.</p>`;
    for (const b of G.buses) {
      const T = BUS_TYPES[b.type], r = routeById(b.routeId), st = b.manual ? '🎮 직접 운전 중' : b.phase === 'run' ? '운행 중' : '정차 · 승하차';
      h += `<div class="card"><h4>${T.name} #${b.id} <small>${st}</small></h4>
        <div class="row"><select data-route="${b.id}" ${b.manual ? 'disabled' : ''}>${G.routes.map(q => `<option value="${q.id}" ${q.id === b.routeId ? 'selected' : ''}>${q.num} ${esc(q.name)}</option>`).join('')}</select><small>승객 ${b.pax.length}/${T.cap}</small></div>
        <div class="meter"><i style="width:${b.pax.length / T.cap * 100}%"></i></div><small>누적 수입 ${fmtMoney(b.income)} · 인건비 ${fmtMoney(T.wage)}/초</small>
        <div class="acts"><button class="btn sm" data-bdrive="${b.id}">🎮 운전하기</button><button class="btn sm" data-bfollow="${b.id}">👁 관제</button><button class="btn sm bad" data-bsell="${b.id}">매각 ${fmtMoney(T.price * .5)}</button></div></div>`;
    }
    return h;
  },
  bind_fleet(b) {
    const bb = b.querySelector('#buyBus'); if (bb) bb.onclick = () => this.buyModal(G.routes[0] && G.routes[0].id);
    b.querySelectorAll('[data-route]').forEach(x => x.onchange = () => { reassignBus(busById(+x.dataset.route), +x.value); this.renderTab(true); });
    b.querySelectorAll('[data-bdrive]').forEach(x => x.onclick = () => this.driveBus(busById(+x.dataset.bdrive)));
    b.querySelectorAll('[data-bfollow]').forEach(x => x.onclick = () => { this.follow = busById(+x.dataset.bfollow); CAM.dist = 40; toast('버스를 따라가는 중 · 휠로 확대/축소'); });
    b.querySelectorAll('[data-bsell]').forEach(x => x.onclick = () => { if (confirm('이 버스를 매각할까요?')) { const bs = busById(+x.dataset.bsell); if (this.follow === bs) this.follow = null; sellBus(bs); this.renderTab(true); } });
  },
  html_stops() {
    const list = STOPS.slice().sort((a, b) => b.waiting - a.waiting).slice(0, 24); let h = `<p class="muted" style="margin:0 0 8px;font-size:13px">대기 승객이 많은 정류장일수록 새 노선의 기회예요.</p>`;
    for (const s of list) { const n = G.routes.filter(r => r.stopIds.includes(s.id)).length; h += `<div class="card" style="padding:8px 12px"><div class="row" style="justify-content:space-between"><b>🚏 ${esc(s.name)}</b><small>${n ? n + '개 노선' : '미연결'}</small></div><div class="meter"><i style="width:${s.waiting / 40 * 100}%;background:${s.waiting > 25 ? '#f87171' : '#4ea1ff'}"></i></div><small>대기 ${Math.floor(s.waiting)}명 · 유동인구 ${(s.pop * 60).toFixed(0)}명/분</small></div>`; }
    return h;
  },
  bind_stops() { },
  html_goals() {
    const l = level(); let h = `<div class="card"><h4>🏢 ${esc(G.name)} <small>Lv.${l} · 누적 승객 ${G.pax}명</small></h4><small>수입 ${fmtMoney(G.stats.revenue)} · 지출 ${fmtMoney(G.stats.expense)} · 운전 ${SCHOOL.license ? '🪪 면허 보유(팁 보너스)' : '면허 없음 (운전교실에서 취득)'}</small></div>`;
    for (const g of GOALS) h += `<div class="card" style="padding:8px 12px;${G.goals[g.id] ? 'opacity:.6' : ''}"><div class="row" style="justify-content:space-between"><span>${G.goals[g.id] ? '✅' : '⬜'} ${g.t}</span><small>+${fmtMoney(g.rw)}</small></div></div>`;
    h += `<div class="card"><small class="muted">레벨 3: 2층 버스 해금 · 직접 운전 시 완벽 정차는 평판과 팁을 올려줘요.</small></div>`;
    return h;
  },
  bind_goals() { },
  buyModal(routeId) {
    if (!G.routes.length) { toast('먼저 노선을 만드세요', 'bad'); return; }
    let sel = 'city'; const l = level();
    const draw = () => {
      this.modal(`<h2>🚌 버스 구매</h2>` + Object.entries(BUS_TYPES).map(([k, T]) => { const lock = l < T.lvl; return `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${T.name}</b> <small>${T.len}m · ${T.cap}명 · 인건비 ${fmtMoney(T.wage)}/초</small></div><button class="btn sm ${k === sel ? 'pri' : ''}" data-t="${k}" ${lock ? 'disabled' : ''}>${lock ? '🔒 Lv.' + T.lvl : fmtMoney(T.price)}</button></div></div>`; }).join('') +
        `<div class="row" style="margin:10px 0"><span>배치 노선</span><select id="mRoute">${G.routes.map(q => `<option value="${q.id}" ${q.id === routeId ? 'selected' : ''}>${q.num} ${esc(q.name)}</option>`).join('')}</select></div>
         <div class="row"><button class="btn pri" id="mBuy" style="flex:1">${BUS_TYPES[sel].name} 구매 (${fmtMoney(BUS_TYPES[sel].price)})</button><button class="btn" id="mX">닫기</button></div>`);
      $('modalBox').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { routeId = +$('mRoute').value; sel = b.dataset.t; draw(); });
      $('mX').onclick = () => this.closeModal();
      $('mBuy').onclick = () => { const bus = addBus(sel, +$('mRoute').value); if (!bus) { toast('자금이 부족해요', 'bad'); return; } sfx('chime'); toast(BUS_TYPES[sel].name + ' 구매 완료!', 'good'); this.closeModal(); this.tab = 'fleet'; this.renderTab(true); };
    }; draw();
  },
  driveBus(b) { if (P.active) return; this.follow = null; startManual(b); },

  // --- 노선 편집기
  openEditor(route) {
    const E = this.edState = { stops: route ? route.stopIds.slice() : [], name: route ? route.name : '노선 ' + (G.nextRoute), color: route ? route.color : ROUTE_COLORS[(G.nextRoute - 1) % ROUTE_COLORS.length], route, path: null, hover: -1 };
    $('editor').classList.remove('hide'); $('edName').value = E.name;
    $('edColors').innerHTML = ROUTE_COLORS.map(c => `<i data-c="${c}" style="background:${hex(c)}" class="${c === E.color ? 'on' : ''}"></i>`).join('');
    $('edColors').querySelectorAll('i').forEach(i => i.onclick = () => { E.color = +i.dataset.c; $('edColors').querySelectorAll('i').forEach(q => q.classList.toggle('on', q === i)); this.edUpdate(); });
    $('edName').oninput = () => { E.name = $('edName').value; };
    $('edCancel').onclick = () => $('editor').classList.add('hide');
    $('edSave').onclick = () => {
      if (E.stops.length < 2) { toast('정류장을 2곳 이상 선택하세요', 'bad'); return; }
      const name = (E.name || '').trim() || '무명 노선';
      if (E.route) { updateRoute(E.route, name, E.color, E.stops); toast('노선을 수정했어요', 'good'); }
      else { const r = addRoute(name, E.color, E.stops); if (!r) { toast('자금이 부족해요', 'bad'); return; } toast(`${r.num}번 노선 개설! 이제 버스를 배치하세요`, 'good'); sfx('chime'); setTimeout(() => this.buyModal(r.id), 200); }
      $('editor').classList.add('hide'); this.tab = 'routes'; this.renderTab(true);
    };
    this.edUpdate();
  },
  edUpdate() {
    const E = this.edState; E.path = E.stops.length >= 2 ? (() => { const { E: ed, stopAt } = routeEdges(E.stops); return buildPath(ed, stopAt); })() : null;
    $('edStops').innerHTML = E.stops.map((id, i) => `<li><b style="color:${hex(E.color)}">${i + 1}</b> ${esc(STOPS[id].name)}<span style="flex:1"></span><button class="btn sm" data-up="${i}">↑</button><button class="btn sm" data-rm="${i}">✕</button></li>`).join('') || '<li class="muted">지도에서 정류장을 클릭하세요</li>';
    $('edStops').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { E.stops.splice(+b.dataset.rm, 1); this.edUpdate(); });
    $('edStops').querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [E.stops[i - 1], E.stops[i]] = [E.stops[i], E.stops[i - 1]]; this.edUpdate(); } });
    const cost = E.route ? 0 : routeCost(E.stops.length), demand = E.stops.reduce((a, id) => a + STOPS[id].pop, 0), len = E.path ? E.path.L : 0;
    $('edInfo').innerHTML = `총 거리 <b>${(len / 1000).toFixed(2)}km</b> · 1바퀴 약 <b>${len ? Math.round(len / 10 + E.stops.length * 6) : 0}초</b><br>예상 유동 <b>${(demand * 60).toFixed(0)}명/분</b><br>개설 비용 <b>${fmtMoney(cost)}</b>${cost > G.money ? ' <span style="color:var(--bad)">(자금 부족)</span>' : ''}`;
    $('edSave').textContent = E.route ? '변경 저장' : '노선 개설'; $('edSave').disabled = E.stops.length < 2; this.edDraw();
  },
  edDraw() { const E = this.edState; if (!E) return; const c = $('mapC'); this.mapT = drawMap(c.getContext('2d'), 760, { routes: G.routes, skip: E.route, dim: .35, edit: { stops: E.stops, color: E.color, path: E.path }, hover: E.hover, crowd: true }); },
  edPointer(e, click) {
    const E = this.edState, c = $('mapC'), r = c.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * 760, my = (e.clientY - r.top) / r.height * 760, sc = 760 / (2 * EXT + 60);
    let best = -1, bd = 16; for (const s of STOPS) { const d = Math.hypot((s.curb.x + EXT + 30) * sc - mx, (s.curb.z + EXT + 30) * sc - my); if (d < bd) { bd = d; best = s.id; } }
    if (click && best >= 0) { const i = E.stops.indexOf(best); if (i >= 0) E.stops.splice(i, 1); else E.stops.push(best); this.edUpdate(); }
    else if (E.hover !== best) { E.hover = best; this.edDraw(); }
  },

  // --- 운전교실
  schoolModal() {
    let h = `<h2>🎓 운전교실</h2><p class="muted" style="margin-top:0">교시를 차례로 통과하면 면허를 취득해요. 면허가 있으면 경영 모드에서 직접 운전 팁이 늘어납니다.</p>`;
    LESSONS.forEach((L, i) => { const un = i === 0 || SCHOOL.done[LESSONS[i - 1].id], d = SCHOOL.done[L.id]; h += `<div class="card lesson"><div><b>${L.title}</b> ${d ? '<span class="stars">✔ ' + (SCHOOL.best[L.id] || '') + '점</span>' : ''}<br><small>${L.desc}</small></div><button class="btn sm ${un ? 'pri' : ''}" data-l="${i}" ${un ? '' : 'disabled'}>${un ? (d ? '다시' : '시작') : '🔒'}</button></div>`; });
    h += `<div class="row" style="margin-top:8px"><button class="btn" id="sX">닫기</button>${SCHOOL.license ? '<span class="stars">🪪 면허 취득 완료</span>' : ''}</div>`; this.modal(h);
    $('modalBox').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { this.closeModal(); initAudio(); startLesson(LESSONS[+b.dataset.l]); });
    $('sX').onclick = () => this.closeModal();
  },
  showLessonResult(L, sc, pass, stars) {
    P.paused = true; const pens = Object.entries(P.pens).map(([k, n]) => ({ speed: '과속', red: '신호위반', center: '중앙선', crash: '충돌', hitcar: '차량충돌', miss: '정류장 통과', doormove: '문 열고 주행', harsh: '급제동', reset: '복귀' }[k] + ' ×' + n)).join(', ') || '없음';
    const hasNext = LESSONS.indexOf(L) < LESSONS.length - 1;
    this.modal(`<h2>${pass ? '🎉 합격!' : '😢 불합격'} — ${L.title}</h2><div style="font-size:42px;font-weight:800">${sc}점 <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></div>
      <p class="muted">${L.pass ? `합격 기준 ${L.pass}점` : '기본 조작 과제 완료'} · 완벽 정차 ${P.perfect}회 · 승차감 ${Math.round(P.comfort)}%<br>감점 내역: ${pens}</p>${L.id === 'L4' && pass ? '<p class="stars" style="font-size:20px">🪪 운전면허를 취득했어요!</p>' : ''}
      <div class="row"><button class="btn pri" id="lRetry">다시 도전</button>${pass && hasNext ? '<button class="btn" id="lNext">다음 교시</button>' : ''}<button class="btn" id="lExit">나가기</button></div>`);
    $('lRetry').onclick = () => { this.closeModal(); stopManual(true); startLesson(L); };
    if ($('lNext')) $('lNext').onclick = () => { this.closeModal(); stopManual(true); startLesson(LESSONS[LESSONS.indexOf(L) + 1]); };
    $('lExit').onclick = () => { this.closeModal(); stopManual(); };
  },
  pauseModal() {
    P.paused = true; this.modal(`<h2>⏸ 일시정지</h2><p class="muted">현재 점수 ${Math.round(P.score)}점 · 승차감 ${Math.round(P.comfort)}%</p><div class="row"><button class="btn pri" id="pGo">계속</button><button class="btn" id="pMute">${muted ? '🔇' : '🔊'} 소리</button><button class="btn bad" id="pEnd">${G.school ? '교습 포기' : '운행 종료'}</button></div>`);
    $('pGo').onclick = () => { this.closeModal(); P.paused = false; }; $('pMute').onclick = () => { muted = !muted; this.pauseModal(); };
    $('pEnd').onclick = () => { this.closeModal(); stopManual(); };
  },

  // --- HUD
  updateHUD() {
    const b = P.bus, T = BUS_TYPES[b.type], r = P.lesson ? P.lesson.route : routeById(b.routeId), si = P.stopInfo, kmh = Math.round(Math.abs(P.v) * 3.6);
    $('hudL').innerHTML = `<span class="chip" style="background:${hex(r ? r.color : 0xffb020)}">${r ? r.num : ''}</span><b>${r ? esc(r.name) : ''}</b> <small class="muted">${T.name}</small><br>🚏 다음: <b>${si ? esc(si.name) : '-'}</b> <span class="tnum">${si ? Math.max(0, Math.round(si.dist)) + 'm' : ''}</span><br>👥 탑승 <b>${b.pax.length}</b>/${T.cap} · 대기 ${si ? Math.floor(si.waiting) : 0}명${P.lesson ? `<br><small class="muted">${P.lesson.title}</small>` : ''}`;
    $('hint').textContent = P.hint;
    $('spd').firstChild.nodeValue = kmh; const gear = P.v < -0.2 ? 'R' : (Math.abs(P.v) < 0.2 ? (keys.Space ? 'P' : 'N') : 'D');
    $('gear').querySelectorAll('b').forEach(x => x.classList.toggle('on', x.textContent === gear)); $('limit').classList.toggle('over', kmh > 52);
    const sc = Math.round(P.score), cf = Math.round(P.comfort);
    $('hudScore').innerHTML = `<small class="muted">운전 점수</small> <b class="tnum" style="float:right">${sc}</b><div class="bar"><i style="width:${sc}%;background:${sc > 80 ? '#4ade80' : sc > 60 ? '#facc15' : '#f87171'}"></i></div><small class="muted">승차감</small> <b class="tnum" style="float:right">${cf}%</b><div class="bar"><i style="width:${cf}%;background:#4ea1ff"></i></div><small class="muted">${G.school ? '교습 중' : '수입 ' + fmtMoney(b.income)}</small>`;
    $('doorTag').textContent = P.doorOpen ? '문 열림' : '문 닫힘'; $('doorTag').classList.toggle('open', P.doorOpen);
    if (P.lesson && P.lesson.id === 'L1') $('tasks').innerHTML = '<b>🎓 과제</b>' + P.lesson.tasks.map(t => `<div class="${P.taskDone[t[0]] ? 'done' : ''}">${P.taskDone[t[0]] ? '✔' : '○'} ${t[1]}</div>`).join('');
    drawMap($('mini').getContext('2d'), 380, { routes: r && !P.lesson ? [r] : [], thin: 1, mini: true, player: true, target: P.stopInfo ? b.agent.path.stops[P.si].id : undefined, buses: G.buses.filter(x => x !== b) });
    if (P.lesson && P.lesson.route) { const c = $('mini').getContext('2d'); }
    if (P.si !== this.lastSi) { this.lastSi = P.si; if (si) announce('이번 정류장은 ' + si.name.replace(' 건너편', '') + '입니다'); }
  },
  init() {
    this.initTop();
    $('bNew').onclick = () => { initAudio(); startCompany(($('coName').value || '버스 회사').trim()); this.showMgmt(); toast('환영합니다 사장님! 오른쪽에서 노선을 설계해 보세요', 'gold'); };
    $('bCont').onclick = () => { initAudio(); const s = loadSaved(); if (s) { startCompany(s.name, s); this.showMgmt(); } };
    $('bSchool').onclick = () => { initAudio(); this.schoolModal(); };
    $('bHelp').onclick = () => $('help').classList.toggle('hide');
    addEventListener('pointerdown', () => { UI.down = true; }, true); addEventListener('pointerup', () => { UI.down = false; }, true); addEventListener('pointercancel', () => { UI.down = false; }, true);
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.renderTab(true); });
    const mc = $('mapC'); mc.onmousemove = e => this.edPointer(e, false); mc.onclick = e => this.edPointer(e, true);
    setInterval(() => { if (G && G.state === 'company') { this.refreshTop(); this.renderTab(false); } }, 1200);
  }
};
