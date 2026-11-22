// 어린이 공명 연대기 판을 만들어요. (쉬운 난이도 + 어린이 안전: 채팅·대인전 숨김)
// 사용법:  node scripts/make-kids.js [원본 html] [만들 kids.html]
//   (인자를 생략하면 scripts/base/rpg-2.4.0.html → kids.html)
const fs = require('fs');
const path = require('path');
const [src = path.join(__dirname, 'base', 'rpg-2.4.0.html'), out = path.join(__dirname, '..', 'kids.html')] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');

function rep(a, b, expect) {
  const n = s.split(a).length - 1;
  if (n < 1 || (expect && n !== expect)) throw new Error('찾지 못했거나 개수가 달라요(' + n + '개): ' + a.slice(0, 70));
  s = s.split(a).join(b);
}

// 1) 이름
rep('<title>별빛 공명 연대기</title>', '<title>어린이 공명 연대기</title>');
rep('꺼진 별을 다시 켜는 공명의 여정', '마음 반짝이를 다시 켜는 친구들의 여정');
rep('별빛 공명 연대기', '어린이 공명 연대기');
// 2) 쉬운 퀴즈와 이야기
rep('<script src="rpg-quiz.js?v=2.4.0"></script>', '<script src="kids-quiz.js?v=1"></script>');
rep('<script src="rpg-story.js?v=2.3.0"></script>', '<script src="kids-story.js?v=1"></script>');
// 3) 데이터는 어린이 전용 위치(kids/)에 저장
rep("function dbRef(p){return db.ref('anime/'+p)}", "function dbRef(p){return db.ref('kids/'+p)}", 1);
// 4) 로그인 계정은 다른 판과 완전히 별개
rep("cyrb128('anime-rpg:'+n)", "cyrb128('kids-rpg:'+n)", 1);
rep("+'@anime-rpg.local'", "+'@kids-rpg.local'", 1);
// 5) 로그인 세션도 따로
rep("if(!firebase.apps.length)fbApp=firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);else fbApp=firebase.app();\n    db=firebase.database();auth=firebase.auth();",
    "fbApp=firebase.apps.find(a=>a.name==='kids')||firebase.initializeApp(DEFAULT_FIREBASE_CONFIG,'kids');\n    db=firebase.database(fbApp);auth=firebase.auth(fbApp);", 1);
rep("firebase.app().functions(FUNCTIONS_REGION)", "firebase.app('kids').functions(FUNCTIONS_REGION)", 1);
// 6) 브라우저 저장소 이름표도 따로
for (const k of ['rpgSave_', 'rpgCharImg_', 'rpgInvite_', 'rpgTradeInvite_', 'rpgTradeRoom_', 'rpgFriendMail_', 'bgPrologueSeen', 'bgChap_']) {
  if (s.includes(k)) s = s.split(k).join(k.replace(/^(rpg|bg)/, 'kd'));
}
// 7) 앱 설치(PWA)·공유 미리보기는 별빛 판 전용이라 빼요
s = s.replace(/<link rel="manifest"[^>]*>\n?/, '').replace(/<meta property="og:[^>]*>\n?/g, '');
s = s.replace(/\nif\('serviceWorker' in navigator[^\n]*\n/, '\n');
// 8) 서버 모드는 별빛 판만 지원 + 어린이 안전: 채팅을 쓸 수 없고, 대인전(PvP)·순위표는 숨겨요
const tail = 'norm();renderAll();setTimeout(()=>{let pc=$("photoChar")';
rep(tail, `SERVER=function(){return false};
adminServerModeOn=function(){alert("어린이 판에서는 서버 모드를 지원하지 않아요.")};
adminSetServerUrl=function(){alert("어린이 판에서는 서버 주소를 쓰지 않아요.")};
/* ---- 어린이 안전: 모르는 사람과 글을 주고받는 채팅, 낯선 사람과 겨루는 대인전·순위표는 숨겨요 ---- */
sendChat=function(){alert('어린이 공명 연대기에서는 안전을 위해 채팅을 쓸 수 없어요 🙂')};
setTimeout(()=>{
  const hide=e=>{if(e)e.classList.add('kidHide')};
  hide(document.querySelector('.chatBox'));
  const pr=$('pvpRoomName');hide(pr&&(pr.closest('.pvp')||pr.closest('.box')));
  hide($('rankingBox'));
},0);
` + tail, 1);
rep(".adminTile.adminHide{display:none!important}", ".adminTile.adminHide{display:none!important}\n.kidHide{display:none!important}", 1);
rep("<div class=\"small\">점검 중에는", "<div class=\"small\">(어린이 판은 서버 모드를 지원하지 않아요) 점검 중에는", 1);

// 9) 쉬운 난이도: 몬스터 체력·공격·속도를 낮춰요
rep('let eh=(650+stage*260+Math.floor(stage/3)*180)*mult;', 'let eh=(650+stage*260+Math.floor(stage/3)*180)*mult*.55;', 1);
rep('atk:(26+stage*9)*mult,spd:1.45+stage*.16,', 'atk:(26+stage*9)*mult*.35,spd:(1.45+stage*.16)*.8,', 1);
rep('let eh=(900+diff*420)*(boss?2.2:1.35);', 'let eh=(900+diff*420)*(boss?2.2:1.35)*.55;', 1);
rep('atk:(35+diff*13)*(boss?1.65:1.2),spd:1.55+diff*.025,', 'atk:(35+diff*13)*(boss?1.65:1.2)*.35,spd:(1.55+diff*.025)*.8,', 1);
rep('let max=Math.floor((780+st*320+Math.floor(st/3)*220)*mult);', 'let max=Math.floor((780+st*320+Math.floor(st/3)*220)*mult*.55);', 1);

// ===================================================================
// 어린이 테마: 귀여운 친구들, 심술 구름과 투정이들
// ===================================================================
// 1) 지역(월드맵)
for (const [a, b] of [
  ['새벽별 언덕 입구', '아침 햇살 동산'], ['거미줄 협곡', '도토리 숲길'], ['등불 항구도시', '말랑 젤리 호수'], ['북소리 저택', '솜사탕 구름 마을'],
  ['별빛 급행열차', '무지개 시냇물'], ['홍등 불야성', '장난감 마을'], ['대장장이 마을', '쿠키 공방'], ['공허 성채', '심술 구름 성'],
  ['각성자 학원', '반짝 학교'], ['네온 구역', '반짝 시장'], ['순환 결계', '잠꾸러기 안개 숲'], ['공허 군주 레이드', '큰 심술 구름 레이드'],
  ['카오스의 성역', '보름달 언덕'], ['오블리비온 최종전', '마음 반짝이 최종전'],
  ['거미 공허체 지역', '도토리 친구 지역'], ['북의 공허 고수 지역', '투덜이 지역'], ['꿈 공허체 보스 지역', '잠꾸러기 보스 지역'],
  ['공허 6좌 지역', '심술 대장 지역'], ['공허 군주 집결 지역', '심술 구름 모임 지역'], ['각성자 시작 지역', '친구들 모임 지역'],
  ['각성자 대형 전투 지역', '시장 대모험 지역'], ['고난도 술식 지역', '어려운 모험 지역'], ['공허 군주 보스 레이드', '큰 심술 구름 보스'],
  ['최상위 각성자 보스', '보름달 지킴이 보스'],
]) rep(a, b);
rep('place.name.includes("오블리비온") || place.name.includes("카오스") || place.name.includes("레이드")', 'place.name.includes("최종전") || place.name.includes("보름달") || place.name.includes("레이드")', 1);
for (const [n, e] of [['아침 햇살 동산', '🌅'], ['도토리 숲길', '🌳'], ['말랑 젤리 호수', '🏞️'], ['솜사탕 구름 마을', '☁️'], ['무지개 시냇물', '🌈'], ['장난감 마을', '🧸'], ['쿠키 공방', '🍪'],
  ['심술 구름 성', '⛈️'], ['반짝 학교', '🏫'], ['반짝 시장', '🎪'], ['잠꾸러기 안개 숲', '🌫️'], ['큰 심술 구름 레이드', '🌩️'], ['보름달 언덕', '🌕'], ['마음 반짝이 최종전', '💖']]) {
  const re = new RegExp('(\\{name:"' + n + '",[^}]*?emoji:")[^"]*(")');
  if (!re.test(s)) throw new Error('지역 줄을 못 찾았어요: ' + n);
  s = s.replace(re, '$1' + e + '$2');
}

// 2) 보스(투정이들)
const demons = '[["투덜 구름","☁️","#14532d"],["심술 쿠키","🍪","#7c2d12"],["게으름 달팽이","🐌","#64748b"],["겁쟁이 안개","🌫️","#7e22ce"],["욕심쟁이 두더지","🐭","#166534"],["뻥쟁이 여우","🦊","#0891b2"],["샘쟁이 고양이","😾","#a16207"],["떼쟁이 아기 공룡","🦖","#dc2626"],["얼음 심술","❄️","#38bdf8"],["늦잠 곰","🐻","#9333ea"],["큰 심술 구름","⛈️","#7f1d1d"],["먹보 용","🐲","#dc2626"],["잔소리 앵무새","🦜","#38bdf8"],["깜깜 그림자","🌑","#6d28d9"],["울보 괴물","👾","#b91c1c"],["슬픈 소나기","🌧️","#ea580c"]]';
{
  const before = s.length;
  s = s.replace(/const demons=\[.*?\];/, 'const demons=' + demons + ';');
  if (s.length === before) throw new Error('보스 목록을 못 찾았어요');
}

// 3) 장비 이름
rep('기사단 갑옷', '포근 망토'); rep('공허 사냥꾼 세트', '반짝 요술 세트');

// 4) 캐릭터: [기존 이름, 새 이름, 진영, 속성(표시), 기술2개, 그림]
const C = [
  ['하루 세이렌', '토리', '숲친구', '물/태양', ['포근 안아주기', '햇살 반짝'], '🐻'],
  ['라이언 볼트', '쫑이', '숲친구', '번개', ['도토리 던지기', '찌릿 꼬리'], '🐿️'],
  ['가루 브루트', '콩이', '숲친구', '짐승', ['멍멍 박치기', '꼬리 흔들기'], '🐶'],
  ['미라 에코', '몽실', '숲친구', '물', ['몽글 물방울', '폴짝 점프'], '🐰'],
  ['플로라 벨', '뭉치', '숲친구', '꽃', ['꽃잎 방패', '동글동글 구르기'], '🦔'],
  ['카이 아쿠아', '파랑', '바다친구', '물', ['파도 타기', '분수 뿜기'], '🐳'],
  ['솔 이그니스', '꼬물', '바다친구', '안개', ['먹물 안개', '여덟 팔 안아주기'], '🐙'],
  ['나비아 실크', '하양', '바다친구', '바람', ['눈썰매 슝', '뒤뚱뒤뚱 춤'], '🐧'],
  ['에이든 바르도', '반짝', '바다친구', '화염', ['별빛 반짝', '다섯 손가락 박수'], '⭐'],
  ['미스트 루벤', '말랑', '바다친구', '번개', ['말랑 젤리 방패', '찌릿 촉수'], '🪼'],
  ['로제 하트', '보글', '바다친구', '바위', ['단단 등껍질', '느릿느릿 한 걸음'], '🐢'],
  ['윈드 칼리스', '동실', '바다친구', '소리', ['꽥꽥 노래', '동동 떠다니기'], '🦆'],
  ['그란 록하트', '철썩', '바다친구', '물', ['철썩 박수', '공 굴리기'], '🦭'],
  ['세르펜 이오', '쪼롱', '바다친구', '짐승', ['집게 콕콕', '옆으로 옆으로'], '🦀'],
  ['루비아 엠버', '뭉게', '하늘친구', '반짝', ['뭉게뭉게 감싸기', '포근 비구름'], '☁️'],
  ['그라스 타이탄', '반딧', '하늘친구', '용기', ['반딧불 길잡이', '깜깜한 밤 밝히기'], '✨'],
  ['프로스트 모르가', '포롱', '하늘친구', '웃음', ['지저귀는 노래', '포롱포롱 날기'], '🐦'],
  ['루나 녹티스', '아롱', '하늘친구', '꿈', ['무지개 다리', '일곱 빛깔 춤'], '🌈'],
  ['오블리비온', '별이', '하늘친구', '반짝', ['반짝반짝 소원', '별똥별 달리기'], '🌟'],
  ['토라 브레이커', '하늘이', '마을친구', '친절', ['친절한 인사', '따뜻한 손잡기'], '👧'],
  ['아스트라 인피니', '나래', '마을친구', '나눔', ['나누면 두 배', '사이좋게 반으로'], '🧒'],
  ['카오스 렉스', '보람', '마을친구', '정직', ['솔직하게 말하기', '용기 있는 사과'], '👦'],
  ['리온 에리스', '다솜', '마을친구', '배려', ['먼저 양보하기', '곁에서 도와주기'], '🧑'],
  ['네로 쉐도우', '한결', '마을친구', '인내', ['끝까지 해 보기', '천천히 차근차근'], '👶'],
  ['레오 칼라일', '이슬', '마을친구', '감사', ['고마워요 한 마디', '웃는 얼굴'], '👩'],
  ['모르페우스', '소담', '마을친구', '평화', ['화해의 악수', '마음 가라앉히기'], '🧒'],
  ['레이나 블래스트', '솜사탕 요정', '꿈요정', '희귀', ['달콤한 향기', '구름 사탕 뿌리기'], '🍭'],
  ['잭 리볼버', '별사탕 요정', '꿈요정', '희귀', ['별사탕 반짝', '소원 빌기'], '🍬'],
  ['카투스 가시', '무지개 요정', '꿈요정', '희귀', ['일곱 빛깔 날개', '무지개 활짝'], '🧚'],
  ['카멜레 쉐이드', '달빛 요정', '꿈요정', '희귀', ['포근한 달빛', '무서운 밤 안아주기'], '🌙'],
];
const multi = C.filter(c => c[0].includes(' '));
for (const [o, n] of multi) { if (!s.includes(o)) throw new Error('이름을 못 찾았어요: ' + o); s = s.split(o).join(n); }
for (const [o, n] of C.filter(c => !c[0].includes(' '))) { rep('name:"' + o + '"', 'name:"' + n + '"', 1); }
for (const [, n, side, br, sk, em] of C) {
  const re = new RegExp('(\\{name:"' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",)side:"[^"]*",emoji:"[^"]*",breath:"[^"]*"(.*?)skill:\\[[^\\]]*\\]');
  const m = s.match(re); if (!m) throw new Error('캐릭터 줄을 못 찾았어요: ' + n);
  s = s.replace(re, m[1] + 'side:"' + side + '",emoji:"' + em + '",breath:"' + br + '"' + m[2] + 'skill:[' + sk.map(x => '"' + x + '"').join(',') + ']');
}
// 4-3) 코드 속 이름 판별 글자(특수 연출·그림 모양) → 새 이름
for (const [a, b] of [['아스트라', '나래'], ['카오스', '보람'], ['토라', '하늘이'], ['이그니스', '꼬물'], ['세이렌', '토리'], ['엠버', '뭉게'],
  ['볼트', '쫑이'], ['브루트', '콩이'], ['실크', '하양'], ['오블리비온', '마음반짝이'], ['블래스트', '솜사탕 요정'], ['리볼버', '별사탕 요정'], ['가시', '무지개 요정'], ['쉐이드', '달빛 요정']]) {
  s = s.split(a).join(b);
}
// 5) 진영 이름
for (const [a, b] of [['공허군', '하늘친구'], ['각성자', '마을친구'], ['용병단', '꿈요정'], ['수호좌', '바다친구'], ['기사단', '숲친구']]) s = s.split(a).join(b);
// 6) 용어
for (const [a, b] of [['일반 공허체', '일반 투정이'], ['공허체', '투정이']]) s = s.split(a).join(b);
s = s.split('"공허술"]').join('"반짝"]').split('하늘친구 공허술').join('하늘친구 반짝');
// 7) 그림 색 표의 속성 이름
for (const [a, b] of [
  ['"공허술":["#991b1b","#fb7185","虛"]', '"반짝":["#f59e0b","#fde68a","★"]'],
  ['"파쇄술":["#ef4444","#111827","破"]', '"용기":["#f97316","#fdba74","勇"]'],
  ['"빙결 공허술":["#bae6fd","#0284c7","冰"]', '"웃음":["#fde047","#f9a8d4","笑"]'],
  ['"달/공허술":["#7e22ce","#c084fc","月"]', '"꿈":["#8b5cf6","#f0abfc","夢"]'],
  ['"마력":["#ef4444","#111827","魔"]', '"친절":["#f472b6","#fbcfe8","親"]'],
  ['"무한":["#38bdf8","#7e22ce","∞"]', '"나눔":["#34d399","#a7f3d0","分"]'],
  ['"혼돈":["#dc2626","#020617","斬"]', '"정직":["#60a5fa","#bfdbfe","直"]'],
  ['"수호령":["#a78bfa","#111827","靈"]', '"배려":["#fb923c","#fed7aa","配"]'],
  ['"그림자 소환":["#475569","#0f172a","影"]', '"인내":["#4ade80","#bbf7d0","耐"]'],
  ['"황금비":["#fbbf24","#78350f","金"]', '"감사":["#facc15","#fef9c3","感"]'],
  ['"영혼 지배":["#7c3aed","#111827","魂"]', '"평화":["#38bdf8","#e0f2fe","和"]'],
]) rep(a, b);
// 8) 연출 문구
for (const [a, b] of [['星界解放', '반짝 해방'], ['魔力解放', '마음 해방'], ['虛術', '반짝'], ['無限星界', '나눔'], ['混沌聖域', '정직'], ['무한 성계', '나눔의 마법'], ['혼돈 성역', '정직의 마법'],
  ['👹 처치 보너스 퀴즈', '🧸 처치 보너스 쉬운 퀴즈']]) { if (s.includes(a)) s = s.split(a).join(b); }

// 8-1) 예전 이름 이전표는 새 게임이라 비워요
{
  if (!/const OLD_TO_NEW=\{[^}]*\};/.test(s)) throw new Error('이전표(OLD_TO_NEW)를 못 찾았어요');
  s = s.replace(/const OLD_TO_NEW=\{[^}]*\};/, 'const OLD_TO_NEW={};');
}

// 8-2) 어린이 판은 보호자와 함께 읽고 동의해야 가입할 수 있어요
rep('이용약관과 개인정보처리방침에 동의합니다. (만 14세 미만은 보호자 동의가 필요해요)', '보호자(법정대리인)와 함께 이용약관과 개인정보처리방침을 읽고 동의합니다. (만 14세 미만은 보호자 동의가 꼭 필요해요)', 1);
rep("alert('이용약관과 개인정보처리방침에 동의해야 가입할 수 있어요.')", "alert('보호자와 함께 이용약관과 개인정보처리방침을 읽고 동의해야 가입할 수 있어요.')", 1);

// 9) 공통 패치: 내 계정 점검 + 프리미엄 + PvP 방 목록 + 이야기 다시 보기 + 같이 하기
s = require('./common-patches').apply(s, { version: '1.2.0', build: 120, root: 'kids',
  og: { title: '어린이 공명 연대기', desc: '심술 구름을 달래 주는 귀여운 친구들의 쉬운 모험. 채팅 없는 안전한 놀이, 쉬운 퀴즈. 무료!', image: 'https://ykim99281-debug.github.io/-/promo/og-kids.jpg', url: 'https://ykim99281-debug.github.io/-/kids.html' },
  titles: [['🌱 개척자', '🌱 첫 친구'], ['💎 후원자', '💖 마음 후원자'], ['✨ 별빛 수호자', '✨ 반짝 수호자'], ['🏅 베테랑', '🏅 척척박사']] });

// 10) 어린이용: 무서운 느낌의 그림 글자는 부드럽게
s = s.split('👹 「').join('💬 「');

fs.writeFileSync(out, s);
console.log('만들었어요:', out, Math.round(s.length / 1024) + 'KB');
