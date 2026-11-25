'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = c => '#' + c.toString(16).padStart(6, '0');
function toast(text, kind) { if (window.__quiet) return; const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = text; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2800); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }
function bigText(t, ms) { $('center').textContent = t; setTimeout(() => { if ($('center').textContent === t) $('center').textContent = ''; }, ms || 1200); }

// ===== 소리 =====
let actx = null, eng = null, muted = false;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = actx.createOscillator(), o2 = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(actx.destination); o1.start(); o2.start(); eng = { o1, o2, g };
    const nb = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = actx.createBufferSource(), bp = actx.createBiquadFilter(), rg = actx.createGain(); ns.buffer = nb; ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6; rg.gain.value = 0; ns.connect(bp); bp.connect(rg); rg.connect(actx.destination); ns.start(); eng.rg = rg;
    const so = actx.createOscillator(), sg = actx.createGain(), sf = actx.createBiquadFilter(); so.type = 'sawtooth'; so.frequency.value = 800; sf.type = 'lowpass'; sf.frequency.value = 2200; sg.gain.value = 0; so.connect(sf); sf.connect(sg); sg.connect(actx.destination); so.start(); eng.so = so; eng.sg = sg;
  } catch (e) { actx = null; }
}
function tone(f, d, type, vol, when, slide) {
  if (!actx || muted) return; const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + (when || 0);
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .02);
}
function sfx(n) {
  if (!actx) return; if (actx.state === 'suspended') actx.resume();
  if (n === 'horn') { tone(311, .7, 'sawtooth', .07); tone(392, .7, 'sawtooth', .07); }
  else if (n === 'door') { tone(520, .12, 'square', .04); tone(390, .16, 'square', .04, .1); }
  else if (n === 'chime') { tone(784, .25, 'sine', .08); tone(988, .35, 'sine', .08, .2); }
  else if (n === 'bad') tone(150, .25, 'sawtooth', .07, 0, 90);
  else if (n === 'good') { tone(660, .12, 'sine', .07); tone(880, .2, 'sine', .07, .1); }
  else if (n === 'crash') tone(90, .35, 'sawtooth', .12, 0, 40);
  else if (n === 'start') tone(440, .1, 'sine', .05);
  else if (n === 'tick') tone(1600, .02, 'square', .025);
  else if (n === 'thunder') { tone(55, 2.0, 'sawtooth', .14, 0, 24); tone(95, 1.3, 'square', .07, .08, 30); }
}
function sirenAudio(k) { if (!actx || !eng || !eng.sg) return; const t = actx.currentTime; eng.sg.gain.setTargetAtTime(muted ? 0 : k * 0.035, t, 0.12); if (k > 0) eng.so.frequency.setTargetAtTime(780 + 380 * Math.sin(t * 5.5), t, 0.04); }
function rainAudio(k) { if (actx && eng && eng.rg) eng.rg.gain.setTargetAtTime(muted ? 0 : k * 0.07, actx.currentTime, 0.4); }
function engineAudio(speed, thr) {
  if (!actx || !eng) return; const gs = 4.5, gear = Math.min(5, Math.floor(speed / gs)), rpm = (speed - gear * gs) / gs, f = 36 + gear * 3 + rpm * 38 + thr * 6, t = actx.currentTime;
  eng.o1.frequency.setTargetAtTime(f, t, .06); eng.o2.frequency.setTargetAtTime(f * .5, t, .06); eng.g.gain.setTargetAtTime(muted || !P.active || P.paused ? 0 : .025 + thr * .03, t, .1);
}
function announce(text) { try { if (muted || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }

// ===== 지도 그리기 (미니맵 · 편집기 공용) =====
function drawMap(ctx, size, o) {
  o = o || {}; const sc = size / (2 * EXT + 60), M = (x, z) => [(x + EXT + 30) * sc, (z + EXT + 30) * sc], vz = o.view ? o.view.z : 1, k = size / 760 / vz;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#1b2230'; ctx.fillRect(0, 0, size, size);
  ctx.save(); if (o.view) { ctx.translate(o.view.ox, o.view.oy); ctx.scale(vz, vz); }
  world.blocks.slice(0, (GN - 1) * (GN - 1)).forEach((b, i) => { ctx.fillStyle = Math.floor(i / (GN - 1)) === world.riverRow ? '#21507c' : '#262e40'; const [x, y] = M(b.minx, b.minz); ctx.fillRect(x, y, (b.maxx - b.minx) * sc, (b.maxz - b.minz) * sc); });
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
  if (!o.mini) { ctx.font = `bold ${15 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (const [n, x, z] of DISTRICTS) { const [px, py] = M(x, z); ctx.fillStyle = 'rgba(120,180,255,.55)'; ctx.fillText(n, px, py); } }
  if (o.target !== undefined) { const s = STOPS[o.target], [x, y] = M(s.curb.x, s.curb.z); ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 3; ctx.stroke(); }
  if (o.buses) for (const b of o.buses) { const [x, y] = M(b.agent.x, b.agent.z); ctx.beginPath(); ctx.arc(x, y, 3.5 * (o.mini ? 1 : k * 1.2), 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }
  if (o.markers) for (const m of o.markers) { const [x, y] = M(m.x, m.z); ctx.beginPath(); ctx.arc(x, y, (m.big ? 7 : 4.5) * (o.mini ? 1 : k), 0, 7); ctx.fillStyle = m.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke(); if (m.big) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.strokeStyle = m.c; ctx.stroke(); } }
  if (o.player) { const [x, y] = M(P.x, P.z), dx = Math.sin(P.h), dz = Math.cos(P.h), r = 9; ctx.fillStyle = '#ffb020'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + dx * r, y + dz * r); ctx.lineTo(x - dx * r * .6 + dz * r * .6, y - dz * r * .6 - dx * r * .6); ctx.lineTo(x - dx * r * .6 - dz * r * .6, y - dz * r * .6 + dx * r * .6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore(); return { M, sc };
}

// ===== UI 객체 =====
const UI = {
  tab: 'routes', follow: null, edState: null,
  hideAll() { for (const id of ['title', 'hud', 'mgmt', 'editor', 'modal']) $(id).classList.add('hide'); $('rear').classList.add('hide'); $('touch').classList.remove('on'); },
  showTitle() {
    if (G && !G.school && G.state !== 'title') { saveCompany(); startSchoolWorld(); }   // 타이틀에서는 회사 시간이 멈추도록 데모 월드로 교체
    this.hideAll(); $('title').classList.remove('hide'); G.state = 'title'; this.follow = null;
    const s = loadSaved(); $('bCont').disabled = !s; $('contInfo').textContent = s ? `${s.name} · ${fmtMoney(s.money)}` : '저장된 회사 없음';
    $('carInfo').textContent = `👛 ${fmtMoney(SCHOOL.wallet)} · 보유 ${SCHOOL.cars.length}대`; const n = Object.keys(SCHOOL.done).length; $('schoolInfo').textContent = SCHOOL.license ? '🪪 면허 취득 완료!' : `수료 ${n}/4`;
  },
  showMgmt() { this.hideAll(); $('mgmt').classList.remove('hide'); G.state = 'company'; this.refreshTop(); this.renderTab(true); },
  showDrive() {
    this.hideAll(); $('hud').classList.remove('hide'); $('rear').classList.remove('hide'); $('touch').classList.add('on'); $('touch').classList.toggle('car', !!P.free);
    const L = P.lesson, t = $('tasks'); if (L && L.id === 'L1') { t.classList.remove('hide'); } else t.classList.add('hide');
  },
  modal(html) { $('modalBox').innerHTML = html; $('modal').classList.remove('hide'); const t = $('pTouch'); if (t) t.onclick = () => { this.setTouch(!this.touch); toast('📱 터치 조작 ' + (this.touch ? '켜짐' : '꺼짐')); }; },
  setTouch(on, quiet) { this.touch = on; document.body.classList.toggle('touch', on); try { if (!quiet) localStorage.setItem('busTouch', on ? '1' : '0'); } catch (e) { } },
  closeModal() { $('modal').classList.add('hide'); },

  // --- 상단바
  initTop() {
    $('topbar').innerHTML = `<span class="co" id="tCo"></span><span class="stat" id="tMoney"></span><span class="stat" id="tLv"></span><span class="stat" id="tRep"></span><span class="stat" id="tRate"></span><span class="stat" id="tPay"></span><span class="stat" id="tWx"></span><span class="stat hide" id="tEv"></span><button class="btn sm" id="tbBell">🔔 <b id="tBellN"></b></button><span class="stat" id="tTime"></span><span class="sp"></span>
      <span class="spd">${[1, 2, 4, 10].map(x => `<button data-sp="${x}">${x}×</button>`).join(' ')}</span><button class="btn sm" id="tbWallet">👛 <span id="tWal"></span></button><button class="btn sm" id="tbSave">💾 저장</button><button class="btn sm" id="tbMenu">메뉴</button>`;
    $('topbar').querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { G.speed = +b.dataset.sp; this.refreshTop(); });
    $('tbWallet').onclick = () => this.walletModal('wallet'); $('tbBell').onclick = () => this.notesModal();
    $('tbSave').onclick = () => { saveCompany(); toast('저장했어요', 'good'); }; $('tbMenu').onclick = () => { saveCompany(); this.showTitle(); };
  },
  refreshTop() {
    const l = level(), nl = LEVELS[l] !== undefined ? LEVELS[l] : null, h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60);
    $('tCo').textContent = '🚌 ' + G.name; $('tMoney').textContent = '💰 ' + fmtMoney(G.money); $('tLv').textContent = '⭐ Lv.' + l + (nl ? ` (${G.pax}/${nl})` : '');
    $('tRep').textContent = '👍 평판 ' + Math.round(G.rep); $('tPay').textContent = '💵 급여 -' + fmtMoney(this.payRate()) + '/분'; $('tWx').textContent = WX_T[WX.type].i + ' ' + WX_T[WX.type].n; { const ev = G.events && G.events[0]; $('tEv').classList.toggle('hide', !ev); if (ev) $('tEv').textContent = ev.def.i + ' ' + ev.name + ' ' + fmtMS(Math.max(0, ev.until - G.gt)); } $('tRate').textContent = '📈 ' + fmtMoney(G.rate) + '/분'; $('tTime').textContent = '🕒 ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    $('tWal').textContent = fmtMoney(SCHOOL.wallet); { const n = G.unread || 0; $('tBellN').textContent = n ? n : ''; $('tbBell').style.borderColor = n ? 'var(--accent)' : ''; }
    $('topbar').querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === G.speed));
    { const tb = $('topbar'), top = tb.offsetHeight + 24; if (this._sideTop !== top) { this._sideTop = top; $('side').style.top = top + 'px'; } }
  },
  payRate() { return G.buses.reduce((a, b) => a + ((b.manual || (P.active && P.auto && P.bus === b)) ? 0 : BUS_TYPES[b.type].wage * 60), 0); },
  payCell(b) { return (b.manual || (P.active && P.auto && P.bus === b)) ? (b.manual ? '🎮 직접 운전' : '🤖 자율주행') : fmtMoney(b.driver.today); },
  liveTick() {
    if (this.tab !== 'company') return; const pr = $('payRate'); if (pr) pr.textContent = fmtMoney(this.payRate()) + '/분';
    document.querySelectorAll('[data-pay]').forEach(c => { const b = busById(+c.dataset.pay); if (b) c.textContent = this.payCell(b); }); const mp = $('myPay'); if (mp) mp.textContent = '+' + fmtMoney(G.myPay);
  },
  drawTaxi() {
    const el = $('taxiBox'), tx = P.taxi; if (!tx) { el.classList.add('hide'); return; } el.classList.remove('hide');
    const avg = tx.stars.length ? (tx.stars.reduce((a, b) => a + b, 0) / tx.stars.length).toFixed(1) : '-', arrow = `<span style="display:inline-block;font-size:26px;transform:rotate(${tx.arrow}deg);color:${tx.ride ? '#4ade80' : '#ffd21a'}">⬆</span>`;
    let h = `<b>🚕 택시 영업</b> <small class="muted">${taxiNight() ? '🌙 심야 할증 20%' : ''}</small>`;
    if (tx.ride) { const r = tx.ride, ov = taxiOver(r), bad = Math.min(2, r.crashes) + (r.speedT > 6 ? 1 : 0) + (ov > 2.5 ? 3 : ov > 1.7 ? 2 : ov > 1.3 ? 1 : 0); h += `<div style="margin:6px 0 2px"><small class="muted">목적지</small> <b>${esc(r.dest.name)}</b></div><div style="font-size:28px;font-weight:800;color:${ov > 1.3 ? '#f87171' : '#ffb020'}" class="tnum">${fmtMoney(taxiCharge(r))}</div><small class="muted">정상 요금 약 ${fmtMoney(taxiExp(r))}</small>${ov > 1.25 ? `<div style="color:#f87171;font-size:12px">😠 돌아가는 중! 경로 대비 ×${ov.toFixed(1)} · ${ov > 1.6 ? '요금 상한 도달' : '곧 항의해요'}</div>` : ''}<div class="row" style="justify-content:space-between"><span>${arrow}</span><span class="tnum">남은 ${Math.round(tx.nav ? tx.nav.rem : tx.dist)}m${tx.nav ? ' <small class="muted">(경로)</small>' : ''}</span></div><small>예상 별점 ${'★'.repeat(Math.max(1, 5 - bad))}${'☆'.repeat(Math.min(4, bad))}</small>`; }
    else h += `<div class="row" style="justify-content:space-between;margin:6px 0"><span>${tx.target ? arrow : '🔍'}</span><span>${tx.target ? '가까운 손님 ' + Math.round(tx.dist) + 'm' : '손님 찾는 중…'}</span></div>`;
    h += `<div style="border-top:1px solid var(--line);margin-top:6px;padding-top:4px"><small class="muted">이번 영업 ${tx.trips}회 · ${fmtMoney(tx.earn)} · ★${avg}</small><br><small>평점 <b style="color:#ffb020">★${taxiRating().toFixed(1)}</b> · ${taxiDemandLabel()}</small></div>`;
    el.innerHTML = h;
  },
  drawGaps() {
    const gp = P.gaps, el = $('gapBox'); if (!gp) { el.innerHTML = ''; return; }
    const row = (ic, lab, o) => { if (!o) return `<div class="gr"><span>${ic} ${lab}</span><b class="muted">없음</b></div>`; const t = o.t, col = t == null ? 'var(--muted)' : t < 1 ? '#f87171' : t < 1.8 ? '#facc15' : '#4ade80'; return `<div class="gr"><span>${ic} ${lab}</span><b style="color:${col}">${o.d.toFixed(1)}m${t != null ? ' · ' + t.toFixed(1) + '초' : ''}</b></div>${t != null ? `<div class="gbar"><i style="width:${Math.min(100, t / 4 * 100)}%;background:${col}"></i></div>` : ''}`; };
    let h = '<b style="font-size:12px;color:var(--muted)">차간 거리 · 시간</b>' + row('🚗', '앞차', gp.front) + row('🚙', '뒷차', gp.rear);
    if (gp.route) { const a = gp.route.ahead, b = gp.route.behind, w = G.headwayTarget; h += `<div style="margin-top:4px;border-top:1px solid var(--line);padding-top:4px"><b style="font-size:12px;color:var(--muted)">같은 노선 배차 간격</b></div><div class="gr"><span>🚌 앞 버스</span><b style="color:${a && a.t < w ? '#facc15' : '#4ade80'}">${a ? fmtMS(a.t) + ' (' + Math.round(a.d) + 'm)' : '없음'}</b></div><div class="gr"><span>🚌 뒤 버스</span><b>${b ? fmtMS(b.t) + ' (' + Math.round(b.d) + 'm)' : '없음'}</b></div>`; }
    if (P.auto) h += `<div class="gr" style="margin-top:4px"><span>🤖 자율주행 차간 시간</span><b>${P.autoHeadway.toFixed(1)}초 <small class="muted">[ ]</small></b></div>`;
    el.innerHTML = h;
  },
  // --- 탭
  renderTab(force) {
    const body = $('tabBody'), el = document.activeElement; if (!force && el && (el.tagName === 'SELECT' || el.tagName === 'INPUT') && body.contains(el)) return;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab)); const sc = body.scrollTop;
    if (!force && UI.down) return;
    const html = this['html_' + this.tab](); if (!force && html === this.lastHtml && this.lastTab === this.tab) return;
    this.lastHtml = html; this.lastTab = this.tab; body.innerHTML = html; body.scrollTop = sc; this['bind_' + this.tab](body);
  },
  routeAnalytics(r) {
    const bs = G.buses.filter(b => b.routeId === r.id); if (!bs.length) return '<small class="muted">버스를 배치하면 수익 분석이 나와요</small>';
    if (G.gt - (r.born || 0) < 90) return '<small class="muted">⏳ 수익을 측정하는 중…</small>';
    const cost = bs.reduce((a, b) => a + BUS_TYPES[b.type].wage * 60 + BUS_TYPES[b.type].fuel * 13 * 60 * 0.6, 0), load = bs.reduce((a, b) => a + b.pax.length / BUS_TYPES[b.type].cap, 0) / bs.length, rate = r.rate || 0;
    const v = rate > cost * 1.3 ? ['🟢 흑자', '#4ade80'] : rate >= cost * 0.85 ? ['🟡 보통', '#facc15'] : ['🔴 적자', '#f87171'];
    const tip = (rate < cost * 0.85 && bs.length > 1) ? '버스를 줄이거나 노선을 수정해 보세요' : (rate > cost * 1.3 && load > 0.75) ? '만석이에요 · 버스를 늘리면 수입이 늘어요' : (rate < cost * 0.85 ? '승객이 적은 노선이에요 · 정류장을 바꿔 보세요' : '');
    return `<small><b style="color:${v[1]}">${v[0]}</b> · 수입 ${fmtMoney(rate)}/분 · 운영비 ${fmtMoney(cost)}/분 · 평균 탑승률 ${Math.round(load * 100)}%${tip ? '<br><span class="muted">💡 ' + tip + '</span>' : ''}</small>`;
  },
  html_routes() {
    let h = `<button class="btn pri" id="newRoute" style="width:100%;margin-bottom:10px">＋ 새 노선 설계하기</button>`;
    if (!G.routes.length) h += `<p class="muted">노선이 없어요. 새 노선을 만들어 보세요!</p>`;
    for (const r of G.routes) {
      const nb = G.buses.filter(b => b.routeId === r.id).length;
      h += `<div class="card"><h4><span class="chip" style="background:${hex(r.color)}">${r.num}</span>${esc(r.name)} <small>정류장 ${r.stopIds.length}곳 · ${(r.path.L / 1000).toFixed(2)}km</small></h4>
        <small>운행 버스 ${nb}대 · 누적 승객 ${r.pax}명 · 누적 수입 ${fmtMoney(r.income)}</small><br>${this.routeAnalytics(r)}
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
    h += `<p class="muted" style="margin:0 0 8px;font-size:12px">🅿 차고지 ${G.buses.length}/${garageCap()}대 · 달리면 연료비가 들고 정비 상태가 떨어져요. 25% 아래면 고장 위험!</p>`;
    for (const b of G.buses) {
      const T = BUS_TYPES[b.type], rg = routeGaps(b), st = b.manual ? '🎮 직접 운전 중' : b.phase === 'broken' ? '🔧 고장 · 수리 중' : b.hold2 ? '⏱ 배차 조정 대기' : b.phase === 'run' ? '운행 중' : '정차 · 승하차', cc = b.cond > 60 ? '#4ade80' : b.cond > 25 ? '#facc15' : '#f87171';
      h += `<div class="card"><h4>${T.name} #${b.id} <small>${st}</small></h4>
        <div class="row"><select data-route="${b.id}" ${b.manual ? 'disabled' : ''}>${G.routes.map(q => `<option value="${q.id}" ${q.id === b.routeId ? 'selected' : ''}>${q.num} ${esc(q.name)}</option>`).join('')}</select><small>승객 ${b.pax.length}/${T.cap}</small></div>
        <div class="meter"><i style="width:${b.pax.length / T.cap * 100}%"></i></div>
        <small>정비 상태 <b style="color:${cc}">${Math.round(b.cond)}%</b> · 주행 ${(b.km / 1000).toFixed(1)}km · 연식 ${b.age}일</small><div class="meter"><i style="width:${b.cond}%;background:${cc}"></i></div>
        <small>👨‍✈️ ${esc(b.driver.name)} · 오늘 급여 ${fmtMoney(b.driver.today)}</small><br><small>⏱ 앞차 ${rg && rg.ahead ? fmtMS(rg.ahead.t) : '-'} · 뒷차 ${rg && rg.behind ? fmtMS(rg.behind.t) : '-'} <span class="muted">(배차 간격)</span></small><br><small>누적 수입 ${fmtMoney(b.income)} · 인건비 ${fmtMoney(T.wage)}/초</small>
        <div class="acts"><button class="btn sm" data-bdrive="${b.id}">🎮 운전하기</button><button class="btn sm" data-bfollow="${b.id}">👁 관제</button><button class="btn sm" data-bsvc="${b.id}" ${b.cond >= 95 ? 'disabled' : ''}>🔧 정비 ${fmtMoney(serviceCost(b))}</button><button class="btn sm bad" data-bsell="${b.id}">매각 ${fmtMoney(busValue(b))}</button></div></div>`;
    }
    return h;
  },
  bind_fleet(b) {
    const bb = b.querySelector('#buyBus'); if (bb) bb.onclick = () => this.buyModal(G.routes[0] && G.routes[0].id);
    b.querySelectorAll('[data-route]').forEach(x => x.onchange = () => { reassignBus(busById(+x.dataset.route), +x.value); this.renderTab(true); });
    b.querySelectorAll('[data-bdrive]').forEach(x => x.onclick = () => this.driveBus(busById(+x.dataset.bdrive)));
    b.querySelectorAll('[data-bfollow]').forEach(x => x.onclick = () => { this.follow = busById(+x.dataset.bfollow); CAM.dist = 40; toast('버스를 따라가는 중 · 휠로 확대/축소'); });
    b.querySelectorAll('[data-bsvc]').forEach(x => x.onclick = () => { serviceBus(busById(+x.dataset.bsvc)); this.renderTab(true); });
    b.querySelectorAll('[data-bsell]').forEach(x => x.onclick = () => { if (confirm('이 버스를 매각할까요?')) { const bs = busById(+x.dataset.bsell); if (this.follow === bs) this.follow = null; sellBus(bs); this.renderTab(true); } });
  },
  html_stops() {
    const list = STOPS.slice().sort((a, b) => b.waiting - a.waiting).slice(0, 24); let h = `<p class="muted" style="margin:0 0 8px;font-size:13px">대기 승객이 많은 정류장일수록 새 노선의 기회예요.</p>`;
    for (const s of list) { const n = G.routes.filter(r => r.stopIds.includes(s.id)).length; h += `<div class="card" style="padding:8px 12px"><div class="row" style="justify-content:space-between"><b>🚏 ${esc(s.name)}</b><small>${n ? n + '개 노선' : '미연결'}</small></div><div class="meter"><i style="width:${s.waiting / 40 * 100}%;background:${s.waiting > 25 ? '#f87171' : '#4ea1ff'}"></i></div><small>대기 ${Math.floor(s.waiting)}명 · 유동인구 ${(s.pop * 60).toFixed(0)}명/분</small></div>`; }
    return h;
  },
  bind_stops() { },
  html_company() {
    const last = G.reports[0], fm = Math.pow(1500 / G.fare, 0.8) * (1 + 0.08 * G.up.info);
    let h = `<div class="card"><h4>💼 재무 현황</h4><table class="tbl"><tr><td>보유 자금</td><td>${fmtMoney(G.money)}</td></tr><tr><td>대출 잔액 (일 이자 2%)</td><td>${fmtMoney(G.loan)}</td></tr><tr><td>차고지</td><td>${G.buses.length} / ${garageCap()}대</td></tr><tr><td>오늘 수입 / 지출</td><td>${fmtMoney(G.day.rev)} / ${fmtMoney(G.day.fuel + G.day.wage + G.day.maint)}</td></tr></table></div>`;
    h += `<div class="card"><h4>💵 실시간 급여 <small>(초 단위로 지급 중)</small></h4><div class="row" style="justify-content:space-between"><span>기사 급여 지출</span><b class="tnum" id="payRate">${fmtMoney(this.payRate())}/분</b></div><table class="tbl">${G.buses.map(b => `<tr><td>${esc(b.driver.name)} <small class="muted">${BUS_TYPES[b.type].name} #${b.id}</small></td><td data-pay="${b.id}">${this.payCell(b)}</td></tr>`).join('') || '<tr><td class="muted">고용한 기사가 없어요</td><td></td></tr>'}<tr><td><b>대표(나)</b> <small class="muted">직접 운전 시 실시간 지급 · 세 3.3%</small></td><td id="myPay">+${fmtMoney(G.myPay)}</td></tr></table></div>
    <div class="card"><h4>⏱ 배차 간격 관리</h4><div class="row"><input type="range" id="hwR" min="0" max="120" step="5" value="${G.headwayTarget}" style="flex:1"><b id="hwV" class="tnum">${G.headwayTarget}초</b></div><small>앞 버스와의 간격이 이 시간보다 짧으면 정류장에서 최대 30초 대기해 벙칭(버스 뭉침)을 막아요. 0이면 끄기.</small></div>
    <div class="card"><h4>👛 대표 인출 (배당)</h4><small>회사 자금을 내 지갑으로 옮겨요. 배당소득세 15.4%가 빠지고, 지갑 돈으로 자동차를 살 수 있어요. 운영 자금이 부족해지지 않게 주의!</small><div class="row" style="margin-top:6px"><small>내 지갑</small><b class="tnum">${fmtMoney(SCHOOL.wallet)}</b></div><div class="acts"><button class="btn sm" data-wd="1000000">100만</button><button class="btn sm" data-wd="5000000">500만</button><button class="btn sm" data-wd="20000000">2천만</button><button class="btn sm" data-wd="-1">가능한 만큼</button><button class="btn sm" data-dep="1000000">↩ 100만 투자</button><button class="btn sm" id="wMore">🚗 자동차 매장</button></div></div>`;
    h += `<div class="card"><h4>🎫 요금 정책 <small>(${G.dayNo}일차)</small></h4><div class="row"><input type="range" id="fareR" min="1000" max="2500" step="50" value="${G.fare}" style="flex:1"><b id="fareV" class="tnum">${fmtMoney(G.fare)}</b></div><small id="fareS">승객 수요 ×${fm.toFixed(2)} · 요금을 올리면 건당 수입은 늘지만 승객이 줄어요</small></div>`;
    h += `<h4 style="margin:14px 0 8px">🏗 회사 업그레이드</h4>`;
    for (const k in UPGRADES) {
      const U = UPGRADES[k], l = G.up[k], c = l < U.max ? U.cost(l) : 0;
      h += `<div class="card"><h4>${U.name}<span class="pips">${Array.from({ length: U.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span></h4><small>${U.desc}</small><div class="acts"><button class="btn sm pri" data-up="${k}" ${l >= U.max || G.money < c ? 'disabled' : ''}>${l >= U.max ? '최대 레벨' : '업그레이드 ' + fmtMoney(c)}</button></div></div>`;
    }
    h += `<div class="card"><h4>🏦 은행 대출 <small>한도 ${fmtMoney(loanLimit())}</small></h4><small>자금이 부족할 때 빌려 버스를 먼저 사세요. 이자는 매일 결산 때 빠져나가요.</small><div class="acts"><button class="btn sm" data-loan="500000">＋ 50만 대출</button><button class="btn sm" data-repay="500000">− 50만 상환</button><button class="btn sm" data-repay="${G.loan}" ${G.loan ? '' : 'disabled'}>전액 상환</button></div></div>`;
    h += `<div class="card"><h4>📒 일일 결산</h4>`;
    if (!last) h += `<small class="muted">자정(00:00)에 하루 결산이 이뤄져요. 연료·인건비·정비·임대료·보험·이자를 제하고 이익의 10%가 세금으로 나가요.</small>`;
    else {
      h += `<small>${last.day}일차</small><table class="tbl"><tr><td>운임 수입</td><td>${fmtMoney(last.rev)}</td></tr><tr><td>연료비</td><td>-${fmtMoney(last.fuel)}</td></tr><tr><td>기사 인건비</td><td>-${fmtMoney(last.wage)}</td></tr><tr><td>정비비</td><td>-${fmtMoney(last.maint)}</td></tr><tr><td>임대료 · 매니저 · 보험</td><td>-${fmtMoney(last.rent + last.ins)}</td></tr><tr><td>대출 이자</td><td>-${fmtMoney(last.interest)}</td></tr><tr><td>법인세 (10%)</td><td>-${fmtMoney(last.tax)}</td></tr><tr><td><b>순이익</b></td><td><b style="color:${last.net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmtMoney(last.net)}</b></td></tr></table>`;
      const mx = Math.max(1, ...G.reports.map(r => Math.abs(r.net))); h += `<div class="bars">${G.reports.slice().reverse().map(r => `<i class="${r.net < 0 ? 'neg' : ''}" style="height:${Math.max(4, Math.abs(r.net) / mx * 100)}%" title="${r.day}일차 ${fmtMoney(r.net)}"></i>`).join('')}</div>`;
    }
    return h + '</div>';
  },
  bind_company(b) {
    const hw = b.querySelector('#hwR'); if (hw) hw.oninput = () => { G.headwayTarget = +hw.value; $('hwV').textContent = G.headwayTarget + '초'; };
    const r = b.querySelector('#fareR'); if (r) r.oninput = () => { G.fare = +r.value; $('fareV').textContent = fmtMoney(G.fare); $('fareS').textContent = '승객 수요 ×' + (Math.pow(1500 / G.fare, 0.8) * (1 + 0.08 * G.up.info)).toFixed(2) + ' · 요금을 올리면 건당 수입은 늘지만 승객이 줄어요'; };
    b.querySelectorAll('[data-wd]').forEach(x => x.onclick = () => { const n = +x.dataset.wd; withdraw(n < 0 ? Math.max(0, G.money - 300000) : n); this.renderTab(true); this.refreshTop(); });
    b.querySelectorAll('[data-dep]').forEach(x => x.onclick = () => { deposit(+x.dataset.dep); this.renderTab(true); this.refreshTop(); });
    const wm = b.querySelector('#wMore'); if (wm) wm.onclick = () => this.walletModal('dealer');
    b.querySelectorAll('[data-up]').forEach(x => x.onclick = () => { if (buyUpgrade(x.dataset.up)) this.renderTab(true); });
    b.querySelectorAll('[data-loan]').forEach(x => x.onclick = () => { borrow(+x.dataset.loan); this.renderTab(true); });
    b.querySelectorAll('[data-repay]').forEach(x => x.onclick = () => { repay(+x.dataset.repay); this.renderTab(true); });
  },
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
      this.modal(`<h2>🚌 버스 구매</h2><p class="muted" style="margin:0 0 8px">🅿 차고지 ${G.buses.length}/${garageCap()}대 · 보유 자금 ${fmtMoney(G.money)}</p>` + Object.entries(BUS_TYPES).map(([k, T]) => { const lock = l < T.lvl; return `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${T.name}</b> <small>${T.len}m · ${T.cap}명 · 인건비 ${fmtMoney(T.wage)}/초 · 연료 ${fmtMoney(T.fuel * 1000 * (1 - 0.08 * G.up.fuel))}/km</small></div><button class="btn sm ${k === sel ? 'pri' : ''}" data-t="${k}" ${lock ? 'disabled' : ''}>${lock ? '🔒 Lv.' + T.lvl : fmtMoney(T.price)}</button></div></div>`; }).join('') +
        `<div class="row" style="margin:10px 0"><span>배치 노선</span><select id="mRoute">${G.routes.map(q => `<option value="${q.id}" ${q.id === routeId ? 'selected' : ''}>${q.num} ${esc(q.name)}</option>`).join('')}</select></div>
         <div class="row"><button class="btn pri" id="mBuy" style="flex:1">${BUS_TYPES[sel].name} 구매 (${fmtMoney(BUS_TYPES[sel].price)})</button><button class="btn" id="mX">닫기</button></div>`);
      $('modalBox').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { routeId = +$('mRoute').value; sel = b.dataset.t; draw(); });
      $('mX').onclick = () => this.closeModal();
      $('mBuy').onclick = () => { const bus = addBus(sel, +$('mRoute').value); if (!bus) { toast('자금이 부족해요', 'bad'); return; } sfx('chime'); toast(BUS_TYPES[sel].name + ' 구매 완료!', 'good'); this.closeModal(); this.tab = 'fleet'; this.renderTab(true); };
    }; draw();
  },
  driveBus(b) { if (P.active) return; this.follow = null; startManual(b); },

  notesModal() {
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.floor(m / 60) + '시간 전' : Math.floor(m / 1440) + '일 전'; };
    this.modal(`<h2>🔔 알림 센터</h2><p class="muted" style="margin-top:0">회사 운영 소식을 모아 보여줘요 (최근 40건)</p>${(G.notes || []).length ? G.notes.map(n => `<div class="card" style="padding:7px 12px;margin-bottom:6px"><div class="row" style="justify-content:space-between"><span style="color:${n.kind === 'bad' ? 'var(--bad)' : n.kind === 'good' ? 'var(--ok)' : 'var(--fg)'}">${esc(n.text)}</span><small class="muted" style="flex:none">${ago(n.t)}</small></div></div>`).join('') : '<p class="muted">아직 소식이 없어요</p>'}<div class="row" style="margin-top:10px"><button class="btn" id="nClr">모두 지우기</button><span style="flex:1"></span><button class="btn pri" id="nX">닫기</button></div>`);
    G.unread = 0; this.refreshTop(); $('nX').onclick = () => this.closeModal(); $('nClr').onclick = () => { G.notes = []; this.notesModal(); };
  },
  offlineModal(r, title) {
    const m = Math.round(r.realSec / 60), t = m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분';
    this.modal(`<h2>${title || '🌙 자리를 비운 동안의 운영'}</h2><p class="muted" style="margin-top:0">${t} 동안 회사가 직접 운영됐어요 (효율 ${Math.round((r.eff || 0.6) * 100)}% · 최대 ${r.capH || 6}시간${r.eff && r.eff < 0.9 ? ' · 🧑‍💼 운영 매니저로 올릴 수 있어요' : ''})</p>
      <table class="tbl"><tr><td>운행 수입</td><td>${fmtMoney(r.rev)}</td></tr><tr><td>순이익 (비용·세금 반영)</td><td><b style="color:${r.net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmtMoney(r.net)}</b></td></tr><tr><td>태운 승객</td><td>${r.pax}명</td></tr><tr><td>결산한 날</td><td>${r.days}일</td></tr><tr><td>버스 고장</td><td>${r.breakdowns}회${r.breakdowns ? ' <small class="muted">(정비소 업그레이드로 줄일 수 있어요)</small>' : ''}</td></tr></table>${r.log && r.log.length ? `<div style="margin-top:8px"><b style="font-size:13px">📰 그동안의 소식</b>${r.log.slice(0, 8).map(l => `<div style="font-size:13px;margin-top:3px">${esc(l)}</div>`).join('')}${r.log.length > 8 ? `<small class="muted">…외 ${r.log.length - 8}건 (알림 센터에서 확인)</small>` : ''}</div>` : ''}
      <button class="btn pri" id="offX" style="margin-top:12px;width:100%">확인</button>`); $('offX').onclick = () => this.closeModal();
  },
  bgModal(o) {
    this.modal(`<h2>🏢 자유주행 중 회사 운영 결과</h2><p class="muted" style="margin-top:0">${esc(o.name)}은(는) 당신이 운전하는 동안에도 운영됐어요</p><table class="tbl"><tr><td>운행 수입</td><td>${fmtMoney(o.rev)}</td></tr><tr><td>순이익</td><td><b style="color:${o.net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmtMoney(o.net)}</b></td></tr><tr><td>태운 승객</td><td>${o.pax}명</td></tr><tr><td>결산한 날</td><td>${o.days}일</td></tr></table>${o.log && o.log.length ? `<div style="margin-top:8px">${o.log.slice(0, 6).map(l => `<div style="font-size:13px;margin-top:3px">${esc(l)}</div>`).join('')}</div>` : ''}<button class="btn pri" id="bgX" style="margin-top:12px;width:100%">확인</button>`); $('bgX').onclick = () => this.closeModal();
  },
  // --- 노선 편집기
  openEditor(route) {
    const E = this.edState = { stops: route ? route.stopIds.slice() : [], name: route ? route.name : '노선 ' + (G.nextRoute), color: route ? route.color : ROUTE_COLORS[(G.nextRoute - 1) % ROUTE_COLORS.length], route, path: null, hover: -1 };
    $('editor').classList.remove('hide'); $('edName').value = E.name; this.edReset();
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
  edDraw() { const E = this.edState; if (!E) return; const c = $('mapC'); this.mapT = drawMap(c.getContext('2d'), 760, { routes: G.routes, skip: E.route, dim: .35, edit: { stops: E.stops, color: E.color, path: E.path }, hover: E.hover, crowd: true, view: this.mv, markers: eventMarkers() }); },
  mv: { z: 1, ox: 0, oy: 0 },
  edXY(e) { const c = $('mapC'), r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 760, (e.clientY - r.top) / r.height * 760]; },
  edPointer(e, click) {
    const E = this.edState, [px, py] = this.edXY(e), v = this.mv, mx = (px - v.ox) / v.z, my = (py - v.oy) / v.z, sc = 760 / (2 * EXT + 60);
    let best = -1, bd = 16 / v.z; for (const s of STOPS) { const d = Math.hypot((s.curb.x + EXT + 30) * sc - mx, (s.curb.z + EXT + 30) * sc - my); if (d < bd) { bd = d; best = s.id; } }
    if (click && best >= 0) { const i = E.stops.indexOf(best); if (i >= 0) E.stops.splice(i, 1); else E.stops.push(best); this.edUpdate(); }
    else if (E.hover !== best) { E.hover = best; this.edDraw(); }
  },
  edZoom(f, px, py) { const v = this.mv, z2 = clamp(v.z * f, 0.7, 10); px = px === undefined ? 380 : px; py = py === undefined ? 380 : py; v.ox = px - (px - v.ox) * z2 / v.z; v.oy = py - (py - v.oy) * z2 / v.z; v.z = z2; this.edDraw(); },
  edReset() { this.mv.z = 1; this.mv.ox = this.mv.oy = 0; this.edDraw(); },
  bindMap() {
    const c = $('mapC'), pts = new Map(); let drag = null, lastD = 0;
    c.onpointerdown = e => { pts.set(e.pointerId, [e.clientX, e.clientY]); const [x, y] = this.edXY(e); drag = pts.size === 1 ? { x, y, ox: this.mv.ox, oy: this.mv.oy, moved: false } : null; lastD = 0; c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (lastD) { const r = c.getBoundingClientRect(); this.edZoom(d / lastD, ((a[0] + b[0]) / 2 - r.left) / r.width * 760, ((a[1] + b[1]) / 2 - r.top) / r.height * 760); } lastD = d; return; }
      if (drag && (e.buttons || e.pointerType === 'touch')) { const [x, y] = this.edXY(e); if (Math.hypot(x - drag.x, y - drag.y) > 6) drag.moved = true; if (drag.moved) { this.mv.ox = drag.ox + x - drag.x; this.mv.oy = drag.oy + y - drag.y; this.edDraw(); } } else this.edPointer(e, false);
    };
    c.onpointerup = e => { if (drag && !drag.moved && pts.size === 1) this.edPointer(e, true); pts.delete(e.pointerId); drag = null; lastD = 0; };
    c.onpointercancel = e => { pts.delete(e.pointerId); drag = null; lastD = 0; };
    c.onwheel = e => { e.preventDefault(); const [x, y] = this.edXY(e); this.edZoom(Math.exp(-e.deltaY * 0.0015), x, y); };
    $('mZoomIn').onclick = () => this.edZoom(1.4); $('mZoomOut').onclick = () => this.edZoom(1 / 1.4); $('mReset').onclick = () => this.edReset();
  },

  // --- 지갑 · 자동차 매장 · 내 차고
  dc: {},
  walletModal(tab) {
    tab = tab || this.wtab || 'wallet'; this.wtab = tab;
    const T = [['wallet', '👛 지갑'], ['dealer', '🏬 자동차 매장'], ['garage', '🚗 내 차고 (' + SCHOOL.cars.length + ')']];
    let h = `<div class="row" style="margin-bottom:12px;flex-wrap:wrap">${T.map(([k, n]) => `<button class="btn sm ${k === tab ? 'pri' : ''}" data-wt="${k}">${n}</button>`).join('')}<span style="flex:1"></span><button class="btn sm" id="wClose">닫기</button></div>`;
    if (tab === 'wallet') {
      h += `<h2>👛 내 지갑</h2><div style="font-size:34px;font-weight:800" class="tnum">${fmtMoney(SCHOOL.wallet)}</div><p class="muted">회사 돈과는 별개의 개인 자금이에요. 회사 탭의 '대표 인출'로 회사 자금을 가져오거나(세금 15.4%), 운전교실 합격 보상으로 모을 수 있어요.</p>`;
      if (!G.school) h += `<div class="card"><div class="row" style="justify-content:space-between"><span>🏢 ${esc(G.name)} 자금</span><b class="tnum">${fmtMoney(G.money)}</b></div><div class="acts"><button class="btn sm" data-wd="1000000">100만 인출</button><button class="btn sm" data-wd="5000000">500만</button><button class="btn sm" data-wd="20000000">2천만</button><button class="btn sm" data-wd="-1">가능한 만큼</button><button class="btn sm" data-dep="1000000">100만 투자</button></div></div>`;
      else h += `<div class="card"><small class="muted">경영 모드에서 회사 자금을 인출할 수 있어요. 지금은 운전교실/타이틀이에요.</small></div>`;
    } else if (tab === 'dealer') {
      const brands = Object.keys(BRANDS), cur = this.dealBrand || brands[0], B = BRANDS[cur];
      h += `<h2>🏬 자동차 매장</h2><p class="muted" style="margin:0 0 8px">제조사 전시장 · 신차 기준 대략가 · 내 지갑 ${fmtMoney(SCHOOL.wallet)}</p><div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">${brands.map(k => `<button class="btn sm ${k === cur ? 'pri' : ''}" data-brand="${k}">${k}</button>`).join('')}</div>`;
      h += `<div class="card" style="padding:8px 12px"><b>${cur} 전시장</b> <small class="muted">${B.note}</small><br><small>🏦 ${B.fin} 할부 연 ${(B.apr * 100).toFixed(1)}% · 선수금 10~50% · 36/48/60개월 · 취득세·보험 등 부대비용 별도</small></div>`;
      for (const k in CAR_SPECS) {
        const s = CAR_SPECS[k]; if (s.brand !== cur) continue; const q = carQuote(k, defaultCfg(k), { method: 'cash' }), d = carDerived({ model: k }), ev = ENG_OK[k].includes('ev');
        h += `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${s.name}</b> ${ev ? '⚡' : ''}<br><small>${s.info}<br>트림 ${TRIM_SETS[cur].map(t => t.n).join(' · ')}<br>${ENG_OK[k].map(e => ENG[e].n).join(' / ')} · 최고 ${Math.round(s.vmax * 3.6)}km/h · ${s.len}m</small></div><div style="text-align:right"><small class="muted">기본 트림</small><br><b>${fmtMoney(s.price)}~</b><br><button class="btn sm pri" data-cfg="${k}" style="margin-top:6px">견적 · 구매</button></div></div></div>`;
      }
    } else {
      h += `<h2>🚗 내 차고</h2>`;
      if (!SCHOOL.cars.length) h += `<p class="muted">보유한 자동차가 없어요. 매장에서 구매해 보세요!</p>`;
      for (const c of SCHOOL.cars) {
        const s = CAR_SPECS[c.model], d = carDerived(c), l = c.loan;
        h += `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${d.fullName}</b> <small>${d.engName}</small><br><small>주행 ${(c.km / 1000).toFixed(1)}km · 연식 ${c.age || 0}일 · 중고 시세 ${fmtMoney(carValue(c))}</small><br><small class="muted">옵션: ${[...d.feat].map(f => FEAT_NAME[f] || f).join(', ') || '없음'}</small>${l ? `<br><small style="color:#facc15">💳 할부 잔액 ${fmtMoney(l.bal)} · 월 ${fmtMoney(l.pmt)} · ${l.left}회 남음${l.overdue ? ' · ⚠ 연체 ' + l.overdue + '회' : ''}</small>` : ''}</div><span style="width:22px;height:22px;border-radius:50%;background:${hex(c.color)};border:2px solid #fff4;flex:none"></span></div><div class="acts"><button class="btn sm pri" data-cdrive="${c.id}">🎮 운전하기</button><button class="btn sm bad" data-csell="${c.id}">매각</button></div></div>`;
      }
    }
    this.modal(h); const mb = $('modalBox');
    mb.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => this.walletModal(b.dataset.wt)); $('wClose').onclick = () => { this.closeModal(); if (G.state === 'title') this.showTitle(); else if (G.state === 'company') this.refreshTop(); };
    mb.querySelectorAll('[data-wd]').forEach(x => x.onclick = () => { const n = +x.dataset.wd; withdraw(n < 0 ? Math.max(0, G.money - 300000) : n); this.walletModal(); this.refreshTop(); });
    mb.querySelectorAll('[data-dep]').forEach(x => x.onclick = () => { deposit(+x.dataset.dep); this.walletModal(); this.refreshTop(); });
    mb.querySelectorAll('[data-brand]').forEach(b => b.onclick = () => { this.dealBrand = b.dataset.brand; this.walletModal('dealer'); });
    mb.querySelectorAll('[data-cfg]').forEach(b => b.onclick = () => { this.cc = null; this.carConfigModal(b.dataset.cfg); });
    mb.querySelectorAll('[data-cdrive]').forEach(b => b.onclick = () => { const c = SCHOOL.cars.find(q => q.id === +b.dataset.cdrive); if (P.active) return; this.closeModal(); this.follow = null; initAudio(); startCar(c); });
    mb.querySelectorAll('[data-csell]').forEach(b => b.onclick = () => { const c = SCHOOL.cars.find(q => q.id === +b.dataset.csell); const net = carValue(c) - (c.loan ? Math.round(c.loan.bal) : 0); if (confirm(CAR_SPECS[c.model].name + ' 매각\n중고 시세 ' + fmtMoney(carValue(c)) + (c.loan ? '\n할부 잔액 -' + fmtMoney(c.loan.bal) : '') + '\n정산 ' + fmtMoney(net))) { sellCar(c); this.walletModal('garage'); } });
  },

  // --- 자유주행
  fd: { wx: 'auto', taxi: 0, car: 0, hour: 12, freeze: true, traffic: 60, x: 0, z: 0 },
  freeDriveModal() {
    const f = this.fd; if (f.car !== 0 && !SCHOOL.cars.some(c => c.id === f.car)) f.car = 0;
    const opt = (k, v, t) => `<button class="btn sm ${f[k] === v ? 'pri' : ''}" data-fd="${k}" data-v="${v}">${t}</button>`;
    this.modal(`<h2>🚗 자유주행</h2><p class="muted" style="margin-top:0">규칙 없이 도시를 마음껏 달려요. 점수도, 감점도 없어요.</p>
      <b>차량</b><div class="row" style="flex-wrap:wrap;margin:6px 0 12px"><button class="btn sm ${f.car === 0 ? 'pri' : ''}" data-fd="car" data-v="0">기본 차량 (아반떼)</button>${SCHOOL.cars.map(c => `<button class="btn sm ${f.car === c.id ? 'pri' : ''}" data-fd="car" data-v="${c.id}">${carDerived(c).fullName}</button>`).join('')}</div>
      <b>모드</b><div class="row" style="flex-wrap:wrap;margin:6px 0 12px">${opt('taxi', 0, '🚗 자유주행')}${opt('taxi', 1, '🚕 택시 영업')}<small class="muted">손 흔드는 손님을 태워 원하는 곳까지!</small></div>
      <b>날씨</b><div class="row" style="flex-wrap:wrap;margin:6px 0 12px"><button class="btn sm ${f.wx === 'auto' ? 'pri' : ''}" data-fdw="auto">🎲 자동</button>${Object.entries(WX_T).map(([k, t]) => `<button class="btn sm ${f.wx === k ? 'pri' : ''}" data-fdw="${k}">${t.i} ${t.n}</button>`).join('')}</div>
      <b>시간</b><div class="row" style="flex-wrap:wrap;margin:6px 0 12px">${opt('hour', 7, '🌅 아침')}${opt('hour', 12, '☀ 낮')}${opt('hour', 18, '🌇 저녁')}${opt('hour', 23, '🌙 밤')}<label class="muted" style="font-size:13px"><input type="checkbox" id="fdFreeze" ${f.freeze ? 'checked' : ''}> 시간 고정</label></div>
      <b>교통량</b><div class="row" style="flex-wrap:wrap;margin:6px 0 12px">${opt('traffic', 0, '없음')}${opt('traffic', 24, '적음')}${opt('traffic', 60, '보통')}${opt('traffic', 120, '많음')}</div>
      <b>출발 위치</b> <small class="muted">(지도를 클릭하세요)</small><canvas id="fdMap" width="480" height="480" style="width:100%;max-width:340px;display:block;margin:6px auto 12px;border-radius:10px;cursor:crosshair"></canvas>
      <div class="row"><button class="btn pri" id="fdGo" style="flex:1">🚗 출발!</button><button class="btn" id="fdX">닫기</button></div>`);
    const c = $('fdMap'), ctx = c.getContext('2d'), draw = () => { const t = drawMap(ctx, 480, { mini: true }); const [x, y] = t.M(f.x, f.z); ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = '#ffb020'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke(); };
    draw();
    c.onclick = e => { const r = c.getBoundingClientRect(), sc = 480 / (2 * EXT + 60); f.x = (e.clientX - r.left) / r.width * 480 / sc - EXT - 30; f.z = (e.clientY - r.top) / r.height * 480 / sc - EXT - 30; draw(); };
    $('modalBox').querySelectorAll('[data-fd]').forEach(b => b.onclick = () => { f[b.dataset.fd] = +b.dataset.v; this.freeDriveModal(); });
    $('modalBox').querySelectorAll('[data-fdw]').forEach(b => b.onclick = () => { f.wx = b.dataset.fdw; this.freeDriveModal(); });
    $('fdFreeze').onchange = e => { f.freeze = e.target.checked; };
    $('fdX').onclick = () => this.closeModal();
    $('fdGo').onclick = () => this.startFreeDrive();
  },
  startFreeDrive() {
    const f = this.fd; this.closeModal(); initAudio(); startSchoolWorld();
    bgStart(); for (const c of cars) c.dispose(); cars = []; spawnCars(f.traffic);
    G.hour = f.hour; G.freezeHour = f.freeze; if (f.wx === 'auto') { WX.lock = false; setWeather('clear'); G.wxT = 120; } else { WX.lock = true; setWeather(f.wx); } applyTime(G.hour);
    const car = f.car === 0 ? { id: 0, model: 'avante', color: 0xf4f4f6, km: 0 } : SCHOOL.cars.find(c => c.id === f.car);
    startCar(car, { x: f.x, z: f.z }); if (f.taxi) setTaxi(true); else toast('🚗 자유주행 시작! T: 자율주행 · C: 카메라 · Esc: 메뉴', 'gold');
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
  // --- 견적 · 구매 (제조사 옵션)
  cc: null,
  carConfigModal(key) {
    const s = CAR_SPECS[key], trs = TRIM_SETS[s.brand]; if (!this.cc || this.cc.key !== key) this.cc = { key, trim: 0, eng: ENG_OK[key][0], color: 0, opts: [], method: 'cash', months: 60, down: 0.3 };
    const cc = this.cc, inc = includedFeats(s.brand, cc.trim); cc.opts = cc.opts.filter(k => !inc.has(k));
    const cfg = { trim: cc.trim, eng: cc.eng, opts: cc.opts, color: cc.color }, q = carQuote(key, cfg, cc), d = carDerived({ model: key, cfg }), cf = optFactor(s.price), ok = SCHOOL.wallet >= q.upfront;
    const sec = t => `<div style="margin:12px 0 4px"><b>${t}</b></div>`, btn = (att, on, txt, dis) => `<button class="btn sm ${on ? 'pri' : ''}" ${att} ${dis ? 'disabled' : ''}>${txt}</button>`;
    let h = `<div class="row" style="margin-bottom:6px"><button class="btn sm" id="cBack">← 전시장</button><span style="flex:1"></span><button class="btn sm" id="cX">닫기</button></div><h2 style="margin:4px 0">${s.brand} ${s.name}</h2><small class="muted">${s.info} · ${d.engName} · 최고 ${Math.round(d.vmax * 3.6)}km/h · 0→100km/h ${(27.8 / d.accel * 1.15).toFixed(1)}초 · ${cc.eng === 'ev' ? '전비 ' + KMPL[key] + 'km/kWh' : '연비 약 ' + (KMPL[key] * ENG[cc.eng].kx).toFixed(1) + 'km/L'} (₩${Math.round(d.perKm)}/km)</small>`;
    h += sec('트림') + `<div class="row" style="flex-wrap:wrap;gap:6px">${trs.map((t, i) => btn(`data-ct="${i}"`, i === cc.trim, `${t.n} <small>${i ? '+' + fmtMoney(r1e4(s.price * t.d)) : '기본'}</small>`)).join('')}</div>`;
    h += sec('파워트레인') + `<div class="row" style="flex-wrap:wrap;gap:6px">${ENG_OK[key].map(e => btn(`data-ce="${e}"`, e === cc.eng, `${ENG[e].n} <small>${(s.ev && e === 'ev') || !ENG[e].d ? '' : '+' + fmtMoney(r1e4(s.price * ENG[e].d))}</small>`)).join('')}</div>`;
    h += sec('외장 색상') + `<div class="sw">${s.colors.map((c, i) => `<i data-cl="${i}" style="background:${hex(c)};${c === 0x0b0b0d || c === 0x111827 ? 'border-color:#555' : ''}" class="${i === cc.color ? 'on' : ''}"></i>`).join('')}</div><small class="muted">${cc.color >= 2 ? '프리미엄 컬러 +' + fmtMoney(q.colorD) : '무상 컬러'}</small>`;
    h += sec('옵션 패키지') + OPTS.map(o => { const isInc = inc.has(o.k), on = isInc || cc.opts.includes(o.k); return `<label class="row" style="justify-content:space-between;padding:4px 0;opacity:${isInc ? .6 : 1}"><span><input type="checkbox" data-co="${o.k}" ${on ? 'checked' : ''} ${isInc ? 'disabled' : ''}> ${o.n}<br><small class="muted">${o.e}</small></span><small>${isInc ? '기본 포함' : '+' + fmtMoney(r1e4(o.d * cf))}</small></label>`; }).join('');
    h += sec('결제 방법') + `<div class="row" style="flex-wrap:wrap;gap:6px">${btn('data-pm="cash"', cc.method === 'cash', '일시불')}${btn('data-pm="loan"', cc.method === 'loan', '할부 (' + BRANDS[s.brand].fin + ' 연 ' + (q.apr * 100).toFixed(1) + '%)')}</div>`;
    if (cc.method === 'loan') h += `<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px"><small class="muted">기간</small>${[36, 48, 60].map(m => btn(`data-mo="${m}"`, m === cc.months, m + '개월')).join('')}<small class="muted" style="margin-left:6px">선수금</small>${[0.1, 0.3, 0.5].map(p => btn(`data-dp="${p}"`, p === cc.down, p * 100 + '%')).join('')}</div>`;
    const row = (n, v, c) => `<tr><td>${n}</td><td style="${c || ''}">${v}</td></tr>`;
    h += `<div class="card" style="margin-top:12px"><b>📄 견적서</b><table class="tbl">${row('차량 가격 (옵션 포함)', fmtMoney(q.price))}${q.subsidy ? row('전기차 구매보조금 (국비·광주시)', '-' + fmtMoney(q.subsidy), 'color:#4ade80') : ''}${row('취득세' + (q.tax === 0 ? ' (경차 면제)' : ''), fmtMoney(q.tax))}${row('공채·등록비', fmtMoney(q.reg))}${row('탁송·번호판', fmtMoney(q.deliver))}${row('자동차보험 1년', fmtMoney(q.ins))}${cc.method === 'loan' ? row('선수금 (' + cc.down * 100 + '%)', fmtMoney(q.down)) + row('할부 원금 · 이자 합계', fmtMoney(q.financed) + ' · ' + fmtMoney(q.interest)) + row('월 납부액 (경영 모드 하루마다)', '<b>' + fmtMoney(q.pmt) + '</b> × ' + cc.months + '회') : ''}<tr><td><b>지금 지불할 금액</b></td><td><b style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${fmtMoney(q.upfront)}</b></td></tr></table><small class="muted">내 지갑 ${fmtMoney(SCHOOL.wallet)}${ok ? '' : ' · 부족 ' + fmtMoney(q.upfront - SCHOOL.wallet)}</small></div>`;
    h += `<button class="btn pri" id="cBuy" style="width:100%;margin-top:8px" ${ok ? '' : 'disabled'}>🚗 계약하고 출고</button>`;
    this.modal(h); const mb = $('modalBox'); const redraw = () => { const sc = mb.scrollTop; this.carConfigModal(key); mb.scrollTop = sc; };
    $('cBack').onclick = () => this.walletModal('dealer'); $('cX').onclick = () => this.closeModal();
    mb.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { cc.trim = +b.dataset.ct; redraw(); });
    mb.querySelectorAll('[data-ce]').forEach(b => b.onclick = () => { cc.eng = b.dataset.ce; redraw(); });
    mb.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => { cc.color = +b.dataset.cl; redraw(); });
    mb.querySelectorAll('[data-co]').forEach(b => b.onchange = () => { const k = b.dataset.co, i = cc.opts.indexOf(k); if (i >= 0) cc.opts.splice(i, 1); else cc.opts.push(k); redraw(); });
    mb.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { cc.method = b.dataset.pm; redraw(); });
    mb.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { cc.months = +b.dataset.mo; redraw(); });
    mb.querySelectorAll('[data-dp]').forEach(b => b.onclick = () => { cc.down = +b.dataset.dp; redraw(); });
    $('cBuy').onclick = () => { if (buyCarCfg(key, cfg, cc)) { this.cc = null; this.walletModal('garage'); } };
  },
  // --- 자유주행 일시정지 메뉴
  freePause() {
    const b = P.bus, T = b.spec, school = G.school, opt = (att, on, t) => `<button class="btn sm ${on ? 'pri' : ''}" ${att}>${t}</button>`, d = b.carRef ? carDerived(b.carRef) : null;
    let h = `<h2>⏸ 자유주행</h2><div class="card" style="padding:8px 12px"><b>${esc(T.name)}</b> <small>${T.engName}</small><br><small class="muted">주행 ${(b.carRef.km / 1000).toFixed(1)}km · 이번 연료비 ${fmtMoney(P.fuel)} · 내 지갑 ${fmtMoney(SCHOOL.wallet)}</small><br><small class="muted">옵션: ${[...T.feat].map(f => FEAT_NAME[f] || f).join(', ') || '없음'}</small></div>`;
    h += `<small class="muted">K 크루즈 · V 주행 모드(ECO/NORMAL/SPORT) · T 자율주행(스마트센스) · L 헤드라이트 · C 카메라${T.feat.has('surround') ? '(서라운드뷰 포함)' : ''}</small>`;
    if (school) {
      h += `<div style="margin:10px 0 4px"><b>시간</b></div><div class="row" style="flex-wrap:wrap;gap:6px">${[[7, '🌅 아침'], [12, '☀ 낮'], [18, '🌇 저녁'], [23, '🌙 밤']].map(([v, t]) => opt(`data-fh="${v}"`, Math.abs(G.hour - v) < 3 && G.freezeHour, t)).join('')}<label class="muted" style="font-size:13px"><input type="checkbox" id="fpFlow" ${G.freezeHour ? '' : 'checked'}> 시간 흐름</label></div>`;
      h += `<div style="margin:10px 0 4px"><b>교통량</b></div><div class="row" style="flex-wrap:wrap;gap:6px">${[[0, '없음'], [24, '적음'], [60, '보통'], [120, '많음']].map(([v, t]) => opt(`data-ft="${v}"`, cars.length === v, t)).join('')}</div>`;
    }
    h += `<div style="margin:10px 0 4px"><b>날씨</b></div><div class="row" style="flex-wrap:wrap;gap:6px">${Object.entries(WX_T).map(([k, t]) => opt(`data-wx="${k}"`, WX.type === k, t.i + ' ' + t.n)).join('')}<label class="muted" style="font-size:13px"><input type="checkbox" id="fpWxAuto" ${WX.lock ? '' : 'checked'}> 자동 변화</label></div>`;
    h += `<div style="margin:10px 0 4px"><b>헤드라이트</b></div><div class="row" style="gap:6px">${['자동', '켜기', '끄기'].map((t, i) => opt(`data-fl="${i}"`, P.lights === i, t)).join('')}</div>`;
    h += `<div style="margin:10px 0 4px"><b>택시 영업</b> <small class="muted">${SCHOOL.taxi ? '누적 ' + SCHOOL.taxi.trips + '회 · ' + fmtMoney(SCHOOL.taxi.earn) : ''}</small></div><div class="row" style="gap:6px">${opt('data-tx="1"', !!P.taxi, P.taxi ? '🚕 영업 중 (끄기)' : '🚕 영업 시작')}</div>`;
    h += `<div style="margin:10px 0 4px"><b>위치 이동</b> <small class="muted">(지도를 클릭)</small></div><canvas id="fpMap" width="420" height="420" style="width:100%;max-width:300px;display:block;margin:0 auto;border-radius:10px;cursor:crosshair"></canvas>`;
    h += `<div class="row" style="margin-top:14px"><button class="btn pri" id="pGo" style="flex:1">▶ 계속 달리기</button><button class="btn" id="pMute">${muted ? '🔇' : '🔊'}</button><button class="btn" id="pTouch">📱</button><button class="btn bad" id="pEnd">🚪 나가기</button></div>`;
    this.modal(h); const mb = $('modalBox');
    const c = $('fpMap'), ctx = c.getContext('2d'); const t = drawMap(ctx, 420, { mini: true, player: true });
    c.onclick = e => { const r = c.getBoundingClientRect(), sc = 420 / (2 * EXT + 60), x = (e.clientX - r.left) / r.width * 420 / sc - EXT - 30, z = (e.clientY - r.top) / r.height * 420 / sc - EXT - 30; this.closeModal(); P.paused = false; teleportCar(x, z); };
    mb.querySelectorAll('[data-fh]').forEach(x => x.onclick = () => { G.hour = +x.dataset.fh; applyTime(G.hour); this.freePause(); });
    const fl = $('fpFlow'); if (fl) fl.onchange = () => { G.freezeHour = !fl.checked; };
    mb.querySelectorAll('[data-ft]').forEach(x => x.onclick = () => { for (const q of cars) q.dispose(); cars = []; spawnCars(+x.dataset.ft); this.freePause(); });
    mb.querySelectorAll('[data-tx]').forEach(x => x.onclick = () => { if (P.taxi && P.taxi.ride) { toast('손님이 타고 있어요', 'bad'); return; } setTaxi(!P.taxi); this.freePause(); });
    mb.querySelectorAll('[data-wx]').forEach(x => x.onclick = () => { setWeather(x.dataset.wx); WX.lock = true; this.freePause(); }); { const wa = $('fpWxAuto'); if (wa) wa.onchange = () => { WX.lock = !wa.checked; if (wa.checked) G.wxT = 60; }; }
    mb.querySelectorAll('[data-fl]').forEach(x => x.onclick = () => { P.lights = +x.dataset.fl; this.freePause(); });
    $('pGo').onclick = () => { this.closeModal(); P.paused = false; }; $('pMute').onclick = () => { muted = !muted; this.freePause(); };
    $('pEnd').onclick = () => { this.closeModal(); stopManual(); };
  },
  pauseModal() {
    P.paused = true; if (P.free) return this.freePause(); this.modal(`<h2>⏸ 일시정지</h2><p class="muted">현재 점수 ${Math.round(P.score)}점 · 승차감 ${Math.round(P.comfort)}%</p><div class="row"><button class="btn pri" id="pGo">계속</button><button class="btn" id="pMute">${muted ? '🔇' : '🔊'} 소리</button><button class="btn" id="pTouch">📱</button><button class="btn bad" id="pEnd">${P.free ? '주행 종료' : G.school ? '교습 포기' : '운행 종료'}</button></div>`);
    $('pGo').onclick = () => { this.closeModal(); P.paused = false; }; $('pMute').onclick = () => { muted = !muted; this.pauseModal(); };
    $('pEnd').onclick = () => { this.closeModal(); stopManual(); };
  },

  // --- HUD
  updateHUD() {
    const b = P.bus, T = vt(b), r = P.lesson ? P.lesson.route : routeById(b.routeId), si = P.stopInfo, kmh = Math.round(Math.abs(P.v) * 3.6);
    $('hudL').innerHTML = `<span class="chip" style="background:${hex(r ? r.color : 0xffb020)}">${r ? r.num : ''}</span><b>${r ? esc(r.name) : ''}</b> <small class="muted">${T.name}</small><br>🚏 다음: <b>${si ? esc(si.name) : '-'}</b> <span class="tnum">${si ? Math.max(0, Math.round(si.dist)) + 'm' : ''}</span><br>👥 탑승 <b>${b.pax.length}</b>/${T.cap} · 대기 ${si ? Math.floor(si.waiting) : 0}명${P.lesson ? `<br><small class="muted">${P.lesson.title}</small>` : ''}`;
    if (b.isCar) $('hudL').innerHTML = `🚗 <b>${esc(T.name)}</b><br><small class="muted">${T.engName} · 주행 ${(b.carRef.km / 1000).toFixed(1)}km</small><br><small>⛽ 이번 주행 ${fmtMoney(P.fuel)} · 👛 ${fmtMoney(SCHOOL.wallet)}</small><br><small>🏎 ${MODE_N[P.mode]}${P.cruise ? ' · 🚀 크루즈 ' + Math.round(P.cruise * 3.6) + 'km/h' : ''} · 💡 ${['자동', 'ON', 'OFF'][P.lights]}${T.feat.has('hud') ? ' · HUD' : ''}</small>`;
    if (BG) $('hudL').innerHTML += `<br><small>🏢 ${esc(BG.name)} 운영 중 · 순이익 <b style="color:${BG.live + BG.sum.net >= 0 ? '#4ade80' : '#f87171'}">${BG.live + BG.sum.net >= 0 ? '+' : ''}${fmtMoney(BG.live)}</b></small>`;
    if (P.auto) $('hudL').innerHTML += '<br>🤖 <b style="color:#4ade80">자율주행 중</b>';
    if (G.events && G.events[0]) $('hudL').innerHTML += `<br><small>${G.events[0].def.i} ${G.events[0].name} ${G.events[0].def.n}</small>`;
    if (WX.type !== 'clear') $('hudL').innerHTML += `<br><small>${WX_T[WX.type].i} ${WX_T[WX.type].n}${WX.grip < 0.9 ? ' · <span style="color:#facc15">노면 미끄러움</span>' : ''}${WX.fogK > 0.5 ? ' · 시야 불량' : ''}</small>`;
    $('sgL').classList.toggle('on', !!(P.sigK & 1)); $('sgR').classList.toggle('on', !!(P.sigK & 2));
    $('hudScore').style.display = b.isCar ? 'none' : ''; $('limit').style.display = b.isCar ? 'none' : ''; $('doorTag').style.display = b.isCar ? 'none' : '';
    this.drawGaps(); this.drawTaxi();
    $('hint').textContent = P.hint; if (this.touch && !P.wheelOn && typeof wheelSvg !== 'undefined') wheelSvg.style.transform = 'rotate(' + (-P.steer * WMAX * 180 / Math.PI) + 'deg)';
    $('spd').firstChild.nodeValue = kmh; const gear = P.v < -0.2 ? 'R' : (Math.abs(P.v) < 0.2 ? (keys.Space ? 'P' : 'N') : 'D');
    $('gear').querySelectorAll('b').forEach(x => x.classList.toggle('on', x.textContent === gear)); $('limit').classList.toggle('over', kmh > 52);
    const sc = Math.round(P.score), cf = Math.round(P.comfort);
    $('hudScore').innerHTML = `<small class="muted">운전 점수</small> <b class="tnum" style="float:right">${sc}</b><div class="bar"><i style="width:${sc}%;background:${sc > 80 ? '#4ade80' : sc > 60 ? '#facc15' : '#f87171'}"></i></div><small class="muted">승차감</small> <b class="tnum" style="float:right">${cf}%</b><div class="bar"><i style="width:${cf}%;background:#4ea1ff"></i></div><small class="muted">${G.school ? '교습 중' : b.isCar ? '' : '수입 ' + fmtMoney(b.income)}</small>${!G.school && !b.isCar ? `<br><small>💵 내 급여 <b style="color:#4ade80">+${fmtMoney(P.earn)}</b> · ${fmtMoney(BUS_TYPES[b.type].wage * 60 * 0.967)}/분</small>` : ''}`;
    $('doorTag').textContent = P.doorOpen ? '문 열림' : '문 닫힘'; $('doorTag').classList.toggle('open', P.doorOpen);
    if (P.lesson && P.lesson.id === 'L1') $('tasks').innerHTML = '<b>🎓 과제</b>' + P.lesson.tasks.map(t => `<div class="${P.taskDone[t[0]] ? 'done' : ''}">${P.taskDone[t[0]] ? '✔' : '○'} ${t[1]}</div>`).join('');
    drawMap($('mini').getContext('2d'), 380, { routes: r && !P.lesson ? [r] : [], thin: 1, mini: true, player: true, target: P.stopInfo ? b.agent.path.stops[P.si].id : undefined, markers: (taxiMarkers() || []).concat(eventMarkers()), buses: G.buses.filter(x => x !== b) });
    if (P.lesson && P.lesson.route) { const c = $('mini').getContext('2d'); }
    if (P.si !== this.lastSi) { this.lastSi = P.si; if (si) announce('이번 정류장은 ' + si.name.replace(' 건너편', '') + '입니다'); }
  },
  init() {
    this.initTop();
    $('bNew').onclick = () => { if (loadSaved() && !confirm('저장된 회사가 있어요.\n새로 시작하면 기존 저장이 덮어써집니다. 계속할까요?')) return; initAudio(); startCompany(($('coName').value || '버스 회사').trim()); this.showMgmt(); toast('환영합니다 사장님! 오른쪽에서 노선을 설계해 보세요', 'gold'); };
    $('bCont').onclick = () => {
      initAudio(); const s = loadSaved(); if (!s) return;
      try { startCompany(s.name, s); this.showMgmt(); if (!G.migrated && G.offlineReport) this.offlineModal(G.offlineReport); if (G.migrated) this.modal(`<h2>🗺 지도가 확장됐어요</h2><p class="muted">광주 지도가 새로 커져서 이전 노선과 버스는 정리했어요. 보유 버스·노선 비용은 환불(<b>${fmtMoney(G.migrated.refund)}</b>)해 드렸고, 자금·레벨·업그레이드·목표는 그대로예요. 시범 노선과 버스 1대를 드렸으니 새 노선을 설계해 보세요!</p><button class="btn pri" id="mgX">확인</button>`), $('mgX').onclick = () => this.closeModal(); }
      catch (e) { console.error(e); toast('저장 데이터를 읽을 수 없어 새 회사로 시작해요', 'bad'); startCompany('광주 시티버스'); this.showMgmt(); }
    };
    $('bSchool').onclick = () => { initAudio(); this.schoolModal(); };
    $('exitBtn').onclick = () => { if (P.active && !P.paused) this.pauseModal(); };
    $('bFree').onclick = () => { initAudio(); this.freeDriveModal(); };
    $('bCar').onclick = () => { initAudio(); this.walletModal('wallet'); };
    $('bHelp').onclick = () => $('help').classList.toggle('hide');
    addEventListener('pointerdown', () => { UI.down = true; }, true); addEventListener('pointerup', () => { UI.down = false; }, true); addEventListener('pointercancel', () => { UI.down = false; }, true);
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.renderTab(true); });
    this.bindMap();
    let tk = 0; setInterval(() => { if (G && G.state === 'company') { this.refreshTop(); this.liveTick(); if (++tk % 4 === 0) this.renderTab(false); } }, 300);
  }
};
