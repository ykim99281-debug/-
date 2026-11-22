// 홍보 그림(링크 미리보기 1200x630, 정사각형 1080x1080)을 만들어요.
// 사용법: node scripts/make-promo.js   → promo/ 폴더에 JPG 저장
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'promo');
fs.mkdirSync(outDir, { recursive: true });
const art = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'rpg-art-hero.jpg')).toString('base64'); // setContent 에서는 파일 주소를 못 읽어서 그림을 직접 넣어요
const URL_TEXT = 'ykim99281-debug.github.io/-/rpg-home.html';

const GAMES = [
  { id: 'home', name: '공명 연대기', sub: '네 가지 이야기, 하나의 모험', tags: ['무료', '설치 없이 바로 플레이', '친구와 함께'], emoji: '✨', hue: '0deg', c1: '#7c3aed', c2: '#0ea5e9',
    chips: [['⚔️', '별빛'], ['📖', '하길'], ['🏗️', '건축'], ['🧸', '어린이']] },
  { id: 'byeolbit', name: '별빛 공명 연대기', sub: '꺼진 별을 다시 켜는 공명의 여정', tags: ['액션 RPG', '영웅 30명', '이야기 14장'], emoji: '⚔️', hue: '0deg', c1: '#7c3aed', c2: '#4c1d95' },
  { id: 'hagil', name: '하길 공명 연대기', sub: '성경 속 인물과 함께 걷는 믿음의 모험', tags: ['성경 인물 30명', '성경 퀴즈', '주간 순위'], emoji: '📖', hue: '-35deg', c1: '#f59e0b', c2: '#b45309' },
  { id: 'gunchuk', name: '건축 공명 연대기', sub: '무너지는 세계를 다시 짓는 건축가들', tags: ['건축가 30명', '건축 퀴즈', '이야기 14장'], emoji: '🏗️', hue: '150deg', c1: '#0ea5e9', c2: '#0369a1' },
  { id: 'kids', name: '어린이 공명 연대기', sub: '심술 구름을 달래 주는 귀여운 친구들의 모험', tags: ['쉬운 게임', '채팅 없는 안전한 놀이', '쉬운 퀴즈'], emoji: '🧸', hue: '290deg', c1: '#ec4899', c2: '#be185d', light: true, deco: ['🐻', '🐿️', '🐳', '☁️', '🌈', '⭐', '🐰', '🐧'] },
];

function html(g, w, h) {
  const sq = w === h, big = sq ? 96 : 76;
  const decoHtml = g.deco ? g.deco.map((e, i) => `<span class="dc" style="left:${(i * 137 + 40) % (w - 140)}px;top:${(i * 83 + 30) % Math.round(h * 0.5)}px;font-size:${70 + (i % 3) * 26}px;transform:rotate(${(i % 2 ? 1 : -1) * (8 + i * 3)}deg)">${e}</span>`).join('') : '';
  const chips = g.chips ? `<div class="chips">${g.chips.map(([e, n]) => `<span>${e}<b>${n}</b></span>`).join('')}</div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:'WenQuanYi Zen Hei','Noto Sans CJK KR',sans-serif;color:#fff;position:relative;background:#0b0f1a}
.bg{position:absolute;inset:0;${g.light ? 'background:linear-gradient(160deg,#fde68a,#fbcfe8 45%,#bae6fd)' : `background:url(\'${art}\') center/cover;filter:hue-rotate(${g.hue}) saturate(1.15) brightness(.95)`}}
.dc{position:absolute;opacity:.9}
.shade{position:absolute;inset:0;background:${g.light ? 'linear-gradient(180deg,rgba(255,255,255,0) 30%,rgba(131,24,67,.55) 100%)' : 'linear-gradient(180deg,rgba(5,3,15,.25) 0%,rgba(5,3,15,.55) 45%,rgba(5,3,15,.92) 100%)'}}
.box{position:absolute;left:${sq ? 70 : 64}px;right:${sq ? 70 : 64}px;bottom:${sq ? 80 : 50}px}
.emoji{font-size:${sq ? 120 : 84}px;line-height:1;margin-bottom:10px}
h1{margin:0;font-size:${big}px;line-height:1.12;text-shadow:0 4px 24px #000;letter-spacing:-1px}
.sub{margin:14px 0 22px;font-size:${sq ? 38 : 30}px;color:${g.light ? '#fff' : '#e9d5ff'};text-shadow:0 2px 12px #000}
.tags{display:flex;gap:12px;flex-wrap:wrap}.tags span{padding:8px 20px;border-radius:999px;font-size:${sq ? 28 : 24}px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3)}
.chips{display:flex;gap:14px;margin:0 0 22px}.chips span{padding:10px 22px;border-radius:16px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);font-size:${sq ? 36 : 30}px}.chips b{margin-left:8px}
.foot{margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:${sq ? 26 : 22}px;color:#cbd5e1}
.go{padding:10px 26px;border-radius:999px;font-weight:900;background:linear-gradient(180deg,${g.c1},${g.c2});color:#fff;font-size:${sq ? 32 : 26}px;box-shadow:0 6px 20px rgba(0,0,0,.5)}
</style></head><body><div class="bg"></div>${decoHtml}<div class="shade"></div>
<div class="box"><div class="emoji">${g.emoji}</div><h1>${g.name}</h1><div class="sub">${g.sub}</div>${chips}
<div class="tags">${g.tags.map(t => `<span>${t}</span>`).join('')}</div>
<div class="foot"><span>${URL_TEXT}</span><span class="go">▶ 지금 시작</span></div></div></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  for (const g of GAMES) {
    for (const [kind, w, h] of [['og', 1200, 630], ['sq', 1080, 1080]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.setContent(html(g, w, h));
      await p.waitForTimeout(300);
      const file = path.join(outDir, kind + '-' + g.id + '.jpg');
      await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
      await p.close();
      console.log('만들었어요:', path.relative(root, file), Math.round(fs.statSync(file).size / 1024) + 'KB');
    }
  }
  await b.close();
})();
