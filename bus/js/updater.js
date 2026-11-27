'use strict';
// 업데이트 확인 · 변경 내역 · 오프라인(PWA) 등록 · 앱 설치
const Updater = {
  latest: null, installEv: null, reg: null,
  cmp(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; },
  async check(manual) {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('http ' + r.status); const j = await r.json(); this.latest = j;
      if (this.cmp(j.version, BUS_VERSION) > 0) { this.banner(j); if (manual) this.changelogModal(true); }
      else if (manual) toast('✅ 최신 버전이에요 (v' + BUS_VERSION + ')', 'good');
      return j;
    } catch (e) { if (manual) toast('업데이트를 확인할 수 없어요 (오프라인일 수 있어요)', 'bad'); return null; }
  },
  banner(j) {
    let el = $('updBar'); if (!el) { el = document.createElement('div'); el.id = 'updBar'; document.body.appendChild(el); }
    el.innerHTML = `🔄 새 버전 <b>v${esc(j.version)}</b>이(가) 나왔어요 <button class="btn sm pri" id="updGo">지금 업데이트</button> <button class="btn sm" id="updLog">변경 내역</button> <button class="btn sm" id="updX">✕</button>`;
    el.classList.remove('hide'); $('updGo').onclick = () => this.apply(); $('updLog').onclick = () => this.changelogModal(true); $('updX').onclick = () => el.classList.add('hide');
  },
  async apply() {
    try { if (typeof G !== 'undefined' && G && !G.school) saveCompany(); if (typeof BG !== 'undefined' && BG) bgFlush(false); } catch (e) { }
    try { const r = this.reg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration()); if (r) await r.update(); } catch (e) { }
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('bus-tycoon-')).map(k => caches.delete(k))); } } catch (e) { }
    location.reload();
  },
  changelogModal(showLatest) {
    const j = this.latest || { version: BUS_VERSION, changes: [] }, list = (j.changes || []).slice(0, 6);
    UI.modal(`<h2>📝 변경 내역</h2><p class="muted" style="margin-top:0">현재 v${BUS_VERSION} (${BUS_BUILD})${this.latest && this.cmp(this.latest.version, BUS_VERSION) > 0 ? ' · 새 버전 v' + esc(this.latest.version) + ' 사용 가능' : ' · 최신'}</p>
      ${list.length ? list.map(c => `<div class="card"><b>v${esc(c.v)}</b> <small class="muted">${esc(c.date)}</small><ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.7">${(c.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('') : '<p class="muted">변경 내역을 불러오지 못했어요</p>'}
      <div class="row" style="margin-top:10px">${this.latest && this.cmp(this.latest.version, BUS_VERSION) > 0 ? '<button class="btn pri" id="clUp">지금 업데이트</button>' : '<button class="btn" id="clChk">업데이트 확인</button>'}<span style="flex:1"></span><button class="btn" id="clX">닫기</button></div>`);
    $('clX').onclick = () => UI.closeModal(); const u = $('clUp'); if (u) u.onclick = () => this.apply(); const c = $('clChk'); if (c) c.onclick = () => { UI.closeModal(); this.check(true); };
  },
  async init() {
    const v = $('verTxt'); if (v) v.textContent = 'v' + BUS_VERSION; const on = () => { const t = $('offTag'); if (t) t.classList.toggle('hide', navigator.onLine); };
    on(); addEventListener('online', () => { on(); toast('🌐 인터넷에 연결됐어요'); this.check(false); }); addEventListener('offline', () => { on(); toast('📴 오프라인 모드예요 · 저장과 운영은 계속돼요'); });
    const c = $('verCheck'), l = $('verLog'), i = $('installBtn'); if (c) c.onclick = () => this.check(true); if (l) l.onclick = () => { this.changelogModal(); this.check(false); };
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installEv = e; if (i) i.classList.remove('hide'); });
    addEventListener('appinstalled', () => { this.installEv = null; if (i) i.classList.add('hide'); toast('📲 앱이 설치됐어요!', 'good'); });
    if (i) i.onclick = async () => { if (!this.installEv) return; this.installEv.prompt(); try { await this.installEv.userChoice; } catch (e) { } this.installEv = null; i.classList.add('hide'); };
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      try {
        this.reg = await navigator.serviceWorker.register('sw.js');
        this.reg.addEventListener('updatefound', () => { const w = this.reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) this.check(false); }); });
      } catch (e) { /* 일부 환경에서는 서비스 워커를 쓸 수 없어요 */ }
    }
    setTimeout(() => this.check(false), 3000); setInterval(() => this.check(false), 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(false); });
  }
};
Updater.init();
